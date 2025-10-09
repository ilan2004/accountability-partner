import { config } from 'dotenv';
import { join } from 'path';
import pino from 'pino';
import { prisma } from '@accountability/db';
import { WhatsAppClient } from '../whatsapp/client';
import { NotificationService } from '../services/notification-service';

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

async function notifyOnce() {
  const groupJid = process.env.WA_GROUP_JID;

  if (!groupJid || groupJid === 'your_whatsapp_group_jid_here@g.us') {
    logger.error('❌ WA_GROUP_JID not set in .env file');
    process.exit(1);
  }

  try {
    // Get pair
    const pair = await prisma.pair.findFirst({
      include: { settings: true },
    });

    if (!pair) {
      logger.error('❌ No pair found. Run pnpm db:seed first.');
      process.exit(1);
    }

    // Update WhatsApp group if needed
    if (!pair.settings?.whatsappGroupJid || pair.settings.whatsappGroupJid !== groupJid) {
      await prisma.settings.update({
        where: { id: pair.settings?.id },
        data: { whatsappGroupJid: groupJid },
      });
      logger.info('Updated WhatsApp group JID');
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

    logger.info('✅ Connected to WhatsApp');

    // Create notification service
    const notificationService = new NotificationService({
      whatsappClient,
      pairId: pair.id,
    });

    // Show pending events
    const pendingEvents = await prisma.taskEvent.count({
      where: { processedAt: null },
    });
    logger.info(`📋 Found ${pendingEvents} unprocessed events`);

    if (pendingEvents === 0) {
      logger.info('ℹ️  No events to process');
      await whatsappClient.disconnect();
      return;
    }

    // Process one batch
    logger.info('🔄 Processing notifications...');
    const before = await prisma.notification.count();
    
    await notificationService.processBatch();
    
    const after = await prisma.notification.count();
    const sent = await prisma.notification.count({
      where: {
        status: 'sent',
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    logger.info(`📊 Results:`);
    logger.info(`  - Notifications created: ${after - before}`);
    logger.info(`  - Notifications sent: ${sent}`);

    // Show sent notifications
    if (sent > 0) {
      const recent = await prisma.notification.findMany({
        where: {
          status: 'sent',
          createdAt: { gte: new Date(Date.now() - 60000) },
        },
        include: {
          taskEvent: {
            include: {
              taskMirror: {
                include: { owner: true },
              },
            },
          },
        },
      });

      logger.info('\n📬 Sent notifications:');
      for (const notif of recent) {
        logger.info(`  - ${notif.taskEvent.taskMirror.owner.name}: ${notif.taskEvent.taskMirror.title} (${notif.taskEvent.eventType})`);
      }

      logger.info('\n✅ Notifications sent to WhatsApp!');
    }

    await whatsappClient.disconnect();

  } catch (error) {
    logger.error(error, '❌ Failed to send notifications');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
notifyOnce().catch(error => {
  logger.error(error, 'Unhandled error');
  process.exit(1);
});
