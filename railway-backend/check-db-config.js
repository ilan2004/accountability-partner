const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseConfig() {
  try {
    // Get all users with Notion access
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .not('notion_access_token', 'is', null);
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    console.log('\n=== NOTION DATABASE CONFIGURATION CHECK ===\n');
    
    for (const user of users) {
      console.log(`User: ${user.name}`);
      console.log(`  - User ID: ${user.id}`);
      console.log(`  - Notion Access: ${user.notion_access_token ? '✓' : '✗'}`);
      console.log(`  - Task Database ID: ${user.notion_task_database_id || 'NOT CONFIGURED'}`);
      
      if (!user.notion_task_database_id) {
        console.log(`  ⚠️  WARNING: No task database configured for ${user.name}`);
        console.log(`     The sync won't work until a database ID is set.`);
        
        // Try to discover databases
        const NotionSyncService = require('./services/notion-sync');
        const notionSync = new NotionSyncService();
        
        console.log(`\n  🔍 Attempting to discover Notion databases for ${user.name}...`);
        const databases = await notionSync.discoverUserTaskDatabases(user.id);
        
        if (databases.length > 0) {
          console.log(`  📋 Found ${databases.length} potential task database(s):`);
          databases.forEach(db => {
            console.log(`     - "${db.title}" (ID: ${db.id})`);
          });
          console.log(`\n  💡 To fix: Update the user's notion_task_database_id with one of these IDs`);
        } else {
          console.log(`  ❌ No task databases found. Make sure the user has a Notion database with tasks.`);
        }
      }
      console.log('\n---\n');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkDatabaseConfig();
