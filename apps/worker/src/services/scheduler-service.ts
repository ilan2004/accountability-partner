import { SupabaseWorkerHelpers } from '../lib/supabase';
import cron from 'node-cron';
import pino from 'pino';
import { WhatsAppClient } from '../whatsapp/client';
import { WarningScheduler } from './warning-scheduler-supabase';
import { DailySummaryScheduler } from './daily-summary-scheduler-supabase';

const logger = pino({ name: 'scheduler-service' });

export interface SchedulerServiceConfig {
  whatsappClient: WhatsAppClient | null;
  pairId: string;
  timezone?: string;
  warningTime?: string;
  summaryTime?: string;
}

export class SchedulerService {
  private whatsappClient: WhatsAppClient | null;
  private pairId: string;
  private timezone: string;
  private warningTime: string;
  private summaryTime: string;
  private warningTask: cron.ScheduledTask | null = null;
  private summaryTask: cron.ScheduledTask | null = null;
  private warningScheduler: WarningScheduler | null = null;
  private summaryScheduler: DailySummaryScheduler | null = null;
  private waOnDemand: boolean;
  private waIdleTimeoutMs: number;

  constructor(config: SchedulerServiceConfig) {
    this.whatsappClient = config.whatsappClient;
    this.pairId = config.pairId;
    this.timezone = config.timezone || 'Asia/Kolkata';
    this.warningTime = config.warningTime || '20:00';
    this.summaryTime = config.summaryTime || '23:55';
    this.waOnDemand = process.env.WA_ON_DEMAND === 'true'; // default false
    this.waIdleTimeoutMs = Number(process.env.WA_IDLE_TIMEOUT_MS || 60000); // 1 minute

    // Initialize schedulers (only if WhatsApp client is available)
    if (this.whatsappClient) {
      this.warningScheduler = new WarningScheduler({
        whatsappClient: this.whatsappClient,
        pairId: this.pairId,
      });

      this.summaryScheduler = new DailySummaryScheduler({
        whatsappClient: this.whatsappClient,
        pairId: this.pairId,
      });
    } else {
      logger.warn('WhatsApp client not available, scheduler will be disabled');
    }
  }

  /**
   * Start scheduled tasks
   */
  async start(): Promise<void> {
    if (!this.whatsappClient) {
      logger.info('Scheduler service disabled - WhatsApp client not available');
      return;
    }

    logger.info('Starting scheduler service');

    // Load settings from database
    await this.loadSettings();

    // Schedule warning
    const warningCron = this.timeToCron(this.warningTime);
    logger.info(`Scheduling daily warning at ${this.warningTime} (${warningCron}) in ${this.timezone}`);
    
    this.warningTask = cron.schedule(warningCron, async () => {
      logger.info('Running scheduled warning');
      try {
        // Handle on-demand connection
        if (this.waOnDemand) {
          await this.ensureWhatsAppConnected();
        }
        
        await this.warningScheduler.sendWarning();
        
        // Schedule disconnect if on-demand mode
        if (this.waOnDemand) {
          await this.scheduleDisconnect();
        }
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
        // Handle on-demand connection
        if (this.waOnDemand) {
          await this.ensureWhatsAppConnected();
        }
        
        await this.summaryScheduler.sendDailySummary();
        
        // Schedule disconnect if on-demand mode
        if (this.waOnDemand) {
          await this.scheduleDisconnect();
        }
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
    const settings = await SupabaseWorkerHelpers.getSettingsByPairId(this.pairId);

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
    if (!this.warningScheduler) {
      throw new Error('Warning scheduler not available - WhatsApp client not initialized');
    }
    logger.info('Manually triggering warning');
    
    // Handle on-demand connection
    if (this.waOnDemand) {
      await this.ensureWhatsAppConnected();
    }
    
    await this.warningScheduler.sendWarning();
    
    // Schedule disconnect if on-demand mode
    if (this.waOnDemand) {
      await this.scheduleDisconnect();
    }
  }

  /**
   * Manually trigger daily summary (for testing)
   */
  async triggerSummary(): Promise<void> {
    if (!this.summaryScheduler) {
      throw new Error('Summary scheduler not available - WhatsApp client not initialized');
    }
    logger.info('Manually triggering daily summary');
    
    // Handle on-demand connection
    if (this.waOnDemand) {
      await this.ensureWhatsAppConnected();
    }
    
    await this.summaryScheduler.sendDailySummary();
    
    // Schedule disconnect if on-demand mode
    if (this.waOnDemand) {
      await this.scheduleDisconnect();
    }
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
  
  /**
   * Ensure WhatsApp is connected (for on-demand mode)
   */
  private async ensureWhatsAppConnected(): Promise<void> {
    if (!this.whatsappClient) return;
    
    if (!this.whatsappClient.isConnected()) {
      logger.info('WhatsApp not connected, connecting on-demand for scheduled send...');
      await this.whatsappClient.connect();
      logger.info('WhatsApp connected on-demand successfully');
    } else {
      logger.debug('WhatsApp already connected');
    }
  }
  
  /**
   * Schedule disconnect after idle timeout
   */
  private async scheduleDisconnect(): Promise<void> {
    if (!this.waOnDemand || !this.whatsappClient) return;
    
    // Wait for idle timeout then disconnect
    setTimeout(async () => {
      if (this.whatsappClient && this.whatsappClient.isConnected()) {
        logger.info('Scheduled message sent, disconnecting WhatsApp after idle timeout...');
        await this.whatsappClient.disconnect();
        logger.info('WhatsApp disconnected after scheduled send');
      }
    }, this.waIdleTimeoutMs);
    
    logger.debug({ timeout: this.waIdleTimeoutMs }, 'Scheduled WhatsApp disconnect after scheduled send');
  }
}
