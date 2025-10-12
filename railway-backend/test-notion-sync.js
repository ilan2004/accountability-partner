#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const AccountabilitySystem = require('./accountability-system');

async function testNotionSync() {
  console.log('🧪 Testing Notion Sync with WhatsApp Notifications...');
  console.log('====================================================');
  console.log('');
  console.log('📋 This test will:');
  console.log('   1. Connect to WhatsApp (scan QR if needed)');
  console.log('   2. Start monitoring Notion for changes');
  console.log('   3. Send WhatsApp notifications when tasks are added/updated');
  console.log('');
  console.log('⚡ To test notifications:');
  console.log('   - Add a new task in Notion');
  console.log('   - Update a task status in Notion');
  console.log('   - Mark a task as complete in Notion');
  console.log('');
  console.log('Press Ctrl+C to stop the test');
  console.log('');
  
  const system = new AccountabilitySystem();
  
  try {
    // Start the full system
    await system.start();
    
    console.log('');
    console.log('🎯 System is running! Now test by:');
    console.log('   1. Adding a task in Notion - You should get a WhatsApp notification');
    console.log('   2. Updating task status - Should trigger an update notification');
    console.log('   3. Completing a task - Should celebrate with a completion message');
    console.log('');
    console.log('📊 Notion sync runs every 5 minutes');
    console.log('💡 You can also trigger manual sync by running: npm run sync');
    console.log('');
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down test...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down test...');
  process.exit(0);
});

// Run the test
testNotionSync();
