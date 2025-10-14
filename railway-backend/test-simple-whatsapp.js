#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

// Simple WhatsApp test without conflicts
async function testWhatsApp() {
  console.log('📱 Simple WhatsApp Test (No Session Conflicts)');
  console.log('===============================================\n');
  
  console.log('🔧 Current Configuration:');
  console.log(`   Group JID: ${process.env.WA_GROUP_JID}`);
  console.log(`   Session Path: ${process.env.WA_AUTH_PATH || './railway-session'}`);
  
  console.log('\n📋 Checking WhatsApp Session Files:');
  const fs = require('fs');
  const path = require('path');
  
  const sessionPath = process.env.WA_AUTH_PATH || './railway-session';
  
  try {
    const files = fs.readdirSync(sessionPath);
    console.log(`✅ Session directory exists with ${files.length} files`);
    
    // Check for key files
    const keyFiles = files.filter(f => f.includes('creds') || f.includes('key'));
    console.log(`🔑 Found ${keyFiles.length} credential/key files`);
    
    if (keyFiles.length === 0) {
      console.log('❌ No credential files found - WhatsApp needs to be re-authenticated');
    }
    
  } catch (error) {
    console.log('❌ Session directory not found or accessible');
  }
  
  console.log('\n💡 Debugging Steps:');
  console.log('1. Check Railway logs for WhatsApp connection status');
  console.log('2. Verify the group exists and bot is added');
  console.log('3. Try personal WhatsApp number instead of group');
  console.log('4. Re-authenticate WhatsApp if needed');
  
  // Don't actually start WhatsApp to avoid conflicts
  console.log('\n⚠️ Not starting WhatsApp connection to avoid conflicts with Railway');
  console.log('✅ Use Railway commands instead: railway run npm run ...');
  
  // Test message format
  console.log('\n📝 Test Message Format:');
  const testMessage = `🧪 **Test Message**

This is a test notification from your accountability system.

If you see this message, WhatsApp notifications are working!

Time: ${new Date().toLocaleString()}`;
  
  console.log('Message that would be sent:');
  console.log('----------------------------');
  console.log(testMessage);
  console.log('----------------------------');
  
  console.log('\n🎯 Next Actions:');
  console.log('1. Check if Railway backend is actually running');
  console.log('2. Look for messages in ALL WhatsApp chats (not just the target group)');
  console.log('3. Try creating a new test group with just you');
  console.log('4. Update WA_GROUP_JID with the new group ID');
  
  process.exit(0);
}

// Run the test
testWhatsApp();
