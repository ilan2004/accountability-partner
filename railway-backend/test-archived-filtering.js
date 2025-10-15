#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const NotionSyncService = require('./services/notion-sync');

async function testArchivedFiltering() {
  console.log('🧪 Testing Archived Task Filtering');
  console.log('================================\n');
  
  const syncService = new NotionSyncService();
  
  try {
    // Get all users
    const users = await syncService.getAllUsers();
    console.log(`👥 Found ${users.length} users with Notion access\n`);
    
    for (const user of users) {
      console.log(`🔍 Testing for ${user.name}:`);
      console.log('-'.repeat(30));
      
      // Get user's task database ID
      const databaseId = await syncService.getUserTaskDatabaseId(user.id);
      if (!databaseId) {
        console.log('⚠️ No task database configured');
        continue;
      }
      
      console.log(`📋 Database ID: ${databaseId}`);
      
      // Get Notion client
      const notion = await syncService.getNotionClientForUser(user.id);
      if (!notion) {
        console.log('⚠️ No Notion client available');
        continue;
      }
      
      // Test the new filtering logic
      console.log('🔄 Fetching tasks with archive filtering...');
      const tasks = await syncService.fetchTasksFromNotion(notion, databaseId);
      
      console.log(`✅ Retrieved ${tasks.length} active tasks`);
      
      if (tasks.length > 0) {
        console.log('\n📝 Active tasks found:');
        tasks.forEach((task, index) => {
          console.log(`  ${index + 1}. ${task.task_name} (${task.status})`);
        });
      }
      
      console.log('');
    }
    
    console.log('✅ Archive filtering test complete!');
    console.log('\n🔧 What this fix does:');
    console.log('  - Filters out tasks with "Archived" checkbox = true');
    console.log('  - Skips pages that are archived at the Notion page level');
    console.log('  - Fallback logic if database doesn\'t have "Archived" property');
    console.log('  - Should significantly reduce task count if you had archived items');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

// Run the test
testArchivedFiltering();
