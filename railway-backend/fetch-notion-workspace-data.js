#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function fetchNotionWorkspaceData() {
  console.log('🔍 Fetching missing Notion workspace data...');
  console.log('============================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Get users with access tokens but missing workspace data
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .not('notion_access_token', 'is', null)
      .is('notion_workspace_id', null);
      
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('✅ No users need workspace data updates.');
      return;
    }
    
    console.log(`👥 Found ${users.length} user(s) that need workspace data:\n`);
    
    for (const user of users) {
      console.log(`🔄 Processing user: ${user.name} (${user.notion_id})`);
      
      try {
        // Call Notion API to get workspace info
        const response = await fetch('https://api.notion.com/v1/users/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.notion_access_token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.log(`   ❌ Failed to fetch workspace data: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const notionUser = await response.json();
        console.log('   📡 Notion API Response:', JSON.stringify(notionUser, null, 2));
        
        // Extract workspace information
        const workspaceId = notionUser.owner?.workspace?.id || null;
        const workspaceName = notionUser.owner?.workspace?.name || 
                             notionUser.workspace?.name || 
                             'Team Workspace';
        
        console.log(`   🏢 Workspace ID: ${workspaceId || 'Not found'}`);
        console.log(`   📝 Workspace Name: ${workspaceName}`);
        
        // Now try to find a task database - call list databases API
        const dbResponse = await fetch('https://api.notion.com/v1/databases', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.notion_access_token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        });
        
        let taskDatabaseId = null;
        if (dbResponse.ok) {
          const databases = await dbResponse.json();
          console.log(`   📊 Found ${databases.results?.length || 0} accessible databases`);
          
          // Look for a database that might be for tasks
          const taskDb = databases.results?.find(db => 
            db.title?.some(title => 
              title.plain_text?.toLowerCase().includes('task') ||
              title.plain_text?.toLowerCase().includes('todo') ||
              title.plain_text?.toLowerCase().includes('accountability')
            )
          );
          
          if (taskDb) {
            taskDatabaseId = taskDb.id;
            const dbTitle = taskDb.title?.[0]?.plain_text || 'Unknown';
            console.log(`   🗂️ Found potential task database: "${dbTitle}" (${taskDatabaseId})`);
          } else {
            console.log(`   🗂️ No obvious task database found in accessible databases`);
          }
        } else {
          console.log(`   ❌ Failed to fetch databases: ${dbResponse.status}`);
        }
        
        // Update user record
        const updates = {
          notion_workspace_id: workspaceId,
          notion_workspace_name: workspaceName,
          notion_task_database_id: taskDatabaseId,
          last_notion_sync: new Date().toISOString()
        };
        
        const { error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id);
          
        if (updateError) {
          console.log(`   ❌ Failed to update user: ${updateError.message}`);
        } else {
          console.log(`   ✅ Updated user with workspace data`);
        }
        
      } catch (apiError) {
        console.log(`   ❌ Error calling Notion API: ${apiError.message}`);
      }
      
      console.log('');
    }
    
    console.log('🎉 Workspace data fetch complete!');
    console.log('\n💡 Next steps:');
    console.log('1. Run check-notion-data.js to verify the updates');
    console.log('2. If task database ID is missing, you may need to create or configure one manually');
    console.log('3. The system should now have all necessary Notion integration data');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
  
  process.exit(0);
}

// Run the fetch
fetchNotionWorkspaceData();
