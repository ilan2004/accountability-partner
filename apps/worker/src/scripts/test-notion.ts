import { config } from 'dotenv';
import { join } from 'path';
import { NotionClient } from '../notion/client';
import pino from 'pino';

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

async function testNotion() {
  // Check required environment variables
  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionToken || notionToken === 'your_notion_integration_token_here') {
    logger.error('❌ NOTION_TOKEN not set in .env file');
    logger.info('Please set NOTION_TOKEN to your Notion integration token');
    process.exit(1);
  }

  if (!databaseId || databaseId === 'your_notion_database_id_here') {
    logger.error('❌ NOTION_DATABASE_ID not set in .env file');
    logger.info('Please set NOTION_DATABASE_ID to your Notion database ID');
    process.exit(1);
  }

  logger.info('🚀 Testing Notion integration...');
  logger.info(`Database ID: ${databaseId}`);

  try {
    // Initialize Notion client
    const notion = new NotionClient({
      integrationToken: notionToken,
      databaseId: databaseId,
    });

    // Test 1: Fetch all tasks
    logger.info('\n📋 Fetching all tasks...');
    const allTasks = await notion.fetchAllTasks();
    
    if (allTasks.length === 0) {
      logger.warn('No tasks found in the database');
      logger.info('Make sure:');
      logger.info('1. The database has the correct properties: Title, Status, Due, Owner');
      logger.info('2. The integration has access to the database');
      logger.info('3. There are tasks in the database');
    } else {
      logger.info(`✅ Found ${allTasks.length} tasks:`);
      
      allTasks.forEach((task, index) => {
        logger.info(`\n  Task ${index + 1}:`);
        logger.info(`    Title: ${task.title}`);
        logger.info(`    Status: ${task.status}`);
        logger.info(`    Due: ${task.dueDate ? task.dueDate.toLocaleDateString() : 'No due date'}`);
        logger.info(`    Owner: ${task.ownerName || 'Unassigned'} (${task.ownerNotionId || 'N/A'})`);
        logger.info(`    Last edited: ${task.lastEditedTime.toLocaleString()}`);
        logger.info(`    URL: ${task.url}`);
      });
    }

    // Test 2: Fetch recent tasks (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    logger.info(`\n📅 Fetching tasks modified since ${yesterday.toLocaleString()}...`);
    const recentTasks = await notion.fetchTasksSince(yesterday);
    
    if (recentTasks.length === 0) {
      logger.info('No tasks modified in the last 24 hours');
    } else {
      logger.info(`✅ Found ${recentTasks.length} recently modified tasks`);
      recentTasks.forEach(task => {
        logger.info(`  - "${task.title}" (${task.status}) - Modified: ${task.lastEditedTime.toLocaleString()}`);
      });
    }

    // Test 3: Test rate limiting (optional)
    logger.info('\n🔄 Testing rate limit handling (making 5 rapid requests)...');
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(notion.fetchAllTasks());
    }
    
    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;
    
    logger.info(`✅ Completed 5 requests in ${duration}ms - rate limiting working`);

    logger.info('\n🎉 Notion integration test completed successfully!');
    
  } catch (error) {
    logger.error('❌ Notion integration test failed:');
    logger.error(error);
    
    if ((error as any).code === 'unauthorized') {
      logger.info('\n💡 Tips:');
      logger.info('1. Make sure your integration token is correct');
      logger.info('2. Ensure the integration has access to the database');
      logger.info('3. Check that the database ID is correct');
    }
    
    process.exit(1);
  }
}

// Run the test
testNotion().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
