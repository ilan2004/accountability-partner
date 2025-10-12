const cron = require('node-cron');
const NotionSyncService = require('./notion-sync');
const WhatsAppNotificationBot = require('../whatsapp-notification-bot');
const GeminiFormatterService = require('./gemini-formatter');
const { createClient } = require('@supabase/supabase-js');

/**
 * Scheduler Service for Accountability System
 * 
 * Purpose: Handle all scheduled tasks
 * - 06:00 IST: Morning task summary
 * - 22:00 IST: Evening completion summary
 * - Every 5 minutes: Notion sync and change detection
 */
class SchedulerService {
  constructor() {
    this.notionSync = new NotionSyncService();
    this.whatsappBot = null; // Will be initialized when needed
    this.geminiFormatter = new GeminiFormatterService();
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.jobs = new Map();
    this.isInitialized = false;
    
    console.log('⏰ Scheduler Service initialized');
  }

  async initialize() {
    try {
      console.log('🔄 Initializing scheduler...');
      
      // Initialize WhatsApp bot
      this.whatsappBot = new WhatsAppNotificationBot();
      await this.whatsappBot.initialize();
      
      // Setup scheduled jobs
      this.setupCronJobs();
      
      this.isInitialized = true;
      console.log('✅ Scheduler initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing scheduler:', error);
      throw error;
    }
  }

