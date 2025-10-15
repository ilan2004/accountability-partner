const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini Message Formatter for Railway Backend
 * 
 * Purpose: Format task summaries and notifications into friendly WhatsApp messages
 * - Morning task summaries with encouraging tone
 * - Evening completion summaries with motivation
 * - Contextual task update messages
 * - Bulk change notifications
 */
class GeminiFormatterService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp' 
    });
    
    console.log('🤖 Gemini Formatter Service initialized');
  }

  /**
   * Format morning task summary for WhatsApp
   */
  async formatMorningMessage(summaryData) {
    try {
      const prompt = this.buildMorningMessagePrompt(summaryData);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return response.text();
    } catch (error) {
      if (error.status === 429) {
        console.error('⚠️ Gemini API quota exceeded - using fallback message');
      } else {
        console.error('❌ Error formatting morning message:', error);
      }
      return this.getFallbackMorningMessage(summaryData);
    }
  }

  /**
   * Format evening completion summary for WhatsApp
   */
  async formatEveningMessage(summaryData) {
    try {
      const prompt = this.buildEveningMessagePrompt(summaryData);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return response.text();
    } catch (error) {
      if (error.status === 429) {
        console.error('⚠️ Gemini API quota exceeded - using fallback message');
      } else {
        console.error('❌ Error formatting evening message:', error);
      }
      return this.getFallbackEveningMessage(summaryData);
    }
  }

  /**
   * Format contextual task update notification
   */
  async formatTaskUpdateMessage(updateData) {
    try {
      const prompt = this.buildTaskUpdatePrompt(updateData);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return response.text();
    } catch (error) {
      if (error.status === 429) {
        console.error('⚠️ Gemini API quota exceeded - using fallback message');
      } else {
        console.error('❌ Error formatting task update message:', error);
      }
      return this.getFallbackTaskUpdateMessage(updateData);
    }
  }

  /**
   * Format bulk task changes notification
   */
  async formatBulkUpdateMessage(bulkData) {
    try {
      const prompt = this.buildBulkUpdatePrompt(bulkData);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return response.text();
    } catch (error) {
      if (error.status === 429) {
        console.error('⚠️ Gemini API quota exceeded - using fallback message');
      } else {
        console.error('❌ Error formatting bulk update message:', error);
      }
      return this.getFallbackBulkUpdateMessage(bulkData);
    }
  }

  /**
   * Build morning message generation prompt
   */
  buildMorningMessagePrompt(data) {
    const taskDetails = data.users_summaries.map(summary => {
      const emoji = summary.user.name === 'Ilan' ? '🧑‍💻' : '👩‍🎓';
      const tasks = summary.tasks || [];
      
      if (tasks.length === 0) {
        return `${emoji} **${summary.user.name}**\n(${summary.user.name} hasn't added tasks yet.)`;
      }
      
      const taskList = tasks.slice(0, 5).map((task, index) => {
        let taskStr = `${index + 1}. ${task.task_name}`;
        if (task.due_date) {
          const dueDate = new Date(task.due_date).toLocaleDateString('en-IN');
          taskStr += ` (Due: ${dueDate})`;
        }
        if (task.priority === 'high') {
          taskStr += ' 🔥';
        }
        return taskStr;
      }).join('\n');
      
      return `${emoji} **${summary.user.name}**\n${taskList}`;
    }).join('\n\n');

    return `
You are an AI assistant for an accountability partner system between Ilan and Sidra.

Generate an energetic morning message for their WhatsApp group.

Date: ${data.date}
Time: 06:00 IST

Task Details:
${taskDetails}

Users without tasks: ${data.missing_task_users.join(', ') || 'None'}

REQUIREMENTS:
1. Start with an energetic morning greeting 🌅
2. Keep the tone motivational and friendly
3. List each user's tasks clearly with their emoji (🧑‍💻 for Ilan, 👩‍🎓 for Sidra) 
4. If someone has no tasks, gently mention it
5. End with encouragement for the day
6. Use WhatsApp-friendly formatting (** for bold)
7. Keep total message under 500 characters if possible
8. Include relevant emojis but don't overdo it
9. IMPORTANT: Generate only ONE message format - DO NOT provide multiple options or variations

Generate the complete morning message:`;
  }

  /**
   * Build evening summary generation prompt
   */
  buildEveningMessagePrompt(data) {
    const userProgress = data.users_summaries.map(summary => {
      const emoji = summary.user.name === 'Ilan' ? '🧑‍💻' : '👩‍🎓';
      return `${emoji} **${summary.user.name}** — ${summary.completed_count}/${summary.total_count} tasks completed${summary.completion_rate > 0 ? ` (${summary.completion_rate}%)` : ''}`;
    }).join('\n');

    return `
You are an AI assistant for an accountability partner system between Ilan and Sidra.

Generate an encouraging evening summary for their WhatsApp group.

Date: ${data.date}
Time: 22:00 IST
Overall completion rate: ${data.overall_completion_rate}%

User Progress:
${userProgress}

REQUIREMENTS:
1. Start with evening greeting 🌙
2. Show completion statistics for each user
3. Celebrate achievements (even small progress)
4. Provide encouraging feedback based on performance
5. Set positive tone for tomorrow
6. Use emojis appropriately 
7. Keep tone supportive and motivational
8. Use WhatsApp-friendly formatting (** for bold)
9. Acknowledge their accountability partnership
10. Keep message concise but meaningful

Performance guidelines:
- 80%+: Excellent, celebrate success 🔥
- 60-79%: Good progress, encourage consistency 💪
- Below 60%: Stay positive, focus on tomorrow 🌱

IMPORTANT: Generate only ONE message format - DO NOT provide multiple options or variations

Generate the complete evening summary:`;
  }

  /**
   * Build task update notification prompt
   */
  buildTaskUpdatePrompt(updateData) {
    return `
Generate a contextual WhatsApp notification for a task update in an accountability system.

Update Details:
- Type: ${updateData.type}
- User: ${updateData.user_name}
- Task: "${updateData.task_name}"
${updateData.old_status ? `- Changed from: ${updateData.old_status}` : ''}
${updateData.new_status ? `- Changed to: ${updateData.new_status}` : ''}

REQUIREMENTS:
1. Keep message concise and friendly
2. Use appropriate emoji for the update type:
   - task_added: ➕ or 📝
   - task_completed: ✅ or 🎉  
   - task_updated: 📝
3. Include user name naturally
4. Add encouraging phrase for completions
5. Keep professional but warm tone
6. Maximum 2-3 lines
7. Use WhatsApp formatting (** for bold)
8. IMPORTANT: Generate only ONE message format - DO NOT provide multiple options or variations
9. Use action-oriented language (emphasis on what was done)
10. For task_added: Keep it brief (1 line max) as the full task list will follow

Generate a single contextual notification message (no options or alternatives):`;
  }

  /**
   * Build bulk update notification prompt
   */
  buildBulkUpdatePrompt(bulkData) {
    const changesSummary = bulkData.changes.reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {});

    return `
Generate a WhatsApp notification for multiple task updates in an accountability system.

User: ${bulkData.user_name}
Changes: ${bulkData.change_count} total updates

Change breakdown:
${Object.entries(changesSummary).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

REQUIREMENTS:
1. Start with user name making updates
2. Summarize the changes with appropriate emojis:
   - task_added: ➕
   - task_completed: ✅
   - task_updated: 📝
3. Keep tone encouraging and supportive
4. Use WhatsApp formatting (** for bold)
5. Keep message concise (3-4 lines max)
6. End with positive note about productivity
7. IMPORTANT: Generate only ONE message format - DO NOT provide multiple options or variations

Generate a bulk update notification:`;
  }

  /**
   * Fallback morning message if AI fails
   */
  getFallbackMorningMessage(data) {
    let message = '🌅 **Good Morning, Accountability Partners!**\n\nHere are today\'s tasks:\n\n';
    
    for (const summary of data.users_summaries) {
      const emoji = summary.user.name === 'Ilan' ? '🧑‍💻' : '👩‍🎓';
      message += `${emoji} **${summary.user.name}**\n`;
      
      if (!summary.tasks || summary.tasks.length === 0) {
        message += `(${summary.user.name} hasn't added tasks yet.)\n\n`;
      } else {
        summary.tasks.slice(0, 3).forEach((task, index) => {
          message += `${index + 1}. ${task.task_name}\n`;
        });
        message += '\n';
      }
    }
    
    message += 'Let\'s make today productive! 💪';
    return message;
  }

  /**
   * Fallback evening message if AI fails
   */
  getFallbackEveningMessage(data) {
    let message = '🌙 **Hey Ilan & Sidra! 🌙**\n\n';
    message += 'Here\'s a quick update on our progress for today:\n\n';
    
    // Add individual user summaries with personalized messages
    for (const summary of data.users_summaries) {
      message += `* **${summary.user.name}:** ${summary.completed_count}/${summary.total_count} tasks completed`;
      if (summary.completion_rate > 0) {
        message += ` (${summary.completion_rate}%)`;
      }
      message += '\n';
    }
    
    // Add personalized motivation based on best performer
    const bestPerformer = data.users_summaries.reduce((best, current) => 
      current.completion_rate > best.completion_rate ? current : best
    );
    
    if (bestPerformer.completion_rate >= 70) {
      message += `\n${bestPerformer.user.name}, amazing job crushing your tasks today! 🎉 `;
    }
    
    const otherUser = data.users_summaries.find(s => s.user.id !== bestPerformer.user.id);
    if (otherUser && otherUser.completion_rate > 0) {
      message += `${otherUser.user.name}, you\'ve made progress and that\'s what counts! 💪 `;
    }
    
    message += 'Remember, even small steps forward are still steps forward.\n\n';
    message += "Let\'s both recharge tonight and come back strong tomorrow! 🌱 We\'ve got this! ";
    message += 'Thanks for being such awesome accountability partners! 🙌';
    
    return message;
  }

  /**
   * Fallback task update message if AI fails
   */
  getFallbackTaskUpdateMessage(updateData) {
    switch (updateData.type) {
      case 'task_added':
        return `➕ ${updateData.user_name} added a task: "${updateData.task_name}". Stay accountable! 🚀`;
      case 'task_completed':
        return `✅ ${updateData.user_name} completed: **${updateData.task_name}**\nGreat job! 🎉`;
      case 'task_updated':
        return `📝 ${updateData.user_name} updated: **${updateData.task_name}**`;
      default:
        return `🔄 ${updateData.user_name} made changes to: **${updateData.task_name}**`;
    }
  }

  /**
   * Fallback bulk update message if AI fails
   */
  getFallbackBulkUpdateMessage(bulkData) {
    const changes = bulkData.changes;
    const addedCount = changes.filter(c => c.type === 'task_added').length;
    const completedCount = changes.filter(c => c.type === 'task_completed').length;
    const updatedCount = changes.filter(c => c.type === 'task_updated').length;

    let message = `🔄 **${bulkData.user_name} made ${bulkData.change_count} updates:**\n\n`;
    
    if (addedCount > 0) message += `➕ ${addedCount} new tasks\n`;
    if (completedCount > 0) message += `✅ ${completedCount} completed\n`;
    if (updatedCount > 0) message += `📝 ${updatedCount} updated\n`;
    
    message += '\nStaying productive! 💪';
    return message;
  }

  /**
   * Test the service with sample data
   */
  async testFormatting() {
    console.log('🧪 Testing Gemini formatter...');
    
    const sampleMorningData = {
      date: '2025-10-12',
      users_summaries: [
        {
          user: { name: 'Ilan' },
          tasks: [
            { task_name: 'Client call', due_date: '2025-10-12', priority: 'high' },
            { task_name: 'Code review', priority: 'medium' }
          ]
        },
        {
          user: { name: 'Sidra' },
          tasks: []
        }
      ],
      missing_task_users: ['Sidra']
    };

    try {
      const result = await this.formatMorningMessage(sampleMorningData);
      console.log('✅ Sample morning message:', result.substring(0, 100) + '...');
      return true;
    } catch (error) {
      console.error('❌ Test failed:', error);
      return false;
    }
  }
}

module.exports = GeminiFormatterService;
