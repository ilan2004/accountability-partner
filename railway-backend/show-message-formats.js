require('dotenv').config();
const GeminiFormatterService = require('./services/gemini-formatter');

async function showAllMessageFormats() {
  const formatter = new GeminiFormatterService();
  
  console.log('\n========================================');
  console.log('ACCOUNTABILITY SYSTEM MESSAGE FORMATS');
  console.log('========================================\n');
  
  // Sample data
  const morningData = {
    date: new Date().toISOString().split('T')[0],
    users_summaries: [
      {
        user: { name: 'Ilan' },
        tasks: [
          { task_name: 'Complete project documentation', due_date: '2025-10-12', priority: 'high' },
          { task_name: 'Review pull requests', priority: 'medium' },
          { task_name: 'Team standup meeting', due_date: '2025-10-12', priority: 'medium' }
        ]
      },
      {
        user: { name: 'Sidra' },
        tasks: [
          { task_name: 'Study for exam', due_date: '2025-10-13', priority: 'high' },
          { task_name: 'Submit assignment', due_date: '2025-10-12', priority: 'high' }
        ]
      }
    ],
    missing_task_users: []
  };

  const eveningData = {
    date: new Date().toISOString().split('T')[0],
    users_summaries: [
      {
        user: { name: 'Ilan' },
        tasks: [
          { task_name: 'Complete project documentation', status: 'done' },
          { task_name: 'Review pull requests', status: 'done' },
          { task_name: 'Team standup meeting', status: 'done' },
          { task_name: 'Fix critical bug', status: 'in_progress' }
        ],
        completed_count: 3,
        total_count: 4,
        completion_rate: 75
      },
      {
        user: { name: 'Sidra' },
        tasks: [
          { task_name: 'Study for exam', status: 'done' },
          { task_name: 'Submit assignment', status: 'not_started' }
        ],
        completed_count: 1,
        total_count: 2,
        completion_rate: 50
      }
    ],
    overall_completion_rate: 67
  };

  const singleTaskUpdate = {
    type: 'task_completed',
    user_name: 'Ilan',
    task_name: 'Complete project documentation'
  };

  const bulkUpdate = {
    user_name: 'Sidra',
    change_count: 4,
    changes: [
      { type: 'task_added', task: { task_name: 'Research paper' } },
      { type: 'task_added', task: { task_name: 'Group project meeting' } },
      { type: 'task_completed', task: { task_name: 'Study for exam' } },
      { type: 'task_updated', task: { task_name: 'Submit assignment' } }
    ]
  };

  console.log('1. MORNING SUMMARY (6:00 AM IST)');
  console.log('--------------------------------');
  const morningMsg = formatter.getFallbackMorningMessage(morningData);
  console.log(morningMsg);
  console.log('\n');

  console.log('2. EVENING SUMMARY (10:00 PM IST)');
  console.log('----------------------------------');
  const eveningMsg = formatter.getFallbackEveningMessage(eveningData);
  console.log(eveningMsg);
  console.log('\n');

  console.log('3. SINGLE TASK UPDATE (Real-time)');
  console.log('----------------------------------');
  console.log('a) Task Added:');
  const addMsg = formatter.getFallbackTaskUpdateMessage({
    type: 'task_added',
    user_name: 'Ilan',
    task_name: 'Prepare presentation slides'
  });
  console.log(addMsg);
  console.log('\nb) Task Completed:');
  const completeMsg = formatter.getFallbackTaskUpdateMessage(singleTaskUpdate);
  console.log(completeMsg);
  console.log('\nc) Task Updated:');
  const updateMsg = formatter.getFallbackTaskUpdateMessage({
    type: 'task_updated',
    user_name: 'Sidra',
    task_name: 'Study for exam'
  });
  console.log(updateMsg);
  console.log('\n');

  console.log('4. BULK UPDATE NOTIFICATION (Real-time)');
  console.log('---------------------------------------');
  const bulkMsg = formatter.getFallbackBulkUpdateMessage(bulkUpdate);
  console.log(bulkMsg);
  console.log('\n');

  console.log('5. OTHER MESSAGES');
  console.log('-----------------');
  console.log('a) Startup Notification:');
  console.log(`🤖 **Accountability Bot is Online!**

Ready to keep you both accountable! 📊

✅ Morning summaries at 06:00 IST
✅ Evening summaries at 22:00 IST  
✅ Real-time task notifications
✅ Completion celebrations

Focus on your Notion workspace - I'll handle the updates! 💪`);
  console.log('\n');

  console.log('========================================');
  console.log('MESSAGE TIMING SCHEDULE');
  console.log('========================================');
  console.log('📅 Morning Summary: 06:00 IST (00:30 UTC) Daily');
  console.log('📅 Evening Summary: 22:00 IST (16:30 UTC) Daily');
  console.log('📅 Task Updates: Real-time (checked every 5 minutes)');
  console.log('📅 System Health Check: Every hour');
  console.log('\n');

  console.log('========================================');
  console.log('CURRENT STATUS');
  console.log('========================================');
  console.log('⚠️ Gemini API: Quota exceeded (using fallback messages)');
  console.log('✅ WhatsApp Bot: Connected and operational');
  console.log('⚠️ Notion Sync: Has sorting issue but operational');
  console.log('✅ Scheduler: All jobs running as scheduled');
}

showAllMessageFormats().catch(console.error);
