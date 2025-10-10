import { prisma } from '../lib/db';
import pino from 'pino';
import { WhatsAppClient } from '../whatsapp/client';

const logger = pino({ name: 'warning-scheduler' });

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
      // Get pair with settings
      const pair = await prisma.pair.findUnique({
        where: { id: this.pairId },
        include: {
          user1: true,
          user2: true,
          settings: true,
        },
      });

      if (!pair || !pair.settings?.whatsappGroupJid) {
        logger.error('No pair or WhatsApp group configured');
        return;
      }

      // Get today's start and end
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get tasks due today that are not done
      const tasksDueToday = await prisma.taskMirror.findMany({
        where: {
          owner: {
            OR: [
              { pairAsUser1: { id: this.pairId } },
              { pairAsUser2: { id: this.pairId } },
            ],
          },
          dueDate: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: {
            not: 'Done',
          },
        },
        include: {
          owner: true,
        },
        orderBy: [
          { ownerId: 'asc' },
          { dueDate: 'asc' },
        ],
      });

      if (tasksDueToday.length === 0) {
        // Send a positive message if no pending tasks
        const message = `[Bot] ⚡ Daily Check-in\n\n` +
          `Great news! No pending tasks due today.\n` +
          `Keep up the good work! 💪`;
        
        await this.whatsappClient.sendMessage({
          to: pair.settings.whatsappGroupJid,
          text: message,
        });
        
        logger.info('No tasks due today, sent positive message');
        return;
      }

      // Group tasks by owner
      const tasksByOwner = new Map<string, typeof tasksDueToday>();
      
      for (const task of tasksDueToday) {
        const ownerId = task.owner.id;
        if (!tasksByOwner.has(ownerId)) {
          tasksByOwner.set(ownerId, []);
        }
        tasksByOwner.get(ownerId)!.push(task);
      }

      // Build warning message
      let message = `[Bot] ⚠️ Daily Task Warning\n\n`;
      message += `Tasks due today that need attention:\n\n`;

      for (const [ownerId, tasks] of tasksByOwner) {
        const owner = tasks[0].owner;
        message += `👤 ${owner.name}:\n`;
        
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
        to: pair.settings.whatsappGroupJid,
        text: message,
      });

      logger.info({
        taskCount: tasksDueToday.length,
        user1Tasks: tasksByOwner.get(pair.user1.id)?.length || 0,
        user2Tasks: tasksByOwner.get(pair.user2.id)?.length || 0,
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
    const tasksDueToday = await prisma.taskMirror.findMany({
      where: {
        owner: {
          OR: [
            { pairAsUser1: { id: this.pairId } },
            { pairAsUser2: { id: this.pairId } },
          ],
        },
        dueDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          not: 'Done',
        },
      },
      include: {
        owner: true,
      },
    });

    // Group tasks by owner
    const tasksByOwner: Record<string, number> = {};
    
    for (const task of tasksDueToday) {
      const ownerName = task.owner.name;
      tasksByOwner[ownerName] = (tasksByOwner[ownerName] || 0) + 1;
    }

    return {
      tasksDueToday: tasksDueToday.length,
      tasksByOwner,
      wouldSend: true, // Always send, even if no tasks (positive message)
    };
  }
}
