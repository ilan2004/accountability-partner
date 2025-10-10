import { execSync } from 'child_process'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import pino from 'pino'

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
})

async function uploadAuthFiles() {
  const localAuthPath = join(process.cwd(), 'local-auth')
  
  if (!existsSync(localAuthPath)) {
    logger.error('❌ Local auth directory not found at ./local-auth/')
    logger.error('Please run: npm run setup:whatsapp-local first')
    process.exit(1)
  }
  
  logger.info('📁 Found local auth directory')
  
  const files = readdirSync(localAuthPath)
  if (files.length === 0) {
    logger.error('❌ No auth files found in ./local-auth/')
    logger.error('Please run: npm run setup:whatsapp-local first')
    process.exit(1)
  }
  
  logger.info(`Found ${files.length} auth files: ${files.join(', ')}`)
  
  // Check if Railway CLI is available
  try {
    execSync('railway --version', { stdio: 'ignore' })
  } catch (error) {
    logger.error('❌ Railway CLI not found. Please install it first.')
    logger.error('Install: npm install -g @railway/cli')
    process.exit(1)
  }
  
  logger.info('🚀 Uploading auth files to Railway volume...')
  
  try {
    // Create the auth directory in the Railway volume
    logger.info('Creating /data/auth directory...')
    execSync('railway run -s worker-docker mkdir -p /data/auth', { stdio: 'inherit' })
    
    // Upload each file
    for (const file of files) {
      const localFile = join(localAuthPath, file)
      logger.info(`Uploading ${file}...`)
      
      // Read file content and encode as base64 for safe transfer
      const content = readFileSync(localFile, 'utf-8')
      const base64Content = Buffer.from(content).toString('base64')
      
      // Use railway run to create the file in the volume
      const command = `railway run -s worker-docker -- sh -c "echo '${base64Content}' | base64 -d > /data/auth/${file}"`
      execSync(command, { stdio: 'inherit' })
    }
    
    logger.info('✅ Auth files uploaded successfully!')
    logger.info('🔄 Now restart your Railway service to apply the changes:')
    logger.info('   railway service --restart -s worker-docker')
    
  } catch (error) {
    logger.error('❌ Failed to upload auth files:', error)
    process.exit(1)
  }
}

uploadAuthFiles().catch(console.error)
