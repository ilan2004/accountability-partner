#!/usr/bin/env tsx

/**
 * Script to delete ALL failed notifications and start fresh
 * This will completely remove old failed notifications so we can start clean
 */

import { config } from 'dotenv';
import pino from 'pino';
import { supabase } from '../lib/supabase';

config();

const logger = pino({ level: 'info', name: 'notification-delete' });

async function deleteAllFailedNotifications() {
  logger.info('🗑️ Deleting ALL failed notifications to start fresh...');

  try {
    // First, get count of failed notifications
    const { count: failedCount, error: countError } = await supabase
      .from('Notification')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    if (countError) {
      logger.error('Failed to count failed notifications:', countError);
      return;
    }

    logger.info(`Found ${failedCount || 0} failed notifications to delete`);

    if (!failedCount || failedCount === 0) {
      logger.info('✅ No failed notifications found to delete');
      return;
    }

    // Delete all failed notifications
    const { error: deleteError } = await supabase
      .from('Notification')
      .delete()
      .eq('status', 'failed');

    if (deleteError) {
      logger.error('Failed to delete notifications:', deleteError);
      return;
    }

    logger.info(`✅ Successfully deleted ${failedCount} failed notifications`);

    // Also reset any task events that were processed for these failed notifications
    // so they can be reprocessed if needed
    const { error: resetError } = await supabase
      .from('TaskEvent')
      .update({ processedAt: null })
      .not('processedAt', 'is', null);

    if (resetError) {
      logger.warn('Failed to reset task events (not critical):', resetError);
    } else {
      logger.info('✅ Reset task events for potential reprocessing');
    }

    // Show final summary
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
      logger.info('📊 Final notification status summary:');
      Object.entries(summary).forEach(([status, count]) => {
        logger.info(`  ${status}: ${count}`);
      });
    }

    logger.info('🎉 Cleanup completed! System will now start fresh with only new notifications.');
    logger.info('💰 This should stop the unnecessary credit usage from retrying old failed notifications.');

  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

// Run the cleanup
deleteAllFailedNotifications().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
