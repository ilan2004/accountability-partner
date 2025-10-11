import { GoogleGenerativeAI } from '@google/generative-ai';
import pino from 'pino';

const logger = pino({ name: 'gemini-service' });

export interface GeminiMessageContext {
  originalMessage: string;
  eventType: 'created' | 'completed' | 'status_changed';
  task: {
    title: string;
    status: string;
    priority?: string;
    dueDate?: string;
  };
  user: {
    name: string;
  };
  partner?: {
    name: string;
  };
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  recentActivity?: {
    tasksCompletedToday: number;
    tasksCompletedThisWeek: number;
  };
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private isEnabled: boolean;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.isEnabled = !!(apiKey && process.env.USE_GEMINI_MESSAGES === 'true');
    
    if (this.isEnabled) {
      logger.info('Initializing Gemini with API key: ' + apiKey?.substring(0, 20) + '...');
      this.genAI = new GoogleGenerativeAI(apiKey!);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
      logger.info('Using Gemini model: ' + modelName);
      this.model = this.genAI.getGenerativeModel({ 
        model: modelName
      });
    }
  }

  /**
   * Enhance a notification message with AI
   */
  async enhanceMessage(context: GeminiMessageContext): Promise<string> {
    if (!this.isEnabled) {
      logger.debug('Gemini not enabled, returning original message');
      return context.originalMessage;
    }

    try {
      const prompt = this.buildPrompt(context);
      logger.debug('Sending prompt to Gemini:', prompt.substring(0, 200) + '...');
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const enhancedMessage = response.text();
      
      logger.info({
        originalMessage: context.originalMessage,
        enhancedMessage: enhancedMessage.substring(0, 100) + '...',
        user: context.user.name,
        eventType: context.eventType
      }, 'Message enhanced by Gemini');

      return this.sanitizeResponse(enhancedMessage);
    } catch (error) {
      logger.error({ error, context }, 'Failed to enhance message with Gemini, falling back to original');
      return context.originalMessage;
    }
  }

  /**
   * Build the prompt for Gemini
   */
  private buildPrompt(context: GeminiMessageContext): string {
    const { task, user, partner, eventType, timeOfDay, recentActivity } = context;
    
    let baseContext = `
You are an AI assistant for an accountability app that helps pairs of users stay productive together. 
Generate an engaging, motivational WhatsApp message to celebrate progress and encourage continued productivity.

CONSTRAINTS:
- Keep message under 280 characters
- Be encouraging but not overly enthusiastic
- Include relevant emojis (but not too many)
- Maintain a friendly, supportive tone
- Consider the time of day and context
- Mention the partner when relevant
- Be specific about the achievement

USER CONTEXT:
- User: ${user.name}
- Partner: ${partner?.name || 'their accountability partner'}
- Time: ${timeOfDay}
- Event: ${eventType}

TASK DETAILS:
- Title: "${task.title}"
- Status: ${task.status}
- Priority: ${task.priority || 'Not specified'}
- Due date: ${task.dueDate || 'No deadline'}

RECENT ACTIVITY:
- Tasks completed today: ${recentActivity?.tasksCompletedToday || 0}
- Tasks completed this week: ${recentActivity?.tasksCompletedThisWeek || 0}
`;

    let eventSpecificPrompt = '';
    
    switch (eventType) {
      case 'completed':
        eventSpecificPrompt = `
${user.name} just completed "${task.title}". Create a celebration message that:
- Celebrates the completion
- Acknowledges their productivity
- May mention how this helps their partner
- Considers if this was completed ahead of deadline
`;
        break;
      
      case 'created':
        eventSpecificPrompt = `
${user.name} just created a new task "${task.title}". Create an encouraging message that:
- Welcomes the new task
- Shows enthusiasm for their planning
- May mention coordination with their partner
- Considers the priority level
`;
        break;
      
      case 'status_changed':
        eventSpecificPrompt = `
${user.name} updated "${task.title}" to status "${task.status}". Create a progress message that:
- Acknowledges the progress
- Shows momentum building
- Encourages continued work
- May mention teamwork aspect
`;
        break;
    }

    return baseContext + eventSpecificPrompt + `

EXAMPLES OF GOOD MESSAGES:
- "🌟 Nice work, John! Crushing that login bug in your productive morning hours. Sarah's going to love this progress! 💪"
- "📝 Great planning, Sarah! Your partner John will appreciate the clear API docs you just outlined. Ready to tackle it? 🚀"
- "⚡ Progress! John moved the database optimization to 'In Progress'. Building momentum on the high-priority items! 📈"

Generate ONE enhanced message now:`;
  }

  /**
   * Clean and validate the AI response
   */
  private sanitizeResponse(response: string): string {
    // Remove quotes if the AI wrapped the response
    let cleaned = response.trim().replace(/^["']|["']$/g, '');
    
    // Ensure reasonable length
    if (cleaned.length > 300) {
      cleaned = cleaned.substring(0, 280) + '...';
    }
    
    // Ensure it doesn't start with unwanted prefixes
    const unwantedPrefixes = ['Here is', 'Here\'s', 'The enhanced message is', 'Message:'];
    for (const prefix of unwantedPrefixes) {
      if (cleaned.startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length).trim();
        cleaned = cleaned.replace(/^[:]\s*/, ''); // Remove colon and space
        break;
      }
    }
    
    return cleaned;
  }

  /**
   * Determine time of day from current time
   */
  static getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Check if Gemini is enabled
   */
  isGeminiEnabled(): boolean {
    return this.isEnabled;
  }
}
