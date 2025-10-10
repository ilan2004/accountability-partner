import { config } from 'dotenv';
import { join } from 'path';
import pino from 'pino';
import { prisma } from '../lib/db';
import { NotionClient } from '../notion/client';
import { NotionPollerService } from '../services/notion-poller';

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

async function testPoller() {
  // Check required environment variables
  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionToken || notionToken === 'your_notion_integration_token_here') {
    logger.error('❌ NOTION_TOKEN not set in .env file');
    process.exit(1);
  }

  if (!databaseId || databaseId === 'your_notion_database_id_here') {
    logger.error('❌ NOTION_DATABASE_ID not set in .env file');
    process.exit(1);
  }

  logger.info('🚀 Starting Notion poller test...');

  try {
    // Get or create the test pair
    const pair = await prisma.pair.findFirst({
      include: {
        notionConfig: true,
        user1: true,
        user2: true,
      },
    });

    if (!pair) {
      logger.error('❌ No pair found in database. Run pnpm db:seed first.');
      process.exit(1);
    }

    logger.info(`Using pair: ${pair.user1.name} & ${pair.user2.name}`);

    // Update Notion config with real credentials
    if (pair.notionConfig) {
      await prisma.notionConfig.update({
        where: { id: pair.notionConfig.id },
        data: {
          integrationToken: notionToken,
          databaseId: databaseId,
        },
      });
    } else {
      await prisma.notionConfig.create({
        data: {
          pairId: pair.id,
          integrationToken: notionToken,
          databaseId: databaseId,
        },
      });
    }

    // Initialize Notion client
    const notionClient = new NotionClient({
      integrationToken: notionToken,
      databaseId: databaseId,
    });

    // Create poller service
    const poller = new NotionPollerService({
      notionClient,
      pairId: pair.id,
      pollInterval: 10000, // Poll every 10 seconds for testing
    });

    logger.info('📊 Current database state:');
    
    // Show current tasks
    const currentTasks = await prisma.taskMirror.count();
    const currentEvents = await prisma.taskEvent.count();
    logger.info(`  - Tasks in mirror: ${currentTasks}`);
    logger.info(`  - Task events: ${currentEvents}`);

    // Start polling
    logger.info('\n🔄 Starting poller (polling every 10 seconds)...');
    await poller.start();

    // Run for 2 minutes
    logger.info('⏰ Running for 2 minutes. Try these actions in Notion:');
    logger.info('  1. Create a new task');
    logger.info('  2. Change a task status to "Done"');
    logger.info('  3. Edit task titles or due dates');
    logger.info('\n📝 Events will be logged as they occur...\n');

    // Monitor events in real-time
    const startTime = Date.now();
    const duration = 2 * 60 * 1000; // 2 minutes

    while (Date.now() - startTime < duration) {
      // Check for new events
      const recentEvents = await prisma.taskEvent.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 11000), // Last 11 seconds
          },
        },
        include: {
          taskMirror: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      for (const event of recentEvents) {
        logger.info({
          event: event.eventType,
          task: event.taskMirror.title,
          previousStatus: event.previousStatus,
          newStatus: event.newStatus,
          time: event.createdAt.toLocaleTimeString(),
        }, `🎯 Event detected!`);
      }

      // Show periodic status
      if ((Date.now() - startTime) % 30000 < 1000) {
        const status = poller.getStatus();
        const totalTasks = await prisma.taskMirror.count();
        const totalEvents = await prisma.taskEvent.count();
        logger.info({
          tasksInMirror: totalTasks,
          totalEvents: totalEvents,
          lastSync: status.lastSyncAt?.toLocaleTimeString(),
        }, '📊 Status update');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Stop poller
    poller.stop();
    
    // Final summary
    logger.info('\n📈 Test completed! Summary:');
    
    const finalTasks = await prisma.taskMirror.count();
    const finalEvents = await prisma.taskEvent.count();
    const completedEvents = await prisma.taskEvent.count({
      where: { eventType: 'completed' },
    });

    logger.info(`  - Total tasks synced: ${finalTasks}`);
    logger.info(`  - Total events generated: ${finalEvents}`);
    logger.info(`  - Completion events: ${completedEvents}`);

    // Show recent events
    const recentEvents = await prisma.taskEvent.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { taskMirror: true },
    });

    if (recentEvents.length > 0) {
      logger.info('\n📋 Recent events:');
      for (const event of recentEvents) {
        logger.info(`  - ${event.eventType}: "${event.taskMirror.title}" (${event.previousStatus || 'new'} → ${event.newStatus})`);
      }
    }

  } catch (error) {
    logger.error(error, '❌ Test failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPoller().catch(error => {
  logger.error(error, 'Unhandled error');
  process.exit(1);
});
