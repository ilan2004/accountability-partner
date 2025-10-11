import { TaskMirror, User, TaskEvent } from '../lib/db';
import { GeminiService, GeminiMessageContext } from './gemini-service';

export interface NotificationContext {
  event: TaskEvent;
  task: TaskMirror;
  owner: User;
  partner?: User;
  priority?: string; // optional priority from Notion
}

export interface TaskListContext {
  tasks: Array<TaskMirror & { owner: User }>;
  totalCount: number;
  maxTasksPerOwner?: number;
}

export class MessageFormatter {
  private templates: Record<string, string>;
  private geminiService: GeminiService;

  constructor(templates?: Record<string, string>) {
    this.geminiService = new GeminiService();
    // Default templates
    this.templates = {
      completed: '✅ {owner} completed: {task}\nStatus: Done\nPriority: {priority}\nDue: {due}\n🔗 {link}',
      created: '📝 {owner} created: {task}\nStatus: {newStatus}\nPriority: {priority}\nDue: {due}',
      status_changed: '📊 {owner} updated: {task}\nStatus: {previousStatus} → {newStatus}\nPriority: {priority}',
      ...templates,
    };
  }

  /**
   * Format a notification message based on the event type
   */
  async formatMessage(context: NotificationContext): Promise<string> {
    const template = this.templates[context.event.eventType] || this.templates.status_changed;
    
    const basicMessage = this.interpolate(template, {
      owner: (context.owner as any).name,
      task: (context.task as any).title,
      due: (context.task as any).dueDate ? this.formatDate(new Date((context.task as any).dueDate)) : 'No due date',
      link: (context.task as any).notionUrl,
      previousStatus: (context.event as any).previousStatus || 'N/A',
      newStatus: (context.event as any).newStatus,
      partnerName: (context.partner as any)?.name || 'Partner',
      priority: context.priority || (context as any)?.task?.priority || 'N/A',
    });

    // Try to enhance with Gemini AI
    if (this.geminiService.isGeminiEnabled()) {
      try {
        const geminiContext: GeminiMessageContext = {
          originalMessage: basicMessage,
          eventType: (context.event as any).eventType as 'created' | 'completed' | 'status_changed',
          task: {
            title: (context.task as any).title,
            status: (context.event as any).newStatus,
            priority: context.priority,
            dueDate: (context.task as any).dueDate ? this.formatDate(new Date((context.task as any).dueDate)) : undefined,
          },
          user: {
            name: (context.owner as any).name || 'User',
          },
          partner: context.partner ? {
            name: (context.partner as any).name || 'Partner',
          } : undefined,
          timeOfDay: GeminiService.getTimeOfDay(),
        };

        const enhancedMessage = await this.geminiService.enhanceMessage(geminiContext);
        return enhancedMessage;
      } catch (error) {
        // Fall back to basic message if AI enhancement fails
        return basicMessage;
      }
    }

    return basicMessage;
  }

  /**
   * Format task completed message with extra celebration
   */
  async formatCompletedMessage(context: NotificationContext & { remainingCount?: number }): Promise<string> {
    const baseMessage = await this.formatMessage(context);
    let celebrationMessage = '';
    
    // Add celebration based on due date
    if (context.task.dueDate) {
      const daysUntilDue = Math.floor(
        (context.task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilDue >= 0) {
        celebrationMessage = `\n\n🎉 Completed ${daysUntilDue} days before deadline!`;
      } else {
        celebrationMessage = `\n\n⚡ Better late than never!`;
      }
    }
    
    // Add remaining count if provided and enabled
    let remainingMessage = '';
    if (context.remainingCount !== undefined && process.env.COMPLETION_INCLUDE_REMAINING_COUNT !== 'false') {
      if (context.remainingCount === 0) {
        remainingMessage = `\n\n🏆 All tasks completed! Amazing work!`;
      } else {
        remainingMessage = `\n\n📈 Remaining open tasks: ${context.remainingCount}`;
      }
    }
    
    return baseMessage + celebrationMessage + remainingMessage;
  }

  /**
   * Interpolate template variables
   */
  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/{(\w+)}/g, (match, key) => vars[key] || match);
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);
    
    if (taskDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (taskDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  /**
   * Update templates
   */
  setTemplates(templates: Record<string, string>): void {
    this.templates = { ...this.templates, ...templates };
  }

  /**
   * Format a task list grouped by owner
   */
  formatTaskListByOwner(context: TaskListContext): string {
    const { tasks, totalCount, maxTasksPerOwner = 10 } = context;
    
    if (tasks.length === 0) {
      return '[Bot] 📋 Current Tasks\n\nNo open tasks at the moment. Great work! 🎉';
    }

    let message = '[Bot] 📋 Current Tasks\n';
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Group tasks by owner
    const tasksByOwner = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const ownerId = task.owner.id;
      if (!tasksByOwner.has(ownerId)) {
        tasksByOwner.set(ownerId, []);
      }
      tasksByOwner.get(ownerId)!.push(task);
    }

    // Format each owner's tasks
    for (const [ownerId, ownerTasks] of tasksByOwner) {
      const owner = ownerTasks[0].owner;
      message += `\n👤 ${owner.name || 'Unknown'}:\n`;
      
      // Sort tasks by due date (earliest first, no due date last)
      const sortedTasks = ownerTasks.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      // Show first N tasks
      const tasksToShow = sortedTasks.slice(0, maxTasksPerOwner);
      
      for (const task of tasksToShow) {
        let statusIcon = '📋';
        const statusText = (task as any).status;
        if (statusText === 'In progress' || statusText === 'In Progress') statusIcon = '🔄';
        else if (statusText === 'Not started') statusIcon = '📝';
        
        const priorityText = (task as any).priority ? ` • Priority: ${(task as any).priority}` : '';
        message += `  ${statusIcon} ${task.title} • Status: ${statusText}${priorityText}\n`;
        
        // Add due date badge if applicable
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const daysUntilDue = Math.floor(
            (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          let dueBadge = '';
          if (dueDate < now) {
            dueBadge = `⚠️ Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`;
          } else if (dueDate.getTime() === today.getTime()) {
            dueBadge = '🔴 Due Today';
          } else if (dueDate.getTime() === tomorrow.getTime()) {
            dueBadge = '🟡 Due Tomorrow';
          } else if (daysUntilDue <= 7) {
            dueBadge = `📅 Due ${this.formatDate(dueDate)}`;
          }
          
          if (dueBadge) {
            message += `     ${dueBadge}\n`;
          }
        }
        
        message += `     🔗 ${task.notionUrl}\n`;
      }
      
      // Add summary if more tasks exist
      if (ownerTasks.length > maxTasksPerOwner) {
        message += `  ... and ${ownerTasks.length - maxTasksPerOwner} more task${ownerTasks.length - maxTasksPerOwner > 1 ? 's' : ''}\n`;
      }
    }
    
    // Add total summary
    message += `\n📊 Total: ${totalCount} open task${totalCount !== 1 ? 's' : ''}`;
    
    return message;
  }
}
