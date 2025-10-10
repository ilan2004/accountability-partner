import { prisma, Prisma } from '../lib/db';
import pino from 'pino';
import { WhatsAppClient } from '../whatsapp/client';
import { MessageFormatter } from './message-formatter';
import { sleep } from './utils';

const logger = pino({ name: 'notification-service' });

export interface NotificationServiceConfig {
  whatsappClient: WhatsAppClient;
  pairId: string;
  processInterval?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number;
}

export class NotificationService {
  private whatsappClient: WhatsAppClient;
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
    // Find events that need notifications
    const events = await prisma.taskEvent.findMany({
      where: {
        processedAt: null,
        taskMirror: {
          owner: {
            pairAsUser1Id: this.pairId,
          },
        },
      },
      include: {
        taskMirror: {
          include: {
            owner: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10, // Process up to 10 events at a time
    });

    // Also check for user2
    const eventsUser2 = await prisma.taskEvent.findMany({
      where: {
        processedAt: null,
        taskMirror: {
          owner: {
            pairAsUser2Id: this.pairId,
          },
        },
      },
      include: {
        taskMirror: {
          include: {
            owner: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10,
    });

    const allEvents = [...events, ...eventsUser2];

    if (allEvents.length === 0) {
      return;
    }

    logger.info(`Processing ${allEvents.length} events`);

    for (const event of allEvents) {
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

    // Check if already has a notification
    const existingNotification = await prisma.notification.findFirst({
      where: {
        taskEventId: event.id,
        status: 'sent',
      },
    });

    if (existingNotification) {
      // Mark event as processed
      await prisma.taskEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
      return;
    }

    // Create or get pending notification
    let notification = await prisma.notification.findFirst({
      where: {
        taskEventId: event.id,
        status: 'pending',
      },
    });

    if (!notification) {
      notification = await prisma.notification.create({
        data: {
          taskEventId: event.id,
          channel: 'whatsapp',
          status: 'pending',
        },
      });
    }

    // Send notification
    try {
      await this.sendNotification(notification.id, event);
      
      // Mark event as processed
      await prisma.taskEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      logger.error({ error, notificationId: notification.id }, 'Failed to send notification');
      
      // Update retry count
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          retryCount: { increment: 1 },
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Send a notification with retries
   */
  private async sendNotification(notificationId: string, event: any): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.status === 'sent') {
      return;
    }

    if (notification.retryCount >= this.maxRetries) {
      // Mark as failed
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'failed' },
      });
      throw new Error('Max retries exceeded');
    }

    // Get pair and settings
    const pair = await prisma.pair.findUnique({
      where: { id: this.pairId },
      include: {
        user1: true,
        user2: true,
        settings: true,
      },
    });

    if (!pair || !pair.settings?.whatsappGroupJid) {
      throw new Error('No WhatsApp group configured');
    }

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

    // Send with exponential backoff on failure
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= notification.retryCount; attempt++) {
      try {
        await this.whatsappClient.sendMessage({
          to: pair.settings.whatsappGroupJid,
          text: `[Bot] ${message}`,
        });

        // Mark as sent
        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: 'sent',
            sentAt: new Date(),
          },
        });

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
    const settings = await prisma.settings.findUnique({
      where: { pairId: this.pairId },
    });

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
    const processed = await prisma.taskEvent.count({
      where: {
        processedAt: { not: null },
        taskMirror: {
          owner: {
            OR: [
              { pairAsUser1: { id: this.pairId } },
              { pairAsUser2: { id: this.pairId } },
            ],
          },
        },
      },
    });

    return processed;
  }
}
