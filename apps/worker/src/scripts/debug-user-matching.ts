import { config } from 'dotenv';
import { join } from 'path';
import { SupabaseWorkerHelpers, supabase } from '../lib/supabase';
import { NotionClient } from '../notion/client';
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

async function debugUserMatching() {
  logger.info('🔍 Debugging user matching issues...');
  
  try {
    const pairId = process.env.PAIR_ID;
    const notionToken = process.env.NOTION_TOKEN;
    const notionDatabaseId = process.env.NOTION_DATABASE_ID;
    
    if (!pairId || !notionToken || !notionDatabaseId) {
      logger.error('❌ Missing required environment variables');
      return;
    }
    
    // 1. Check users in the database
    logger.info('\n📊 Users in database:');
    const pair = await SupabaseWorkerHelpers.getPairWithUsers(pairId);
    if (!pair) {
      logger.error('❌ No pair found with ID:', pairId);
      return;
    }
    
    logger.info(`  User 1: "${pair.user1.name}" (ID: ${pair.user1.id}) (Notion ID: ${pair.user1.notionId || 'None'})`);
    logger.info(`  User 2: "${pair.user2.name}" (ID: ${pair.user2.id}) (Notion ID: ${pair.user2.notionId || 'None'})`);
    
    // 2. Check the recent task from Notion
    logger.info('\n📋 Recent tasks from Notion:');
    const notionClient = new NotionClient({
      integrationToken: notionToken,
      databaseId: notionDatabaseId
    });
    
    // Get the most recent task
    const recentTasks = await notionClient.fetchTasksSince(new Date(Date.now() - 60 * 60 * 1000)); // Last hour
    
    if (recentTasks.length === 0) {
      logger.warn('⚠️ No recent tasks found in the last hour');
    }
    
    for (const task of recentTasks.slice(0, 5)) { // Show last 5 tasks
      logger.info(`  Task: "${task.title}"`);
      logger.info(`    Owner Name: "${task.ownerName}"`);
      logger.info(`    Owner Notion ID: "${task.ownerNotionId}"`);
      logger.info(`    Status: "${task.status}"`);
      logger.info(`    Last Edited: ${task.lastEditedTime}`);
      
      // Try to match this user
      let matchedUser = null;
      if (task.ownerNotionId) {
        matchedUser = await SupabaseWorkerHelpers.findUserByNotionId(task.ownerNotionId);
        if (matchedUser) {
          logger.info(`    ✅ Matched by Notion ID to: "${matchedUser.name}"`);
        } else {
          logger.warn(`    ❌ No user found with Notion ID: "${task.ownerNotionId}"`);
        }
      }
      
      if (!matchedUser && task.ownerName) {
        matchedUser = await SupabaseWorkerHelpers.findUserByName(task.ownerName);
        if (matchedUser) {
          logger.info(`    ✅ Matched by name to: "${matchedUser.name}"`);
        } else {
          logger.warn(`    ❌ No user found with name: "${task.ownerName}"`);
        }
      }
      
      if (!matchedUser) {
        logger.error(`    🚫 NO MATCH FOUND - This task will be skipped!`);
        
        // Suggest solutions
        logger.info('    💡 Solutions:');
        logger.info('      1. Update user name in database to match Notion');
        logger.info('      2. Set Notion ID for user in database');
        logger.info('      3. Update assignee name in Notion to match database');
      }
      
      logger.info(''); // Empty line for readability
    }
    
    // 3. Check if we can auto-fix by updating Notion IDs
    logger.info('\n🔧 Auto-fix suggestions:');
    for (const task of recentTasks) {
      if (task.ownerName && task.ownerNotionId) {
        // Try to find by similar name
        const users = [pair.user1, pair.user2];
        for (const user of users) {
          const userName = user.name?.toLowerCase() || '';
          const taskOwnerName = task.ownerName.toLowerCase();
          
          if (userName.includes(taskOwnerName) || taskOwnerName.includes(userName)) {
            logger.info(`💡 Suggestion: Link "${user.name}" to Notion ID "${task.ownerNotionId}"`);
            
            // Ask if we should auto-fix
            logger.info('   To auto-fix, run: UPDATE "User" SET "notionId" = \'${task.ownerNotionId}\' WHERE id = \'${user.id}\';');
          }
        }
      }
    }
    
    // 4. Show current task mirrors
    logger.info('\n📋 Current tasks in database:');
    const allTasks = await SupabaseWorkerHelpers.getAllTasksForPair(pairId);
    logger.info(`Total tasks: ${allTasks.length}`);
    
    for (const task of allTasks.slice(-5)) { // Show last 5 tasks
      logger.info(`  "${(task as any).title}" - Owner: ${(task as any).owner?.name} - Status: ${(task as any).status}`);
    }
    
  } catch (error) {
    logger.error('❌ Error debugging user matching:', error);
  }
}

debugUserMatching();
