import { config } from 'dotenv';
import { join } from 'path';
import { prisma } from './packages/db/src/index';

config({ path: join(__dirname, '.env') });

async function fixUserPair() {
  try {
    console.log('🔧 Linking Notion user to the accountability pair...\n');
    
    const pairId = process.env.PAIR_ID;
    
    // Find Ilan Usman (the user from Notion)
    const ilanUser = await prisma.user.findFirst({
      where: { name: 'Ilan Usman' }
    });
    
    if (!ilanUser) {
      throw new Error('Ilan Usman user not found');
    }
    
    console.log(`Found Notion user: ${ilanUser.name} (ID: ${ilanUser.id})`);
    
    // Get the current pair
    const pair = await prisma.pair.findUnique({
      where: { id: pairId! },
      include: {
        user1: true,
        user2: true,
      }
    });
    
    if (!pair) {
      throw new Error('Pair not found');
    }
    
    console.log(`Current pair: ${pair.user1.name} & ${pair.user2.name}`);
    
    // Replace User One with Ilan Usman
    console.log(`\n🔄 Updating pair to replace "${pair.user1.name}" with "${ilanUser.name}"...`);
    
    await prisma.pair.update({
      where: { id: pairId! },
      data: {
        user1Id: ilanUser.id,
      },
    });
    
    console.log('✅ Pair updated successfully!');
    
    // Now check events that should be processed
    const eventsToProcess = await prisma.taskEvent.findMany({
      where: {
        processedAt: null,
        taskMirror: {
          ownerId: ilanUser.id,
        },
      },
      include: {
        taskMirror: true,
      },
    });
    
    console.log(`\n📋 Found ${eventsToProcess.length} events that can now be processed:`);
    for (const event of eventsToProcess) {
      console.log(`  - ${event.eventType}: ${event.taskMirror.title}`);
    }
    
    console.log(`\n🎉 The notification system should now process these events!`);
    console.log(`   Try changing a task in Notion and wait 1-2 minutes for WhatsApp messages.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserPair();