  setupCronJobs() {
    // Morning summary at 06:00 IST (00:30 UTC)
    const morningJob = cron.schedule('30 0 * * *', async () => {
      console.log('🌅 Running morning task summary job...');
      await this.sendMorningSummary();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    // Evening summary at 22:00 IST (16:30 UTC)
    const eveningJob = cron.schedule('30 16 * * *', async () => {
      console.log('🌙 Running evening completion summary job...');
      await this.sendEveningSummary();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    // Notion sync every 5 minutes
    const syncJob = cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 Running Notion sync job...');
      await this.runNotionSync();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    // Health check every hour
    const healthJob = cron.schedule('0 * * * *', async () => {
      console.log('🔍 Running health check...');
      await this.runHealthCheck();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.jobs.set('morning', morningJob);
    this.jobs.set('evening', eveningJob);
    this.jobs.set('sync', syncJob);
    this.jobs.set('health', healthJob);

    console.log('✅ Cron jobs scheduled:');
    console.log('  📅 Morning summary: 06:00 IST daily');
    console.log('  📅 Evening summary: 22:00 IST daily');
    console.log('  📅 Notion sync: Every 5 minutes');
    console.log('  📅 Health check: Every hour');
  }

  async sendMorningSummary() {
    try {
      console.log('🌅 Generating morning task summary...');
      
      // Get all users and their tasks
      const summaryData = await this.generateMorningSummaryData();
      
      if (summaryData) {
        // Use Gemini to format the message
        const formattedMessage = await this.geminiFormatter.formatMorningMessage(summaryData);
        
        // Send via WhatsApp
        const success = await this.whatsappBot.sendMorningTaskSummary({
          ...summaryData,
          formatted_message: formattedMessage
        });

        if (success) {
          console.log('✅ Morning summary sent successfully');
        } else {
          console.error('❌ Failed to send morning summary');
        }
      } else {
        console.log('⚠️ No data available for morning summary');
      }
    } catch (error) {
      console.error('❌ Error in sendMorningSummary:', error);
    }
  }

  async sendEveningSummary() {
    try {
      console.log('🌙 Generating evening completion summary...');
      
      // Get completion stats for the day
      const summaryData = await this.generateEveningSummaryData();
      
      if (summaryData) {
        // Use Gemini to format the message
        const formattedMessage = await this.geminiFormatter.formatEveningMessage(summaryData);
        
        // Send via WhatsApp
        const success = await this.whatsappBot.sendEveningCompletionSummary({
          ...summaryData,
          formatted_message: formattedMessage
        });

        if (success) {
          console.log('✅ Evening summary sent successfully');
        } else {
          console.error('❌ Failed to send evening summary');
        }
      } else {
        console.log('⚠️ No data available for evening summary');
      }
    } catch (error) {
      console.error('❌ Error in sendEveningSummary:', error);
    }
  }

  async runNotionSync() {
    try {
      // Run the sync
      const result = await this.notionSync.syncAllUsers();
      
      // Process any changes for WhatsApp notifications
      if (result.changes.length > 0) {
        await this.processTaskChanges(result.changes);
      }
      
      if (result.errors.length > 0) {
        console.error('⚠️ Sync completed with errors:', result.errors);
      } else {
        console.log(`✅ Notion sync completed: ${result.changes.length} changes`);
      }
    } catch (error) {
      console.error('❌ Error in runNotionSync:', error);
    }
  }

  async processTaskChanges(changes) {
    try {
      // Group changes by type and user
      const changesByUser = new Map();
      
      for (const change of changes) {
        const userId = change.user_id;
        if (!changesByUser.has(userId)) {
          changesByUser.set(userId, []);
        }
        changesByUser.get(userId).push(change);
      }

      // Get user names
      const { data: users } = await this.supabase
        .from('users')
        .select('id, name')
        .in('id', Array.from(changesByUser.keys()));

      const userNamesMap = new Map(users?.map(u => [u.id, u.name]) || []);

      // Send notifications for each user's changes
      for (const [userId, userChanges] of changesByUser) {
        const userName = userNamesMap.get(userId) || `User ${userId}`;
        
        if (userChanges.length === 1) {
          // Single change - send specific notification
          await this.sendSingleTaskNotification(userChanges[0], userName);
        } else {
          // Multiple changes - send bulk notification
          await this.sendBulkTaskNotification(userChanges, userName);
        }
      }
    } catch (error) {
      console.error('❌ Error processing task changes:', error);
    }
  }

  async sendSingleTaskNotification(change, userName) {
    try {
      const updateData = {
        type: change.type,
        user_name: userName,
        task_name: change.task.task_name,
        contextual_message: await this.geminiFormatter.formatTaskUpdateMessage({
          type: change.type,
          user_name: userName,
          task_name: change.task.task_name,
          old_status: change.old_status,
          new_status: change.new_status
        })
      };

      await this.whatsappBot.sendTaskUpdateNotification(updateData);
    } catch (error) {
      console.error('❌ Error sending single task notification:', error);
    }
  }

  async sendBulkTaskNotification(changes, userName) {
    try {
      const formattedMessage = await this.geminiFormatter.formatBulkUpdateMessage({
        changes: changes,
        user_name: userName,
        change_count: changes.length
      });
      
      const bulkUpdateData = {
        formatted_message: formattedMessage,
        user_name: userName,
        change_count: changes.length
      };

      await this.whatsappBot.sendBulkTaskUpdateNotification(bulkUpdateData);
    } catch (error) {
      console.error('❌ Error sending bulk task notification:', error);
    }
  }

  async generateMorningSummaryData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get all users
      const { data: users } = await this.supabase
        .from('users')
        .select('*');

      if (!users?.length) return null;

      const usersSummaries = [];

      for (const user of users) {
        // Get user's tasks for today and near future
        const { data: tasks } = await this.supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .or(`due_date.is.null,due_date.gte.${today}`)
          .neq('status', 'done')
          .order('due_date', { ascending: true, nullsLast: true })
          .limit(10);

        usersSummaries.push({
          user: user,
          tasks: tasks || [],
          task_count: tasks?.length || 0
        });
      }

      return {
        date: today,
        users_summaries: usersSummaries,
        missing_task_users: usersSummaries.filter(u => u.task_count === 0).map(u => u.user.name)
      };
    } catch (error) {
      console.error('❌ Error generating morning summary data:', error);
      return null;
    }
  }

  async generateEveningSummaryData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get all users
      const { data: users } = await this.supabase
        .from('users')
        .select('*');

      if (!users?.length) return null;

      const usersSummaries = [];
      let totalTasks = 0;
      let totalCompleted = 0;

      for (const user of users) {
        // Get all user's tasks (not just today's)
        const { data: allTasks } = await this.supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id);

        // Get completed tasks (regardless of when they were completed)
        const { data: completedTasks } = await this.supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'done');

        const userTaskCount = allTasks?.length || 0;
        const userCompletedCount = completedTasks?.length || 0;
        const completionRate = userTaskCount > 0 ? Math.round((userCompletedCount / userTaskCount) * 100) : 0;

        usersSummaries.push({
          user: user,
          tasks: allTasks || [],
          completed_count: userCompletedCount,
          total_count: userTaskCount,
          completion_rate: completionRate
        });

        totalTasks += userTaskCount;
        totalCompleted += userCompletedCount;
      }

      const overallCompletionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

      return {
        date: today,
        users_summaries: usersSummaries,
        overall_completion_rate: overallCompletionRate,
        total_tasks: totalTasks,
        total_completed: totalCompleted
      };
    } catch (error) {
      console.error('❌ Error generating evening summary data:', error);
      return null;
    }
  }

