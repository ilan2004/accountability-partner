import { config } from 'dotenv';
import { join } from 'path';
import { SupabaseWorkerHelpers } from '../lib/supabase';
import { MessageFormatter } from '../services/message-formatter';
import pino from 'pino';

// Load environment variables from root
config({ path: '.env' });

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function testTaskFiltering() {
  logger.info('🔍 Testing task filtering and list generation...');
  
  try {
    const pairId = process.env.PAIR_ID;
    if (!pairId) {
      logger.error('❌ PAIR_ID not found in environment variables');
      return;
    }
    
    logger.info(`📊 Using pair ID: ${pairId}`);
    
    // Get all tasks for the pair
    const allTasks = await SupabaseWorkerHelpers.getAllTasksForPair(pairId);
    logger.info(`📋 Total tasks found: ${allTasks.length}`);
    
    // Show status breakdown
    const statusCounts: Record<string, number> = {};
    for (const task of allTasks) {
      const status = (task as any).status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      logger.info(`  Task: "${(task as any).title}" | Status: "${status}" | Owner: ${(task as any).owner?.name}`);
    }
    
    logger.info('\n📊 Status breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      logger.info(`  "${status}": ${count} tasks`);
    });
    
    // Test the improved filter
    const openTasks = allTasks.filter(t => {
      const status = (t as any).status;
      return status && status.toLowerCase() !== 'done';
    });
    
    logger.info(`\n✅ Open tasks after filtering: ${openTasks.length}`);
    
    // Test message formatting
    const formatter = new MessageFormatter();
    const context = {
      tasks: openTasks,
      totalCount: openTasks.length,
      maxTasksPerOwner: 10
    };
    
    const message = formatter.formatTaskListByOwner(context);
    logger.info('\n📝 Generated message:');
    logger.info('---');
    logger.info(message);
    logger.info('---');
    
    if (openTasks.length === 0) {
      logger.warn('⚠️  No open tasks found - this might be why you see "No open tasks at the moment"');
      logger.info('💡 Possible reasons:');
      logger.info('   - All tasks are marked as "Done" (or "done")');
      logger.info('   - No tasks exist in the database');
      logger.info('   - Tasks are not properly synced from Notion');
    } else {
      logger.info('✅ Task filtering is working correctly!');
    }
    
  } catch (error) {
    logger.error('❌ Error testing task filtering:', error);
  }
}

testTaskFiltering();
