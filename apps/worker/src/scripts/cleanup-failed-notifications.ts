#!/usr/bin/env tsx

/**
 * Script to clean up failed emoji-related notifications so they can be retried
 * This will reset failed notifications back to pending status
 */

import { config } from 'dotenv';
import pino from 'pino';
import { supabase } from '../lib/supabase';

config();

const logger = pino({ level: 'info', name: 'notification-cleanup' });

async function cleanupFailedNotifications() {
  logger.info('🧹 Cleaning up failed emoji-related notifications...');

  try {
    // Get all failed notifications that are related to the emoji task
    const { data: failedNotifications, error: fetchError } = await supabase
      .from('Notification')
      .select(`
        id,
        status,
        retryCount,
        lastError,
        TaskEvent:taskEventId (
          id,
          TaskMirror:taskMirrorId (
            id,
            title
          )
        )
      `)
      .eq('status', 'failed')
      .eq('lastError', 'Max retries exceeded');

    if (fetchError) {
      logger.error('Failed to fetch failed notifications:', fetchError);
      return;
    }

    if (!failedNotifications || failedNotifications.length === 0) {
      logger.info('✅ No failed notifications found to clean up');
      return;
    }

    logger.info(`Found ${failedNotifications.length} failed notifications`);

    // Filter for emoji-related failures (task contains emojis)
    const emojiFailures = failedNotifications.filter(notification => {
      const taskTitle = (notification.TaskEvent as any)?.TaskMirror?.title || '';
      const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu.test(taskTitle);
      return hasEmojis;
    });

    if (emojiFailures.length === 0) {
      logger.info('✅ No emoji-related failed notifications found');
      return;
    }

    logger.info(`Found ${emojiFailures.length} emoji-related failed notifications to reset`);

    // Reset these notifications to pending status with retry count 0
    const notificationIds = emojiFailures.map(n => n.id);
    
    const { error: resetError } = await supabase
      .from('Notification')
      .update({
        status: 'pending',
        retryCount: 0,
        lastError: null,
        sentAt: null
      })
      .in('id', notificationIds);

    if (resetError) {
      logger.error('Failed to reset notifications:', resetError);
      return;
    }

    logger.info(`✅ Successfully reset ${emojiFailures.length} failed notifications to pending`);
    
    // Show which tasks will be retried
    const uniqueTasks = [...new Set(emojiFailures.map(n => (n.TaskEvent as any)?.TaskMirror?.title))];
    logger.info('📝 Tasks that will be retried:');
    uniqueTasks.forEach(title => {
      if (title) {
        logger.info(`  - "${title}"`);
      }
    });

    // Also reset their task events processedAt so they'll be picked up again
    const eventIds = emojiFailures.map(n => (n.TaskEvent as any)?.id).filter(Boolean);
    
    if (eventIds.length > 0) {
      const { error: eventResetError } = await supabase
        .from('TaskEvent')
        .update({
          processedAt: null
        })
        .in('id', eventIds);

      if (eventResetError) {
        logger.warn('Failed to reset task events (notifications will still be retried):', eventResetError);
      } else {
        logger.info(`✅ Reset ${eventIds.length} task events for reprocessing`);
      }
    }

    logger.info('🎉 Cleanup completed! Emoji-sanitized notifications should now be sent successfully.');

  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupFailedNotifications().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