  async formatMorningMessage(summaryData) {
    // TODO: Integrate with Gemini service for formatting
    // For now, create a basic format
    let message = `Here are today's tasks:\n\n`;
    
    for (const userSummary of summaryData.users_summaries) {
      const emoji = userSummary.user.name === 'Ilan' ? '🧑‍💻' : '👩‍🎓';
      message += `${emoji} **${userSummary.user.name}**\n`;
      
      if (userSummary.tasks.length === 0) {
        message += `(${userSummary.user.name} hasn't added tasks yet.)\n\n`;
      } else {
        userSummary.tasks.forEach((task, index) => {
          message += `${index + 1}. ${task.task_name}`;
          if (task.due_date) {
            message += ` (Due: ${new Date(task.due_date).toLocaleDateString('en-IN')})`;
          }
          message += `\n`;
        });
        message += `\n`;
      }
    }
    
    return message;
  }

  async formatEveningMessage(summaryData) {
    // TODO: Integrate with Gemini service for formatting
    let message = ``;
    
    for (const userSummary of summaryData.users_summaries) {
      const emoji = userSummary.user.name === 'Ilan' ? '🧑‍💻' : '👩‍🎓';
      message += `${emoji} **${userSummary.user.name}** — ${userSummary.completed_count}/${userSummary.total_count} tasks completed`;
      if (userSummary.completion_rate > 0) {
        message += ` (${userSummary.completion_rate}%)`;
      }
      message += `\n`;
    }
    
    // Add motivational message based on performance
    if (summaryData.overall_completion_rate >= 80) {
      message += `\nExcellent work today! 🔥 Keep the momentum going!`;
    } else if (summaryData.overall_completion_rate >= 60) {
      message += `\nGood progress today! 💪 Tomorrow's a new opportunity!`;
    } else {
      message += `\nEvery step counts! 🌱 Let's focus on tomorrow's goals!`;
    }
    
    return message;
  }

  async generateContextualMessage(change, userName) {
    // TODO: Integrate with Gemini for better contextual messages
    switch (change.type) {
      case 'task_added':
        return `Task added to the list! 📝`;
      case 'task_completed':
        return `🎉 Fantastic! Another one done!`;
      case 'task_updated':
        return `Task details updated 📝`;
      default:
        return '';
    }
  }

  async formatBulkChangesMessage(changes, userName) {
    // TODO: Integrate with Gemini for better bulk formatting
    const addedCount = changes.filter(c => c.type === 'task_added').length;
    const completedCount = changes.filter(c => c.type === 'task_completed').length;
    const updatedCount = changes.filter(c => c.type === 'task_updated').length;

    let message = `${userName} made several updates:\n\n`;
    
    if (addedCount > 0) message += `➕ ${addedCount} new tasks added\n`;
    if (completedCount > 0) message += `✅ ${completedCount} tasks completed\n`;
    if (updatedCount > 0) message += `📝 ${updatedCount} tasks updated\n`;
    
    return message;
  }

  async runHealthCheck() {
    try {
      const status = this.whatsappBot?.getConnectionStatus();
      
      if (!status?.connected) {
        console.log('⚠️ WhatsApp bot disconnected, attempting reconnection...');
        await this.whatsappBot?.initialize();
      }
      
      // Optional: Send health check to WhatsApp (uncomment for debugging)
      // await this.whatsappBot?.sendHealthCheck();
      
      console.log('✅ Health check completed');
    } catch (error) {
      console.error('❌ Error in health check:', error);
    }
  }

  // Manual trigger methods for testing
  async triggerMorningSummary() {
    console.log('🧪 Manually triggering morning summary...');
    await this.sendMorningSummary();
  }

  async triggerEveningSummary() {
    console.log('🧪 Manually triggering evening summary...');
    await this.sendEveningSummary();
  }

  async triggerNotionSync() {
    console.log('🧪 Manually triggering Notion sync...');
    await this.runNotionSync();
  }

  // Stop all jobs
  stopAllJobs() {
    console.log('⏸️ Stopping all scheduled jobs...');
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`  ⏸️ Stopped ${name} job`);
    }
  }

  // Start all jobs
  startAllJobs() {
    console.log('▶️ Starting all scheduled jobs...');
    for (const [name, job] of this.jobs) {
      job.start();
      console.log(`  ▶️ Started ${name} job`);
    }
  }

  getJobStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    }
    return status;
  }
}

module.exports = SchedulerService;
