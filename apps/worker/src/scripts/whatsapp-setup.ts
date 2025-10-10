#!/usr/bin/env tsx

/**
 * WhatsApp Setup Script
 * Use this to:
 * 1. Connect WhatsApp for the first time (QR code)
 * 2. List all your groups to find the correct JID
 */

import { config } from 'dotenv';
import { WhatsAppBot } from '../whatsapp';
import pino from 'pino';
import * as readline from 'readline';

// Load environment variables
config();

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
  logger.info('🚀 WhatsApp Setup Starting...');
  logger.info('This will help you connect WhatsApp and find your group JID\n');

  const bot = new WhatsAppBot();
  
  try {
    // Connect to WhatsApp
    logger.info('📱 Connecting to WhatsApp...');
    logger.info('You may need to scan a QR code with your phone\n');
    
    await bot.connect();
    
    logger.info('\n✅ Successfully connected to WhatsApp!');
    
    // Wait a moment for connection to stabilize
    logger.info('Waiting for connection to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // List all groups
    logger.info('\n📋 Fetching your WhatsApp groups...\n');
    
    const groups = await bot.getGroups();
    
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
      
      logger.info('\n📌 Copy the JID of your accountability group and add it to your .env file as:');
      logger.info('WA_GROUP_JID=<your-group-jid>\n');
    }
    
    // Ask if they want to send a test message
    const sendTest = await question('\nWould you like to send a test message to a group? (y/N): ');
    
    if (sendTest.toLowerCase() === 'y') {
      const groupNumber = await question('Enter the group number from the list above: ');
      const groupIndex = parseInt(groupNumber) - 1;
      
      if (groupIndex >= 0 && groupIndex < groups.length) {
        const selectedGroup = groups[groupIndex];
        logger.info(`\nSending test message to: ${selectedGroup.subject}`);
        
        await bot.sendMessage(
          selectedGroup.id,
          '🤖 Accountability Bot Test Message\nIf you see this, WhatsApp is connected successfully!'
        );
        
        logger.info('✅ Test message sent successfully!');
        logger.info(`\nAdd this to your .env file:\nWA_GROUP_JID=${selectedGroup.id}`);
      } else {
        logger.error('Invalid group number');
      }
    }
    
  } catch (error) {
    logger.error('Setup failed:');
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    } else {
      logger.error('Unknown error:', error);
    }
  } finally {
    rl.close();
    await bot.disconnect();
    process.exit(0);
  }
}

// Run setup
setup().catch(console.error);
