#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function testFixedTaskFiltering() {
  console.log('🧪 Testing Fixed Task Filtering for Notifications');
  console.log('==============================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const today = new Date().toISOString().split('T')[0];
  console.log(`📅 Today's date: ${today}\n`);
  
  try {
    // Get all users
    const { data: users } = await supabase
      .from('users')
      .select('*');

    console.log(`👥 Found ${users?.length || 0} users\n`);

    for (const user of users || []) {
      console.log(`\n📊 Analysis for ${user.name}:`);
      console.log('=' .repeat(30));
      
      // Get ALL tasks
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);
      
      // Get today's tasks only (due today or no due date)
      const { data: todayTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .or(`due_date.eq.${today},due_date.is.null`);
      
      // Get today's completed tasks
      const { data: todayCompleted } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'done')
        .or(`due_date.eq.${today},due_date.is.null`);
      
      // Get today's pending tasks
      const { data: todayPending } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'done')
        .or(`due_date.eq.${today},due_date.is.null`);
      
      console.log(`📋 All tasks: ${allTasks?.length || 0}`);
      console.log(`📅 Today's tasks: ${todayTasks?.length || 0}`);
      console.log(`✅ Today's completed: ${todayCompleted?.length || 0}`);
      console.log(`⏳ Today's pending: ${todayPending?.length || 0}`);
      
      const todayCompletionRate = todayTasks?.length > 0 ? 
        Math.round(((todayCompleted?.length || 0) / todayTasks.length) * 100) : 0;
      
      console.log(`📊 Today's completion rate: ${todayCompletionRate}%`);
      
      if (todayTasks?.length > 0) {
        console.log('\n📝 Today\'s tasks:');
        todayTasks.forEach((task, index) => {
          const status = task.status === 'done' ? '✅' : 
                        task.status === 'in_progress' ? '🟡' : '⭕';
          const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';
          console.log(`  ${index + 1}. ${status} ${task.task_name} (${dueDate})`);
        });
      } else {
        console.log('📝 No tasks for today');
      }
      
      if (todayPending?.length > 0) {
        console.log('\n⏳ Today\'s pending tasks for notifications:');
        todayPending.slice(0, 10).forEach((task, index) => {
          const priority = task.priority === 'high' ? '🔥' : 
                          task.priority === 'medium' ? '🟡' : '🟢';
          const dueDate = task.due_date ? 
            new Date(task.due_date).toLocaleDateString('en-IN', { 
              day: 'numeric', 
              month: 'short', 
              weekday: 'short' 
            }) : 'No due date';
          console.log(`  ${index + 1}. ${task.task_name} ${priority} (Due: ${dueDate})`);
        });
      }
    }
    
    console.log('\n✅ Task filtering analysis complete!');
    console.log('\n🔧 Expected behavior:');
    console.log('  - Task list notifications now show only today\'s pending tasks');
    console.log('  - Evening summaries calculate completion based on today\'s tasks only');
    console.log('  - Morning summaries focus on today\'s tasks');
    console.log('  - "Today\'s pending tasks" instead of "Total pending tasks"');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

// Run the test
testFixedTaskFiltering();
