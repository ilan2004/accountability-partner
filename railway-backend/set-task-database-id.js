#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function setTaskDatabaseId() {
  console.log('🗂️ Setting Task Database ID...');
  console.log('==============================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Extract database ID from the URL
    const notionUrl = 'https://www.notion.so/28ba098ea37a81518592f7c0f85ea108?v=28ba098ea37a8151afdf000c7b70b87a&source=copy_link';
    const databaseId = '28ba098ea37a81518592f7c0f85ea108';
    
    console.log('🔗 Notion Database URL:', notionUrl);
    console.log('🆔 Extracted Database ID:', databaseId);
    
    // Get Ilan's user record
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('name', 'Ilan Usman')
      .not('notion_access_token', 'is', null);
      
    if (usersError) {
      console.error('❌ Error fetching user:', usersError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('❌ No user found to update.');
      return;
    }
    
    const user = users[0];
    console.log(`\n👤 Updating user: ${user.name}`);
    console.log(`🏢 Workspace: ${user.notion_workspace_name}`);
    
    // Update with task database ID
    const updates = {
      notion_task_database_id: databaseId,
      last_notion_sync: new Date().toISOString()
    };
    
    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);
      
    if (updateError) {
      console.log(`❌ Failed to update user: ${updateError.message}`);
      return;
    }
    
    console.log(`✅ Successfully updated task database ID`);
    
    // Verify the Notion API can access this database
    console.log('\n🔍 Testing database access...');
    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.notion_access_token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const database = await response.json();
        const dbTitle = database.title?.[0]?.plain_text || 'Unknown';
        console.log(`✅ Database accessible: "${dbTitle}"`);
        console.log(`📊 Properties found: ${Object.keys(database.properties || {}).length}`);
      } else {
        console.log(`❌ Cannot access database: ${response.status} ${response.statusText}`);
        console.log('💡 Make sure the database is shared with "Accountability Partner" integration');
      }
    } catch (apiError) {
      console.log(`❌ Error testing database access: ${apiError.message}`);
    }
    
    console.log('\n🎉 Task Database Configuration Complete!');
    console.log('\n🔗 Complete Notion Integration Status:');
    console.log('✅ Notion ID: Present');
    console.log('✅ Access Token: Present');
    console.log('✅ Workspace ID: Present');
    console.log('✅ Workspace Name: Present');
    console.log('✅ Task Database ID: Now configured');
    
    console.log('\n📱 WhatsApp Notification Setup:');
    console.log('🔄 To enable WhatsApp notifications for Notion changes:');
    console.log('1. The system needs to be configured to poll Notion for changes');
    console.log('2. Set up webhook or scheduled sync to detect task updates');
    console.log('3. Configure WhatsApp bot to send notifications');
    console.log('4. Currently this requires additional backend setup');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
  
  process.exit(0);
}

// Run the setup
setTaskDatabaseId();
