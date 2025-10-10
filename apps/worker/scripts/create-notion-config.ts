import { config } from 'dotenv'
import { prisma } from '../src/lib/db'

// Load environment variables
config()

async function createNotionConfig() {
  const pairId = process.env.PAIR_ID
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID

  if (!pairId) {
    console.error('PAIR_ID environment variable is required')
    process.exit(1)
  }

  if (!notionToken) {
    console.error('NOTION_TOKEN environment variable is required')
    process.exit(1)
  }

  if (!notionDatabaseId) {
    console.error('NOTION_DATABASE_ID environment variable is required')
    process.exit(1)
  }

  try {
    // Check if config already exists
    const existing = await prisma.notionConfig.findUnique({
      where: { pairId }
    })

    if (existing) {
      console.log(`NotionConfig already exists for pair ${pairId}`)
      console.log(`Database ID: ${existing.databaseId}`)
      console.log(`Created: ${existing.createdAt}`)
      return
    }

    // Create new config
    const config = await prisma.notionConfig.create({
      data: {
        pairId,
        databaseId: notionDatabaseId,
        integrationToken: notionToken,
      }
    })

    console.log(`✅ Created NotionConfig for pair ${pairId}`)
    console.log(`ID: ${config.id}`)
    console.log(`Database ID: ${config.databaseId}`)
    console.log(`Created: ${config.createdAt}`)

  } catch (error) {
    console.error('Error creating NotionConfig:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createNotionConfig()
