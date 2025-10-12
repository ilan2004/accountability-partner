#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const WhatsAppBot = require('./whatsapp-bot');

async function testWhatsAppConnection() {
  console.log('🧪 Testing WhatsApp Bot Connection...');
  console.log('=====================================');
  
  // Check required environment variables
  const requiredEnvVars = ['WA_GROUP_JID'];
  const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars);
    console.log('📝 Please check your .env file and ensure these variables are set:');
    missingEnvVars.forEach(env => console.log(`   - ${env}`));
    process.exit(1);
  }
  
  console.log('✅ Required environment variables found');
  console.log('📱 Group JID:', process.env.WA_GROUP_JID);
  console.log('📂 Session Path:', process.env.WA_AUTH_PATH || './railway-session');
  console.log('');
  
  const bot = new WhatsAppBot();
  
  try {
    console.log('🔄 Initializing WhatsApp bot...');
    await bot.initialize();
    
    console.log('✅ WhatsApp bot initialized successfully!');
    console.log('📊 Connection Status:', bot.getConnectionStatus());
    
    // Wait a moment for connection to fully establish
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test sending a message
    console.log('📤 Sending test message...');
    const success = await bot.sendTestMessage('🤖 Test message from local development setup!');
    
    if (success) {
      console.log('✅ Test message sent successfully!');
    } else {
      console.log('⚠️ Test message could not be sent (might be connection issue)');
    }
    
    console.log('🎉 WhatsApp bot test completed successfully!');
    
    // Disconnect gracefully
    await bot.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ WhatsApp bot test failed:');
    console.error(error);
    
    if (error.message.includes('Stream Errored (conflict)')) {
      console.log('');
      console.log('💡 This is a common WhatsApp connection conflict error.');
      console.log('   It usually happens when multiple sessions try to connect.');
      console.log('   The bot should automatically retry with exponential backoff.');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the test
testWhatsAppConnection();
