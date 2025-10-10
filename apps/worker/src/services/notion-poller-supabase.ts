import { supabase, SupabaseWorkerHelpers, TaskMirrorInsert, TaskEventInsert, UserInsert } from '../lib/supabase';
import pino from 'pino';
import { NotionClient } from '../notion/client';
import { NotionTask } from '../notion/types';
import { generateIdempotencyKey, sleep } from './utils';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ name: 'notion-poller' });

export interface NotionPollerConfig {
  notionClient: NotionClient;
  pairId: string;
  pollInterval?: number; // milliseconds
  debounceWindowMs?: number; // suppress duplicate/rapid events within this window
}

export class NotionPollerService {
  private notionClient: NotionClient;
  private pairId: string;
  private pollInterval: number;
  private isRunning = false;
  private lastSyncAt: Date | null = null;
  private debounceWindowMs: number;

  constructor(config: NotionPollerConfig) {
    this.notionClient = config.notionClient;
    this.pairId = config.pairId;
    this.pollInterval = config.pollInterval || 60000; // Default 1 minute
    this.debounceWindowMs = config.debounceWindowMs ?? 30000; // Default 30s
  }

  /**
   * Start the polling service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Poller is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Notion poller service');

    // Get last sync time from database
    const notionConfig = await SupabaseWorkerHelpers.getNotionConfigByPairId(this.pairId);
    this.lastSyncAt = notionConfig?.lastSyncAt ? new Date(notionConfig.lastSyncAt) : null;

    // Start polling loop
    this.pollLoop().catch(error => {
      logger.error({ error }, 'Polling loop crashed');
      this.isRunning = false;
    });
  }

  /**
   * Stop the polling service
   */
  stop(): void {
    logger.info('Stopping Notion poller service');
    this.isRunning = false;
  }

