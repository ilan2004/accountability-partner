require('dotenv').config({ path: '../.env.local' });
const WhatsAppNotificationBot = require('./whatsapp-notification-bot');
const GeminiFormatterService = require('./services/gemini-formatter');

async function testTaskAddedWithList() {
  console.log('🧪 Testing Task Added notification with task list...\n');
  
  const bot = new WhatsAppNotificationBot();
  const formatter = new GeminiFormatterService();
  
  try {
    // Initialize WhatsApp connection
    await bot.initialize();
    
    // Wait a bit for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create sample task data
    const sampleUpdateData = {
      type: 'task_added',
      user_name: 'Ilan',
      task_name: 'Complete project documentation',
      task_list: [
        {
          id: '1',
          task_name: 'Complete project documentation',
          priority: 'high',
          due_date: '2025-10-13',
          status: 'to_do'
        },
        {
          id: '2',
          task_name: 'Review pull requests',
          priority: 'medium',
          due_date: '2025-10-14',
          status: 'to_do'
        },
        {
          id: '3',
          task_name: 'Update team on progress',
          priority: 'low',
          due_date: null,
          status: 'to_do'
        },
        {
          id: '4',
          task_name: 'Prepare for client meeting',
          priority: 'high',
          due_date: '2025-10-15',
          status: 'to_do'
        }
      ]
    };
    
    // Format the contextual message
    sampleUpdateData.contextual_message = await formatter.formatTaskUpdateMessage({
      type: 'task_added',
      user_name: 'Ilan',
      task_name: 'Complete project documentation'
    });
    
    console.log('📝 Sending notification with task list...');
    
    // Send the notification
    const success = await bot.sendTaskUpdateNotification(sampleUpdateData);
    
    if (success) {
      console.log('✅ Test notification sent successfully!');
    } else {
      console.log('❌ Failed to send test notification');
    }
    
    // Disconnect
    await bot.disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

// Run the test
testTaskAddedWithList();
