import { config } from 'dotenv'
import { WhatsAppClient } from '../src/whatsapp/client'
import pino from 'pino'
import * as readline from 'readline'

// Load environment variables
config()

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function authenticateLocally() {
  logger.info('🚀 Local WhatsApp Authentication Setup')
  logger.info('This will create auth files locally that you can upload to Railway\n')
  
  // Create WhatsApp client with local auth path
  const waClient = new WhatsAppClient({
    sessionName: process.env.WA_SESSION_NAME || 'accountability-bot',
    authPath: './local-auth',  // Local directory
    printQR: true,  // Enable QR in local terminal
  })
  
  try {
    logger.info('📱 Connecting to WhatsApp...')
    logger.info('You may need to scan a QR code with your phone\n')
    
    await waClient.connect()
    
    logger.info('\n✅ Successfully connected to WhatsApp!')
    logger.info('Auth files have been created in ./local-auth/')
    
    // Wait a moment for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // List groups to help user find the right JID
    logger.info('\n📋 Fetching your WhatsApp groups...\n')
    
    try {
      const groups = await waClient.getGroups()
      
      if (groups.length === 0) {
        logger.warn('No groups found. Make sure you have created a group with your accountability partner.')
      } else {
        logger.info(`Found ${groups.length} groups:\n`)
        
        groups.forEach((group, index) => {
          console.log(`${index + 1}. ${group.subject || 'Unnamed Group'}`)
          console.log(`   JID: ${group.id}`)
          console.log(`   Participants: ${group.participants?.length || 0}`)
          console.log('')
        })
        
        logger.info('📌 Copy the JID of your accountability group.')
        logger.info('You can set it as WA_GROUP_JID environment variable in Railway.\n')
      }
    } catch (error) {
      logger.warn('Could not fetch groups:', error)
    }
    
    // Ask if they want to send a test message
    const sendTest = await question('Would you like to send a test message to a group? (y/N): ')
    
    if (sendTest.toLowerCase() === 'y') {
      const groupJid = await question('Enter the group JID from above: ')
      
      try {
        await waClient.sendMessage({
          to: groupJid,
          text: '🤖 Accountability Bot Test Message\nIf you see this, WhatsApp is connected successfully!'
        })
        
        logger.info('✅ Test message sent successfully!')
        logger.info(`\nSet this in Railway environment:\nWA_GROUP_JID=${groupJid}`)
      } catch (error) {
        logger.error('Failed to send test message:', error)
      }
    }
    
    logger.info('\n📦 Next Steps:')
    logger.info('1. The auth files are in ./apps/worker/local-auth/')
    logger.info('2. Upload these files to your Railway volume at /data/auth/')
    logger.info('3. Restart your Railway worker service')
    logger.info('4. The worker should connect without needing QR code again')
    
  } catch (error) {
    logger.error('Authentication failed:', error)
  } finally {
    rl.close()
    await waClient.disconnect()
    process.exit(0)
  }
}

authenticateLocally().catch(console.error)
