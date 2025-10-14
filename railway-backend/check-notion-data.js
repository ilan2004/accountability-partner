#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function checkNotionData() {
  console.log('🔍 Checking Notion integration data in database...');
  console.log('==================================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Get all users with Notion data
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        notion_id,
        notion_access_token,
        notion_workspace_id,
        notion_workspace_name,
        notion_task_database_id,
        last_notion_sync,
        created_at
      `)
      .order('created_at', { ascending: false });
      
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`👥 Total users in database: ${users?.length || 0}\n`);
    
    // Show detailed Notion data for each user
    users?.forEach((user, index) => {
      console.log(`👤 User ${index + 1}: ${user.name}`);
      console.log(`   🆔 ID: ${user.id}`);
      console.log(`   📅 Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log(`   \n🔗 Notion Integration:`);
      console.log(`   📋 Notion ID: ${user.notion_id || '❌ Not set'}`);
      console.log(`   🔑 Access Token: ${user.notion_access_token ? '✅ Present (' + user.notion_access_token.substring(0, 20) + '...)' : '❌ Not set'}`);
      console.log(`   🏢 Workspace ID: ${user.notion_workspace_id || '❌ Not set'}`);
      console.log(`   📝 Workspace Name: ${user.notion_workspace_name || '❌ Not set'}`);
      console.log(`   🗂️ Task Database ID: ${user.notion_task_database_id || '❌ Not set'}`);
      console.log(`   ⏰ Last Sync: ${user.last_notion_sync ? new Date(user.last_notion_sync).toLocaleString() : '❌ Never synced'}`);
      console.log('');
    });
    
    // Check which fields are missing
    const missingFields = [];
    users?.forEach(user => {
      if (!user.notion_workspace_id) missingFields.push('workspace_id');
      if (!user.notion_workspace_name) missingFields.push('workspace_name');
      if (!user.notion_task_database_id) missingFields.push('task_database_id');
    });
    
    if (missingFields.length > 0) {
      console.log('⚠️  Missing Notion integration data:');
      [...new Set(missingFields)].forEach(field => {
        console.log(`   - ${field}`);
      });
      
      console.log('\n💡 Possible solutions:');
      console.log('1. Check browser console during authentication to see what data Supabase provides');
      console.log('2. The Notion OAuth might not include workspace metadata');
      console.log('3. We might need to call Notion API separately to get workspace info');
      console.log('4. Workspace ID might need to be configured manually');
    } else {
      console.log('✅ All Notion integration data is present!');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
  
  process.exit(0);
}

// Run the check
checkNotionData();
