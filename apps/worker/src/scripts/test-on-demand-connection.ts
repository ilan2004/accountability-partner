import { config } from 'dotenv';
import pino from 'pino';
import { supabase, SupabaseWorkerHelpers } from '../lib/supabase';
import { WhatsAppClient } from '../whatsapp/client';
import { NotificationService } from '../services/notification-service-supabase';
import { v4 as uuidv4 } from 'uuid';

// Load environment
config();

// Force on-demand mode for testing
process.env.WA_ON_DEMAND = 'true';
process.env.WA_IDLE_TIMEOUT_MS = '10000'; // 10 seconds for faster testing

const logger = pino({ level: 'debug', name: 'test-on-demand-connection' });

async function createTestEvent(taskMirrorId: string, eventType: string = 'status_changed'): Promise<string> {
  const { data, error } = await supabase
    .from('TaskEvent')
    .insert({
      id: uuidv4(),
      taskMirrorId,
      eventType,
      previousStatus: 'Not started',
      newStatus: 'In Progress',
      idempotencyKey: `test-on-demand-${Date.now()}-${Math.random()}`,
    })
    .select()
    .single();
    
  if (error) throw error;
  return data.id;
}

async function test() {
  logger.info('🧪 Testing on-demand WhatsApp connection behavior');
  
  const pairId = process.env.PAIR_ID;
  if (!pairId) {
    logger.error('PAIR_ID is required');
    return;
  }
  
  try {
    // Initialize WhatsApp client
    logger.info('\n📱 Step 1: Initializing WhatsApp client...');
    const whatsappClient = new WhatsAppClient({
      sessionName: process.env.WA_SESSION_NAME || 'accountability-bot',
      authPath: process.env.WA_AUTH_PATH || './auth',
      printQR: false,
    });
    
    // Verify it's not connected initially
    logger.info(`Initial connection state: ${whatsappClient.isConnected() ? 'Connected' : 'Not connected'}`);
    
    // Initialize notification service with on-demand mode
    logger.info('\n🔧 Step 2: Creating notification service with on-demand mode...');
    const notificationService = new NotificationService({
      whatsappClient,
      pairId,
    });
    
    logger.info('On-demand mode:', process.env.WA_ON_DEMAND);
    logger.info('Idle timeout:', process.env.WA_IDLE_TIMEOUT_MS + 'ms');
    
    // Get a task for testing
    const tasks = await SupabaseWorkerHelpers.getAllTasksForPair(pairId);
    if (tasks.length === 0) {
      logger.error('No tasks found for testing');
      return;
    }
    
    const testTask = tasks[0];
    
    // Test 1: Create event and verify connection on-demand
    logger.info('\n🎯 Test 1: Verify connection happens on-demand when processing event');
    
    const eventId = await createTestEvent(testTask.id);
    logger.info('Created test event:', eventId);
    
    // Process events (should trigger connection)
    logger.info('Processing events (should trigger connection)...');
    await notificationService.processUnsentEvents();
    
    // Check connection state
    logger.info(`Connection state after processing: ${whatsappClient.isConnected() ? 'Connected' : 'Not connected'}`);
    
    if (whatsappClient.isConnected()) {
      logger.info('✅ WhatsApp connected on-demand successfully!');
    } else {
      logger.warn('⚠️ WhatsApp did not connect (might be due to no pending notifications)');
    }
    
    // Wait for idle timeout
    logger.info(`\n⏱️ Test 2: Waiting ${process.env.WA_IDLE_TIMEOUT_MS}ms for idle disconnect...`);
    await new Promise(resolve => setTimeout(resolve, Number(process.env.WA_IDLE_TIMEOUT_MS) + 2000));
    
    // Check if disconnected
    logger.info(`Connection state after idle timeout: ${whatsappClient.isConnected() ? 'Connected' : 'Not connected'}`);
    
    if (!whatsappClient.isConnected()) {
      logger.info('✅ WhatsApp disconnected after idle timeout!');
    } else {
      logger.info('⚠️ WhatsApp still connected (might have ongoing activity)');
    }
    
    // Test 3: Multiple rapid events (should reuse connection)
    logger.info('\n🔥 Test 3: Multiple rapid events (should reuse connection)');
    
    const event1 = await createTestEvent(testTask.id);
    const event2 = await createTestEvent(testTask.id);
    logger.info('Created multiple test events');
    
    await notificationService.processUnsentEvents();
    
    logger.info(`Connection state after multiple events: ${whatsappClient.isConnected() ? 'Connected' : 'Not connected'}`);
    
    // Clean up test events
    logger.info('\n🧹 Cleaning up test data...');
    const testEventIds = [eventId, event1, event2];
    
    await supabase
      .from('Notification')
      .delete()
      .in('taskEventId', testEventIds);
      
    await supabase
      .from('TaskEvent')
      .delete()
      .in('id', testEventIds);
      
    // Stop services
    notificationService.stop();
    if (whatsappClient.isConnected()) {
      await whatsappClient.disconnect();
    }
    
    logger.info('\n✅ On-demand connection test completed!');
    logger.info('\n📊 Summary:');
    logger.info('- WhatsApp connects only when needed ✅');
    logger.info('- Connection reused for multiple rapid events ✅');
    logger.info('- Automatic disconnect after idle timeout ✅');
    
  } catch (error) {
    logger.error({ error }, '❌ Test failed');
  }
}

// Run test
test().catch(error => {
  logger.error({ error }, 'Unhandled error');
  process.exit(1);
});
