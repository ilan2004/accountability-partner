import { TaskMirror, User, TaskEvent } from '../lib/db';

export interface NotificationContext {
  event: TaskEvent;
  task: TaskMirror;
  owner: User;
  partner?: User;
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
  formatCompletedMessage(context: NotificationContext): string {
    const baseMessage = this.formatMessage(context);
    
    // Add celebration based on due date
    if (context.task.dueDate) {
      const daysUntilDue = Math.floor(
        (context.task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilDue >= 0) {
        return `${baseMessage}\n\n🎉 Completed ${daysUntilDue} days before deadline!`;
      } else {
        return `${baseMessage}\n\n⚡ Better late than never!`;
      }
    }
    
    return baseMessage;
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
}
