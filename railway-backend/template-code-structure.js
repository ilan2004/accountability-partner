// ACCOUNTABILITY SYSTEM - MESSAGE TEMPLATE STRUCTURES

// ============================================
// 1. STARTUP NOTIFICATION
// ============================================
const startupMessage = `🤖 **Accountability Bot is Online!**

Ready to keep you both accountable! 📊

✅ Morning summaries at 06:00 IST
✅ Evening summaries at 22:00 IST  
✅ Real-time task notifications
✅ Completion celebrations

Focus on your Notion workspace - I'll handle the updates! 💪`;

// ============================================
// 2. TASK UPDATE TEMPLATES (whatsapp-notification-bot.js)
// ============================================

// Task Added
const taskAddedTemplate = `➕ **Task Added**

${updateData.user_name} added a new task:
📋 "${updateData.task_name}"

${updateData.contextual_message || ''}`;

// Task Completed  
const taskCompletedTemplate = `✅ **Task Completed**

🎉 ${updateData.user_name} completed:
📋 "${updateData.task_name}"

${updateData.contextual_message || 'Great job! 🎯'}`;

// Task Updated
const taskUpdatedTemplate = `📝 **Task Updated**

${updateData.user_name} updated:
📋 "${updateData.task_name}"

${updateData.contextual_message || ''}`;

// Bulk Update
const bulkUpdateTemplate = `🔄 **Task Updates**

${bulkUpdateData.formatted_message}

📅 Updated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

// ============================================
// 3. FALLBACK TEMPLATES (gemini-formatter.js)
// ============================================

// Morning Message Fallback
function getFallbackMorningMessage(data) {
  let message = '🌅 **Good Morning, Accountability Partners!**\\n\\nHere are today\\'s tasks:\\n\\n';
  
  for (const summary of data.users_summaries) {
    const emoji = summary.user.name === 'Ilan' ? '🧑‍💻' : '👩‍🎓';
    message += `${emoji} **${summary.user.name}**\\n`;
    
    if (!summary.tasks || summary.tasks.length === 0) {
      message += `(${summary.user.name} hasn't added tasks yet.)\\n\\n`;
    } else {
      summary.tasks.slice(0, 3).forEach((task, index) => {
        message += `${index + 1}. ${task.task_name}\\n`;
      });
      message += '\\n';
    }
  }
  
  message += 'Let\\'s make today productive! 💪';
  return message;
}

// Evening Message Fallback
function getFallbackEveningMessage(data) {
  let message = '🌙 **End of Day Summary**\\n\\n';
  message += 'Hey Ilan and Sidra!\\n\\n';
  message += 'Wrapping up our day, and wanted to check in on progress.\\n\\n';
  
  for (const summary of data.users_summaries) {
    message += `**${summary.user.name}**: ${summary.completed_count}/${summary.total_count} tasks completed.\\n`;
    
    // List completed tasks
    if (summary.completed_count > 0) {
      const completedTasks = summary.tasks.filter(t => t.status === 'done');
      message += 'Completed tasks:\\n';
      completedTasks.forEach(task => {
        message += `  ✅ ${task.task_name}\\n`;
      });
      message += '\\n';
    }
    
    // Personalized motivation
    if (summary.completed_count === 0 && summary.total_count > 0) {
      message += `Alright ${summary.user.name}, no worries at all! Even starting is a victory. Tomorrow is a fresh start! 🌱 `;
      message += `Let's tackle those tasks with renewed energy. Remember, you got this!\\n\\n`;
    } else if (summary.completion_rate < 50) {
      message += `Good start ${summary.user.name}! Progress is progress, no matter the pace. `;
      message += `Tomorrow let's keep building on this momentum! 💪\\n\\n`;
    } else if (summary.completion_rate < 80) {
      message += `Great progress ${summary.user.name}! You're really getting things done. `;
      message += `Keep up the excellent work! 🎯\\n\\n`;
    } else {
      message += `Outstanding work ${summary.user.name}! You absolutely crushed it today! 🔥 `;
      message += `This is the energy we love to see!\\n\\n`;
    }
  }
  
  message += "Let's make tomorrow awesome! ✨\\n\\n";
  message += `📊 Overall Completion Rate: ${data.overall_completion_rate}%`;
  
  return message;
}

// Simple Task Update Fallbacks
function getFallbackTaskUpdateMessage(updateData) {
  switch (updateData.type) {
    case 'task_added':
      return `➕ ${updateData.user_name} added: **${updateData.task_name}**`;
    case 'task_completed':
      return `✅ ${updateData.user_name} completed: **${updateData.task_name}**\\nGreat job! 🎉`;
    case 'task_updated':
      return `📝 ${updateData.user_name} updated: **${updateData.task_name}**`;
    default:
      return `🔄 ${updateData.user_name} made changes to: **${updateData.task_name}**`;
  }
}

// Bulk Update Fallback
function getFallbackBulkUpdateMessage(bulkData) {
  const changes = bulkData.changes;
  const addedCount = changes.filter(c => c.type === 'task_added').length;
  const completedCount = changes.filter(c => c.type === 'task_completed').length;
  const updatedCount = changes.filter(c => c.type === 'task_updated').length;

  let message = `🔄 **${bulkData.user_name} made ${bulkData.change_count} updates:**\\n\\n`;
  
  if (addedCount > 0) message += `➕ ${addedCount} new tasks\\n`;
  if (completedCount > 0) message += `✅ ${completedCount} completed\\n`;
  if (updatedCount > 0) message += `📝 ${updatedCount} updated\\n`;
  
  message += '\\nStaying productive! 💪';
  return message;
}

// ============================================
// 4. HEALTH CHECK MESSAGE
// ============================================
const healthCheckTemplate = `🔍 **Bot Health Check**

Connection: ${status.connected ? '✅ Connected' : '❌ Disconnected'}
Group: ${status.groupJid ? '✅ Configured' : '❌ Not configured'}
Session: ${status.sessionPath}
Uptime: ${process.uptime().toFixed(0)}s

System operational! 🚀`;

// Export for reference
module.exports = {
  templates: {
    startup: startupMessage,
    taskAdded: taskAddedTemplate,
    taskCompleted: taskCompletedTemplate,
    taskUpdated: taskUpdatedTemplate,
    bulkUpdate: bulkUpdateTemplate,
    healthCheck: healthCheckTemplate
  },
  fallbacks: {
    morning: getFallbackMorningMessage,
    evening: getFallbackEveningMessage,
    taskUpdate: getFallbackTaskUpdateMessage,
    bulkUpdate: getFallbackBulkUpdateMessage
  }
};
