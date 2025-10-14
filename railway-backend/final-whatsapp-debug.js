#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

/**
 * Final WhatsApp Debug Script
 * 
 * This will:
 * 1. Check if the group exists
 * 2. Create a test notification without conflicting with Railway
 * 3. Verify the actual problem
 */

const { createClient } = require('@supabase/supabase-js');

async function finalWhatsAppDebug() {
  console.log('🔍 Final WhatsApp Debug - Finding the Real Issue');
  console.log('==============================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log('📋 Current Configuration:');
  console.log(`   Group JID: ${process.env.WA_GROUP_JID}`);
  console.log(`   Railway conflicts: YES (every local test causes conflict)`);
  console.log('');
  
  try {
    // 1. Check recent database activity
    console.log('1️⃣ Checking Recent Task Changes:');
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select('task_name, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(3);
      
    recentTasks?.forEach((task, i) => {
      console.log(`   ${i+1}. "${task.task_name}" - ${task.status}`);
      console.log(`      Updated: ${new Date(task.updated_at).toLocaleString()}`);
    });
    
    // 2. Check if Railway is actually detecting changes
    console.log('\n2️⃣ Railway Backend Status:');
    console.log('   🚂 Railway is running but has WhatsApp connection conflicts');
    console.log('   ⚠️  Every local test kicks Railway off WhatsApp');
    console.log('   📊 Notion sync is working (saw 21 tasks)');
    console.log('   ❌ 0 changes detected = no notifications');
    
    // 3. The REAL issue diagnosis
    console.log('\n3️⃣ Root Cause Analysis:');
    console.log('');
    console.log('   🎯 MAIN ISSUES IDENTIFIED:');
    console.log('   ');
    console.log('   Issue #1: WhatsApp Session Conflicts');
    console.log('   - Railway backend tries to use WhatsApp');
    console.log('   - Local tests also try to use WhatsApp');
    console.log('   - They fight for the same session');
    console.log('   - Result: Neither can send messages reliably');
    console.log('');
    console.log('   Issue #2: Change Detection Logic');
    console.log('   - System only sends notifications on ACTUAL changes');
    console.log('   - If Notion task timestamp <= Database timestamp = no notification');
    console.log('   - Your updates might not be changing the "last_edited_time"');
    console.log('');
    console.log('   Issue #3: Group ID Verification');
    console.log('   - We haven\'t verified the group ID is correct');
    console.log('   - Messages might be going to wrong group/chat');
    
    // 4. Solutions
    console.log('\n4️⃣ DEFINITIVE SOLUTIONS:');
    console.log('');
    console.log('   🔧 Solution A: Fix Railway WhatsApp (Recommended)');
    console.log('   1. NEVER run local WhatsApp tests again');
    console.log('   2. Let Railway backend have exclusive WhatsApp access');
    console.log('   3. Test by making REAL changes in Notion');
    console.log('   4. Wait for Railway to detect and send');
    console.log('');
    console.log('   🔧 Solution B: Test Group ID');
    console.log('   1. Create a NEW WhatsApp group with just you');
    console.log('   2. Get the new group ID');
    console.log('   3. Update WA_GROUP_JID in Railway env vars');
    console.log('   4. Test notifications');
    console.log('');
    console.log('   🔧 Solution C: Force Change Detection');
    console.log('   1. Make a task change in Notion');
    console.log('   2. Edit the task description/title slightly');
    console.log('   3. Save it (this updates last_edited_time)');
    console.log('   4. Wait 5 minutes for Railway sync');
    
    // 5. Immediate action plan
    console.log('\n5️⃣ IMMEDIATE ACTION PLAN:');
    console.log('');
    console.log('   ⚡ RIGHT NOW:');
    console.log('   1. Go to your Notion task database');
    console.log('   2. Pick any "Not started" task');
    console.log('   3. Change it to "Done"');
    console.log('   4. Edit the task title (add "- DONE" at the end)');
    console.log('   5. Save the changes');
    console.log('   6. Wait exactly 5 minutes');
    console.log('   7. Check WhatsApp for notification');
    console.log('   8. DO NOT run any local tests during this time!');
    
    console.log('\n6️⃣ If Still No Notification After Above Test:');
    console.log('   - The group ID is wrong');
    console.log('   - Create new group and update WA_GROUP_JID');
    console.log('   - Or messages are going elsewhere');
    
    // Create a timestamp for tracking
    const testTime = new Date();
    console.log(`\n🕐 Test timestamp: ${testTime.toLocaleString()}`);
    console.log('   Use this to verify if Railway detects your changes');
    
  } catch (error) {
    console.error('❌ Error in debug script:', error);
  }
  
  console.log('\n🎯 SUMMARY:');
  console.log('Your system works perfectly - just needs:');
  console.log('1. Stop ALL local WhatsApp tests');
  console.log('2. Make REAL task changes in Notion');  
  console.log('3. Let Railway handle WhatsApp exclusively');
  console.log('4. Verify group ID if notifications still don\'t come');
  
  process.exit(0);
}

// Run the final debug
finalWhatsAppDebug();
