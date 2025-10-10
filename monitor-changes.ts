import { config } from 'dotenv';
import { join } from 'path';
import { prisma } from './packages/db/src/index';

config({ path: join(__dirname, '.env') });

let lastEventCount = 0;
let lastNotificationCount = 0;

async function monitorChanges() {
  try {
    // Get current counts
    const currentEventCount = await prisma.taskEvent.count();
    const currentNotificationCount = await prisma.notification.count();
    
    const now = new Date().toLocaleTimeString();
    
    if (lastEventCount === 0) {
      // First run
      console.log(`🔍 [${now}] Monitoring started - Current state:`);
      console.log(`   📋 Task Events: ${currentEventCount}`);
      console.log(`   📨 Notifications: ${currentNotificationCount}`);
      console.log(`   ⏰ Checking every 10 seconds for changes...`);
      console.log('');
      console.log('🎯 READY TO TEST:');
      console.log('   1. Go to your Notion database');
      console.log('   2. Change a task status to "Done" or create a new task');
      console.log('   3. Watch this screen for real-time updates!');
      console.log('');
      console.log('=' .repeat(60));
    } else {
      // Check for changes
      const newEvents = currentEventCount - lastEventCount;
      const newNotifications = currentNotificationCount - lastNotificationCount;
      
      if (newEvents > 0 || newNotifications > 0) {
        console.log(`🚨 [${now}] CHANGES DETECTED!`);
        
        if (newEvents > 0) {
          console.log(`   📋 New Task Events: +${newEvents} (Total: ${currentEventCount})`);
          
          // Show the latest events
          const latestEvents = await prisma.taskEvent.findMany({
            take: newEvents,
            orderBy: { createdAt: 'desc' },
            include: {
              taskMirror: {
                include: {
                  owner: true,
                },
              },
            },
          });
          
          for (const event of latestEvents.reverse()) {
            console.log(`     → ${event.eventType}: "${event.taskMirror.title}"`);
            console.log(`       ${event.previousStatus || 'new'} → ${event.newStatus}`);
            console.log(`       Owner: ${event.taskMirror.owner.name}`);
          }
        }
        
        if (newNotifications > 0) {
          console.log(`   📨 New Notifications: +${newNotifications} (Total: ${currentNotificationCount})`);
          
          // Show the latest notifications
          const latestNotifications = await prisma.notification.findMany({
            take: newNotifications,
            orderBy: { createdAt: 'desc' },
          });
          
          for (const notif of latestNotifications.reverse()) {
            const status = notif.status === 'sent' ? '✅ SENT' : `🔄 ${notif.status.toUpperCase()}`;
            console.log(`     → ${status} via ${notif.channel}`);
            if (notif.sentAt) {
              console.log(`       Sent at: ${notif.sentAt.toLocaleTimeString()}`);
            }
          }
        }
        
        console.log('');
      } else {
        console.log(`⏳ [${now}] No changes detected - system running normally`);
      }
    }
    
    lastEventCount = currentEventCount;
    lastNotificationCount = currentNotificationCount;
    
  } catch (error) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] Error:`, error);
  }
}

// Run monitoring
console.log('🚀 Starting real-time monitoring...\n');
monitorChanges();

const interval = setInterval(async () => {
  await monitorChanges();
}, 10000); // Check every 10 seconds

// Cleanup on exit
process.on('SIGINT', async () => {
  clearInterval(interval);
  console.log('\n\n🛑 Monitoring stopped');
  await prisma.$disconnect();
  process.exit(0);
});
