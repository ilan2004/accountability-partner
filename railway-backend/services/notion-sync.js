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
      // Query with filter to exclude archived pages
      console.log('🗒️ Fetching active tasks from Notion database (excluding trash)...');
      const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Archived',
          checkbox: {
            equals: false
          }
        }
        // Removed sorting to avoid property name conflicts
      });

      console.log(`📊 Found ${response.results.length} active (non-archived) pages`);
      
      const tasks = response.results.map(page => {
        // Additional check: skip if page is archived at the page level
        if (page.archived) {
          console.log(`🗑️ Skipping archived page: ${page.id}`);
          return null;
        }
        return this.parseNotionPageToTask(page);
      });

      return tasks.filter(task => task !== null);
    } catch (error) {
      // If filtering by Archived property fails, try without it but still check page.archived
      if (error.code === 'validation_error' && error.message.includes('Could not find property')) {
        console.log('⚠️ No "Archived" property found, filtering by page archive status only...');
        try {
          const response = await notion.databases.query({
            database_id: databaseId
          });
          
          console.log(`📊 Found ${response.results.length} total pages, filtering archived ones...`);
          
          const tasks = response.results.map(page => {
            // Skip archived pages
            if (page.archived) {
              console.log(`🗑️ Skipping archived page: ${page.id}`);
              return null;
            }
            return this.parseNotionPageToTask(page);
          });

          return tasks.filter(task => task !== null);
        } catch (fallbackError) {
          console.error('❌ Error fetching tasks from Notion (fallback):', fallbackError);
          return [];
        }
      } else {
        console.error('❌ Error fetching tasks from Notion:', error);
        return [];
      }
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
        effort_level: this.extractEffortLevel(properties['Effort level'] || properties['Effort'] || properties['Effort Level']),
        due_date: this.extractDate(properties['Due date'] || properties['Due Date'] || properties['Due']),
        assignee: this.extractAssignee(properties['Assignee']),
        created_at: page.created_time,
        updated_at: page.last_edited_time,
        last_edited_by: page.last_edited_by
      };

      // Debug: Log extracted values
      console.log(`✅ Parsed task: "${task.task_name}" - Status: "${task.status}" - Assignee: "${task.assignee}"`);
      
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

  extractEffortLevel(effortProperty) {
    if (!effortProperty || !effortProperty.select) return 'medium';
    const value = effortProperty.select.name.toLowerCase();
    
    // Map Notion effort levels to valid database enum values
    // Based on the database, valid values are: low, medium, high
    const effortMap = {
      'small': 'low',
      'medium': 'medium',
      'large': 'high',
      'high': 'high',
      'low': 'low'
    };
    
    return effortMap[value] || 'medium';
  }

  extractDate(dateProperty) {
    if (!dateProperty || !dateProperty.date) return null;
    return dateProperty.date.start;
  }

  extractAssignee(assigneeProperty) {
    if (!assigneeProperty) return null;
    
    // Handle people (multi_select or people property)
    if (assigneeProperty.people && assigneeProperty.people.length > 0) {
      return assigneeProperty.people[0].name || assigneeProperty.people[0].id;
    }
    
    // Handle select property
    if (assigneeProperty.select) {
      return assigneeProperty.select.name;
    }
    
    // Handle multi_select property
    if (assigneeProperty.multi_select && assigneeProperty.multi_select.length > 0) {
      return assigneeProperty.multi_select[0].name;
    }
    
    return null;
  }

  async compareAndSyncTasks(userId, notionTasks, existingTasks) {
    const changes = [];
    const existingTasksMap = new Map(existingTasks.map(t => [t.notion_id, t]));

    for (const notionTask of notionTasks) {
      const existingTask = existingTasksMap.get(notionTask.notion_id);
      
      if (!existingTask) {
        // New task - determine actual user who should own it
        const actualUserId = await this.determineTaskOwner(notionTask, userId);
        const change = await this.insertTask(actualUserId, notionTask);
        if (change) changes.push(change);
      } else {
        // Existing task - check for updates and determine who made the change
        const change = await this.updateTaskIfChangedWithUserDetection(existingTask, notionTask);
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

      // Get user name for better logging
      const { data: user } = await this.supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      console.log(`➕ Inserted new task: ${notionTask.task_name} (assigned to ${user?.name || userId})`);
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

  async updateTaskIfChangedWithUserDetection(existingTask, notionTask) {
    try {
      // Check if task has been updated
      const notionUpdatedAt = new Date(notionTask.updated_at);
      const existingUpdatedAt = new Date(existingTask.updated_at);
      
      if (notionUpdatedAt <= existingUpdatedAt) {
        return null; // No changes
      }

      // Determine who made the change
      const userWhoMadeChange = await this.determineWhoMadeChange(notionTask, existingTask);

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

      console.log(`📝 Updated task: ${notionTask.task_name} (${changeType}) by ${userWhoMadeChange.name}`);
      return {
        type: changeType,
        task: data,
        user_id: userWhoMadeChange.id, // The person who actually made the change
        original_owner_id: existingTask.user_id,
        old_status: existingTask.status,
        new_status: notionTask.status
      };
    } catch (error) {
      console.error('❌ Error in updateTaskIfChangedWithUserDetection:', error);
      return null;
    }
  }

  async determineTaskOwner(notionTask, defaultUserId) {
    try {
      // Strategy 1: Check assignee property
      if (notionTask.assignee) {
        const user = await this.findUserByAssignee(notionTask.assignee);
        if (user) return user.id;
      }

      // Strategy 2: Check task name patterns
      const taskName = notionTask.task_name?.toLowerCase() || '';
      if (taskName.includes('sidra')) {
        const sidraUser = await this.findUserByName('Sidra');
        if (sidraUser) return sidraUser.id;
      }
      if (taskName.includes('ilan')) {
        const ilanUser = await this.findUserByName('Ilan');
        if (ilanUser) return ilanUser.id;
      }

      // Default to the syncing user
      return defaultUserId;
    } catch (error) {
      console.error('❌ Error determining task owner:', error);
      return defaultUserId;
    }
  }

  async determineWhoMadeChange(notionTask, existingTask) {
    try {
      // Strategy 1: Check assignee property
      if (notionTask.assignee) {
        const user = await this.findUserByAssignee(notionTask.assignee);
        if (user) return user;
      }

      // Strategy 2: Check task name patterns for hints
      const taskName = notionTask.task_name?.toLowerCase() || '';
      if (taskName.includes('sidra')) {
        const sidraUser = await this.findUserByName('Sidra');
        if (sidraUser) return sidraUser;
      }
      if (taskName.includes('ilan')) {
        const ilanUser = await this.findUserByName('Ilan');
        if (ilanUser) return ilanUser;
      }

      // Strategy 3: Time-based heuristics
      const changeTime = new Date(notionTask.updated_at);
      const hour = changeTime.getHours();
      
      // Evening hours (6 PM - 11 PM) or early morning (6 AM - 9 AM) might indicate different users
      const sidraUser = await this.findUserByName('Sidra');
      const ilanUser = await this.findUserByName('Ilan');
      
      if (hour >= 18 && hour <= 23) {
        return sidraUser || ilanUser;
      } else if (hour >= 6 && hour <= 9) {
        return ilanUser || sidraUser;
      }

      // Default: return the original task owner
      return await this.findUserById(existingTask.user_id) || ilanUser || sidraUser;
    } catch (error) {
      console.error('❌ Error determining who made change:', error);
      const users = await this.getAllUsers();
      return users[0]; // Fallback
    }
  }

  async findUserByAssignee(assignee) {
    try {
      const { data: users } = await this.supabase
        .from('users')
        .select('*');
        
      return users?.find(user => 
        user.name.toLowerCase().includes(assignee.toLowerCase()) ||
        assignee.toLowerCase().includes(user.name.toLowerCase())
      );
    } catch (error) {
      console.error('❌ Error finding user by assignee:', error);
      return null;
    }
  }

  async findUserByName(namePattern) {
    try {
      const { data: users } = await this.supabase
        .from('users')
        .select('*');
        
      return users?.find(user => 
        user.name.toLowerCase().includes(namePattern.toLowerCase())
      );
    } catch (error) {
      console.error('❌ Error finding user by name:', error);
      return null;
    }
  }

  async findUserById(userId) {
    try {
      const { data: user } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      return user;
    } catch (error) {
      console.error('❌ Error finding user by ID:', error);
      return null;
    }
  }

  async syncAllUsers() {
    try {
      console.log('🔄 Starting full sync of all users...');
      
      const users = await this.getAllUsers();
      const allChanges = [];
      const allErrors = [];

      // Since both users share the same database, sync once and process for all users
      if (users.length > 0) {
        const result = await this.syncSharedDatabase(users);
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

  async syncSharedDatabase(users) {
    try {
      console.log('🔄 Syncing shared database for all users...');
      
      // Use first user's database ID (they should all be the same)
      const databaseId = users[0]?.notion_task_database_id;
      if (!databaseId) {
        console.error('❌ No database ID found');
        return { changes: [], errors: ['No database ID'] };
      }

      // Get Notion client using first user's token
      const notion = await this.getNotionClientForUser(users[0].id);
      if (!notion) {
        console.error('❌ Could not get Notion client');
        return { changes: [], errors: ['No Notion client'] };
      }

      // Fetch tasks from Notion
      const notionTasks = await this.fetchTasksFromNotion(notion, databaseId);
      
      // Get all existing tasks from database
      const { data: existingTasks } = await this.supabase
        .from('tasks')
        .select('*');

      // Process changes
      const changes = await this.compareAndSyncTasksShared(users, notionTasks, existingTasks || []);
      
      return { changes, errors: [] };
    } catch (error) {
      console.error('❌ Error in syncSharedDatabase:', error);
      return { changes: [], errors: [error.message] };
    }
  }

  async compareAndSyncTasksShared(users, notionTasks, existingTasks) {
    const changes = [];
    const existingTasksMap = new Map(existingTasks.map(t => [t.notion_id, t]));

    for (const notionTask of notionTasks) {
      const existingTask = existingTasksMap.get(notionTask.notion_id);
      
      if (!existingTask) {
        // New task - determine actual user who should own it
        const actualUserId = await this.determineTaskOwner(notionTask, users[0].id);
        const change = await this.insertTask(actualUserId, notionTask);
        if (change) changes.push(change);
      } else {
        // Existing task - check for updates and determine who made the change
        const change = await this.updateTaskIfChangedWithUserDetection(existingTask, notionTask);
        if (change) changes.push(change);
      }
    }

    return changes;
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
