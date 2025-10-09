import { config } from 'dotenv'
import { join } from 'path'
import pino from 'pino'

// Load environment variables from root
config({ path: join(__dirname, '../../../.env') })

const logger = pino({ level: 'info' })

async function main() {
  logger.info('🚀 Worker starting up...')
  
  // Environment check
  const requiredEnvVars = [
    'NOTION_TOKEN',
    'NOTION_DATABASE_ID',
    'WA_GROUP_JID',
    'TZ',
    'WARNING_TIME',
    'SUMMARY_TIME',
  ]
  
  const missingVars = requiredEnvVars.filter(v => !process.env[v])
  if (missingVars.length > 0) {
    logger.error(`Missing environment variables: ${missingVars.join(', ')}`)
    logger.info('Please copy .env.example to .env and fill in the values')
    process.exit(1)
  }
  
  logger.info('✅ Environment variables loaded successfully')
  logger.info({
    timezone: process.env.TZ,
    warningTime: process.env.WARNING_TIME,
    summaryTime: process.env.SUMMARY_TIME,
  }, 'Configuration')
  
  // TODO: Initialize Notion client
  // TODO: Initialize Baileys WhatsApp client
  // TODO: Start polling and schedulers
  
  logger.info('✅ Worker running successfully!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
