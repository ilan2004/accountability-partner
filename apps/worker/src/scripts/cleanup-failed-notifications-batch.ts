#!/usr/bin/env tsx

/**
 * Script to clean up failed notifications in smaller batches to avoid database limits
 * This will mark failed notifications as permanently failed to stop retrying
 */

import { config } from 'dotenv';
import pino from 'pino';
import { supabase } from '../lib/supabase';

config();

const logger = pino({ level: 'info', name: 'notification-cleanup-batch' });

async function cleanupFailedNotificationsBatch() {
  logger.info('🧹 Cleaning up failed notifications in batches...');

  try {
    let totalCleaned = 0;
    let batchSize = 50; // Process 50 at a time
    let hasMore = true;

    while (hasMore) {
      // Get a batch of failed notifications
      const { data: failedNotifications, error: fetchError } = await supabase
        .from('Notification')
        .select('id, status, retryCount, lastError, createdAt')
        .eq('status', 'failed')
        .eq('lastError', 'Max retries exceeded')
        .limit(batchSize);

      if (fetchError) {
        logger.error('Failed to fetch failed notifications:', fetchError);
        break;
      }

      if (!failedNotifications || failedNotifications.length === 0) {
        hasMore = false;
        break;
      }

      logger.info(`Processing batch of ${failedNotifications.length} failed notifications`);

      // Mark these as permanently failed to stop retrying
      const notificationIds = failedNotifications.map(n => n.id);
      
      const { error: updateError } = await supabase
        .from('Notification')
        .update({
          status: 'permanently_failed', // New status to indicate we should stop retrying
          lastError: 'Permanently failed - emoji/unicode issue resolved',
        })
        .in('id', notificationIds);

      if (updateError) {
        logger.error('Failed to update notifications:', updateError);
        break;
      }

      totalCleaned += failedNotifications.length;
      logger.info(`✅ Marked ${failedNotifications.length} notifications as permanently failed`);

      // If we got fewer than batchSize, we're done
      if (failedNotifications.length < batchSize) {
        hasMore = false;
      }

      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(`🎉 Cleanup completed! Total notifications marked as permanently failed: ${totalCleaned}`);
    
    // Show summary
    const { data: summary, error: summaryError } = await supabase
      .from('Notification')
      .select('status')
      .then(result => {
        if (result.error) return result;
        
        const statusCounts = (result.data || []).reduce((acc, n) => {
          acc[n.status] = (acc[n.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return { data: statusCounts, error: null };
      });

    if (!summaryError && summary) {
      logger.info('📊 Current notification status summary:');
      Object.entries(summary).forEach(([status, count]) => {
        logger.info(`  ${status}: ${count}`);
      });
    }

  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupFailedNotificationsBatch().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
