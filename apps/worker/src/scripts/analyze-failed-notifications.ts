#!/usr/bin/env tsx

/**
 * Script to analyze failing notifications and their associated events
 */

import { config } from 'dotenv';
import pino from 'pino';
import { supabase } from '../lib/supabase';

config();

const logger = pino({ level: 'info', name: 'notification-analyzer' });

async function analyzeFailedNotifications() {
  logger.info('🔍 Analyzing failed notifications...');

  try {
    // Get all notifications with their status and associated events
    const { data: notifications, error: notificationsError } = await supabase
      .from('Notification')
      .select(`
        id,
        status,
        channel,
        retryCount,
        lastError,
        createdAt,
        sentAt,
        taskEventId,
        TaskEvent:taskEventId (
          id,
          eventType,
          createdAt,
          processedAt,
          TaskMirror:taskMirrorId (
            id,
            title,
            status,
            notionId,
            User:ownerId (
              id,
              name,
              email
            )
          )
        )
      `)
      .order('createdAt', { ascending: false })
      .limit(50);

    if (notificationsError) {
      logger.error('Failed to fetch notifications:', notificationsError);
      return;
    }

    logger.info(`📊 Found ${notifications.length} notifications`);

    // Group by status
    const byStatus = notifications.reduce((acc, notification) => {
      const status = notification.status || 'unknown';
      if (!acc[status]) acc[status] = [];
      acc[status].push(notification);
      return acc;
    }, {} as Record<string, any[]>);

    logger.info('📈 Notification Status Summary:');
    Object.entries(byStatus).forEach(([status, items]) => {
      logger.info(`  ${status}: ${items.length}`);
    });

    // Analyze failed notifications
    const failed = byStatus.failed || [];
    const pending = byStatus.pending || [];
    const sent = byStatus.sent || [];

    logger.info('\n❌ FAILED NOTIFICATIONS:');
    failed.forEach((notification, index) => {
      const event = notification.TaskEvent;
      const task = event?.TaskMirror;
      const owner = task?.User;
      
      logger.info(`${index + 1}. Notification ${notification.id}`);
      logger.info(`   Status: ${notification.status}`);
      logger.info(`   Retry Count: ${notification.retryCount}`);
      logger.info(`   Last Error: ${notification.lastError || 'No error message'}`);
      logger.info(`   Created: ${notification.createdAt}`);
      logger.info(`   Event Type: ${event?.eventType || 'Unknown'}`);
      logger.info(`   Task: ${task?.title || 'Unknown'} (${task?.status || 'Unknown'})`);
      logger.info(`   Owner: ${owner?.name || 'Unknown'} (${owner?.email || 'Unknown'})`);
      logger.info(`   Event Processed: ${event?.processedAt ? 'Yes' : 'No'}`);
      logger.info('');
    });

    logger.info('\n⏳ PENDING NOTIFICATIONS:');
    pending.forEach((notification, index) => {
      const event = notification.TaskEvent;
      const task = event?.TaskMirror;
      const owner = task?.User;
      
      logger.info(`${index + 1}. Notification ${notification.id}`);
      logger.info(`   Status: ${notification.status}`);
      logger.info(`   Retry Count: ${notification.retryCount}`);
      logger.info(`   Created: ${notification.createdAt}`);
      logger.info(`   Event Type: ${event?.eventType || 'Unknown'}`);
      logger.info(`   Task: ${task?.title || 'Unknown'} (${task?.status || 'Unknown'})`);
      logger.info(`   Owner: ${owner?.name || 'Unknown'} (${owner?.email || 'Unknown'})`);
      logger.info(`   Event Processed: ${event?.processedAt ? 'Yes' : 'No'}`);
      logger.info('');
    });

    logger.info('\n✅ RECENT SUCCESSFUL NOTIFICATIONS:');
    sent.slice(0, 5).forEach((notification, index) => {
      const event = notification.TaskEvent;
      const task = event?.TaskMirror;
      const owner = task?.User;
      
      logger.info(`${index + 1}. Notification ${notification.id}`);
      logger.info(`   Status: ${notification.status}`);
      logger.info(`   Sent At: ${notification.sentAt}`);
      logger.info(`   Event Type: ${event?.eventType || 'Unknown'}`);
      logger.info(`   Task: ${task?.title || 'Unknown'} (${task?.status || 'Unknown'})`);
      logger.info(`   Owner: ${owner?.name || 'Unknown'} (${owner?.email || 'Unknown'})`);
      logger.info('');
    });

    // Check for patterns
    logger.info('\n🔍 PATTERN ANALYSIS:');
    
    const failedEventTypes = failed.map(n => n.TaskEvent?.eventType).filter(Boolean);
    const failedEventTypeCounts = failedEventTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    logger.info('Failed by event type:');
    Object.entries(failedEventTypeCounts).forEach(([type, count]) => {
      logger.info(`  ${type}: ${count}`);
    });

    const failedTaskTitles = failed.map(n => n.TaskEvent?.TaskMirror?.title).filter(Boolean);
    const uniqueFailedTasks = [...new Set(failedTaskTitles)];
    logger.info(`\nFailed notifications for ${uniqueFailedTasks.length} unique tasks:`);
    uniqueFailedTasks.forEach(title => {
      logger.info(`  - ${title}`);
    });

    // Check if there are old events that should be cleaned up
    const oldPending = pending.filter(n => {
      const created = new Date(n.createdAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      return hoursDiff > 1; // Older than 1 hour
    });

    if (oldPending.length > 0) {
      logger.info(`\n⚠️  Found ${oldPending.length} old pending notifications (>1 hour old)`);
      logger.info('These might need manual cleanup or investigation');
    }

  } catch (error) {
    logger.error('Error analyzing notifications:', error);
  }
}

// Run the analysis
analyzeFailedNotifications().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
