const NotionSyncService = require('./services/notion-sync');
require('dotenv').config();

async function testSync() {
  console.log('🔄 Starting manual Notion sync test...\n');
  
  const notionSync = new NotionSyncService();
  
  // Run sync for all users
  const result = await notionSync.syncAllUsers();
  
  console.log('\n📊 SYNC RESULTS:');
  console.log(`- Total changes detected: ${result.changes.length}`);
  console.log(`- Errors: ${result.errors.length}`);
  
  if (result.changes.length > 0) {
    console.log('\n📝 Changes:');
    result.changes.forEach(change => {
      console.log(`  - ${change.type}: "${change.task.task_name}"`);
    });
  }
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
  }
  
  // Also check the database directly
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data: tasks } = await supabase
    .from('tasks')
    .select('task_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('\n📋 Latest tasks in database:');
  tasks?.forEach(task => {
    console.log(`  - "${task.task_name}" (${task.status}) - Created: ${new Date(task.created_at).toLocaleString()}`);
  });
  
  process.exit(0);
}

testSync().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
