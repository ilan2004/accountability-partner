import { config } from 'dotenv'
import pino from 'pino'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { prisma } from './lib/db'
import { NotionClient } from './notion/client'
import { WhatsAppClient } from './whatsapp/client'
import { NotionPollerService } from './services/notion-poller'
import { NotificationService } from './services/notification-service'
import { SchedulerService } from './services/scheduler-service'

// Load environment variables
config()

const logger = pino({ level: 'info', name: 'worker-main' })
const execFileAsync = promisify(execFile)

async function ensurePrismaSchema() {
  try {
    logger.info('Ensuring database schema with Prisma (db push)...')
    // Run Prisma db push to create tables if they do not exist
    const { stdout, stderr } = await execFileAsync('npx', ['prisma', 'db', 'push'], {
      env: process.env,
    })
    if (stdout) logger.info(stdout.trim())
    if (stderr) logger.warn(stderr.trim())
    logger.info('Prisma schema ensured')
  } catch (e) {
    logger.error({ e }, 'Prisma db push failed - continuing, app may error if schema is missing')
  }
}

async function main() {
  logger.info('🚀 Worker starting up...')

  const pairId = process.env.PAIR_ID
  if (!pairId) {
    logger.error('PAIR_ID is required in environment to start worker')
    process.exit(1)
  }

  // Ensure database schema exists before any queries
  await ensurePrismaSchema()

  // Fetch Notion configuration for the pair
  const notionConfig = await prisma.notionConfig.findUnique({ where: { pairId } })
  if (!notionConfig) {
    logger.error({ pairId }, 'No NotionConfig found for pair')
    process.exit(1)
  }

  // Initialize Notion client (with conservative rate limit handling)
  const notionClient = new NotionClient({
    integrationToken: notionConfig.integrationToken,
    databaseId: notionConfig.databaseId,
    rateLimitRetries: Number(process.env.NOTION_RATE_LIMIT_RETRIES || 5),
    rateLimitDelay: Number(process.env.NOTION_RATE_LIMIT_DELAY_MS || 1000),
  })

  // Initialize WhatsApp client
  const waClient = new WhatsAppClient({
    sessionName: process.env.WA_SESSION_NAME || 'accountability-bot',
    authPath: process.env.WA_AUTH_PATH || './auth',
    printQR: process.env.WA_PRINT_QR !== 'false',
  })
  await waClient.connect()

  // Initialize services
  const poller = new NotionPollerService({
    notionClient,
    pairId,
    pollInterval: Number(process.env.WORKER_POLL_INTERVAL_MS || 60000),
    debounceWindowMs: Number(process.env.NOTION_DEBOUNCE_MS || 30000),
  })

  const notifier = new NotificationService({
    whatsappClient: waClient,
    pairId,
    processInterval: Number(process.env.NOTIFY_PROCESS_INTERVAL_MS || 5000),
    maxRetries: Number(process.env.NOTIFY_MAX_RETRIES || 3),
    retryDelay: Number(process.env.NOTIFY_RETRY_BASE_DELAY_MS || 1000),
  })

  const scheduler = new SchedulerService({
    whatsappClient: waClient,
    pairId,
  })

  // Start services
  await poller.start()
  await notifier.start()
  await scheduler.start()

  logger.info('✅ Worker running successfully!')

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down worker...')
    try {
      notifier.stop()
      scheduler.stop()
      await waClient.disconnect()
    } catch (e) {
      logger.error({ e }, 'Error during shutdown')
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
