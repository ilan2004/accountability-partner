import { SupabaseWorkerHelpers } from '../lib/supabase';
import pino from 'pino';
import { WhatsAppClient } from '../whatsapp/client';

const logger = pino({ name: 'warning-scheduler-supabase' });

export interface WarningSchedulerConfig {
  whatsappClient: WhatsAppClient;
  pairId: string;
}

export class WarningScheduler {
  private whatsappClient: WhatsAppClient;
  private pairId: string;

  constructor(config: WarningSchedulerConfig) {
    this.whatsappClient = config.whatsappClient;
    this.pairId = config.pairId;
  }

  /**
   * Send daily warning message
   */
  async sendWarning(): Promise<void> {
    logger.info('Preparing daily warning message');

    try {
      // Get pair with users
      const pair = await SupabaseWorkerHelpers.getPairById(this.pairId);
      if (!pair) {
        logger.error('No pair found');
        return;
      }

      // Get settings
      const settings = await SupabaseWorkerHelpers.getSettingsByPairId(this.pairId);
      if (!settings?.whatsappGroupJid) {
        logger.error('No WhatsApp group configured');
        return;
      }

      // Get today's start and end
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get tasks due today that are not done
      const tasksDueToday = await SupabaseWorkerHelpers.getTasksDueToday(
        this.pairId,
        todayStart,
        todayEnd
      );

      if (tasksDueToday.length === 0) {
        // Send a positive message if no pending tasks
        const message = `[Bot] ⚡ Daily Check-in\n\n` +
          `Great news! No pending tasks due today.\n` +
          `Keep up the good work! 💪`;
        
        await this.whatsappClient.sendMessage({
          to: settings.whatsappGroupJid,
          text: message,
        });
        
        logger.info('No tasks due today, sent positive message');
        return;
      }

      // Group tasks by owner
      const tasksByOwner = new Map<string, typeof tasksDueToday>();
      
      for (const task of tasksDueToday) {
        const ownerId = task.ownerId;
        if (!tasksByOwner.has(ownerId)) {
          tasksByOwner.set(ownerId, []);
        }
        tasksByOwner.get(ownerId)!.push(task);
      }

      // Build warning message
      let message = `[Bot] ⚠️ Daily Task Warning\n\n`;
      message += `Tasks due today that need attention:\n\n`;

      for (const [ownerId, tasks] of tasksByOwner) {
        // Find user name
        let ownerName = 'Unknown User';
        if (ownerId === pair.user1Id) {
          ownerName = await SupabaseWorkerHelpers.getUserById(pair.user1Id).then(u => u?.name || 'User 1');
        } else if (ownerId === pair.user2Id) {
          ownerName = await SupabaseWorkerHelpers.getUserById(pair.user2Id).then(u => u?.name || 'User 2');
        }
        
        message += `👤 ${ownerName}:\n`;
        
        for (const task of tasks) {
          const status = task.status === 'In Progress' ? '🔄' : '📋';
          message += `  ${status} ${task.title}\n`;
          message += `     🔗 ${task.notionUrl}\n`;
        }
        
        message += '\n';
      }

      // Add motivational footer
      const totalTasks = tasksDueToday.length;
      message += `📊 Total: ${totalTasks} task${totalTasks > 1 ? 's' : ''} due today\n`;
      message += `\n💡 Remember: Progress over perfection!`;

      // Send message
      await this.whatsappClient.sendMessage({
        to: settings.whatsappGroupJid,
        text: message,
      });

      logger.info({
        taskCount: tasksDueToday.length,
        user1Tasks: tasksByOwner.get(pair.user1Id)?.length || 0,
        user2Tasks: tasksByOwner.get(pair.user2Id)?.length || 0,
      }, 'Daily warning sent');

    } catch (error) {
      logger.error({ error }, 'Failed to send daily warning');
      throw error;
    }
  }

  /**
   * Get preview of what would be sent (for testing)
   */
  async getWarningPreview(): Promise<{
    tasksDueToday: number;
    tasksByOwner: Record<string, number>;
    wouldSend: boolean;
  }> {
    // Get today's start and end
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get tasks due today that are not done
    const tasksDueToday = await SupabaseWorkerHelpers.getTasksDueToday(
      this.pairId,
      todayStart,
      todayEnd
    );

    // Get pair to get user names
    const pair = await SupabaseWorkerHelpers.getPairById(this.pairId);
    if (!pair) {
      return { tasksDueToday: 0, tasksByOwner: {}, wouldSend: false };
    }

    // Group tasks by owner name
    const tasksByOwner: Record<string, number> = {};
    
    for (const task of tasksDueToday) {
      let ownerName = 'Unknown User';
      if (task.ownerId === pair.user1Id) {
        const user1 = await SupabaseWorkerHelpers.getUserById(pair.user1Id);
        ownerName = user1?.name || 'User 1';
      } else if (task.ownerId === pair.user2Id) {
        const user2 = await SupabaseWorkerHelpers.getUserById(pair.user2Id);
        ownerName = user2?.name || 'User 2';
      }
      
      tasksByOwner[ownerName] = (tasksByOwner[ownerName] || 0) + 1;
    }

    return {
      tasksDueToday: tasksDueToday.length,
      tasksByOwner,
      wouldSend: true, // Always send, even if no tasks (positive message)
    };
  }
}
