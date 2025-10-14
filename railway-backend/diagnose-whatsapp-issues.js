#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function diagnoseWhatsAppIssues() {
  console.log('🔍 Diagnosing WhatsApp Notification Issues...');
  console.log('===============================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // 1. Check WhatsApp Group JID configuration
    console.log('1️⃣ WhatsApp Configuration Check:');
    console.log(`   Group JID: ${process.env.WA_GROUP_JID}`);
    console.log(`   Session Path: ${process.env.WA_AUTH_PATH || './railway-session'}`);
    console.log(`   Print QR: ${process.env.WA_PRINT_QR}`);
    
    // 2. Verify the group JID format
    const groupJid = process.env.WA_GROUP_JID;
    if (!groupJid) {
      console.log('❌ WA_GROUP_JID is not set!');
    } else if (!groupJid.includes('@g.us')) {
      console.log('❌ Group JID format looks wrong - should end with @g.us');
    } else {
      console.log('✅ Group JID format looks correct');
    }
    
    console.log('\n2️⃣ Database Activity Check:');
    
    // Check recent task updates
    const { data: recentTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(5);
      
    if (tasksError) {
      console.error('❌ Error fetching tasks:', tasksError);
    } else {
      console.log(`   Found ${recentTasks?.length || 0} recent tasks:`);
      recentTasks?.forEach((task, i) => {
        console.log(`   ${i+1}. "${task.task_name}" - ${task.status} (updated: ${new Date(task.updated_at).toLocaleString()})`);
      });
    }
    
    // Check user sync status
    const { data: users } = await supabase
      .from('users')
      .select('name, last_notion_sync')
      .not('notion_access_token', 'is', null);
      
    console.log('\n   User sync status:');
    users?.forEach(user => {
      const lastSync = user.last_notion_sync ? new Date(user.last_notion_sync).toLocaleString() : 'Never';
      console.log(`   - ${user.name}: Last sync ${lastSync}`);
    });
    
    console.log('\n3️⃣ Common Issues & Solutions:');
    
    console.log('\n   📱 WhatsApp Issues:');
    console.log('   • Group ID might be wrong - check the actual group');
    console.log('   • Phone not connected to WhatsApp Web');
    console.log('   • Bot not added to the group properly');
    console.log('   • Messages going to different group/chat');
    
    console.log('\n   🔧 Quick Fixes to Try:');
    console.log('   1. Check WhatsApp Web - look for bot messages in any chat');
    console.log('   2. Verify the group ID by checking WhatsApp group info');
    console.log('   3. Make sure your phone has internet and WhatsApp is open');
    console.log('   4. Try creating a new group and updating WA_GROUP_JID');
    
    console.log('\n4️⃣ Testing Group ID:');
    console.log('   Current Group ID:', groupJid);
    console.log('   📋 To get correct Group ID:');
    console.log('   1. Open WhatsApp Web');
    console.log('   2. Go to group info');
    console.log('   3. Look at URL or use WhatsApp bot tools to get JID');
    
    console.log('\n5️⃣ Alternative Testing:');
    console.log('   💡 Try sending to your personal number first:');
    console.log('   1. Get your WhatsApp number JID (your_number@s.whatsapp.net)');
    console.log('   2. Test with personal chat instead of group');
    console.log('   3. Once personal messages work, fix group JID');
    
    // 6. Check if Railway is actually running
    console.log('\n6️⃣ Railway Status Check:');
    console.log('   🚂 Your Railway backend should be running continuously');
    console.log('   📊 Check Railway dashboard for:');
    console.log('   - Service status (running/stopped)');
    console.log('   - Recent logs');
    console.log('   - Memory/CPU usage');
    console.log('   - Any error messages');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  }
  
  console.log('\n💡 Next Steps:');
  console.log('1. Check WhatsApp Web for any bot messages (even in wrong chats)');
  console.log('2. Verify Railway backend is running (check Railway dashboard)'); 
  console.log('3. Test with personal WhatsApp number first');
  console.log('4. Create new group and get correct Group JID');
  console.log('5. Check phone connectivity and WhatsApp Web session');
  
  process.exit(0);
}

// Run diagnosis
diagnoseWhatsAppIssues();
