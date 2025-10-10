import { supabase, SupabaseWorkerHelpers, NotificationInsert } from '../lib/supabase';
import pino from 'pino';
import { WhatsAppClient } from '../whatsapp/client';
import { MessageFormatter } from './message-formatter';
import { sleep } from './utils';

const logger = pino({ name: 'notification-service' });

export interface NotificationServiceConfig {
  whatsappClient: WhatsAppClient | null;
  pairId: string;
  processInterval?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number;
}

export class NotificationService {
  private whatsappClient: WhatsAppClient | null;
  private pairId: string;
  private formatter: MessageFormatter;
  private isRunning = false;
  private processInterval: number;
  private maxRetries: number;
  private retryDelay: number;
  private maxRetryDelay: number;

  constructor(config: NotificationServiceConfig) {
    this.whatsappClient = config.whatsappClient;
    this.pairId = config.pairId;
    this.formatter = new MessageFormatter();
    this.processInterval = config.processInterval || 5000; // Default 5 seconds
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // base delay 1s
    this.maxRetryDelay = 30000; // cap at 30s
  }

  /**
   * Start processing notifications
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Notification service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting notification service');

    // Load custom templates from settings
    await this.loadTemplates();

    // Start processing loop
    this.processLoop().catch(error => {
      logger.error({ error }, 'Processing loop crashed');
      this.isRunning = false;
    });
  }

  /**
   * Stop processing notifications
   */
  stop(): void {
    logger.info('Stopping notification service');
    this.isRunning = false;
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processUnsentEvents();
      } catch (error) {
        logger.error({ error }, 'Error during process cycle');
      }

      if (this.isRunning) {
        await sleep(this.processInterval);
      }
    }
  }

  /**
   * Process all unsent events
   */
  async processUnsentEvents(): Promise<void> {
    // Find ALL unprocessed events (simplified approach)
    const events = await SupabaseWorkerHelpers.getUnprocessedTaskEvents(10);

    if (events.length === 0) {
      return;
    }

    logger.info(`Processing ${events.length} events`);

    for (const event of events) {
      try {
        await this.processEvent(event);
      } catch (error) {
        logger.error({ error, eventId: event.id }, 'Failed to process event');
      }
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: any): Promise<void> {
    logger.debug({ eventId: event.id }, 'Processing event');

    // Check if already has a sent notification
    const existingNotification = await SupabaseWorkerHelpers.getSentNotificationByTaskEventId(event.id);

    if (existingNotification) {
      // Mark event as processed
      const { error } = await supabase
        .from('TaskEvent')
        .update({ processedAt: new Date().toISOString() })
        .eq('id', event.id);

      if (error) throw error;
      return;
    }

    // Create or get pending notification
    let notification = await SupabaseWorkerHelpers.getPendingNotificationByTaskEventId(event.id);

    if (!notification) {
      const { data: newNotification, error } = await supabase
        .from('Notification')
        .insert({
          taskEventId: event.id,
          channel: 'whatsapp',
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      notification = newNotification;
    }

    // Send notification
    try {
      await this.sendNotification(notification.id, event);
      
      // Mark event as processed
      const { error } = await supabase
        .from('TaskEvent')
        .update({ processedAt: new Date().toISOString() })
        .eq('id', event.id);

      if (error) throw error;
    } catch (error) {
      logger.error({ error, notificationId: notification.id }, 'Failed to send notification');
      
      // Update retry count
      const { error: updateError } = await supabase
        .from('Notification')
        .update({
          retryCount: notification.retryCount + 1,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', notification.id);

      if (updateError) {
        logger.error({ error: updateError }, 'Failed to update notification retry count');
      }
    }
  }

  /**
   * Send a notification with retries
   */
  private async sendNotification(notificationId: string, event: any): Promise<void> {
    const { data: notification, error: fetchError } = await supabase
      .from('Notification')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (fetchError) throw fetchError;

    if (!notification || notification.status === 'sent') {
      return;
    }

    if (notification.retryCount >= this.maxRetries) {
      // Mark as failed
      const { error } = await supabase
        .from('Notification')
        .update({ status: 'failed' })
        .eq('id', notificationId);

      if (error) logger.error({ error }, 'Failed to mark notification as failed');
      throw new Error('Max retries exceeded');
    }

    // Get pair and settings
    const pair = await SupabaseWorkerHelpers.getPairWithUsers(this.pairId);

    if (!pair || !pair.settings || pair.settings.length === 0 || !pair.settings[0].whatsappGroupJid) {
      throw new Error('No WhatsApp group configured');
    }

    const settings = pair.settings[0];

    // Get partner
    const partner = event.taskMirror.owner.id === pair.user1.id ? pair.user2 : pair.user1;

    // Format message
    const context = {
      event,
      task: event.taskMirror,
      owner: event.taskMirror.owner,
      partner,
    };

    const message = event.eventType === 'completed'
      ? this.formatter.formatCompletedMessage(context)
      : this.formatter.formatMessage(context);

    // Check if WhatsApp client is available
    if (!this.whatsappClient) {
      logger.warn({ notificationId }, 'WhatsApp client not available, marking notification as failed');
      
      // Mark as failed since we can't send
      const { error } = await supabase
        .from('Notification')
        .update({ 
          status: 'failed',
          lastError: 'WhatsApp client not available' 
        })
        .eq('id', notificationId);

      if (error) logger.error({ error }, 'Failed to mark notification as failed');
      throw new Error('WhatsApp client not available');
    }

    // Send with exponential backoff on failure
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= notification.retryCount; attempt++) {
      try {
        await this.whatsappClient.sendMessage({
          to: settings.whatsappGroupJid,
          text: `[Bot] ${message}`,
        });

        // Mark as sent
        const { error } = await supabase
          .from('Notification')
          .update({
            status: 'sent',
            sentAt: new Date().toISOString(),
          })
          .eq('id', notificationId);

        if (error) {
          logger.error({ error }, 'Failed to mark notification as sent');
        }

        logger.info({
          notificationId,
          eventId: event.id,
          eventType: event.eventType,
          task: event.taskMirror.title,
        }, 'Notification sent successfully');

        return;
      } catch (error) {
        lastError = error as Error;
        // exponential backoff with jitter, capped
        const base = this.retryDelay * Math.pow(2, attempt);
        const capped = Math.min(base, this.maxRetryDelay);
        const jitter = Math.floor(capped * (0.8 + Math.random() * 0.4));
        logger.warn(
          { error, attempt, delay: jitter },
          `Failed to send notification, retrying in ${jitter}ms`
        );
        await sleep(jitter);
      }
    }

    throw lastError || new Error('Failed to send notification');
  }

  /**
   * Load custom templates from settings
   */
  private async loadTemplates(): Promise<void> {
    const settings = await SupabaseWorkerHelpers.getSettingsByPairId(this.pairId);

    if (settings?.notificationTemplates) {
      try {
        const templates = JSON.parse(settings.notificationTemplates);
        this.formatter.setTemplates(templates);
        logger.info('Loaded custom notification templates');
      } catch (error) {
        logger.error({ error }, 'Failed to parse notification templates');
      }
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processInterval: this.processInterval,
    };
  }

  /**
   * Process a single batch (for testing)
   */
  async processBatch(): Promise<number> {
    await this.processUnsentEvents();
    
    // Return count of processed events
    const { count, error } = await supabase
      .from('TaskEvent')
      .select('*', { count: 'exact', head: true })
      .not('processedAt', 'is', null);

    if (error) {
      logger.error({ error }, 'Failed to count processed events');
      return 0;
    }

    return count || 0;
  }
}
