import { TaskMirror, User, TaskEvent } from '../lib/db';

export interface NotificationContext {
  event: TaskEvent;
  task: TaskMirror;
  owner: User;
  partner?: User;
}

export interface TaskListContext {
  tasks: Array<TaskMirror & { owner: User }>;
  totalCount: number;
  maxTasksPerOwner?: number;
}

export class MessageFormatter {
  private templates: Record<string, string>;

  constructor(templates?: Record<string, string>) {
    // Default templates
    this.templates = {
      completed: '✅ {owner} completed: {task}\nDue: {due}\n🔗 {link}',
      created: '📝 {owner} created: {task}\nDue: {due}',
      status_changed: '📊 {owner} updated: {task}\nStatus: {previousStatus} → {newStatus}',
      ...templates,
    };
  }

  /**
   * Format a notification message based on the event type
   */
  formatMessage(context: NotificationContext): string {
    const template = this.templates[context.event.eventType] || this.templates.status_changed;
    
    return this.interpolate(template, {
      owner: context.owner.name,
      task: context.task.title,
      due: context.task.dueDate ? this.formatDate(context.task.dueDate) : 'No due date',
      link: context.task.notionUrl,
      previousStatus: context.event.previousStatus || 'N/A',
      newStatus: context.event.newStatus,
      partnerName: context.partner?.name || 'Partner',
    });
  }

  /**
   * Format task completed message with extra celebration
   */
  formatCompletedMessage(context: NotificationContext & { remainingCount?: number }): string {
    const baseMessage = this.formatMessage(context);
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
        if (task.status === 'In Progress') statusIcon = '🔄';
        else if (task.status === 'Not started') statusIcon = '📝';
        
        message += `  ${statusIcon} ${task.title}\n`;
        
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
