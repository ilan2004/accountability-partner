import { config } from 'dotenv';
import { join } from 'path';
import pino from 'pino';
import { WhatsAppClient } from '../whatsapp/client';

// Load env from root
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

async function main() {
  logger.info('🚀 Starting WhatsApp test...');

  const client = new WhatsAppClient({
    sessionName: 'accountability-bot',
    authPath: 'auth',
    printQR: true,
  });

  await client.connect();

  // Wait until connected (or user scanned QR)
  let attempts = 0;
  while (!client.isConnected() && attempts < 60) { // up to ~60s
    await new Promise(res => setTimeout(res, 1000));
    attempts++;
  }

  if (!client.isConnected()) {
    logger.error('❌ Failed to connect to WhatsApp. Make sure you scanned the QR code.');
    process.exit(1);
  }

  logger.info('✅ Connected to WhatsApp!');

  // List groups
  const groups = await client.getGroups();
  if (groups.length === 0) {
    logger.warn('No groups found. Create a group with your accountability partner.');
  } else {
    logger.info(`📋 Found ${groups.length} groups:`);
    groups.forEach((g, i) => {
      logger.info(`${i + 1}. ${g.subject} (${g.id})`);
    });
  }

  // Optionally send a test message if WA_GROUP_JID is set
  const groupJid = process.env.WA_GROUP_JID;
  if (groupJid && groupJid !== 'your_whatsapp_group_jid_here@g.us') {
    await client.sendMessage({
      to: groupJid,
      text: `[Bot] Hello from Accountability Worker! Time: ${new Date().toLocaleString()}`,
    });
    logger.info(`✉️ Sent test message to ${groupJid}`);
  } else {
    logger.info('ℹ️ Set WA_GROUP_JID in .env to send a test message.');
  }

  // Keep alive for a bit to ensure message is sent
  await new Promise(res => setTimeout(res, 3000));

  await client.disconnect();
  logger.info('👋 Done.');
}

main().catch((err) => {
  logger.error(err, 'Fatal error in WhatsApp test');
  process.exit(1);
});
