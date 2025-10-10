import { config } from 'dotenv';
import { join } from 'path';
import { prisma } from './lib/db';

// Load environment variables from root
config({ path: join(__dirname, '../../../.env') });

async function testDatabaseAccess() {
  console.log('🔍 Testing database access from worker...\n');

  try {
    // Test 1: Read users
    const users = await prisma.user.findMany();
    console.log(`✅ Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.email})`);
    });

    // Test 2: Read pair with relations
    const pair = await prisma.pair.findFirst({
      include: {
        user1: true,
        user2: true,
        settings: true,
        notionConfig: true,
      },
    });
    
    if (pair) {
      console.log(`\n✅ Found pair: ${pair.id}`);
      console.log(`   - User 1: ${pair.user1.name}`);
      console.log(`   - User 2: ${pair.user2.name}`);
      console.log(`   - Active: ${pair.isActive}`);
      console.log(`   - Has settings: ${pair.settings ? 'Yes' : 'No'}`);
      console.log(`   - Has Notion config: ${pair.notionConfig ? 'Yes' : 'No'}`);
    }

    // Test 3: Read tasks
    const tasks = await prisma.taskMirror.findMany({
      include: {
        owner: true,
      },
    });
    console.log(`\n✅ Found ${tasks.length} tasks:`);
    tasks.forEach(task => {
      console.log(`   - "${task.title}" (${task.status}) - Owner: ${task.owner.name}`);
    });

    // Test 4: Write operation - create a task event
    const task = tasks[0];
    if (task) {
      const event = await prisma.taskEvent.create({
        data: {
          taskMirrorId: task.id,
          eventType: 'status_changed',
          previousStatus: task.status,
          newStatus: task.status,
          idempotencyKey: `test-${Date.now()}`,
        },
      });
      console.log(`\n✅ Created test event: ${event.id}`);
    }

    console.log('\n🎉 All database tests passed!');
  } catch (error) {
    console.error('❌ Database test error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseAccess();
