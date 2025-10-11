import { config } from 'dotenv';
import pino from 'pino';
import { NotionClient } from '../notion/client';
import { NotionPollerService } from '../services/notion-poller-supabase';
import { NotificationService } from '../services/notification-service-supabase';

// Load environment
config();

const logger = pino({ level: 'debug', name: 'test-dynamic-backoff' });

async function simulateIdleSystem() {
  logger.info('🧪 Testing dynamic backoff behavior');
  
  const pairId = process.env.PAIR_ID;
  const notionToken = process.env.NOTION_TOKEN;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;
  
  if (!pairId || !notionToken || !notionDatabaseId) {
    logger.error('Required environment variables missing');
    return;
  }
  
  // Initialize services
  const notionClient = new NotionClient({
    integrationToken: notionToken,
    databaseId: notionDatabaseId,
  });
  
  const poller = new NotionPollerService({
    notionClient,
    pairId,
  });
  
  const notifier = new NotificationService({
    whatsappClient: null, // Testing without WhatsApp
    pairId,
  });
  
  logger.info('\n📊 Initial status:');
  logger.info('Poller:', poller.getStatus());
  logger.info('Notifier:', notifier.getStatus());
  
  // Test 1: Simulate idle polling (no changes)
  logger.info('\n🔄 Test 1: Simulating idle polling cycles...');
  
  for (let i = 0; i < 5; i++) {
    logger.info(`\n--- Poll cycle ${i + 1} ---`);
    await poller.pollOnce();
    const pollerStatus = poller.getStatus();
    logger.info({
      cycle: i + 1,
      currentInterval: pollerStatus.currentPollInterval,
      minInterval: pollerStatus.minPollInterval,
      maxInterval: pollerStatus.maxPollInterval,
    }, 'Poller interval status');
  }
  
  // Test 2: Simulate idle notification processing (no events)
  logger.info('\n🔔 Test 2: Simulating idle notification processing...');
  
  for (let i = 0; i < 5; i++) {
    logger.info(`\n--- Process cycle ${i + 1} ---`);
    await notifier.processUnsentEvents();
    const notifierStatus = notifier.getStatus();
    logger.info({
      cycle: i + 1,
      currentInterval: notifierStatus.currentProcessInterval,
      minInterval: notifierStatus.minProcessInterval,
      maxInterval: notifierStatus.maxProcessInterval,
    }, 'Notifier interval status');
  }
  
  logger.info('\n✅ Dynamic backoff test completed!');
  logger.info('\n📈 Summary:');
  logger.info('- Poller should have increased interval from 30s → 60s → 120s → max 180s');
  logger.info('- Notifier should have increased interval from 5s → 10s → 20s → 40s → max 60s');
  logger.info('- When activity is detected, intervals should reset to minimum');
}

async function test() {
  try {
    await simulateIdleSystem();
  } catch (error) {
    logger.error({ error }, '❌ Test failed');
  }
}

// Run test
test().catch(error => {
  logger.error({ error }, 'Unhandled error');
  process.exit(1);
});
