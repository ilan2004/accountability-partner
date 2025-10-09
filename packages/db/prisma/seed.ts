import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.taskEvent.deleteMany();
  await prisma.taskMirror.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.notionConfig.deleteMany();
  await prisma.pair.deleteMany();
  await prisma.user.deleteMany();

  // Create two users
  const user1 = await prisma.user.create({
    data: {
      email: 'user1@example.com',
      name: 'User One',
      notionId: 'notion_user_1',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      name: 'User Two',
      notionId: 'notion_user_2',
    },
  });

  console.log('✅ Created users:', { user1: user1.name, user2: user2.name });

  // Create a pair
  const pair = await prisma.pair.create({
    data: {
      user1Id: user1.id,
      user2Id: user2.id,
      isActive: true,
    },
  });

  console.log('✅ Created pair:', pair.id);

  // Create Notion config for the pair
  const notionConfig = await prisma.notionConfig.create({
    data: {
      pairId: pair.id,
      databaseId: process.env.NOTION_DATABASE_ID || 'sample_database_id',
      integrationToken: process.env.NOTION_TOKEN || 'sample_token',
    },
  });

  console.log('✅ Created Notion config');

  // Create settings for the pair
  const settings = await prisma.settings.create({
    data: {
      pairId: pair.id,
      timezone: 'Asia/Kolkata',
      warningTime: '20:00',
      summaryTime: '23:55',
      whatsappGroupJid: process.env.WA_GROUP_JID || 'sample_group@g.us',
      notificationTemplates: JSON.stringify({
        taskCompleted: '✅ {owner} completed: {task}',
        dailyWarning: '⚠️ Tasks due today for {owner}: {tasks}',
        dailySummary: '📊 Daily Summary - {owner}: {done} done, {pending} pending',
      }),
    },
  });

  console.log('✅ Created settings');

  // Create some sample tasks
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const task1 = await prisma.taskMirror.create({
    data: {
      notionId: 'notion_task_1',
      title: 'Complete project documentation',
      status: 'In Progress',
      dueDate: tomorrow,
      ownerId: user1.id,
      lastEditedTime: now,
      notionUrl: 'https://notion.so/sample-task-1',
    },
  });

  const task2 = await prisma.taskMirror.create({
    data: {
      notionId: 'notion_task_2',
      title: 'Review code changes',
      status: 'Todo',
      dueDate: tomorrow,
      ownerId: user2.id,
      lastEditedTime: now,
      notionUrl: 'https://notion.so/sample-task-2',
    },
  });

  console.log('✅ Created sample tasks');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
