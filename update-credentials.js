const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

// Load environment variables
config({ path: '.env' });

const prisma = new PrismaClient();

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
  } catch (error) {
    console.error('❌ Error updating credentials:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCredentials();
