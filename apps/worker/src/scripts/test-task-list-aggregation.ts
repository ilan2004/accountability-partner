import { config } from 'dotenv';
import pino from 'pino';
import { supabase, SupabaseWorkerHelpers } from '../lib/supabase';
import { NotificationService } from '../services/notification-service-supabase';
import { v4 as uuidv4 } from 'uuid';

// Load environment
config();

const logger = pino({ level: 'debug', name: 'test-task-list-aggregation' });

async function createTestEvents(count: number, taskMirrorId: string) {
  const events = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const idempotencyKey = `test-created-${taskMirrorId}-${i}-${now.getTime()}`;
    const { data, error } = await supabase
      .from('TaskEvent')
      .insert({
        id: uuidv4(),
        taskMirrorId,
        eventType: 'created',
        previousStatus: null,
        newStatus: 'Not started',
        idempotencyKey,
        createdAt: new Date(now.getTime() + i * 1000).toISOString(), // Space out by 1 second
      })
      .select()
      .single();
      
    if (error) {
      logger.error({ error }, 'Failed to create test event');
    } else {
      events.push(data);
      logger.info(`Created test event ${i + 1}/${count}`);
    }
  }
  
  return events;
}

async function test() {
  logger.info('🧪 Testing task list aggregation and error handling');
  
  const pairId = process.env.PAIR_ID;
  if (!pairId) {
    logger.error('PAIR_ID is required');
    return;
  }
  
  try {
    // Get a task to use for testing
    const tasks = await SupabaseWorkerHelpers.getAllTasksForPair(pairId);
    if (tasks.length === 0) {
      logger.error('No tasks found for testing');
      return;
    }
    
    const testTask = tasks[0];
    logger.info(`Using task "${testTask.title}" for testing`);
    
    // Test 1: Create multiple events within aggregation window
    logger.info('\n📋 Test 1: Multiple created events within aggregation window');
    const events = await createTestEvents(3, testTask.id);
    
    // Create notification service (without WhatsApp for dry run)
    const notificationService = new NotificationService({
      whatsappClient: null, // Will trigger permanent failure
      pairId,
    });
    
    // Process events
    await notificationService.processUnsentEvents();
    
    // Check results
    logger.info('\n📊 Checking results...');
    
    // Check if events were processed
    for (const event of events) {
      const { data: updatedEvent } = await supabase
        .from('TaskEvent')
        .select('processedAt')
        .eq('id', event.id)
        .single();
        
      logger.info({
        eventId: event.id,
        processed: !!updatedEvent?.processedAt,
      }, 'Event status');
    }
    
    // Check notifications
    const { data: notifications } = await supabase
      .from('Notification')
      .select('*')
      .in('taskEventId', events.map(e => e.id));
      
    logger.info(`\n📬 Found ${notifications?.length || 0} notifications:`);
    notifications?.forEach(n => {
      logger.info({
        id: n.id,
        taskEventId: n.taskEventId,
        status: n.status,
        lastError: n.lastError,
        retryCount: n.retryCount,
        nextAttemptAt: n.nextAttemptAt,
      }, 'Notification');
    });
    
    // Test 2: Test error classification
    logger.info('\n🔧 Test 2: Error classification');
    
    // Create a single completion event
    const { data: completionEvent } = await supabase
      .from('TaskEvent')
      .insert({
        id: uuidv4(),
        taskMirrorId: testTask.id,
        eventType: 'completed',
        previousStatus: 'In Progress',
        newStatus: 'Done',
        idempotencyKey: `test-completed-${testTask.id}-${Date.now()}`,
      })
      .select()
      .single();
      
    if (completionEvent) {
      // Process it (should fail with permanent error due to no WhatsApp)
      await notificationService.processUnsentEvents();
      
      // Check the notification
      const { data: completionNotif } = await supabase
        .from('Notification')
        .select('*')
        .eq('taskEventId', completionEvent.id)
        .single();
        
      logger.info({
        eventType: 'completed',
        notificationStatus: completionNotif?.status,
        lastError: completionNotif?.lastError,
        isPermanentlyFailed: completionNotif?.status === 'permanently_failed',
      }, 'Completion notification result');
    }
    
    // Clean up test data
    logger.info('\n🧹 Cleaning up test data...');
    const allEventIds = [...events.map(e => e.id), completionEvent?.id].filter(Boolean);
    
    await supabase
      .from('Notification')
      .delete()
      .in('taskEventId', allEventIds);
      
    await supabase
      .from('TaskEvent')
      .delete()
      .in('id', allEventIds);
      
    logger.info('✅ Test completed!');
    
  } catch (error) {
    logger.error({ error }, '❌ Test failed');
  }
}

// Run test
test().catch(error => {
  logger.error({ error }, 'Unhandled error');
  process.exit(1);
});
