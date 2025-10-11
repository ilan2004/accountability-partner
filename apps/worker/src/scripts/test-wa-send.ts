#!/usr/bin/env tsx

/**
 * Simple test script to manually test WhatsApp message sending
 * This helps isolate WhatsApp issues from the notification service
 */

import { config } from 'dotenv';
import pino from 'pino';
import { WhatsAppClient } from '../whatsapp/client';
import { bootstrapWhatsAppAuth } from '../utils/whatsapp-bootstrap';

config();

const logger = pino({ level: 'debug', name: 'wa-test' });

async function testWhatsAppSend() {
  logger.info('🧪 Starting WhatsApp send test...');

  const groupJid = process.env.WA_GROUP_JID;
  if (!groupJid) {
    logger.error('❌ WA_GROUP_JID environment variable is required');
    process.exit(1);
  }

  logger.info(`📱 Testing with group JID: ${groupJid}`);

  try {
    // Bootstrap auth files if needed
    logger.info('🔄 Bootstrapping WhatsApp auth...');
    await bootstrapWhatsAppAuth();
    logger.info('✅ Auth bootstrap completed');
  } catch (error) {
    logger.warn('⚠️ Auth bootstrap failed, continuing anyway...', { error });
  }

  let client: WhatsAppClient | null = null;

  try {
    // Initialize WhatsApp client
    logger.info('🔄 Initializing WhatsApp client...');
    client = new WhatsAppClient({
      sessionName: process.env.WA_SESSION_NAME || 'accountability-bot',
      authPath: process.env.WA_AUTH_PATH || './auth',
      printQR: true,
    });

    // Connect
    logger.info('🔄 Connecting to WhatsApp...');
    await client.connect();
    logger.info('✅ Connected to WhatsApp successfully');

    // Get connection info
    const connectionInfo = client.getConnectionInfo();
    logger.info('📊 Connection info:', connectionInfo);

    // Test message
    const testMessage = `🧪 Test message from Accountability Bot - ${new Date().toISOString()}`;
    logger.info(`📤 Sending test message: "${testMessage}"`);

    await client.sendMessage({
      to: groupJid,
      text: testMessage,
    });

    logger.info('✅ Test message sent successfully!');

    // Try sending a second message to test consistency
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const secondMessage = `🔄 Second test message - ${new Date().toISOString()}`;
    logger.info(`📤 Sending second test message: "${secondMessage}"`);

    await client.sendMessage({
      to: groupJid,
      text: secondMessage,
    });

    logger.info('✅ Second test message sent successfully!');
    logger.info('🎉 All tests passed!');

  } catch (error) {
    logger.error('❌ Test failed:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  } finally {
    if (client) {
      logger.info('🔄 Disconnecting WhatsApp client...');
      try {
        await client.disconnect();
        logger.info('✅ Disconnected successfully');
      } catch (disconnectError) {
        logger.warn('⚠️ Error during disconnect:', disconnectError);
      }
    }
  }
}

// Run the test
testWhatsAppSend().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
