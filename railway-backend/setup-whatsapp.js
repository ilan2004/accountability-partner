#!/usr/bin/env node

const WhatsAppNotificationBot = require('./whatsapp-notification-bot');
const fs = require('fs');
const path = require('path');

/**
 * Local WhatsApp Setup Script
 * 
 * Purpose: Authenticate WhatsApp locally and generate session files
 * that can be deployed to Railway for production use.
 */

console.log('🔧 WhatsApp Local Setup');
console.log('=======================');
console.log('');
console.log('This script will:');
console.log('1. Generate a WhatsApp QR code for you to scan');
console.log('2. Create authentication session files');
console.log('3. Test the connection');
console.log('4. Prepare files for Railway deployment');
console.log('');

async function setupWhatsApp() {
  try {
    console.log('🔍 Checking environment...');
    
    // Load environment variables
    require('dotenv').config();
    
    if (!process.env.WA_GROUP_JID) {
      console.log('⚠️ WA_GROUP_JID not set!');
      console.log('');
      console.log('To get your WhatsApp Group JID:');
      console.log('1. Add the bot to your accountability group');
      console.log('2. The JID will be logged when messages are received');
      console.log('3. Or use a WhatsApp group ID finder tool');
      console.log('');
      console.log('For now, we\'ll create the session files without testing messages.');
      console.log('');
    }
    
    console.log('📱 Initializing WhatsApp bot...');
    
    // Create bot instance with local session path
    const bot = new WhatsAppNotificationBot();
    
    console.log('');
    console.log('📱 Starting WhatsApp authentication...');
    console.log('⏳ Please wait for QR code to appear...');
    console.log('');
    
    // Initialize the bot (this will show QR code)
    await bot.initialize();
    
    // Wait for connection
    console.log('⏳ Waiting for WhatsApp connection...');
    
    // Wait up to 2 minutes for connection
    const maxWaitTime = 2 * 60 * 1000; // 2 minutes
    const checkInterval = 2000; // 2 seconds
    const startTime = Date.now();
    
    while (!bot.isConnected && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      console.log('⏳ Still waiting for WhatsApp connection...');
    }
    
    if (bot.isConnected) {
      console.log('✅ WhatsApp connected successfully!');
      
      // Test sending a message
      console.log('🧪 Testing message sending...');
      const testSuccess = await bot.sendTestMessage('🤖 WhatsApp bot setup completed successfully! Ready for deployment to Railway.');
      
      if (testSuccess) {
        console.log('✅ Test message sent successfully!');
      } else {
        console.log('⚠️ Test message failed - check your group JID configuration');
      }
      
      // Show session info
      console.log('');
      console.log('📂 Session Information:');
      console.log('====================');
      
      const sessionPath = bot.sessionPath;
      console.log('Session path:', sessionPath);
      
      if (fs.existsSync(sessionPath)) {
        const files = fs.readdirSync(sessionPath);
        console.log('Session files created:');
        files.forEach(file => {
          const filePath = path.join(sessionPath, file);
          const stats = fs.statSync(filePath);
          console.log(`  - ${file} (${stats.size} bytes)`);
        });
      }
      
      console.log('');
      console.log('🚀 Next Steps for Railway Deployment:');
      console.log('=====================================');
      console.log('');
      console.log('1. The session files are now saved in:', sessionPath);
      console.log('2. These files need to be deployed to Railway');
      console.log('3. Set environment variable: WA_AUTH_PATH=./wa-session');
      console.log('4. Deploy your code to Railway');
      console.log('');
      console.log('Would you like me to help prepare these files for Railway?');
      
    } else {
      console.log('❌ WhatsApp connection timed out after 2 minutes');
      console.log('');
      console.log('Troubleshooting:');
      console.log('- Make sure you scanned the QR code with WhatsApp');
      console.log('- Check your internet connection');
      console.log('- Verify the WA_GROUP_JID environment variable');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    
    if (error.message.includes('GEMINI_API_KEY')) {
      console.log('');
      console.log('💡 Tip: You can skip Gemini AI for WhatsApp setup');
      console.log('Set GEMINI_API_KEY=dummy for this setup script');
    }
  }
}

async function prepareForRailway() {
  console.log('');
  console.log('🚂 Preparing for Railway Deployment...');
  
  const sessionPath = './wa-session';
  const railwaySessionPath = './railway-session';
  
  if (!fs.existsSync(sessionPath)) {
    console.log('❌ No session files found. Run WhatsApp setup first.');
    return;
  }
  
  try {
    // Create Railway session directory
    if (fs.existsSync(railwaySessionPath)) {
      fs.rmSync(railwaySessionPath, { recursive: true, force: true });
    }
    fs.mkdirSync(railwaySessionPath, { recursive: true });
    
    // Copy session files
    const files = fs.readdirSync(sessionPath);
    console.log('📁 Copying session files for Railway...');
    
    files.forEach(file => {
      const source = path.join(sessionPath, file);
      const destination = path.join(railwaySessionPath, file);
      fs.copyFileSync(source, destination);
      console.log(`  ✅ Copied: ${file}`);
    });
    
    console.log('');
    console.log('✅ Files prepared for Railway!');
    console.log('');
    console.log('Railway Deployment Steps:');
    console.log('========================');
    console.log('1. Commit and push the railway-session folder to GitHub');
    console.log('2. In Railway, set: WA_AUTH_PATH=./railway-session');
    console.log('3. Deploy to Railway');
    console.log('4. Your WhatsApp bot will connect automatically!');
    
  } catch (error) {
    console.error('❌ Error preparing Railway files:', error);
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'setup':
      setupWhatsApp();
      break;
      
    case 'prepare':
      prepareForRailway();
      break;
      
    case 'help':
      console.log(`
🔧 WhatsApp Setup Commands:

Usage: node setup-whatsapp.js [command]

Commands:
  setup     Authenticate WhatsApp and create session files (default)
  prepare   Prepare session files for Railway deployment  
  help      Show this help message

Examples:
  node setup-whatsapp.js           # Start WhatsApp setup
  node setup-whatsapp.js prepare   # Prepare files for Railway
      `);
      break;
      
    default:
      setupWhatsApp();
      break;
  }
}
