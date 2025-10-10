import { config } from 'dotenv'
import pino from 'pino'
import { v4 as uuidv4 } from 'uuid'
import { supabase, SupabaseWorkerHelpers, NotionConfigInsert, PairInsert, UserInsert } from './lib/supabase'
import { NotionClient } from './notion/client'
import { WhatsAppClient } from './whatsapp/client'
import { NotionPollerService } from './services/notion-poller-supabase'
import { NotificationService } from './services/notification-service-supabase'
// Temporarily disabled for Supabase migration
// import { SchedulerService } from './services/scheduler-service'
// import { WarnScheduler } from './services/warning-scheduler'
// Load environment variables
config()

const logger = pino({ level: 'info', name: 'worker-main' })

async function main() {
  logger.info('🚀 Worker starting up...')

  const pairId = process.env.PAIR_ID
  if (!pairId) {
    logger.error('PAIR_ID is required in environment to start worker')
    process.exit(1)
  }

  // Fetch or create Notion configuration for the pair
  let notionConfig = await SupabaseWorkerHelpers.getNotionConfigByPairId(pairId)
  if (!notionConfig) {
    logger.info({ pairId }, 'No NotionConfig found for pair, attempting to create setup...')
    
    const notionToken = process.env.NOTION_TOKEN
    const notionDatabaseId = process.env.NOTION_DATABASE_ID
    
    if (!notionToken || !notionDatabaseId) {
      logger.error({ pairId }, 'NOTION_TOKEN and NOTION_DATABASE_ID environment variables are required to create NotionConfig')
      process.exit(1)
    }
    
    try {
      // First ensure the Pair exists (create dummy users and pair for worker-only setup)
      const { data: pair, error: pairError } = await supabase
        .from('Pair')
        .select('*')
        .eq('id', pairId)
        .single()
      
      if (pairError && pairError.code !== 'PGRST116') {
        throw pairError
      }
      
      if (!pair) {
        logger.info({ pairId }, 'Creating dummy users and pair for worker setup...')
        
        // Check if dummy users already exist
        const user1Email = `worker-user1-${pairId}@example.com`
        const user2Email = `worker-user2-${pairId}@example.com`
        
        let user1, user2
        
        // Check for existing user1
        const { data: existingUser1 } = await supabase
          .from('User')
          .select()
          .eq('email', user1Email)
          .single()
        
        if (existingUser1) {
          user1 = existingUser1
        } else {
          // Create user1
          const now = new Date().toISOString()
          const { data: newUser1, error: user1Error } = await supabase
            .from('User')
            .insert({
              id: uuidv4(),
              email: user1Email,
              name: 'Worker User 1',
              createdAt: now,
              updatedAt: now
            })
            .select()
            .single()
          
          if (user1Error) throw user1Error
          user1 = newUser1
        }
        
        // Check for existing user2
        const { data: existingUser2 } = await supabase
          .from('User')
          .select()
          .eq('email', user2Email)
          .single()
        
        if (existingUser2) {
          user2 = existingUser2
        } else {
          // Create user2
          const now = new Date().toISOString()
          const { data: newUser2, error: user2Error } = await supabase
            .from('User')
            .insert({
              id: uuidv4(),
              email: user2Email,
              name: 'Worker User 2',
              createdAt: now,
              updatedAt: now
            })
            .select()
            .single()
          
          if (user2Error) throw user2Error
          user2 = newUser2
        }
        
        // Create the pair with the specific ID
        const now = new Date().toISOString()
        const { data: newPair, error: newPairError } = await supabase
          .from('Pair')
          .insert({
            id: pairId,
            user1Id: user1.id,
            user2Id: user2.id,
            isActive: true,
            createdAt: now,
            updatedAt: now
          })
          .select()
          .single()
        
        if (newPairError) throw newPairError
        
        logger.info({ pairId, user1Id: user1.id, user2Id: user2.id }, 'Created dummy pair for worker setup')
      }
      
      // Now create the NotionConfig
      const { data: newNotionConfig, error: configError } = await supabase
        .from('NotionConfig')
        .insert({
          pairId,
          databaseId: notionDatabaseId,
          integrationToken: notionToken,
        })
        .select()
        .single()
      
      if (configError) throw configError
      
      notionConfig = newNotionConfig
      logger.info({ pairId, configId: notionConfig.id }, 'Created NotionConfig successfully')
    } catch (error) {
      logger.error({ pairId, error }, 'Failed to create setup')
      process.exit(1)
    }
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

  // TODO: Scheduler service temporarily disabled during Supabase migration
  // const scheduler = new SchedulerService({
  //   whatsappClient: waClient,
  //   pairId,
  // })

  // Start services
  await poller.start()
  await notifier.start()
  // await scheduler.start() // Temporarily disabled

  logger.info('✅ Worker running successfully!')

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down worker...')
    try {
      notifier.stop()
      // scheduler.stop() // Temporarily disabled
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
