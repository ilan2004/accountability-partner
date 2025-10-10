#!/usr/bin/env tsx

/**
 * WhatsApp Local Setup Script
 * Use this to authenticate WhatsApp locally and generate auth files
 * that can be transferred to Railway
 */

import { WhatsAppClient } from './src/whatsapp/client';
import pino from 'pino';
import * as readline from 'readline';

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function setup() {
  logger.info('🚀 WhatsApp Local Authentication Setup');
  logger.info('This will generate auth files that can be uploaded to Railway\n');

  // Use a fresh auth directory
  const authPath = './auth-fresh';
  
  // Create the directory if it doesn't exist
  const fs = require('fs');
  const path = require('path');
  const fullAuthPath = path.join(authPath, 'accountability-bot');
  if (!fs.existsSync(fullAuthPath)) {
    fs.mkdirSync(fullAuthPath, { recursive: true });
    logger.info('Created fresh auth directory');
  }
  
  const client = new WhatsAppClient({
    sessionName: 'accountability-bot',
    authPath: authPath,
    printQR: true,
  });
  
  try {
    // Connect to WhatsApp
    logger.info('📱 Connecting to WhatsApp...');
    logger.info('Please scan the QR code with your WhatsApp mobile app\n');
    
    await client.connect();
    
    logger.info('\n✅ Successfully connected to WhatsApp!');
    
    // Wait a moment for connection to stabilize
    logger.info('Waiting for connection to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // List all groups
    logger.info('\n📋 Fetching your WhatsApp groups...\n');
    
    const groups = await client.getGroups();
    
    if (groups.length === 0) {
      logger.warn('No groups found. Make sure you have created a group with your accountability partner.');
    } else {
      logger.info(`Found ${groups.length} groups:\n`);
      
      groups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.subject || 'Unnamed Group'}`);
        console.log(`   JID: ${group.id}`);
        console.log(`   Participants: ${group.participants?.length || 0}`);
        console.log('');
      });
      
      logger.info('\n📌 Copy the JID of your accountability group');
      logger.info('You will need to set it as WA_GROUP_JID in Railway\n');
    }
    
    // Ask if they want to send a test message
    const sendTest = await question('\nWould you like to send a test message to a group? (y/N): ');
    
    if (sendTest.toLowerCase() === 'y') {
      const groupNumber = await question('Enter the group number from the list above: ');
      const groupIndex = parseInt(groupNumber) - 1;
      
      if (groupIndex >= 0 && groupIndex < groups.length) {
        const selectedGroup = groups[groupIndex];
        logger.info(`\nSending test message to: ${selectedGroup.subject}`);
        
        await client.sendMessage({
          to: selectedGroup.id,
          text: '🤖 Accountability Bot Test Message\nIf you see this, WhatsApp is connected successfully!'
        });
        
        logger.info('✅ Test message sent successfully!');
        logger.info(`\nSet this in Railway: WA_GROUP_JID=${selectedGroup.id}`);
      } else {
        logger.error('Invalid group number');
      }
    }
    
    logger.info('\n🎉 WhatsApp authentication successful!');
    logger.info(`\nAuth files have been created in: ${authPath}/accountability-bot/`);
    logger.info('\nNext steps:');
    logger.info('1. Upload the auth files to Railway');
    logger.info('2. Set WA_GROUP_JID environment variable in Railway');
    logger.info('3. Redeploy the worker');
    
  } catch (error) {
    logger.error('Setup failed:', error);
  } finally {
    rl.close();
    await client.disconnect();
    logger.info('\n👋 Disconnected from WhatsApp');
    process.exit(0);
  }
}

// Run setup
setup().catch(console.error);
