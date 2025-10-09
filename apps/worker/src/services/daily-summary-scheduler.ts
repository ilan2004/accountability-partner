import { prisma } from '@accountability/db';
import pino from 'pino';
import { WhatsAppClient } from '../whatsapp/client';

const logger = pino({ name: 'daily-summary-scheduler' });

export interface DailySummarySchedulerConfig {
  whatsappClient: WhatsAppClient;
  pairId: string;
}

export class DailySummaryScheduler {
  private whatsappClient: WhatsAppClient;
  private pairId: string;

  constructor(config: DailySummarySchedulerConfig) {
    this.whatsappClient = config.whatsappClient;
    this.pairId = config.pairId;
  }

  /**
   * Send daily summary message
   */
  async sendDailySummary(): Promise<void> {
    logger.info('Preparing daily summary message');

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

      // Get today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get all tasks for the pair
      const allTasks = await prisma.taskMirror.findMany({
        where: {
          owner: {
            OR: [
              { pairAsUser1: { id: this.pairId } },
              { pairAsUser2: { id: this.pairId } },
            ],
          },
        },
        include: {
          owner: true,
        },
      });

      // Calculate stats per user
      const stats = new Map<string, {
        user: typeof pair.user1;
        total: number;
        done: number;
        doneToday: number;
        pending: number;
        overdue: any[];
      }>();

      // Initialize stats for both users
      stats.set(pair.user1.id, {
        user: pair.user1,
        total: 0,
        done: 0,
        doneToday: 0,
        pending: 0,
        overdue: [],
      });

      stats.set(pair.user2.id, {
        user: pair.user2,
        total: 0,
        done: 0,
        doneToday: 0,
        pending: 0,
        overdue: [],
      });

      // Process tasks
      for (const task of allTasks) {
        const userStats = stats.get(task.owner.id);
        if (!userStats) continue;

        userStats.total++;

        if (task.status === 'Done') {
          userStats.done++;
          
          // Check if completed today
          const completedToday = await prisma.taskEvent.findFirst({
            where: {
              taskMirrorId: task.id,
              eventType: 'completed',
              createdAt: {
                gte: todayStart,
                lte: todayEnd,
              },
            },
          });

          if (completedToday) {
            userStats.doneToday++;
          }
        } else {
          userStats.pending++;
          
          // Check if overdue
          if (task.dueDate && task.dueDate < todayStart) {
            userStats.overdue.push(task);
          }
        }
      }

      // Build summary message
      let message = `[Bot] 📊 Daily Summary\n\n`;
      
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      
      message += `${today}\n\n`;

      // Add stats for each user
      for (const [userId, userStats] of stats) {
        message += `👤 ${userStats.user.name}:\n`;
        message += `  ✅ Completed today: ${userStats.doneToday}\n`;
        message += `  📋 Pending: ${userStats.pending}\n`;
        message += `  🎯 Total completed: ${userStats.done}/${userStats.total}\n`;
        
        if (userStats.overdue.length > 0) {
          message += `  ⚠️ Overdue: ${userStats.overdue.length}\n`;
        }
        
        message += '\n';
      }

      // Add overdue tasks if any
      const allOverdue = Array.from(stats.values())
        .flatMap(s => s.overdue)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      if (allOverdue.length > 0) {
        message += `⏰ Overdue Tasks:\n\n`;
        
        for (const task of allOverdue) {
          const daysOverdue = Math.floor(
            (todayStart.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          message += `• ${task.title}\n`;
          message += `  👤 ${task.owner.name} | ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue\n`;
          message += `  🔗 ${task.notionUrl}\n\n`;
        }
      }

      // Add progress summary
      const totalDone = Array.from(stats.values()).reduce((sum, s) => sum + s.done, 0);
      const totalTasks = Array.from(stats.values()).reduce((sum, s) => sum + s.total, 0);
      const completionRate = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

      message += `📈 Overall Progress: ${completionRate}% (${totalDone}/${totalTasks})\n`;

      // Add motivational closer
      const todayCompleted = Array.from(stats.values()).reduce((sum, s) => sum + s.doneToday, 0);
      if (todayCompleted > 0) {
        message += `\n🎉 Great job on completing ${todayCompleted} task${todayCompleted > 1 ? 's' : ''} today!`;
      } else if (allOverdue.length > 0) {
        message += `\n💪 Tomorrow is a fresh start. You've got this!`;
      } else {
        message += `\n🌟 Keep up the momentum!`;
      }

      // Send message
      await this.whatsappClient.sendMessage({
        to: pair.settings.whatsappGroupJid,
        text: message,
      });

      logger.info({
        user1Stats: {
          done: stats.get(pair.user1.id)?.done || 0,
          pending: stats.get(pair.user1.id)?.pending || 0,
          overdue: stats.get(pair.user1.id)?.overdue.length || 0,
        },
        user2Stats: {
          done: stats.get(pair.user2.id)?.done || 0,
          pending: stats.get(pair.user2.id)?.pending || 0,
          overdue: stats.get(pair.user2.id)?.overdue.length || 0,
        },
        completionRate,
      }, 'Daily summary sent');

    } catch (error) {
      logger.error({ error }, 'Failed to send daily summary');
      throw error;
    }
  }

  /**
   * Get preview of what would be sent (for testing)
   */
  async getSummaryPreview(): Promise<{
    totalTasks: number;
    completedToday: number;
    overdueTasks: number;
    completionRate: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get all tasks for the pair
    const allTasks = await prisma.taskMirror.findMany({
      where: {
        owner: {
          OR: [
            { pairAsUser1: { id: this.pairId } },
            { pairAsUser2: { id: this.pairId } },
          ],
        },
      },
    });

    // Count completed today
    let completedToday = 0;
    for (const task of allTasks) {
      if (task.status === 'Done') {
        const completedEvent = await prisma.taskEvent.findFirst({
          where: {
            taskMirrorId: task.id,
            eventType: 'completed',
            createdAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        });
        if (completedEvent) {
          completedToday++;
        }
      }
    }

    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter(t => t.status === 'Done').length;
    const overdueTasks = allTasks.filter(t => 
      t.status !== 'Done' && t.dueDate && t.dueDate < todayStart
    ).length;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedToday,
      overdueTasks,
      completionRate,
    };
  }
}
