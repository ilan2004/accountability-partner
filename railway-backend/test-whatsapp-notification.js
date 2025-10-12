require('dotenv').config();
const SchedulerService = require('./services/scheduler');

async function testWhatsAppNotification() {
  console.log('🔄 Testing WhatsApp notification system...\n');
  
  const scheduler = new SchedulerService();
  
  try {
    // Initialize the scheduler (which initializes WhatsApp bot)
    console.log('1️⃣ Initializing WhatsApp bot...');
    await scheduler.initialize();
    
    // Check WhatsApp connection status
    const status = scheduler.whatsappBot?.getConnectionStatus();
    console.log('\n2️⃣ WhatsApp Connection Status:', status);
    
    if (!status?.connected) {
      console.error('❌ WhatsApp bot is not connected!');
      console.log('💡 Make sure the WhatsApp bot server is running');
      return;
    }
    
    // Manually trigger a sync to detect changes
    console.log('\n3️⃣ Running Notion sync to detect changes...');
    await scheduler.triggerNotionSync();
    
    // Send a test notification
    console.log('\n4️⃣ Sending test task notification...');
    const testChange = {
      type: 'task_added',
      task: {
        task_name: 'Test Task - ' + new Date().toLocaleTimeString(),
        status: 'not_started',
        priority: 'medium'
      },
      user_id: '634a18e2-b27c-4730-817e-6c2c4592e147' // Your user ID
    };
    
    await scheduler.sendSingleTaskNotification(testChange, 'Ilan');
    
    console.log('\n✅ Test complete! Check your WhatsApp for notifications.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure the WhatsApp bot server is running');
    console.log('2. Check if the QR code was scanned');
    console.log('3. Verify the group chat ID is correct');
  } finally {
    // Give time for messages to send
    await new Promise(resolve => setTimeout(resolve, 5000));
    process.exit(0);
  }
}

testWhatsAppNotification();
