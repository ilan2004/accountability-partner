import { config } from 'dotenv';
import { join } from 'path';
import { prisma } from './packages/db/src/index';

// Load environment variables
config({ path: join(__dirname, '.env') });

async function checkStatus() {
  try {
    console.log('🔍 Checking notification system status...\n');
    
    // Check recent task events
    const recentEvents = await prisma.taskEvent.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { taskMirror: { include: { owner: true } } }
    });
    
    console.log('📋 Recent Task Events:', recentEvents.length);
    for (const event of recentEvents) {
      console.log(`  - ${event.eventType}: ${event.taskMirror.title} (${event.previousStatus || 'new'} → ${event.newStatus})`);
      console.log(`    Owner: ${event.taskMirror.owner.name}`);
      console.log(`    Created: ${event.createdAt.toLocaleString()}`);
      console.log(`    Processed: ${event.processedAt ? 'Yes at ' + event.processedAt.toLocaleString() : 'No'}`);
      console.log('');
    }
    
    // Check notifications
    const notifications = await prisma.notification.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('📨 Recent Notifications:', notifications.length);
    for (const notif of notifications) {
      console.log(`  - Status: ${notif.status}, Channel: ${notif.channel}, Retries: ${notif.retryCount}`);
      console.log(`    Created: ${notif.createdAt.toLocaleString()}`);
      if (notif.sentAt) console.log(`    Sent: ${notif.sentAt.toLocaleString()}`);
      if (notif.lastError) console.log(`    Error: ${notif.lastError}`);
      console.log('');
    }
    
    // Check settings
    const settings = await prisma.settings.findFirst();
    console.log('⚙️ WhatsApp Settings:');
    console.log(`  Group JID: ${settings?.whatsappGroupJid || 'Not set'}`);
    console.log(`  Active: ${settings?.isActive ? 'Yes' : 'No'}`);
    
    // Check if worker process should be detecting changes
    console.log('\n🔄 Next Steps:');
    console.log('1. Go to your Notion database');
    console.log('2. Change a task status (e.g., to "Done")');
    console.log('3. Wait 1-2 minutes');
    console.log('4. Run this script again to see if events were detected');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
