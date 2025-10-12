require('dotenv').config();
const GeminiFormatterService = require('./services/gemini-formatter');

async function showExactMessages() {
  const formatter = new GeminiFormatterService();
  
  console.log('\n===========================================');
  console.log('EXACT WHATSAPP MESSAGES (Copy & Paste View)');
  console.log('===========================================\n');
  
  // Real data based on current database state
  const morningData = {
    date: '2025-10-12',
    users_summaries: [
      {
        user: { name: 'Ilan' },
        tasks: [
          { task_name: 'Update 2.0 test', due_date: null, priority: null },
          { task_name: 'Real time ', due_date: null, priority: null },
          { task_name: 'Fist ', due_date: null, priority: null }
        ]
      },
      {
        user: { name: 'Sidra' },
        tasks: []
      }
    ],
    missing_task_users: ['Sidra']
  };

  const eveningData = {
    date: '2025-10-12',
    users_summaries: [
      {
        user: { name: 'Ilan' },
        tasks: [
          { task_name: 'Takdjb ', status: 'done' },
          { task_name: 'Final test', status: 'done' },
          { task_name: 'Another test', status: 'done' },
          { task_name: 'Hehe ', status: 'done' },
          { task_name: 'Update 2.0 test', status: 'in_progress' },
          { task_name: 'Real time ', status: 'not_started' },
          { task_name: 'Fist ', status: 'not_started' }
        ],
        completed_count: 4,
        total_count: 7,
        completion_rate: 57
      },
      {
        user: { name: 'Sidra' },
        tasks: [],
        completed_count: 0,
        total_count: 0,
        completion_rate: 0
      }
    ],
    overall_completion_rate: 57
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣ STARTUP MESSAGE (When bot connects)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🤖 **Accountability Bot is Online!**');
  console.log('');
  console.log('Ready to keep you both accountable! 📊');
  console.log('');
  console.log('✅ Morning summaries at 06:00 IST');
  console.log('✅ Evening summaries at 22:00 IST  ');
  console.log('✅ Real-time task notifications');
  console.log('✅ Completion celebrations');
  console.log('');
  console.log('Focus on your Notion workspace - I\'ll handle the updates! 💪');
  console.log('');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2️⃣ MORNING MESSAGE (6:00 AM IST)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  const morningMsg = formatter.getFallbackMorningMessage(morningData);
  console.log(morningMsg);
  console.log('');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3️⃣ EVENING MESSAGE (10:00 PM IST)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  const eveningMsg = formatter.getFallbackEveningMessage(eveningData);
  console.log(eveningMsg);
  console.log('');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4️⃣ TASK ADDED (Real-time)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('➕ Ilan added: **Fist **');
  console.log('');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5️⃣ TASK COMPLETED (Real-time)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('✅ Ilan completed: **Update 2.0 test**');
  console.log('Great job! 🎉');
  console.log('');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('6️⃣ BULK UPDATES (When multiple changes)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🔄 **Task Updates**');
  console.log('');
  console.log('🔄 **Ilan made 3 updates:**');
  console.log('');
  console.log('➕ 1 new tasks');
  console.log('✅ 2 completed');
  console.log('');
  console.log('Staying productive! 💪');
  console.log('');
  console.log('📅 Updated: ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  console.log('');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 HOW IT LOOKS IN WHATSAPP:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('• Bold text appears as **bold** in WhatsApp');
  console.log('• Each message is a separate notification');
  console.log('• Emojis render natively in WhatsApp');
  console.log('• Line breaks are preserved');
  console.log('• Messages appear in the group: 120363421579500257@g.us');
  console.log('');

  // Show the exact task update from logs
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('7️⃣ ACTUAL MESSAGE FROM LOGS (Task Added)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('➕ **Task Added**');
  console.log('');
  console.log('Ilan Usman added a new task:');
  console.log('📋 "Fist "');
  console.log('');
  console.log('➕ Ilan Usman added: **Fist **');
  console.log('');
}

showExactMessages().catch(console.error);
