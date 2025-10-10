#!/usr/bin/env tsx

import { WhatsAppClient } from './src/whatsapp/client';
import pino from 'pino';

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function testAuth() {
  logger.info('Testing existing WhatsApp auth files...');

  const client = new WhatsAppClient({
    sessionName: 'accountability-bot',
    authPath: './auth',  // Use existing auth directory
    printQR: false,  // Don't print QR since we're using existing auth
  });
  
  try {
    logger.info('Attempting to connect with existing auth...');
    await client.connect();
    
    logger.info('✅ Successfully connected to WhatsApp!');
    logger.info('Connection state:', client.getConnectionState());
    
    // Test fetching groups
    logger.info('Fetching groups...');
    const groups = await client.getGroups();
    logger.info(`Found ${groups.length} groups`);
    
    if (groups.length > 0) {
      logger.info('\nYour WhatsApp groups:');
      groups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.subject || 'Unnamed Group'}`);
        console.log(`   JID: ${group.id}`);
      });
    }
    
    logger.info('\n✅ Auth files are valid and working!');
    
  } catch (error) {
    logger.error('Failed to connect:', error);
    logger.info('\nThe existing auth files may be expired or invalid.');
  } finally {
    await client.disconnect();
    process.exit(0);
  }
}

testAuth().catch(console.error);
