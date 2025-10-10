import { prisma } from '../lib/db';
import cron from 'node-cron';
import pino from 'pino';
import { WhatsAppClient } from '../whatsapp/client';
import { WarningScheduler } from './warning-scheduler';
import { DailySummaryScheduler } from './daily-summary-scheduler';

const logger = pino({ name: 'scheduler-service' });

export interface SchedulerServiceConfig {
  whatsappClient: WhatsAppClient;
  pairId: string;
  timezone?: string;
  warningTime?: string;
  summaryTime?: string;
}

export class SchedulerService {
  private whatsappClient: WhatsAppClient;
  private pairId: string;
  private timezone: string;
  private warningTime: string;
  private summaryTime: string;
  private warningTask: cron.ScheduledTask | null = null;
  private summaryTask: cron.ScheduledTask | null = null;
  private warningScheduler: WarningScheduler;
  private summaryScheduler: DailySummaryScheduler;

  constructor(config: SchedulerServiceConfig) {
    this.whatsappClient = config.whatsappClient;
    this.pairId = config.pairId;
    this.timezone = config.timezone || 'Asia/Kolkata';
    this.warningTime = config.warningTime || '20:00';
    this.summaryTime = config.summaryTime || '23:55';

    // Initialize schedulers
    this.warningScheduler = new WarningScheduler({
      whatsappClient: this.whatsappClient,
      pairId: this.pairId,
    });

    this.summaryScheduler = new DailySummaryScheduler({
      whatsappClient: this.whatsappClient,
      pairId: this.pairId,
    });
  }

  /**
   * Start scheduled tasks
   */
  async start(): Promise<void> {
    logger.info('Starting scheduler service');

    // Load settings from database
    await this.loadSettings();

    // Schedule warning
    const warningCron = this.timeToCron(this.warningTime);
    logger.info(`Scheduling daily warning at ${this.warningTime} (${warningCron}) in ${this.timezone}`);
    
    this.warningTask = cron.schedule(warningCron, async () => {
      logger.info('Running scheduled warning');
      try {
        await this.warningScheduler.sendWarning();
      } catch (error) {
        logger.error({ error }, 'Failed to send warning');
      }
    }, {
      scheduled: true,
      timezone: this.timezone,
    });

    // Schedule daily summary
    const summaryCron = this.timeToCron(this.summaryTime);
    logger.info(`Scheduling daily summary at ${this.summaryTime} (${summaryCron}) in ${this.timezone}`);
    
    this.summaryTask = cron.schedule(summaryCron, async () => {
      logger.info('Running scheduled daily summary');
      try {
        await this.summaryScheduler.sendDailySummary();
      } catch (error) {
        logger.error({ error }, 'Failed to send daily summary');
      }
    }, {
      scheduled: true,
      timezone: this.timezone,
    });

    logger.info('Scheduler service started');
  }

  /**
   * Stop scheduled tasks
   */
  stop(): void {
    logger.info('Stopping scheduler service');

    if (this.warningTask) {
      this.warningTask.stop();
      this.warningTask = null;
    }

    if (this.summaryTask) {
      this.summaryTask.stop();
      this.summaryTask = null;
    }

    logger.info('Scheduler service stopped');
  }

  /**
   * Load settings from database
   */
  private async loadSettings(): Promise<void> {
    const settings = await prisma.settings.findUnique({
      where: { pairId: this.pairId },
    });

    if (settings) {
      this.timezone = settings.timezone;
      this.warningTime = settings.warningTime;
      this.summaryTime = settings.summaryTime;
      logger.info({
        timezone: this.timezone,
        warningTime: this.warningTime,
        summaryTime: this.summaryTime,
      }, 'Loaded scheduler settings');
    }
  }

  /**
   * Convert time string to cron expression
   */
  private timeToCron(time: string): string {
    const [hours, minutes] = time.split(':');
    return `${minutes} ${hours} * * *`; // Run daily at specified time
  }

  /**
   * Manually trigger warning (for testing)
   */
  async triggerWarning(): Promise<void> {
    logger.info('Manually triggering warning');
    await this.warningScheduler.sendWarning();
  }

  /**
   * Manually trigger daily summary (for testing)
   */
  async triggerSummary(): Promise<void> {
    logger.info('Manually triggering daily summary');
    await this.summaryScheduler.sendDailySummary();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      timezone: this.timezone,
      warningTime: this.warningTime,
      summaryTime: this.summaryTime,
      warningScheduled: this.warningTask !== null,
      summaryScheduled: this.summaryTask !== null,
    };
  }
}
