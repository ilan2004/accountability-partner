#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function updateWorkspaceData() {
  console.log('🔄 Updating workspace data with correct information...');
  console.log('==================================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Get the user we just processed
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
    console.log(`👤 Updating user: ${user.name}`);
    
    // Based on the API response we saw, extract the correct workspace data
    const workspaceId = 'efda098e-a37a-815c-a901-0003d298961c'; // From bot.workspace_id
    const workspaceName = "Ilan Usman's Workspace"; // From bot.workspace_name
    
    console.log(`🏢 Workspace ID: ${workspaceId}`);
    console.log(`📝 Workspace Name: ${workspaceName}`);
    
    // Update user record with correct data
    const updates = {
      notion_workspace_id: workspaceId,
      notion_workspace_name: workspaceName,
      last_notion_sync: new Date().toISOString()
    };
    
    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);
      
    if (updateError) {
      console.log(`❌ Failed to update user: ${updateError.message}`);
    } else {
      console.log(`✅ Updated user with correct workspace data`);
    }
    
    console.log('\n🎯 Current status:');
    console.log('✅ Notion ID: Present');
    console.log('✅ Access Token: Present'); 
    console.log('✅ Workspace ID: Now updated');
    console.log('✅ Workspace Name: Now updated');
    console.log('⚠️  Task Database ID: Still needs to be configured');
    
    console.log('\n💡 Next steps for Task Database ID:');
    console.log('1. Create a new database in your Notion workspace for tasks');
    console.log('2. Make sure it has properties like: Task Name, Status, Priority, Due Date');
    console.log('3. Share the database with your Notion integration');
    console.log('4. Get the database ID from the URL or API and update manually');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
  
  process.exit(0);
}

// Run the update
updateWorkspaceData();
