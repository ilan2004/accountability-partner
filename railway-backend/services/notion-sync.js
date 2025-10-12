const { Client } = require('@notionhq/client');
const { createClient } = require('@supabase/supabase-js');

/**
 * Notion Sync Service for Accountability System
 * 
 * Purpose: Sync tasks from Notion workspaces to Supabase database
 * - Fetch tasks from both users' Notion workspaces
 * - Update/insert tasks in Supabase  
 * - Detect changes and trigger WhatsApp notifications
 * - Handle OAuth token management
 */
class NotionSyncService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Track last sync time for change detection
    this.lastSyncTime = new Date();
    
    console.log('📄 Notion Sync Service initialized');
  }

  async getNotionClientForUser(userId) {
    try {
      // Get user's Notion OAuth token from Supabase
      const { data: user, error } = await this.supabase
        .from('users')
        .select('notion_access_token, notion_workspace_id')
        .eq('id', userId)
        .single();

      if (error || !user?.notion_access_token) {
        console.log(`⚠️ No Notion token found for user ${userId}`);
        return null;
      }

      return new Client({
        auth: user.notion_access_token
      });
    } catch (error) {
      console.error(`❌ Error getting Notion client for user ${userId}:`, error);
      return null;
    }
  }

  async getAllUsers() {
    try {
      const { data: users, error } = await this.supabase
        .from('users')
        .select('*')
        .not('notion_access_token', 'is', null);

      if (error) {
        console.error('❌ Error fetching users:', error);
        return [];
      }

      return users || [];
    } catch (error) {
      console.error('❌ Error in getAllUsers:', error);
      return [];
    }
  }

  async syncUserTasks(userId, userName) {
    try {
      console.log(`🔄 Syncing tasks for ${userName}...`);

      const notion = await this.getNotionClientForUser(userId);
      if (!notion) {
        console.log(`⏭️ Skipping ${userName} - no Notion access`);
        return { changes: [], errors: [] };
      }

      // Get user's Notion database/page for tasks
      // This would need to be configured per user - could be stored in user preferences
      const taskDatabaseId = await this.getUserTaskDatabaseId(userId);
      if (!taskDatabaseId) {
        console.log(`⚠️ No task database configured for ${userName}`);
        return { changes: [], errors: [] };
      }

      // Fetch tasks from Notion
      const notionTasks = await this.fetchTasksFromNotion(notion, taskDatabaseId);
      
      // Get existing tasks from Supabase for this user
      const { data: existingTasks } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId);

      // Compare and sync changes
      const changes = await this.compareAndSyncTasks(userId, notionTasks, existingTasks || []);

      console.log(`✅ Synced ${notionTasks.length} tasks for ${userName}, ${changes.length} changes detected`);
      return { changes, errors: [] };

    } catch (error) {
      console.error(`❌ Error syncing tasks for ${userName}:`, error);
      return { changes: [], errors: [error.message] };
    }
  }

  async getUserTaskDatabaseId(userId) {
    try {
      // This could be stored in user settings or discovered automatically
      // For now, let's check if it's stored in user preferences
      const { data: user } = await this.supabase
        .from('users')
        .select('notion_task_database_id')
        .eq('id', userId)
        .single();

      return user?.notion_task_database_id;
    } catch (error) {
      console.error('❌ Error getting task database ID:', error);
      return null;
    }
  }

  async fetchTasksFromNotion(notion, databaseId) {
    try {
      // Query without sorting to avoid property name issues
      console.log('🗒️ Fetching tasks from Notion database...');
      const response = await notion.databases.query({
        database_id: databaseId
        // Removed sorting to avoid property name conflicts
      });

      const tasks = response.results.map(page => {
        return this.parseNotionPageToTask(page);
      });

      return tasks.filter(task => task !== null);
    } catch (error) {
      console.error('❌ Error fetching tasks from Notion:', error);
      return [];
    }
  }

  parseNotionPageToTask(page) {
    try {
      const properties = page.properties;
      
      // Debug: Log all property keys available
      console.log('📋 Task properties available:', Object.keys(properties));
      
      // Debug: Log the actual Status property structure
      if (properties['Status']) {
        console.log('🔍 Status property structure:', JSON.stringify(properties['Status'], null, 2));
      }
      
      // Extract common task properties - adjust based on your Notion setup
      const task = {
        notion_id: page.id,
        task_name: this.extractTitle(properties['Task name'] || properties['Name'] || properties['Task'] || properties['Title']),
        description: this.extractRichText(properties['Description']),
        status: this.extractStatus(properties['Status']),
        priority: this.extractSelect(properties['Priority']),
        effort_level: this.extractSelect(properties['Effort level'] || properties['Effort'] || properties['Effort Level']),
        due_date: this.extractDate(properties['Due date'] || properties['Due Date'] || properties['Due']),
        created_at: page.created_time,
        updated_at: page.last_edited_time
      };

      // Debug: Log extracted values
      console.log(`✅ Parsed task: "${task.task_name}" - Status: "${task.status}"`);
      
      // Validate required fields
      if (!task.task_name) {
        console.log('⚠️ Skipping task with no name:', page.id);
        return null;
      }

      return task;
    } catch (error) {
      console.error('❌ Error parsing Notion page:', error);
      return null;
    }
  }

  extractTitle(titleProperty) {
    if (!titleProperty || !titleProperty.title) return null;
    return titleProperty.title.map(t => t.plain_text).join('');
  }

  extractRichText(richTextProperty) {
    if (!richTextProperty || !richTextProperty.rich_text) return null;
    return richTextProperty.rich_text.map(t => t.plain_text).join('');
  }

  extractStatus(statusProperty) {
    if (!statusProperty) return 'not_started';
    
    if (statusProperty.select) {
      const status = statusProperty.select.name.toLowerCase();
      // Map Notion status to our enum
      if (status.includes('done') || status.includes('complete')) return 'done';
      if (status.includes('progress') || status.includes('working')) return 'in_progress';
      return 'not_started';
    }
    
    if (statusProperty.status) {
      // Handle status type (newer Notion databases use 'status' type)
      const status = statusProperty.status.name.toLowerCase();
      // Note: Notion returns "Done" with capital D, so we convert to lowercase for comparison
      if (status === 'done' || status.includes('done') || status.includes('complete')) return 'done';
      if (status === 'in progress' || status.includes('progress') || status.includes('working')) return 'in_progress';
      if (status === 'not started' || status.includes('not started')) return 'not_started';
      return 'not_started';
    }
    
    if (statusProperty.checkbox) {
      return statusProperty.checkbox ? 'done' : 'not_started';
    }
    
    return 'not_started';
  }

  extractSelect(selectProperty) {
    if (!selectProperty || !selectProperty.select) return 'medium';
    return selectProperty.select.name.toLowerCase();
  }

  extractDate(dateProperty) {
    if (!dateProperty || !dateProperty.date) return null;
    return dateProperty.date.start;
  }

  async compareAndSyncTasks(userId, notionTasks, existingTasks) {
    const changes = [];
    const existingTasksMap = new Map(existingTasks.map(t => [t.notion_id, t]));

    for (const notionTask of notionTasks) {
      const existingTask = existingTasksMap.get(notionTask.notion_id);
      
      if (!existingTask) {
        // New task - insert
        const change = await this.insertTask(userId, notionTask);
        if (change) changes.push(change);
      } else {
        // Existing task - check for updates
        const change = await this.updateTaskIfChanged(existingTask, notionTask);
        if (change) changes.push(change);
      }
    }

    return changes;
  }

  async insertTask(userId, notionTask) {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .insert({
          user_id: userId,
          notion_id: notionTask.notion_id,
          task_name: notionTask.task_name,
          description: notionTask.description,
          status: notionTask.status,
          priority: notionTask.priority,
          effort_level: notionTask.effort_level,
          due_date: notionTask.due_date,
          created_at: notionTask.created_at,
          updated_at: notionTask.updated_at
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error inserting task:', error);
        return null;
      }

      console.log(`➕ Inserted new task: ${notionTask.task_name}`);
      return {
        type: 'task_added',
        task: data,
        user_id: userId
      };
    } catch (error) {
      console.error('❌ Error in insertTask:', error);
      return null;
    }
  }

  async updateTaskIfChanged(existingTask, notionTask) {
    try {
      // Check if task has been updated
      const notionUpdatedAt = new Date(notionTask.updated_at);
      const existingUpdatedAt = new Date(existingTask.updated_at);
      
      if (notionUpdatedAt <= existingUpdatedAt) {
        return null; // No changes
      }

      // Determine type of change
      let changeType = 'task_updated';
      if (existingTask.status !== notionTask.status && notionTask.status === 'done') {
        changeType = 'task_completed';
      }

      const { data, error } = await this.supabase
        .from('tasks')
        .update({
          task_name: notionTask.task_name,
          description: notionTask.description,
          status: notionTask.status,
          priority: notionTask.priority,
          effort_level: notionTask.effort_level,
          due_date: notionTask.due_date,
          updated_at: notionTask.updated_at
        })
        .eq('id', existingTask.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating task:', error);
        return null;
      }

      console.log(`📝 Updated task: ${notionTask.task_name} (${changeType})`);
      return {
        type: changeType,
        task: data,
        user_id: existingTask.user_id,
        old_status: existingTask.status,
        new_status: notionTask.status
      };
    } catch (error) {
      console.error('❌ Error in updateTaskIfChanged:', error);
      return null;
    }
  }

  async syncAllUsers() {
    try {
      console.log('🔄 Starting full sync of all users...');
      
      const users = await this.getAllUsers();
      const allChanges = [];
      const allErrors = [];

      for (const user of users) {
        const result = await this.syncUserTasks(user.id, user.name);
        allChanges.push(...result.changes);
        allErrors.push(...result.errors);
      }

      this.lastSyncTime = new Date();
      
      console.log(`✅ Full sync completed: ${allChanges.length} total changes, ${allErrors.length} errors`);
      
      return {
        changes: allChanges,
        errors: allErrors,
        syncTime: this.lastSyncTime
      };
    } catch (error) {
      console.error('❌ Error in syncAllUsers:', error);
      return { changes: [], errors: [error.message], syncTime: new Date() };
    }
  }

  // Discover user's task databases automatically
  async discoverUserTaskDatabases(userId) {
    try {
      const notion = await this.getNotionClientForUser(userId);
      if (!notion) return [];

      const response = await notion.search({
        filter: {
          property: 'object',
          value: 'database'
        }
      });

      const taskDatabases = response.results.filter(db => {
        const title = db.title?.[0]?.plain_text || '';
        return title.toLowerCase().includes('task') || 
               title.toLowerCase().includes('todo') ||
               title.toLowerCase().includes('project');
      });

      return taskDatabases.map(db => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled',
        url: db.url
      }));
    } catch (error) {
      console.error('❌ Error discovering task databases:', error);
      return [];
    }
  }

  getLastSyncTime() {
    return this.lastSyncTime;
  }

  async testConnection(userId) {
    try {
      const notion = await this.getNotionClientForUser(userId);
      if (!notion) {
        return { connected: false, error: 'No Notion token' };
      }

      // Test with a simple API call
      await notion.users.me();
      return { connected: true };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

module.exports = NotionSyncService;
