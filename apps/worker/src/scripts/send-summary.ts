import { config } from 'dotenv';
import { join } from 'path';
import pino from 'pino';
import { prisma } from '@accountability/db';
import { WhatsAppClient } from '../whatsapp/client';
import { DailySummaryScheduler } from '../services/daily-summary-scheduler';

// Load environment variables from root
config({ path: join(__dirname, '../../../../.env') });

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function sendSummary() {
  const groupJid = process.env.WA_GROUP_JID;

  if (!groupJid || groupJid === 'your_whatsapp_group_jid_here@g.us') {
    logger.error('❌ WA_GROUP_JID not set in .env file');
    process.exit(1);
  }

  try {
    // Get pair
    const pair = await prisma.pair.findFirst();
    if (!pair) {
      logger.error('❌ No pair found');
      process.exit(1);
    }

    // Connect to WhatsApp
    logger.info('📱 Connecting to WhatsApp...');
    const whatsappClient = new WhatsAppClient({
      sessionName: 'accountability-bot',
      authPath: 'auth',
      printQR: true,
    });

    await whatsappClient.connect();

    // Wait for connection
    let attempts = 0;
    while (!whatsappClient.isConnected() && attempts < 30) {
      await new Promise(res => setTimeout(res, 1000));
      attempts++;
    }

    if (!whatsappClient.isConnected()) {
      logger.error('❌ Failed to connect to WhatsApp');
      process.exit(1);
    }

    // Create and use summary scheduler
    const summaryScheduler = new DailySummaryScheduler({
      whatsappClient,
      pairId: pair.id,
    });

    // Show preview
    const preview = await summaryScheduler.getSummaryPreview();
    logger.info(`📊 Preview: ${preview.completedToday} completed today, ${preview.completionRate}% overall`);

    // Send summary
    logger.info('📤 Sending daily summary...');
    await summaryScheduler.sendDailySummary();
    logger.info('✅ Daily summary sent!');

    await whatsappClient.disconnect();

  } catch (error) {
    logger.error(error, '❌ Failed to send summary');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

sendSummary();
