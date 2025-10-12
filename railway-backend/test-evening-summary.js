#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const AccountabilitySystem = require('./accountability-system');

async function testEveningSummary() {
  console.log('🌙 Testing Evening Summary with correct task counts...');
  console.log('==========================================\n');
  
  const system = new AccountabilitySystem();
  
  try {
    // Start the system
    await system.start();
    
    // Wait a bit for connection to establish
    console.log('⏳ Waiting for WhatsApp connection...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send evening summary
    console.log('📤 Sending evening summary...');
    await system.triggerEveningSummary();
    
    console.log('✅ Evening summary test complete!');
    console.log('\nThe message should show:');
    console.log('   - Ilan: 2/6 tasks completed (33%)');
    console.log('   - With proper fallback formatting since Gemini API quota is exceeded');
    
    // Keep alive for a moment to ensure message sends
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Clean shutdown
    await system.stop();
    process.exit(0);
  }
}

// Run the test
testEveningSummary();
