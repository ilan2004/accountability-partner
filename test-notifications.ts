import { config } from 'dotenv';
import { join } from 'path';
import { prisma } from './packages/db/src/index';

// Load environment variables
config({ path: join(__dirname, '.env') });

async function testNotifications() {
  try {
    console.log('🔍 Testing notification processing...\n');
    
    const pairId = process.env.PAIR_ID;
    if (!pairId) {
      throw new Error('PAIR_ID not found in environment');
    }
    
    // Find unprocessed events
    const unprocessedEvents = await prisma.taskEvent.findMany({
      where: {
        processedAt: null,
        taskMirror: {
          owner: {
            OR: [
              { pairAsUser1: { id: pairId } },
              { pairAsUser2: { id: pairId } },
            ],
          },
        },
      },
      include: {
        taskMirror: {
          include: {
            owner: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
    
    console.log(`📋 Found ${unprocessedEvents.length} unprocessed events`);
    
    for (const event of unprocessedEvents) {
      console.log(`\n📝 Event: ${event.eventType}`);
      console.log(`   Task: ${event.taskMirror.title}`);
      console.log(`   Owner: ${event.taskMirror.owner.name}`);
      console.log(`   Status Change: ${event.previousStatus || 'new'} → ${event.newStatus}`);
      console.log(`   Created: ${event.createdAt}`);
      
      // Check if notification already exists
      const existingNotification = await prisma.notification.findFirst({
        where: { taskEventId: event.id }
      });
      
      if (existingNotification) {
        console.log(`   ✓ Notification exists: ${existingNotification.status}`);
      } else {
        console.log(`   ❌ No notification found - creating one...`);
        
        // Create notification manually for testing
        const notification = await prisma.notification.create({
          data: {
            taskEventId: event.id,
            channel: 'whatsapp',
            status: 'pending',
          },
        });
        
        console.log(`   ✓ Created notification: ${notification.id}`);
      }
    }
    
    // Check WhatsApp settings
    const settings = await prisma.settings.findUnique({
      where: { pairId }
    });
    
    console.log(`\n⚙️ Settings Check:`);
    console.log(`   WhatsApp Group: ${settings?.whatsappGroupJid || 'NOT SET'}`);
    console.log(`   Active: ${settings?.isActive}`);
    
    if (!settings?.whatsappGroupJid) {
      console.log(`\n❌ ISSUE FOUND: WhatsApp Group JID is not set!`);
      console.log(`   This will prevent notifications from being sent.`);
    }
    
    console.log(`\n🔍 Next: The worker service should pick up these notifications`);
    console.log(`   and send them to WhatsApp within the next few minutes.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNotifications();
