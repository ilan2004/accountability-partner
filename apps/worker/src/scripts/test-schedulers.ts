import { config } from 'dotenv';
import { join } from 'path';
import pino from 'pino';
import { prisma } from '@accountability/db';
import { WhatsAppClient } from '../whatsapp/client';
import { SchedulerService } from '../services/scheduler-service';
import { WarningScheduler } from '../services/warning-scheduler';
import { DailySummaryScheduler } from '../services/daily-summary-scheduler';

// Load environment variables from root
config({ path: join(__dirname, '../../../../.env') });

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function testSchedulers() {
  const groupJid = process.env.WA_GROUP_JID;

  if (!groupJid || groupJid === 'your_whatsapp_group_jid_here@g.us') {
    logger.error('❌ WA_GROUP_JID not set in .env file');
    process.exit(1);
  }

  logger.info('🚀 Starting scheduler test...');

  try {
    // Get pair
    const pair = await prisma.pair.findFirst({
      include: {
        settings: true,
        user1: true,
        user2: true,
      },
    });

    if (!pair) {
      logger.error('❌ No pair found. Run pnpm db:seed first.');
      process.exit(1);
    }

    // Connect to WhatsApp
    logger.info('📱 Connecting to WhatsApp...');
    const whatsappClient = new WhatsAppClient({
      sessionName: 'accountability-bot',
      authPath: 'auth',
      printQR: true,
    });

    await whatsappClient.connect();

    // Wait for connection
    let attempts = 0;
    while (!whatsappClient.isConnected() && attempts < 30) {
      await new Promise(res => setTimeout(res, 1000));
      attempts++;
    }

    if (!whatsappClient.isConnected()) {
      logger.error('❌ Failed to connect to WhatsApp');
      process.exit(1);
    }

    logger.info('✅ WhatsApp connected');

    // Create schedulers directly for testing
    const warningScheduler = new WarningScheduler({
      whatsappClient,
      pairId: pair.id,
    });

    const summaryScheduler = new DailySummaryScheduler({
      whatsappClient,
      pairId: pair.id,
    });

    // Show preview of what would be sent
    logger.info('\n📊 Preview of scheduled messages:\n');

    // Preview warning
    const warningPreview = await warningScheduler.getWarningPreview();
    logger.info('⚠️  Daily Warning Preview:');
    logger.info(`  - Tasks due today: ${warningPreview.tasksDueToday}`);
    if (warningPreview.tasksDueToday > 0) {
      logger.info(`  - Tasks by owner:`);
      for (const [owner, count] of Object.entries(warningPreview.tasksByOwner)) {
        logger.info(`    • ${owner}: ${count} tasks`);
      }
    }

    // Preview summary
    const summaryPreview = await summaryScheduler.getSummaryPreview();
    logger.info('\n📊 Daily Summary Preview:');
    logger.info(`  - Total tasks: ${summaryPreview.totalTasks}`);
    logger.info(`  - Completed today: ${summaryPreview.completedToday}`);
    logger.info(`  - Overdue tasks: ${summaryPreview.overdueTasks}`);
    logger.info(`  - Completion rate: ${summaryPreview.completionRate}%`);

    // Test menu
    logger.info('\n📋 Choose what to test:\n');
    logger.info('1. Send Daily Warning (tasks due today)');
    logger.info('2. Send Daily Summary (end of day stats)');
    logger.info('3. Send both messages');
    logger.info('4. Test scheduled timing (shows when messages would be sent)');
    logger.info('5. Exit without sending\n');

    // For automated testing, we'll send both
    const choice = process.env.TEST_CHOICE || '3';

    switch (choice) {
      case '1':
        logger.info('\n📤 Sending daily warning...');
        await warningScheduler.sendWarning();
        logger.info('✅ Daily warning sent!');
        break;

      case '2':
        logger.info('\n📤 Sending daily summary...');
        await summaryScheduler.sendDailySummary();
        logger.info('✅ Daily summary sent!');
        break;

      case '3':
        logger.info('\n📤 Sending both messages...');
        
        logger.info('Sending daily warning...');
        await warningScheduler.sendWarning();
        logger.info('✅ Daily warning sent!');
        
        await new Promise(res => setTimeout(res, 2000)); // Wait 2 seconds
        
        logger.info('\nSending daily summary...');
        await summaryScheduler.sendDailySummary();
        logger.info('✅ Daily summary sent!');
        break;

      case '4':
        // Test scheduler service timing
        const schedulerService = new SchedulerService({
          whatsappClient,
          pairId: pair.id,
        });

        await schedulerService.start();
        const status = schedulerService.getStatus();
        
        logger.info('\n⏰ Scheduler Configuration:');
        logger.info(`  - Timezone: ${status.timezone}`);
        logger.info(`  - Warning time: ${status.warningTime} daily`);
        logger.info(`  - Summary time: ${status.summaryTime} daily`);
        
        // Calculate next run times
        const now = new Date();
        const nextWarning = getNextRunTime(status.warningTime, status.timezone);
        const nextSummary = getNextRunTime(status.summaryTime, status.timezone);
        
        logger.info('\n⏱️  Next scheduled runs:');
        logger.info(`  - Warning: ${nextWarning.toLocaleString()}`);
        logger.info(`  - Summary: ${nextSummary.toLocaleString()}`);
        
        logger.info('\n📌 Schedulers are active. Press Ctrl+C to stop.');
        
        // Keep running for demonstration
        await new Promise(res => setTimeout(res, 60000)); // Run for 1 minute
        
        schedulerService.stop();
        break;

      case '5':
      default:
        logger.info('👋 Exiting without sending messages');
        break;
    }

    await whatsappClient.disconnect();
    logger.info('\n✅ Test completed!');

  } catch (error) {
    logger.error(error, '❌ Test failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function getNextRunTime(time: string, timezone: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  
  next.setHours(hours, minutes, 0, 0);
  
  // If time has passed today, set for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

// Run test
testSchedulers().catch(error => {
  logger.error(error, 'Unhandled error');
  process.exit(1);
});
