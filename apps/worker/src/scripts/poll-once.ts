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

async function pollOnce() {
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

  try {
    // Get pair
    const pair = await prisma.pair.findFirst({
      include: { notionConfig: true },
    });

    if (!pair) {
      logger.error('❌ No pair found. Run pnpm db:seed first.');
      process.exit(1);
    }

    // Update Notion config if needed
    if (!pair.notionConfig || 
        pair.notionConfig.integrationToken !== notionToken ||
        pair.notionConfig.databaseId !== databaseId) {
      
      if (pair.notionConfig) {
        await prisma.notionConfig.update({
          where: { id: pair.notionConfig.id },
          data: { integrationToken: notionToken, databaseId },
        });
      } else {
        await prisma.notionConfig.create({
          data: { pairId: pair.id, integrationToken: notionToken, databaseId },
        });
      }
    }

    // Initialize services
    const notionClient = new NotionClient({
      integrationToken: notionToken,
      databaseId: databaseId,
    });

    const poller = new NotionPollerService({
      notionClient,
      pairId: pair.id,
    });

    logger.info('🔄 Running single poll cycle...\n');

    // Show before state
    const beforeTasks = await prisma.taskMirror.count();
    const beforeEvents = await prisma.taskEvent.count();
    logger.info(`📊 Before: ${beforeTasks} tasks, ${beforeEvents} events`);

    // Run single poll
    await poller.pollOnce();

    // Show after state
    const afterTasks = await prisma.taskMirror.count();
    const afterEvents = await prisma.taskEvent.count();
    logger.info(`📊 After: ${afterTasks} tasks, ${afterEvents} events`);

    // Show new events
    const newEvents = await prisma.taskEvent.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60000), // Last minute
        },
      },
      include: { taskMirror: true },
      orderBy: { createdAt: 'desc' },
    });

    if (newEvents.length > 0) {
      logger.info('\n🎯 New events:');
      for (const event of newEvents) {
        logger.info(`  - ${event.eventType}: "${event.taskMirror.title}" (${event.previousStatus || 'new'} → ${event.newStatus})`);
      }
    } else {
      logger.info('\nℹ️  No new events generated');
    }

    logger.info('\n✅ Poll cycle complete!');

  } catch (error) {
    logger.error(error, '❌ Poll failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
pollOnce().catch(error => {
  logger.error(error, 'Unhandled error');
  process.exit(1);
});
