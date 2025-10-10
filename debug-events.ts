import { config } from 'dotenv';
import { join } from 'path';
import { prisma } from './packages/db/src/index';

config({ path: join(__dirname, '.env') });

async function debugEvents() {
  try {
    console.log('🔍 Debugging event ownership...\n');
    
    const pairId = process.env.PAIR_ID;
    console.log(`Using PAIR_ID: ${pairId}\n`);
    
    // Check the pair and users
    const pair = await prisma.pair.findUnique({
      where: { id: pairId! },
      include: {
        user1: true,
        user2: true,
      }
    });
    
    if (!pair) {
      throw new Error('Pair not found!');
    }
    
    console.log('👥 Pair Members:');
    console.log(`  User1: ${pair.user1.name} (ID: ${pair.user1.id})`);
    console.log(`  User2: ${pair.user2.name} (ID: ${pair.user2.id})\n`);
    
    // Check all recent task events
    const allEvents = await prisma.taskEvent.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        taskMirror: {
          include: {
            owner: true,
          },
        },
      },
    });
    
    console.log(`📋 All Recent Events (${allEvents.length}):`);
    for (const event of allEvents) {
      const owner = event.taskMirror.owner;
      const isUser1 = owner.id === pair.user1.id;
      const isUser2 = owner.id === pair.user2.id;
      const belongsToPair = isUser1 || isUser2;
      
      console.log(`  - ${event.eventType}: ${event.taskMirror.title}`);
      console.log(`    Owner: ${owner.name} (ID: ${owner.id})`);
      console.log(`    Belongs to pair: ${belongsToPair ? '✅' : '❌'}`);
      console.log(`    Processed: ${event.processedAt ? '✅' : '❌'}`);
      console.log('');
    }
    
    // Now check specifically for events that should belong to this pair
    const pairEvents = await prisma.taskEvent.findMany({
      where: {
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
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`📋 Events for this pair (${pairEvents.length}):`);
    for (const event of pairEvents) {
      console.log(`  - ${event.eventType}: ${event.taskMirror.title}`);
      console.log(`    Owner: ${event.taskMirror.owner.name}`);
      console.log(`    Processed: ${event.processedAt ? '✅' : '❌'}`);
    }
    
    // Check if there are any users with pairAsUser1 or pairAsUser2 relationships
    const usersWithPairs = await prisma.user.findMany({
      where: {
        OR: [
          { pairAsUser1: { isNot: null } },
          { pairAsUser2: { isNot: null } },
        ],
      },
      include: {
        pairAsUser1: true,
        pairAsUser2: true,
      },
    });
    
    console.log(`\n👥 Users with pair relationships (${usersWithPairs.length}):`);
    for (const user of usersWithPairs) {
      console.log(`  - ${user.name} (ID: ${user.id})`);
      if (user.pairAsUser1) console.log(`    Has pairAsUser1: ${user.pairAsUser1.id}`);
      if (user.pairAsUser2) console.log(`    Has pairAsUser2: ${user.pairAsUser2.id}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugEvents();
