import { GoogleGenerativeAI } from '@google/generative-ai'
import type {
  GeminiTaskParseResult,
  Task,
  PriorityLevel,
  EffortLevel,
  TaskStatus,
  DailyTaskSummary,
  MorningMessageData,
  EveningMessageData
} from '@/types'

class GeminiService {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required')
    }

    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' 
    })
  }

  /**
   * Parse natural language input into structured task data
   * Handles WhatsApp messages, Notion task descriptions, and various input formats
   */
  async parseTaskIntent(
    message: string,
    context: {
      user: string
      existingTasks?: Task[]
      currentDate?: string
    }
  ): Promise<GeminiTaskParseResult> {
    try {
      const prompt = this.buildTaskParsingPrompt(message, context)
      
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      // Parse the JSON response
      const parsed = JSON.parse(text)
      
      // Validate and sanitize the response
      return this.validateTaskParseResult(parsed)

    } catch (error) {
      console.error('Error parsing task intent:', error)
      return {
        action: 'ambiguous',
        response_message: "I couldn't understand that. Could you please rephrase? For example: 'Add call client tomorrow at 10 AM' or 'Mark presentation as done'",
        clarification_needed: true
      }
    }
  }

  /**
   * Generate morning message with both users' daily tasks
   */
  async formatMorningMessage(data: MorningMessageData): Promise<string> {
    try {
      const prompt = this.buildMorningMessagePrompt(data)
      
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      
      return response.text()

    } catch (error) {
      console.error('Error formatting morning message:', error)
      return this.getFallbackMorningMessage(data)
    }
  }

  /**
   * Generate evening summary with completion rates and motivation
   */
  async formatEveningMessage(data: EveningMessageData): Promise<string> {
    try {
      const prompt = this.buildEveningMessagePrompt(data)
      
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      
      return response.text()

    } catch (error) {
      console.error('Error formatting evening message:', error)
      return this.getFallbackEveningMessage(data)
    }
  }

  /**
   * Handle ambiguous input with clarification questions
   */
  async handleAmbiguousInput(
    message: string,
    possibleInterpretations: string[]
  ): Promise<string> {
    try {
      const prompt = `
You are an accountability partner assistant. The user said: "${message}"

I detected these possible interpretations:
${possibleInterpretations.map((interp, i) => `${i + 1}. ${interp}`).join('\n')}

Generate a friendly clarification question to help understand what they meant.
Keep it conversational and offer specific options.

Response format: Just the clarification text, no JSON.
`

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      
      return response.text()

    } catch (error) {
      console.error('Error handling ambiguous input:', error)
      return "I'm not sure what you meant. Could you please be more specific?"
    }
  }

  /**
   * Build comprehensive task parsing prompt
   */
  private buildTaskParsingPrompt(message: string, context: any): string {
    const today = context.currentDate || new Date().toISOString().split('T')[0]
    const existingTasksText = context.existingTasks?.length 
      ? context.existingTasks.map((t: Task) => `- ${t.task_name} (${t.status})`).join('\n')
      : 'No existing tasks'

    return `
You are an AI assistant for an accountability partner system. Parse the user's message into structured task data.

User: ${context.user}
Date: ${today}
Message: "${message}"

Existing tasks:
${existingTasksText}

PARSING RULES:
1. Detect action: add_task, complete_task, update_task, query_tasks, or ambiguous
2. Extract task details with high accuracy
3. Handle time expressions (today, tomorrow, next week, etc.)
4. Infer priority/effort from context (urgent, important, quick, etc.)
5. Handle various phrasings naturally

RESPONSE FORMAT (JSON only):
{
  "action": "add_task|complete_task|update_task|query_tasks|ambiguous",
  "task_name": "extracted task name",
  "description": "additional details if mentioned",
  "due_date": "YYYY-MM-DD or null",
  "time": "HH:MM or null", 
  "priority": "low|medium|high",
  "effort_level": "low|medium|high",
  "response_message": "confirmation message",
  "clarification_needed": false,
  "task_id": "if updating/completing existing task"
}

EXAMPLES:
Input: "Add call with client tomorrow at 10 AM"
Output: {"action": "add_task", "task_name": "Call with client", "due_date": "2025-10-13", "time": "10:00", "priority": "medium", "effort_level": "medium", "response_message": "✅ Added: Call with client (tomorrow at 10 AM)"}

Input: "Mark presentation as done"
Output: {"action": "complete_task", "task_name": "presentation", "response_message": "✅ Marked presentation as completed!"}

Input: "Add urgent report by Friday"
Output: {"action": "add_task", "task_name": "Report", "due_date": "2025-10-16", "priority": "high", "effort_level": "high", "response_message": "✅ Added: Report (urgent, due Friday)"}

Parse this message now:
`
  }

  /**
   * Build morning message generation prompt
   */
  private buildMorningMessagePrompt(data: MorningMessageData): string {
    return `
Generate a motivational morning message for accountability partners Ilan and Sidra.

Date: ${data.date}
Users with missing tasks: ${data.missing_task_users.join(', ') || 'None'}

Task summaries:
${data.users_summaries.map(summary => 
  `${summary.user.name}: ${summary.total_count} tasks (${summary.completed_count} done, ${summary.total_count - summary.completed_count} pending)`
).join('\n')}

Detailed tasks:
${data.users_summaries.map(summary => {
  const pendingTasks = summary.tasks.filter(t => t.status !== 'done')
  return `\n🧑‍💼 ${summary.user.name}:\n${pendingTasks.map(t => 
    `• ${t.task_name}${t.due_date ? ` (due: ${t.due_date})` : ''}`
  ).join('\n') || 'No pending tasks'}`
}).join('\n')}

REQUIREMENTS:
1. Start with energetic morning greeting
2. List each user's tasks clearly with emojis
3. Mention if someone hasn't added tasks yet
4. Keep it motivational and encouraging
5. Use WhatsApp-friendly formatting
6. Encourage accountability partnership

Generate the complete morning message:
`
  }

  /**
   * Build evening summary generation prompt
   */
  private buildEveningMessagePrompt(data: EveningMessageData): string {
    return `
Generate an encouraging evening summary for accountability partners.

Date: ${data.date}
Overall completion rate: ${data.overall_completion_rate}%

User progress:
${data.users_summaries.map(summary => 
  `${summary.user.name}: ${summary.completed_count}/${summary.total_count} tasks (${summary.completion_rate}%)`
).join('\n')}

REQUIREMENTS:
1. Start with evening greeting
2. Show completion statistics
3. Celebrate achievements (even small ones)
4. Provide encouraging feedback
5. Set positive tone for tomorrow
6. Use emojis and WhatsApp-friendly format
7. Acknowledge the partnership aspect

Generate the complete evening summary:
`
  }

  /**
   * Validate and sanitize parsed task result
   */
  private validateTaskParseResult(parsed: any): GeminiTaskParseResult {
    const validActions = ['add_task', 'complete_task', 'update_task', 'query_tasks', 'ambiguous']
    const validPriorities: PriorityLevel[] = ['low', 'medium', 'high']
    const validEfforts: EffortLevel[] = ['low', 'medium', 'high']

    return {
      action: validActions.includes(parsed.action) ? parsed.action : 'ambiguous',
      task_name: typeof parsed.task_name === 'string' ? parsed.task_name.substring(0, 200) : undefined,
      description: typeof parsed.description === 'string' ? parsed.description.substring(0, 500) : undefined,
      due_date: this.validateDate(parsed.due_date),
      time: this.validateTime(parsed.time),
      priority: validPriorities.includes(parsed.priority) ? parsed.priority : 'medium',
      effort_level: validEfforts.includes(parsed.effort_level) ? parsed.effort_level : 'medium',
      response_message: typeof parsed.response_message === 'string' ? parsed.response_message : 'Task processed',
      clarification_needed: Boolean(parsed.clarification_needed),
      task_id: typeof parsed.task_id === 'string' ? parsed.task_id : undefined
    }
  }

  /**
   * Validate date string
   */
  private validateDate(dateStr: any): string | undefined {
    if (typeof dateStr !== 'string') return undefined
    
    // Check if it's a valid ISO date
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return undefined
    
    return dateStr
  }

  /**
   * Validate time string
   */
  private validateTime(timeStr: any): string | undefined {
    if (typeof timeStr !== 'string') return undefined
    
    // Check if it matches HH:MM format
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) return undefined
    
    return timeStr
  }

  /**
   * Fallback morning message if AI fails
   */
  private getFallbackMorningMessage(data: MorningMessageData): string {
    const summaries = data.users_summaries.map(summary => {
      const pendingTasks = summary.tasks.filter(t => t.status !== 'done')
      return `🧑‍💼 ${summary.user.name}:\n${pendingTasks.map(t => 
        `• ${t.task_name}`
      ).join('\n') || 'No pending tasks'}`
    }).join('\n\n')

    return `🌅 Good morning! Here are today's tasks:\n\n${summaries}\n\nLet's make it a productive day! 💪`
  }

  /**
   * Fallback evening message if AI fails  
   */
  private getFallbackEveningMessage(data: EveningMessageData): string {
    const summaries = data.users_summaries.map(summary => 
      `${summary.user.name}: ${summary.completed_count}/${summary.total_count} tasks completed`
    ).join('\n')

    return `🌙 End of day summary:\n\n${summaries}\n\nOverall completion: ${data.overall_completion_rate}%\n\nGreat work today! 🎉`
  }
}

// Export singleton instance
export const geminiService = new GeminiService()

// Export class for testing
export { GeminiService }
