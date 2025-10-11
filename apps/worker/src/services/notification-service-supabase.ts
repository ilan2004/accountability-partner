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
  private currentProcessInterval: number;
  private minProcessInterval: number;
  private maxProcessInterval: number;
  private backoffFactor: number;
  private maxRetries: number;
  private retryDelay: number;
  private maxRetryDelay: number;
  private taskListOnCreate: boolean;
  private taskListAggregationWindow: number;

  constructor(config: NotificationServiceConfig) {
    this.whatsappClient = config.whatsappClient;
    this.pairId = config.pairId;
    this.formatter = new MessageFormatter();
    this.processInterval = config.processInterval || 5000; // Default 5 seconds
    this.minProcessInterval = Number(process.env.NOTIFIER_MIN_INTERVAL_MS || 5000); // 5s
    this.maxProcessInterval = Number(process.env.NOTIFIER_MAX_INTERVAL_MS || 60000); // 60s
    this.backoffFactor = Number(process.env.BACKOFF_FACTOR || 2);
    this.currentProcessInterval = this.minProcessInterval;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // base delay 1s
    this.maxRetryDelay = 30000; // cap at 30s
    this.taskListOnCreate = process.env.TASK_LIST_ON_CREATE !== 'false'; // default true
    this.taskListAggregationWindow = Number(process.env.TASK_LIST_AGGREGATION_WINDOW_MS || 8000);
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
        logger.debug({ interval: this.currentProcessInterval }, 'Sleeping before next process cycle');
        await sleep(this.currentProcessInterval);
      }
    }
  }

  /**
   * Process all unsent events
   */
  async processUnsentEvents(): Promise<void> {
    // Find ALL unprocessed events (simplified approach)
    const events = await SupabaseWorkerHelpers.getUnprocessedTaskEvents(50); // Increased to handle aggregation

    if (events.length === 0) {
      // No events to process, increase interval
      const newInterval = Math.min(this.currentProcessInterval * this.backoffFactor, this.maxProcessInterval);
      if (newInterval !== this.currentProcessInterval) {
        logger.info({
          oldInterval: this.currentProcessInterval,
          newInterval,
          reason: 'No events to process'
        }, 'Increasing process interval');
        this.currentProcessInterval = newInterval;
      }
      return;
    }

    logger.info(`Processing ${events.length} events`);
    
    // Events found, reset to minimum interval
    if (this.currentProcessInterval !== this.minProcessInterval) {
      logger.info({
        oldInterval: this.currentProcessInterval,
        newInterval: this.minProcessInterval,
        eventsFound: events.length,
        reason: 'Events to process'
      }, 'Resetting process interval to minimum');
      this.currentProcessInterval = this.minProcessInterval;
    }

    // Check if we should aggregate created events
    if (this.taskListOnCreate) {
      const createdEvents = events.filter(e => e.eventType === 'created');
      const otherEvents = events.filter(e => e.eventType !== 'created');
      
      if (createdEvents.length > 0) {
        // Check if all created events are within aggregation window
        const oldestCreated = new Date(createdEvents[0].createdAt).getTime();
        const newestCreated = new Date(createdEvents[createdEvents.length - 1].createdAt).getTime();
        
        if (newestCreated - oldestCreated <= this.taskListAggregationWindow) {
          // Process as a batch
          await this.processCreatedEventBatch(createdEvents);
        } else {
          // Process old ones individually, batch recent ones
          const cutoffTime = newestCreated - this.taskListAggregationWindow;
          const oldCreated = createdEvents.filter(e => new Date(e.createdAt).getTime() < cutoffTime);
          const recentCreated = createdEvents.filter(e => new Date(e.createdAt).getTime() >= cutoffTime);
          
          // Process old ones individually
          for (const event of oldCreated) {
            try {
              await this.processEvent(event);
            } catch (error) {
              logger.error({ error, eventId: event.id }, 'Failed to process event');
            }
          }
          
          // Batch recent ones
          if (recentCreated.length > 0) {
            await this.processCreatedEventBatch(recentCreated);
          }
        }
        
        // Process non-created events normally
        for (const event of otherEvents) {
          try {
            await this.processEvent(event);
          } catch (error) {
            logger.error({ error, eventId: event.id }, 'Failed to process event');
          }
        }
        return;
      }
    }

    // Default processing for all events
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
    logger.debug({ eventId: event.id, eventType: event.eventType }, 'Processing event');

    // Check if already has a sent notification or is permanently failed
    const { data: existingNotifications, error: checkError } = await supabase
      .from('Notification')
      .select('*')
      .eq('taskEventId', event.id)
      .in('status', ['sent', 'permanently_failed']);

    if (checkError) throw checkError;

    if (existingNotifications && existingNotifications.length > 0) {
      const notification = existingNotifications[0];
      if (notification.status === 'permanently_failed') {
        logger.debug({ eventId: event.id, notificationId: notification.id }, 'Skipping permanently failed notification');
      }
      
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
          nextAttemptAt: new Date().toISOString(), // Attempt immediately
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
      const { isPermanent, reason } = this.classifyError(error);
      
      logger.error({ 
        error, 
        notificationId: notification.id,
        eventId: event.id,
        isPermanent,
        reason 
      }, isPermanent ? 'Permanent failure for notification' : 'Transient failure for notification');
      
      if (isPermanent) {
        // Mark as permanently failed
        const { error: updateError } = await supabase
          .from('Notification')
          .update({
            status: 'permanently_failed',
            lastError: reason,
          })
          .eq('id', notification.id);

        if (updateError) {
          logger.error({ error: updateError }, 'Failed to mark notification as permanently failed');
        }
        
        // Mark event as processed since we won't retry
        const { error: eventError } = await supabase
          .from('TaskEvent')
          .update({ processedAt: new Date().toISOString() })
          .eq('id', event.id);
          
        if (eventError) {
          logger.error({ error: eventError }, 'Failed to mark event as processed after permanent failure');
        }
      } else {
        // Update retry count and set next attempt time
        const nextRetryCount = notification.retryCount + 1;
        const nextAttemptAt = nextRetryCount >= this.maxRetries 
          ? null // No more retries
          : this.calculateNextAttemptTime(nextRetryCount);
        
        const { error: updateError } = await supabase
          .from('Notification')
          .update({
            retryCount: nextRetryCount,
            lastError: reason,
            status: nextRetryCount >= this.maxRetries ? 'permanently_failed' : 'pending',
            nextAttemptAt: nextAttemptAt?.toISOString() || null,
          })
          .eq('id', notification.id);

        if (updateError) {
          logger.error({ error: updateError }, 'Failed to update notification after transient failure');
        }
        
        // If max retries reached, mark event as processed
        if (nextRetryCount >= this.maxRetries) {
          const { error: eventError } = await supabase
            .from('TaskEvent')
            .update({ processedAt: new Date().toISOString() })
            .eq('id', event.id);
            
          if (eventError) {
            logger.error({ error: eventError }, 'Failed to mark event as processed after max retries');
          }
        }
      }
    }
  }

  /**
   * Send a notification with retries
   */
  private async sendNotification(notificationId: string, event: any): Promise<void> {
    // Set status to processing
    const { error: processingError } = await supabase
      .from('Notification')
      .update({ status: 'processing' })
      .eq('id', notificationId);
      
    if (processingError) {
      logger.error({ error: processingError }, 'Failed to set notification to processing');
    }
    
    const { data: notification, error: fetchError } = await supabase
      .from('Notification')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (fetchError) throw fetchError;

    if (!notification || notification.status === 'sent' || notification.status === 'permanently_failed') {
      if (notification?.status === 'permanently_failed') {
        logger.debug({ notificationId }, 'Skipping permanently failed notification');
      }
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

      // Get remaining count if this is a completion
      let remainingCount: number | undefined;
      if (event.eventType === 'completed' && process.env.COMPLETION_INCLUDE_REMAINING_COUNT !== 'false') {
        const allTasks = await SupabaseWorkerHelpers.getAllTasksForPair(this.pairId);
        remainingCount = allTasks.filter(t => t.status !== 'Done').length;
      }

      // Format message
      const context = {
        event,
        task: event.taskMirror,
        owner: event.taskMirror.owner,
        partner,
        remainingCount,
      };

      const message = event.eventType === 'completed'
        ? this.formatter.formatCompletedMessage(context)
        : this.formatter.formatMessage(context);

    // Check if WhatsApp client is available and connected
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

    // Get detailed connection info for debugging
    const connectionInfo = this.whatsappClient.getConnectionInfo();
    logger.info({ notificationId, connectionInfo }, 'WhatsApp connection status before sending');

    // Validate connection more thoroughly
    if (!this.whatsappClient.isConnected()) {
      const errorMsg = 'WhatsApp client not connected';
      logger.warn({ notificationId, connectionInfo }, errorMsg);
      
      // Mark as failed 
      const { error } = await supabase
        .from('Notification')
        .update({ 
          status: 'failed',
          lastError: `${errorMsg}: ${JSON.stringify(connectionInfo)}` 
        })
        .eq('id', notificationId);

      if (error) logger.error({ error }, 'Failed to mark notification as failed');
      throw new Error(errorMsg);
    }

    // Send with exponential backoff on failure
    let lastError: Error | null = null;
    
    logger.info({
      notificationId,
      groupJid: settings.whatsappGroupJid,
      messagePreview: message.substring(0, 100),
      messageLength: message.length
    }, 'About to send WhatsApp notification');

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
          groupJid: settings.whatsappGroupJid
        }, '✅ Notification sent successfully');

        return;
      } catch (error) {
        lastError = error as Error;
        logger.error({
          error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: typeof error,
          attempt,
          notificationId,
          groupJid: settings.whatsappGroupJid
        }, `❌ Failed to send notification on attempt ${attempt + 1}`);
        
        // exponential backoff with jitter, capped
        const base = this.retryDelay * Math.pow(2, attempt);
        const capped = Math.min(base, this.maxRetryDelay);
        const jitter = Math.floor(capped * (0.8 + Math.random() * 0.4));
        
        if (attempt < notification.retryCount) {
          logger.info({ attempt, delay: jitter }, `Retrying notification send in ${jitter}ms`);
          await sleep(jitter);
        }
      }
    }

    throw lastError || new Error('Failed to send notification');
  }

  /**
   * Classify error as permanent or transient
   */
  private classifyError(error: any): { isPermanent: boolean; reason: string } {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code;
    
    // Permanent errors
    if (errorMessage.includes('No WhatsApp group configured')) {
      return { isPermanent: true, reason: 'No WhatsApp group configured' };
    }
    
    if (errorMessage.includes('WhatsApp client not available')) {
      return { isPermanent: true, reason: 'WhatsApp client not available' };
    }
    
    if (errorMessage.includes('invalid JID') || errorMessage.includes('invalid-jid')) {
      return { isPermanent: true, reason: 'Invalid WhatsApp JID' };
    }
    
    if (errorCode === '23505') { // PostgreSQL unique constraint violation
      return { isPermanent: true, reason: 'Duplicate notification' };
    }
    
    // Everything else is transient
    return { isPermanent: false, reason: errorMessage };
  }

  /**
   * Calculate next attempt time with exponential backoff and jitter
   */
  private calculateNextAttemptTime(retryCount: number): Date {
    const baseDelay = this.retryDelay * Math.pow(2, retryCount);
    const cappedDelay = Math.min(baseDelay, this.maxRetryDelay);
    const jitter = Math.floor(cappedDelay * (0.8 + Math.random() * 0.4)); // ±20% jitter
    return new Date(Date.now() + jitter);
  }

  /**
   * Process a batch of created events by sending a task list
   */
  private async processCreatedEventBatch(createdEvents: any[]): Promise<void> {
    logger.info(`Processing ${createdEvents.length} created events as a batch`);
    
    try {
      // Get pair and settings
      const pair = await SupabaseWorkerHelpers.getPairWithUsers(this.pairId);
      
      if (!pair || !pair.settings || pair.settings.length === 0 || !pair.settings[0].whatsappGroupJid) {
        throw new Error('No WhatsApp group configured');
      }
      
      const settings = pair.settings[0];
      
      // Fetch all open tasks for the pair
      const allTasks = await SupabaseWorkerHelpers.getAllTasksForPair(this.pairId);
      const openTasks = allTasks.filter(t => t.status !== 'Done');
      
      // Format message as task list
      const context = {
        tasks: openTasks,
        totalCount: openTasks.length,
        maxTasksPerOwner: 10
      };
      
      const message = this.formatter.formatTaskListByOwner(context);
      
      // Check if WhatsApp client is available
      if (!this.whatsappClient) {
        logger.warn('WhatsApp client not available for batch processing');
        // Mark all events as permanently failed due to missing client
        for (const event of createdEvents) {
          await this.markEventPermanentlyFailed(event.id, 'WhatsApp client not available');
        }
        return;
      }
      
      if (!this.whatsappClient.isConnected()) {
        logger.warn('WhatsApp client not connected for batch processing');
        // Don't mark as permanently failed - this is transient
        return;
      }
      
      // Send the task list message
      logger.info({
        groupJid: settings.whatsappGroupJid,
        openTaskCount: openTasks.length,
        createdEventCount: createdEvents.length
      }, 'Sending task list for created events batch');
      
      await this.whatsappClient.sendMessage({
        to: settings.whatsappGroupJid,
        text: message,
      });
      
      // Mark all created events as processed
      // Create a single notification for the most recent event for audit trail
      const mostRecentEvent = createdEvents[createdEvents.length - 1];
      
      const { error: notifError } = await supabase
        .from('Notification')
        .insert({
          taskEventId: mostRecentEvent.id,
          channel: 'whatsapp',
          status: 'sent',
          sentAt: new Date().toISOString(),
          messageId: 'batch-' + new Date().getTime(),
        });
      
      if (notifError) {
        logger.error({ error: notifError }, 'Failed to create notification record for batch');
      }
      
      // Mark all events as processed
      const eventIds = createdEvents.map(e => e.id);
      const { error: updateError } = await supabase
        .from('TaskEvent')
        .update({ processedAt: new Date().toISOString() })
        .in('id', eventIds);
      
      if (updateError) {
        logger.error({ error: updateError }, 'Failed to mark batch events as processed');
      } else {
        logger.info({
          eventCount: createdEvents.length,
          taskCount: openTasks.length
        }, '✅ Task list sent for created events batch');
      }
      
    } catch (error) {
      logger.error({ error }, 'Failed to process created event batch');
      // Process individually as fallback
      for (const event of createdEvents) {
        try {
          await this.processEvent(event);
        } catch (err) {
          logger.error({ error: err, eventId: event.id }, 'Failed to process event individually');
        }
      }
    }
  }
  
  /**
   * Mark an event as permanently failed
   */
  private async markEventPermanentlyFailed(eventId: string, reason: string): Promise<void> {
    // Check if notification already exists
    const { data: existingNotif } = await supabase
      .from('Notification')
      .select('id')
      .eq('taskEventId', eventId)
      .single();
    
    if (existingNotif) {
      // Update existing
      await supabase
        .from('Notification')
        .update({
          status: 'permanently_failed',
          lastError: reason,
        })
        .eq('id', existingNotif.id);
    } else {
      // Create new
      await supabase
        .from('Notification')
        .insert({
          taskEventId: eventId,
          channel: 'whatsapp',
          status: 'permanently_failed',
          lastError: reason,
        });
    }
    
    // Mark event as processed
    await supabase
      .from('TaskEvent')
      .update({ processedAt: new Date().toISOString() })
      .eq('id', eventId);
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
      currentProcessInterval: this.currentProcessInterval,
      minProcessInterval: this.minProcessInterval,
      maxProcessInterval: this.maxProcessInterval,
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
