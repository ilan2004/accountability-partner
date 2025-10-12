#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const GeminiFormatterService = require('./services/gemini-formatter');

async function showEveningPreview() {
  console.log('🌙 Preview of Evening Summary Format');
  console.log('=====================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const formatter = new GeminiFormatterService();
  
  try {
    // Get all users
    const { data: users } = await supabase
      .from('users')
      .select('*');

    if (!users?.length) {
      console.log('No users found');
      return;
    }

    const usersSummaries = [];
    let totalTasks = 0;
    let totalCompleted = 0;

    for (const user of users) {
      // Get all user's tasks
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);

      // Get completed tasks
      const { data: completedTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'done');

      const userTaskCount = allTasks?.length || 0;
      const userCompletedCount = completedTasks?.length || 0;
      const completionRate = userTaskCount > 0 ? Math.round((userCompletedCount / userTaskCount) * 100) : 0;

      usersSummaries.push({
        user: user,
        tasks: allTasks || [],
        completed_count: userCompletedCount,
        total_count: userTaskCount,
        completion_rate: completionRate
      });

      totalTasks += userTaskCount;
      totalCompleted += userCompletedCount;
    }

    const overallCompletionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    const summaryData = {
      date: new Date().toISOString().split('T')[0],
      users_summaries: usersSummaries,
      overall_completion_rate: overallCompletionRate,
      total_tasks: totalTasks,
      total_completed: totalCompleted
    };
    
    // Use the fallback formatter directly since Gemini API is over quota
    const message = formatter.getFallbackEveningMessage(summaryData);
    
    console.log('📱 MESSAGE PREVIEW:');
    console.log('-------------------');
    console.log(message);
    console.log('-------------------\n');
    
    console.log('📊 Statistics:');
    console.log(`   Total tasks: ${totalTasks}`);
    console.log(`   Completed tasks: ${totalCompleted}`);
    console.log(`   Overall completion: ${overallCompletionRate}%`);
    
    console.log('\n✅ Completed tasks:');
    for (const summary of usersSummaries) {
      const completedTasks = summary.tasks.filter(t => t.status === 'done');
      if (completedTasks.length > 0) {
        console.log(`\n   ${summary.user.name}:`);
        completedTasks.forEach(task => {
          console.log(`   - ${task.task_name}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

// Run the preview
showEveningPreview();
