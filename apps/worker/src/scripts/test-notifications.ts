import { config } from 'dotenv';
import { join } from 'path';
import pino from 'pino';
import { prisma } from '../lib/db';
import { WhatsAppClient } from '../whatsapp/client';
import { NotionClient } from '../notion/client';
import { NotionPollerService } from '../services/notion-poller';
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

async function testNotifications() {
  // Check required environment variables
  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  const groupJid = process.env.WA_GROUP_JID;

  if (!notionToken || notionToken === 'your_notion_integration_token_here') {
    logger.error('❌ NOTION_TOKEN not set in .env file');
    process.exit(1);
  }

  if (!databaseId || databaseId === 'your_notion_database_id_here') {
    logger.error('❌ NOTION_DATABASE_ID not set in .env file');
    process.exit(1);
  }

  if (!groupJid || groupJid === 'your_whatsapp_group_jid_here@g.us') {
    logger.error('❌ WA_GROUP_JID not set in .env file');
    logger.info('Run "pnpm wa:test" first to get your group JID');
    process.exit(1);
  }

  logger.info('🚀 Starting notification pipeline test...');

  try {
    // Get pair
    const pair = await prisma.pair.findFirst({
      include: {
        notionConfig: true,
        settings: true,
        user1: true,
        user2: true,
      },
    });

    if (!pair) {
      logger.error('❌ No pair found. Run pnpm db:seed first.');
      process.exit(1);
    }

    // Update settings with WhatsApp group
    if (!pair.settings?.whatsappGroupJid) {
      await prisma.settings.update({
        where: { id: pair.settings?.id },
        data: { whatsappGroupJid: groupJid },
      });
      logger.info('Updated WhatsApp group JID in settings');
    }

    // Initialize WhatsApp
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

    logger.info('✅ WhatsApp connected');

    // Initialize Notion client
    const notionClient = new NotionClient({
      integrationToken: notionToken,
      databaseId: databaseId,
    });

    // Create services
    const poller = new NotionPollerService({
      notionClient,
      pairId: pair.id,
      pollInterval: 10000, // 10 seconds
    });

    const notificationService = new NotificationService({
      whatsappClient,
      pairId: pair.id,
      processInterval: 2000, // Check every 2 seconds
    });

    // Clear previous test data
    logger.info('🧹 Clearing previous test notifications...');
    await prisma.notification.deleteMany({
      where: {
        taskEvent: {
          taskMirror: {
            owner: {
              OR: [
                { pairAsUser1: { id: pair.id } },
                { pairAsUser2: { id: pair.id } },
              ],
            },
          },
        },
      },
    });

    // Reset processedAt for recent events for testing
    await prisma.taskEvent.updateMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
      data: {
        processedAt: null,
      },
    });

    logger.info('📊 Current state:');
    const taskCount = await prisma.taskMirror.count();
    const eventCount = await prisma.taskEvent.count({ where: { processedAt: null } });
    const notificationCount = await prisma.notification.count();
    
    logger.info(`  - Tasks: ${taskCount}`);
    logger.info(`  - Unprocessed events: ${eventCount}`);
    logger.info(`  - Notifications: ${notificationCount}`);

    // Start services
    logger.info('\n🔄 Starting services...');
    await poller.start();
    await notificationService.start();

    logger.info('\n📝 Instructions:');
    logger.info('1. Go to your Notion database');
    logger.info('2. Change a task status to "Done"');
    logger.info('3. Within 10-15 seconds, you should receive a WhatsApp notification');
    logger.info('\n⏰ Running for 2 minutes...\n');

    // Monitor for 2 minutes
    const startTime = Date.now();
    const duration = 2 * 60 * 1000;
    let lastNotificationCount = 0;

    while (Date.now() - startTime < duration) {
      // Check for new notifications
      const notifications = await prisma.notification.findMany({
        where: {
          createdAt: {
            gte: new Date(startTime),
          },
        },
        include: {
          taskEvent: {
            include: {
              taskMirror: {
                include: {
                  owner: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (notifications.length > lastNotificationCount) {
        const newNotifications = notifications.slice(0, notifications.length - lastNotificationCount);
        
        for (const notif of newNotifications) {
          logger.info({
            status: notif.status,
            channel: notif.channel,
            task: notif.taskEvent.taskMirror.title,
            owner: notif.taskEvent.taskMirror.owner.name,
            eventType: notif.taskEvent.eventType,
            sentAt: notif.sentAt?.toLocaleTimeString(),
          }, '📬 Notification sent!');
        }
        
        lastNotificationCount = notifications.length;
      }

      // Show periodic status
      if ((Date.now() - startTime) % 20000 < 1000) {
        const pendingEvents = await prisma.taskEvent.count({
          where: { processedAt: null },
        });
        const sentNotifs = await prisma.notification.count({
          where: { 
            status: 'sent',
            createdAt: { gte: new Date(startTime) },
          },
        });
        
        logger.info({
          pendingEvents,
          sentNotifications: sentNotifs,
          uptime: Math.floor((Date.now() - startTime) / 1000) + 's',
        }, '📊 Status');
      }

      await new Promise(res => setTimeout(res, 1000));
    }

    // Stop services
    poller.stop();
    notificationService.stop();
    await whatsappClient.disconnect();

    // Final summary
    logger.info('\n📈 Test completed! Summary:');
    
    const finalNotifications = await prisma.notification.findMany({
      where: {
        createdAt: { gte: new Date(startTime) },
      },
      include: {
        taskEvent: {
          include: {
            taskMirror: true,
          },
        },
      },
    });

    const sentCount = finalNotifications.filter(n => n.status === 'sent').length;
    const failedCount = finalNotifications.filter(n => n.status === 'failed').length;
    const pendingCount = finalNotifications.filter(n => n.status === 'pending').length;

    logger.info(`  - Total notifications: ${finalNotifications.length}`);
    logger.info(`  - Sent: ${sentCount}`);
    logger.info(`  - Failed: ${failedCount}`);
    logger.info(`  - Pending: ${pendingCount}`);

    if (sentCount > 0) {
      logger.info('\n✅ Success! Notifications were sent to WhatsApp');
      logger.info('Check your WhatsApp group for the messages');
    } else if (finalNotifications.length === 0) {
      logger.info('\n⚠️  No notifications were generated');
      logger.info('Make sure you changed a task to "Done" in Notion');
    } else {
      logger.info('\n❌ Notifications were generated but failed to send');
      logger.info('Check your WhatsApp connection and group JID');
    }

  } catch (error) {
    logger.error(error, '❌ Test failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testNotifications().catch(error => {
  logger.error(error, 'Unhandled error');
  process.exit(1);
});
