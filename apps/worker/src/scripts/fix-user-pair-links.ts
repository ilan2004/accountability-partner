#!/usr/bin/env npx tsx

/**
 * Fix script to link task owners to the correct pair
 * This ensures notifications can find the correct events
 */

import { prisma } from '../lib/db';
import pino from 'pino';

const logger = pino({ name: 'fix-user-pair-links' });

async function main() {
  const pairId = process.env.PAIR_ID;
  
  if (!pairId) {
    logger.error('❌ Missing PAIR_ID environment variable');
    process.exit(1);
  }
  
  logger.info('🔧 Fixing User-Pair Links for Notifications');
  logger.info(`PAIR_ID: ${pairId}`);
  
  try {
    // 1. Get the pair to understand its structure
    const pair = await prisma.pair.findUnique({
      where: { id: pairId },
      include: {
        user1: true,
        user2: true,
      }
    });
    
    if (!pair) {
      logger.error('❌ Pair not found');
      process.exit(1);
    }
    
    logger.info(`Pair found: ${pair.user1.name} & ${pair.user2.name}`);
    
    // 2. Find all users who own tasks but are not properly linked to the pair
    const taskOwners = await prisma.user.findMany({
      where: {
        ownedTasks: {
          some: {}
        },
        AND: [
          {
            OR: [
              { pairAsUser1: null },
              { pairAsUser2: null }
            ]
          }
        ]
      },
      include: {
        ownedTasks: true,
      }
    });
    
    logger.info(`Found ${taskOwners.length} users who own tasks but are not linked to any pair`);
    
    // 3. Link these users to the pair (as user1 since this is single-user setup)
    for (const user of taskOwners) {
      logger.info(`Linking user ${user.name} (${user.id}) to pair as additional owner`);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          pairAsUser1: {
            connect: { id: pairId }
          }
        }
      });
      
      logger.info(`✅ Linked ${user.name} to pair`);
    }
    
    // 4. Verify the fix by checking unprocessed events
    const unprocessedEvents = await prisma.taskEvent.findMany({
      where: {
        processedAt: null,
        taskMirror: {
          owner: {
            OR: [
              { pairAsUser1: { id: pairId } },
              { pairAsUser2: { id: pairId } }
            ]
          }
        }
      },
      include: {
        taskMirror: {
          include: {
            owner: true
          }
        }
      }
    });
    
    logger.info(`Found ${unprocessedEvents.length} unprocessed events that should now be processable`);
    
    for (const event of unprocessedEvents) {
      logger.info(`- Event: ${event.eventType} for task "${event.taskMirror.title}" by ${event.taskMirror.owner.name}`);
    }
    
    logger.info('🎉 Fix completed successfully!');
    logger.info('Notifications should start working within 5 seconds.');
    
  } catch (error) {
    logger.error({ error }, '❌ Failed to fix user-pair links');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
