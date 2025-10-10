import { config } from 'dotenv';
import { join } from 'path';
import pino from 'pino';
import { prisma } from '../lib/db';
import { WhatsAppClient } from '../whatsapp/client';
import { WarningScheduler } from '../services/warning-scheduler';

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

async function sendWarning() {
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

    // Create and use warning scheduler
    const warningScheduler = new WarningScheduler({
      whatsappClient,
      pairId: pair.id,
    });

    // Show preview
    const preview = await warningScheduler.getWarningPreview();
    logger.info(`📊 Preview: ${preview.tasksDueToday} tasks due today`);

    // Send warning
    logger.info('📤 Sending daily warning...');
    await warningScheduler.sendWarning();
    logger.info('✅ Daily warning sent!');

    await whatsappClient.disconnect();

  } catch (error) {
    logger.error(error, '❌ Failed to send warning');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

sendWarning();
