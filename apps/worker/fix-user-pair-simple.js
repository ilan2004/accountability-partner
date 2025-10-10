#!/usr/bin/env node

/**
 * Simple fix script to link task owners to the correct pair
 * This ensures notifications can find the correct events
 */

console.log('🔧 Fixing User-Pair Links for Notifications');

// Import Prisma client
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pairId = process.env.PAIR_ID;
  
  if (!pairId) {
    console.error('❌ Missing PAIR_ID environment variable');
    process.exit(1);
  }
  
  console.log(`PAIR_ID: ${pairId}`);
  
  try {
    console.log('\n1. Getting pair information...');
    
    // Get the pair
    const pair = await prisma.pair.findUnique({
      where: { id: pairId },
      include: {
        user1: true,
        user2: true,
      }
    });
    
    if (!pair) {
      console.error('❌ Pair not found');
      process.exit(1);
    }
    
    console.log(`✅ Pair found: ${pair.user1.name} & ${pair.user2.name}`);
    
    console.log('\n2. Finding users who own tasks but are not linked to the pair...');
    
    // Find all task owners who are not properly linked
    const taskOwners = await prisma.user.findMany({
      where: {
        ownedTasks: {
          some: {}
        },
        pairAsUser1Id: null,
        pairAsUser2Id: null
      },
      include: {
        ownedTasks: {
          select: {
            title: true
          }
        }
      }
    });
    
    console.log(`Found ${taskOwners.length} users who need to be linked`);
    
    console.log('\n3. Linking users to the pair...');
    
    // Link each user to the pair
    for (const user of taskOwners) {
      console.log(`- Linking ${user.name} (owns ${user.ownedTasks.length} tasks)`);
      
      // Update the user to link to this pair as user1
      await prisma.user.update({
        where: { id: user.id },
        data: {
          pairAsUser1Id: pairId
        }
      });
      
      console.log(`  ✅ Linked ${user.name} to pair`);
    }
    
    console.log('\n4. Checking unprocessed events...');
    
    // Count unprocessed events that should now be processable
    const unprocessedEventsCount = await prisma.taskEvent.count({
      where: {
        processedAt: null,
        taskMirror: {
          owner: {
            OR: [
              { pairAsUser1Id: pairId },
              { pairAsUser2Id: pairId }
            ]
          }
        }
      }
    });
    
    console.log(`Found ${unprocessedEventsCount} unprocessed events that should now be processable`);
    
    console.log('\n🎉 Fix completed successfully!');
    console.log('Notifications should start working within 5 seconds.');
    
  } catch (error) {
    console.error('❌ Failed to fix user-pair links:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
