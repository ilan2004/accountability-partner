import { config } from 'dotenv';
import { join } from 'path';
import { prisma } from './src/index';

// Load environment variables from project root
config({ path: join(__dirname, '../../.env') });

async function updateCredentials() {
  try {
    const pairId = process.env.PAIR_ID;
    const notionToken = process.env.NOTION_TOKEN;
    const notionDatabaseId = process.env.NOTION_DATABASE_ID;
    const waGroupJid = process.env.WA_GROUP_JID;

    console.log('🔄 Updating credentials...');
    console.log(`Pair ID: ${pairId}`);
    console.log(`Notion DB: ${notionDatabaseId}`);
    console.log(`WA Group: ${waGroupJid}`);

    if (!pairId || !notionToken || !notionDatabaseId || !waGroupJid) {
      throw new Error('Missing required environment variables');
    }

    // Update NotionConfig
    await prisma.notionConfig.update({
      where: { pairId },
      data: {
        integrationToken: notionToken,
        databaseId: notionDatabaseId,
      },
    });

    // Update Settings with WhatsApp Group JID
    await prisma.settings.update({
      where: { pairId },
      data: {
        whatsappGroupJid: waGroupJid,
      },
    });

    console.log('✅ Credentials updated successfully!');
    console.log('');
    console.log('Now try running the worker:');
    console.log('cd ../../ && pnpm --filter @accountability/worker dev');
  } catch (error) {
    console.error('❌ Error updating credentials:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCredentials();
