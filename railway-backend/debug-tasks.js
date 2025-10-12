#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function debugTasks() {
  console.log('🔍 Debugging Task Status in Database...');
  console.log('========================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Get all tasks
    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (tasksError) {
      console.error('❌ Error fetching tasks:', tasksError);
      return;
    }
    
    console.log(`📊 Total tasks in database: ${allTasks?.length || 0}\n`);
    
    // Count by status
    const statusCounts = {};
    allTasks?.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });
    
    console.log('📈 Tasks by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} tasks`);
    });
    console.log('');
    
    // Show each task with its status
    console.log('📋 All tasks:');
    allTasks?.forEach(task => {
      const statusEmoji = task.status === 'done' ? '✅' : 
                         task.status === 'in_progress' ? '🔄' : '⏸️';
      console.log(`   ${statusEmoji} [${task.status}] ${task.task_name}`);
      console.log(`      Updated: ${new Date(task.updated_at).toLocaleString()}`);
    });
    
    // Check for Ilan's tasks specifically
    const { data: users } = await supabase
      .from('users')
      .select('id, name');
      
    for (const user of users || []) {
      console.log(`\n👤 ${user.name}'s tasks:`);
      
      const userTasks = allTasks?.filter(t => t.user_id === user.id) || [];
      const completedTasks = userTasks.filter(t => t.status === 'done');
      
      console.log(`   Total: ${userTasks.length}`);
      console.log(`   Completed: ${completedTasks.length}`);
      console.log(`   Completion rate: ${userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0}%`);
    }
    
    // Test what the evening summary would show
    console.log('\n🌙 What evening summary should show:');
    for (const user of users || []) {
      const { data: allUserTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);
        
      const { data: completedUserTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'done');
        
      console.log(`   ${user.name}: ${completedUserTasks?.length || 0}/${allUserTasks?.length || 0} tasks completed`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

// Run the debug
debugTasks();
