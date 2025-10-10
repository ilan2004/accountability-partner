#!/usr/bin/env tsx

/**
 * Migration Script: Railway Postgres → Supabase
 * 
 * This script migrates all data from Railway Postgres to Supabase.
 * It handles user mapping and foreign key relationships properly.
 * 
 * Usage:
 * 1. Set environment variables: RAILWAY_DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 2. Run: npx tsx scripts/migrate-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface MigrationStats {
  table: string;
  sourceCount: number;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

class SupabaseMigrator {
  private railwayClient: Client;
  private supabaseClient: any;
  private stats: MigrationStats[] = [];

  constructor() {
    const railwayUrl = process.env.RAILWAY_DATABASE_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!railwayUrl || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables: RAILWAY_DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    }

    this.railwayClient = new Client({ connectionString: railwayUrl });
    this.supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('🔗 Migration clients initialized');
  }

  async connect() {
    await this.railwayClient.connect();
    console.log('✅ Connected to Railway database');
  }

  async disconnect() {
    await this.railwayClient.end();
    console.log('✅ Disconnected from Railway database');
  }

  private createStats(table: string): MigrationStats {
    const stat = {
      table,
      sourceCount: 0,
      migratedCount: 0,
      skippedCount: 0,
      errors: []
    };
    this.stats.push(stat);
    return stat;
  }

  /**
   * Migrate User table
   * Note: Users in Supabase are managed by auth.users, so we only sync additional fields
   */
  async migrateUsers() {
    console.log('\n👥 Migrating Users...');
    const stats = this.createStats('User');

    try {
      const result = await this.railwayClient.query('SELECT * FROM "User" ORDER BY "createdAt"');
      const users = result.rows;
      stats.sourceCount = users.length;

      console.log(`Found ${users.length} users in Railway`);

      for (const user of users) {
        try {
          // Check if user exists in Supabase auth
          const { data: authUsers, error: authError } = await this.supabaseClient.auth.admin.listUsers();
          
          if (authError) {
            console.warn(`Warning: Could not fetch auth users: ${authError.message}`);
          }

          const existingAuthUser = authUsers?.users?.find((au: any) => au.email === user.email);
          
          if (existingAuthUser) {
            // Update existing user record with Railway data
            const { error } = await this.supabaseClient
              .from('User')
              .upsert({
                id: existingAuthUser.id, // Use Supabase auth ID
                email: user.email,
                name: user.name,
                notionId: user.notionId,
                emailVerified: user.emailVerified,
                image: user.image,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
              }, { onConflict: 'id' });

            if (error) {
              stats.errors.push(`User ${user.email}: ${error.message}`);
              console.error(`❌ Error upserting user ${user.email}:`, error.message);
            } else {
              stats.migratedCount++;
              console.log(`✅ Migrated user: ${user.email} (Railway ID: ${user.id} → Supabase ID: ${existingAuthUser.id})`);
            }
          } else {
            console.log(`⚠️  User ${user.email} not found in Supabase auth - will be created on next login`);
            stats.skippedCount++;
          }
        } catch (error) {
          stats.errors.push(`User ${user.email}: ${error}`);
          console.error(`❌ Error processing user ${user.email}:`, error);
        }
      }
    } catch (error) {
      stats.errors.push(`Migration failed: ${error}`);
      console.error('❌ User migration failed:', error);
    }
  }

  /**
   * Migrate Pair table
   * This requires mapping Railway user IDs to Supabase user IDs
   */
  async migratePairs() {
    console.log('\n👫 Migrating Pairs...');
    const stats = this.createStats('Pair');

    try {
      const result = await this.railwayClient.query('SELECT * FROM "Pair" ORDER BY "createdAt"');
      const pairs = result.rows;
      stats.sourceCount = pairs.length;

      console.log(`Found ${pairs.length} pairs in Railway`);

      // Create user ID mapping
      const userIdMap = await this.createUserIdMapping();

      for (const pair of pairs) {
        try {
          const supabaseUser1Id = userIdMap.get(pair.user1Id);
          const supabaseUser2Id = userIdMap.get(pair.user2Id);

          if (!supabaseUser1Id || !supabaseUser2Id) {
            console.log(`⚠️  Skipping pair ${pair.id}: Missing user mapping (${pair.user1Id} → ${supabaseUser1Id}, ${pair.user2Id} → ${supabaseUser2Id})`);
            stats.skippedCount++;
            continue;
          }

          const { error } = await this.supabaseClient
            .from('Pair')
            .upsert({
              id: pair.id,
              user1Id: supabaseUser1Id,
              user2Id: supabaseUser2Id,
              isActive: pair.isActive,
              createdAt: pair.createdAt,
              updatedAt: pair.updatedAt
            }, { onConflict: 'id' });

          if (error) {
            stats.errors.push(`Pair ${pair.id}: ${error.message}`);
            console.error(`❌ Error upserting pair ${pair.id}:`, error.message);
          } else {
            stats.migratedCount++;
            console.log(`✅ Migrated pair: ${pair.id}`);
          }
        } catch (error) {
          stats.errors.push(`Pair ${pair.id}: ${error}`);
          console.error(`❌ Error processing pair ${pair.id}:`, error);
        }
      }
    } catch (error) {
      stats.errors.push(`Migration failed: ${error}`);
      console.error('❌ Pair migration failed:', error);
    }
  }

  /**
   * Migrate NotionConfig table
   */
  async migrateNotionConfigs() {
    console.log('\n📝 Migrating Notion Configs...');
    const stats = this.createStats('NotionConfig');

    try {
      const result = await this.railwayClient.query('SELECT * FROM "NotionConfig" ORDER BY "createdAt"');
      const configs = result.rows;
      stats.sourceCount = configs.length;

      console.log(`Found ${configs.length} notion configs in Railway`);

      for (const config of configs) {
        try {
          const { error } = await this.supabaseClient
            .from('NotionConfig')
            .upsert({
              id: config.id,
              pairId: config.pairId,
              databaseId: config.databaseId,
              integrationToken: config.integrationToken,
              lastSyncAt: config.lastSyncAt,
              createdAt: config.createdAt,
              updatedAt: config.updatedAt
            }, { onConflict: 'id' });

          if (error) {
            stats.errors.push(`NotionConfig ${config.id}: ${error.message}`);
            console.error(`❌ Error upserting notion config ${config.id}:`, error.message);
          } else {
            stats.migratedCount++;
            console.log(`✅ Migrated notion config: ${config.id}`);
          }
        } catch (error) {
          stats.errors.push(`NotionConfig ${config.id}: ${error}`);
          console.error(`❌ Error processing notion config ${config.id}:`, error);
        }
      }
    } catch (error) {
      stats.errors.push(`Migration failed: ${error}`);
      console.error('❌ NotionConfig migration failed:', error);
    }
  }

  /**
   * Migrate Settings table
   */
  async migrateSettings() {
    console.log('\n⚙️ Migrating Settings...');
    const stats = this.createStats('Settings');

    try {
      const result = await this.railwayClient.query('SELECT * FROM "Settings" ORDER BY "createdAt"');
      const settings = result.rows;
      stats.sourceCount = settings.length;

      console.log(`Found ${settings.length} settings in Railway`);

      // Get user ID mapping for userId field
      const userIdMap = await this.createUserIdMapping();

      for (const setting of settings) {
        try {
          let userId = setting.userId;
          if (userId && userIdMap.has(userId)) {
            userId = userIdMap.get(userId);
          }

          const { error } = await this.supabaseClient
            .from('Settings')
            .upsert({
              id: setting.id,
              pairId: setting.pairId,
              userId: userId,
              timezone: setting.timezone,
              warningTime: setting.warningTime,
              summaryTime: setting.summaryTime,
              whatsappGroupJid: setting.whatsappGroupJid,
              notificationTemplates: setting.notificationTemplates,
              isActive: setting.isActive,
              createdAt: setting.createdAt,
              updatedAt: setting.updatedAt
            }, { onConflict: 'id' });

          if (error) {
            stats.errors.push(`Settings ${setting.id}: ${error.message}`);
            console.error(`❌ Error upserting settings ${setting.id}:`, error.message);
          } else {
            stats.migratedCount++;
            console.log(`✅ Migrated settings: ${setting.id}`);
          }
        } catch (error) {
          stats.errors.push(`Settings ${setting.id}: ${error}`);
          console.error(`❌ Error processing settings ${setting.id}:`, error);
        }
      }
    } catch (error) {
      stats.errors.push(`Migration failed: ${error}`);
      console.error('❌ Settings migration failed:', error);
    }
  }

  /**
   * Migrate TaskMirror table
   */
  async migrateTaskMirrors() {
    console.log('\n📋 Migrating Task Mirrors...');
    const stats = this.createStats('TaskMirror');

    try {
      const result = await this.railwayClient.query('SELECT * FROM "TaskMirror" ORDER BY "createdAt"');
      const tasks = result.rows;
      stats.sourceCount = tasks.length;

      console.log(`Found ${tasks.length} task mirrors in Railway`);

      // Get user ID mapping
      const userIdMap = await this.createUserIdMapping();

      for (const task of tasks) {
        try {
          const supabaseOwnerId = userIdMap.get(task.ownerId);
          if (!supabaseOwnerId) {
            console.log(`⚠️  Skipping task ${task.id}: Missing owner mapping (${task.ownerId})`);
            stats.skippedCount++;
            continue;
          }

          const { error } = await this.supabaseClient
            .from('TaskMirror')
            .upsert({
              id: task.id,
              notionId: task.notionId,
              title: task.title,
              status: task.status,
              dueDate: task.dueDate,
              ownerId: supabaseOwnerId,
              lastEditedTime: task.lastEditedTime,
              notionUrl: task.notionUrl,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt
            }, { onConflict: 'id' });

          if (error) {
            stats.errors.push(`TaskMirror ${task.id}: ${error.message}`);
            console.error(`❌ Error upserting task ${task.id}:`, error.message);
          } else {
            stats.migratedCount++;
            console.log(`✅ Migrated task: ${task.title} (${task.id})`);
          }
        } catch (error) {
          stats.errors.push(`TaskMirror ${task.id}: ${error}`);
          console.error(`❌ Error processing task ${task.id}:`, error);
        }
      }
    } catch (error) {
      stats.errors.push(`Migration failed: ${error}`);
      console.error('❌ TaskMirror migration failed:', error);
    }
  }

  /**
   * Migrate TaskEvent table
   */
  async migrateTaskEvents() {
    console.log('\n📊 Migrating Task Events...');
    const stats = this.createStats('TaskEvent');

    try {
      const result = await this.railwayClient.query('SELECT * FROM "TaskEvent" ORDER BY "createdAt"');
      const events = result.rows;
      stats.sourceCount = events.length;

      console.log(`Found ${events.length} task events in Railway`);

      for (const event of events) {
        try {
          const { error } = await this.supabaseClient
            .from('TaskEvent')
            .upsert({
              id: event.id,
              taskMirrorId: event.taskMirrorId,
              eventType: event.eventType,
              previousStatus: event.previousStatus,
              newStatus: event.newStatus,
              idempotencyKey: event.idempotencyKey,
              processedAt: event.processedAt,
              createdAt: event.createdAt
            }, { onConflict: 'id' });

          if (error) {
            stats.errors.push(`TaskEvent ${event.id}: ${error.message}`);
            console.error(`❌ Error upserting task event ${event.id}:`, error.message);
          } else {
            stats.migratedCount++;
            console.log(`✅ Migrated task event: ${event.id}`);
          }
        } catch (error) {
          stats.errors.push(`TaskEvent ${event.id}: ${error}`);
          console.error(`❌ Error processing task event ${event.id}:`, error);
        }
      }
    } catch (error) {
      stats.errors.push(`Migration failed: ${error}`);
      console.error('❌ TaskEvent migration failed:', error);
    }
  }

  /**
   * Migrate Notification table
   */
  async migrateNotifications() {
    console.log('\n🔔 Migrating Notifications...');
    const stats = this.createStats('Notification');

    try {
      const result = await this.railwayClient.query('SELECT * FROM "Notification" ORDER BY "createdAt"');
      const notifications = result.rows;
      stats.sourceCount = notifications.length;

      console.log(`Found ${notifications.length} notifications in Railway`);

      for (const notification of notifications) {
        try {
          const { error } = await this.supabaseClient
            .from('Notification')
            .upsert({
              id: notification.id,
              taskEventId: notification.taskEventId,
              channel: notification.channel,
              status: notification.status,
              sentAt: notification.sentAt,
              retryCount: notification.retryCount,
              lastError: notification.lastError,
              messageId: notification.messageId,
              createdAt: notification.createdAt,
              updatedAt: notification.updatedAt
            }, { onConflict: 'id' });

          if (error) {
            stats.errors.push(`Notification ${notification.id}: ${error.message}`);
            console.error(`❌ Error upserting notification ${notification.id}:`, error.message);
          } else {
            stats.migratedCount++;
            console.log(`✅ Migrated notification: ${notification.id}`);
          }
        } catch (error) {
          stats.errors.push(`Notification ${notification.id}: ${error}`);
          console.error(`❌ Error processing notification ${notification.id}:`, error);
        }
      }
    } catch (error) {
      stats.errors.push(`Migration failed: ${error}`);
      console.error('❌ Notification migration failed:', error);
    }
  }

  /**
   * Create mapping from Railway User IDs to Supabase User IDs based on email
   */
  private async createUserIdMapping(): Promise<Map<string, string>> {
    const mapping = new Map<string, string>();

    try {
      // Get Railway users
      const railwayResult = await this.railwayClient.query('SELECT id, email FROM "User"');
      const railwayUsers = railwayResult.rows;

      // Get Supabase auth users
      const { data: authData, error } = await this.supabaseClient.auth.admin.listUsers();
      if (error) {
        console.error('Error fetching Supabase auth users:', error);
        return mapping;
      }

      const supabaseUsers = authData.users;

      // Create mapping by email
      for (const railwayUser of railwayUsers) {
        const supabaseUser = supabaseUsers.find((su: any) => su.email === railwayUser.email);
        if (supabaseUser) {
          mapping.set(railwayUser.id, supabaseUser.id);
        }
      }

      console.log(`📋 Created user ID mapping: ${mapping.size} users mapped`);
    } catch (error) {
      console.error('Error creating user ID mapping:', error);
    }

    return mapping;
  }

  /**
   * Print migration statistics
   */
  private printStats() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));

    let totalSource = 0;
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const stat of this.stats) {
      totalSource += stat.sourceCount;
      totalMigrated += stat.migratedCount;
      totalSkipped += stat.skippedCount;
      totalErrors += stat.errors.length;

      console.log(`${stat.table.padEnd(15)} | Source: ${stat.sourceCount.toString().padStart(3)} | Migrated: ${stat.migratedCount.toString().padStart(3)} | Skipped: ${stat.skippedCount.toString().padStart(3)} | Errors: ${stat.errors.length.toString().padStart(3)}`);
    }

    console.log('-'.repeat(80));
    console.log(`${'TOTAL'.padEnd(15)} | Source: ${totalSource.toString().padStart(3)} | Migrated: ${totalMigrated.toString().padStart(3)} | Skipped: ${totalSkipped.toString().padStart(3)} | Errors: ${totalErrors.toString().padStart(3)}`);

    // Print errors if any
    if (totalErrors > 0) {
      console.log('\n❌ ERRORS:');
      for (const stat of this.stats) {
        if (stat.errors.length > 0) {
          console.log(`\n${stat.table}:`);
          stat.errors.forEach(error => console.log(`  - ${error}`));
        }
      }
    }

    if (totalErrors === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log(`\n⚠️  Migration completed with ${totalErrors} errors. Please review and address them.`);
    }
  }

  /**
   * Run the full migration
   */
  async migrate() {
    try {
      console.log('🚀 Starting Railway → Supabase migration');
      
      await this.connect();

      // Migration order matters due to foreign key relationships
      await this.migrateUsers();
      await this.migratePairs();
      await this.migrateNotionConfigs();
      await this.migrateSettings();
      await this.migrateTaskMirrors();
      await this.migrateTaskEvents();
      await this.migrateNotifications();

      this.printStats();
    } catch (error) {
      console.error('❌ Migration failed:', error);
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  const migrator = new SupabaseMigrator();
  migrator.migrate().catch(console.error);
}

export default SupabaseMigrator;