  /**
   * Main polling loop
   */
  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.pollOnce();
      } catch (error) {
        logger.error({ error }, 'Error during poll cycle');
      }

      if (this.isRunning) {
        await sleep(this.pollInterval);
      }
    }
  }

  /**
   * Perform a single poll cycle
   */
  async pollOnce(): Promise<void> {
    const startTime = new Date();
    logger.info('Starting poll cycle');

    try {
      // Fetch tasks from Notion
      const tasks = this.lastSyncAt
        ? await this.notionClient.fetchTasksSince(this.lastSyncAt)
        : await this.notionClient.fetchAllTasks();

      logger.info(`Fetched ${tasks.length} tasks from Notion`);

      // Process each task
      for (const task of tasks) {
        await this.syncTask(task);
      }

      // Update last sync time
      const { error } = await supabase
        .from('NotionConfig')
        .update({ lastSyncAt: startTime.toISOString() })
        .eq('pairId', this.pairId);

      if (error) {
        throw error;
      }

      this.lastSyncAt = startTime;

      logger.info(`Poll cycle completed. Processed ${tasks.length} tasks`);
    } catch (error) {
      logger.error({ error }, 'Failed to complete poll cycle');
      throw error;
    }
  }

  /**
   * Sync a single task to the database
   */
  private async syncTask(notionTask: NotionTask): Promise<void> {
    logger.debug({ taskId: notionTask.id }, `Syncing task: ${notionTask.title}`);

    try {
      // Find user by Notion ID
      let user = await SupabaseWorkerHelpers.findUserByNotionId(notionTask.ownerNotionId);

      // If user not found by Notion ID, try to create or update
      if (!user && notionTask.ownerNotionId) {
        // Check if we have a user with this name
        user = await SupabaseWorkerHelpers.findUserByName(notionTask.ownerName || '');

        if (user) {
          // Update existing user with Notion ID
          const { data: updatedUser, error } = await supabase
            .from('User')
            .update({ notionId: notionTask.ownerNotionId })
            .eq('id', user.id)
            .select()
            .single();

          if (error) throw error;
          user = updatedUser;
        } else {
          // Create new user
          logger.warn(`Creating new user for Notion ID: ${notionTask.ownerNotionId}`);
          const now = new Date().toISOString();
          const { data: newUser, error } = await supabase
            .from('User')
            .insert({
              id: uuidv4(),
              name: notionTask.ownerName || 'Unknown User',
              email: `${notionTask.ownerNotionId}@notion.placeholder`,
              notionId: notionTask.ownerNotionId,
              createdAt: now,
              updatedAt: now,
            })
            .select()
            .single();

          if (error) throw error;
          user = newUser;
        }
      }

      if (!user) {
        logger.warn(`No user found for task: ${notionTask.title}`);
        return;
      }

      // Check if task already exists
      const existingTask = await SupabaseWorkerHelpers.findTaskMirrorByNotionId(notionTask.id);

      if (existingTask) {
        // Check for status change
        const statusChanged = existingTask.status !== notionTask.status;
        const previousStatus = existingTask.status;

        // Update existing task
        const { error } = await supabase
          .from('TaskMirror')
          .update({
            title: notionTask.title,
            status: notionTask.status,
            dueDate: notionTask.dueDate?.toISOString(),
            lastEditedTime: notionTask.lastEditedTime.toISOString(),
            notionUrl: notionTask.url,
          })
          .eq('id', existingTask.id);

        if (error) throw error;

        // Generate event if status changed
        if (statusChanged) {
          await this.generateTaskEvent(
            existingTask.id,
            previousStatus,
            notionTask.status,
            notionTask.lastEditedTime
          );
        }
      } else {
        // Create new task
        const { data: newTask, error } = await supabase
          .from('TaskMirror')
          .insert({
            notionId: notionTask.id,
            title: notionTask.title,
            status: notionTask.status,
            dueDate: notionTask.dueDate?.toISOString(),
            ownerId: user.id,
            lastEditedTime: notionTask.lastEditedTime.toISOString(),
            notionUrl: notionTask.url,
          })
          .select()
          .single();

        if (error) throw error;

        // Generate creation event
        await this.generateTaskEvent(
          newTask.id,
          null,
          notionTask.status,
          notionTask.lastEditedTime,
          'created'
        );
      }
    } catch (error) {
      logger.error({ error, taskId: notionTask.id }, 'Failed to sync task');
      throw error;
    }
  }

  /**
   * Generate a task event
   */
  private async generateTaskEvent(
    taskMirrorId: string,
    previousStatus: string | null,
    newStatus: string,
    timestamp: Date,
    eventType: string = 'status_changed'
  ): Promise<void> {
    // Determine event type based on status change
    if (eventType === 'status_changed' && newStatus === 'Done') {
      eventType = 'completed';
    }

    // Debounce window: suppress noisy edits within window
    const windowStart = new Date(timestamp.getTime() - this.debounceWindowMs);
    
    const { data: recentSimilar, error: debounceError } = await supabase
      .from('TaskEvent')
      .select('*')
      .eq('taskMirrorId', taskMirrorId)
      .gte('createdAt', windowStart.toISOString())
      .or(`eventType.eq.${eventType},and(eventType.eq.status_changed,newStatus.eq.${newStatus}),and(eventType.eq.completed,newStatus.eq.Done)`)
      .order('createdAt', { ascending: false })
      .limit(1);

    if (debounceError) throw debounceError;

    if (recentSimilar && recentSimilar.length > 0) {
      logger.debug({ taskMirrorId, eventType, newStatus }, 'Debounced duplicate/rapid event');
      return;
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(
      taskMirrorId,
      eventType,
      previousStatus,
      newStatus,
      timestamp
    );

    try {
      // Check if event already exists
      const existingEvent = await SupabaseWorkerHelpers.findTaskEventByIdempotencyKey(idempotencyKey);

      if (existingEvent) {
        logger.debug({ idempotencyKey }, 'Event already exists, skipping');
        return;
      }

      // Create new event
      const { error } = await supabase
        .from('TaskEvent')
        .insert({
          taskMirrorId,
          eventType,
          previousStatus,
          newStatus,
          idempotencyKey,
        });

      if (error) throw error;

      logger.info({
        taskMirrorId,
        eventType,
        previousStatus,
        newStatus,
      }, 'Task event created');
    } catch (error) {
      // Handle unique constraint violation gracefully
      if ((error as any).code === '23505') { // PostgreSQL unique_violation
        logger.debug('Event already exists (race condition), skipping');
        return;
      }
      throw error;
    }
  }

  /**
   * Get polling status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncAt: this.lastSyncAt,
      pollInterval: this.pollInterval,
    };
  }
}
