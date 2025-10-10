import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
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
  
  const authDirs = readdirSync(localAuthPath).filter(item => {
    const fullPath = join(localAuthPath, item)
    return statSync(fullPath).isDirectory()
  })
  
  if (authDirs.length === 0) {
    logger.error('❌ No auth directories found in ./local-auth/')
    logger.error('Please run: npm run setup:whatsapp-local first')
    process.exit(1)
  }
  
  logger.info(`Found ${authDirs.length} auth directories: ${authDirs.join(', ')}`)
  
  // Get all auth files recursively
  const getAllFiles = (dir: string, baseDir = ''): string[] => {
    const results: string[] = []
    const list = readdirSync(dir)
    
    for (const file of list) {
      const fullPath = join(dir, file)
      const relativePath = join(baseDir, file)
      
      if (statSync(fullPath).isDirectory()) {
        results.push(...getAllFiles(fullPath, relativePath))
      } else {
        results.push(relativePath)
      }
    }
    
    return results
  }
  
  const allAuthFiles: { relativePath: string, fullPath: string }[] = []
  for (const authDir of authDirs) {
    const authDirPath = join(localAuthPath, authDir)
    const files = getAllFiles(authDirPath, authDir)
    for (const file of files) {
      allAuthFiles.push({
        relativePath: file,
        fullPath: join(localAuthPath, file)
      })
    }
  }
  
  if (allAuthFiles.length === 0) {
    logger.error('❌ No auth files found in auth directories')
    process.exit(1)
  }
  
  logger.info(`Found ${allAuthFiles.length} total auth files`)
  
  // Show file contents for manual upload
  logger.info('')
  logger.info('🚨 IMPORTANT: Due to Railway CLI compatibility issues with PowerShell,')
  logger.info('   automatic upload is currently not working.')
  logger.info('')
  logger.info('📋 MANUAL UPLOAD INSTRUCTIONS:')
  logger.info('') 
  logger.info('1. First, you need to stabilize your Railway service:')
  logger.info('   - Temporarily comment out the WhatsApp client initialization in your code')
  logger.info('   - Redeploy the service so it stays running')
  logger.info('')
  logger.info('2. Then run ONE of these commands from cmd.exe (not PowerShell):')
  logger.info('')
  
  // Generate the commands for manual execution
  const projectId = '5afaf645-e28d-4236-bdba-75f343a0a614'
  const environmentId = '3f2a8477-f1c0-48f0-ac2e-3d72e47a595e'
  const serviceId = 'worker-docker'
  
  logger.info(`   # Create the auth directory structure:`)
  logger.info(`   railway ssh -p ${projectId} -e ${environmentId} -s ${serviceId} "mkdir -p /data/auth"`)
  logger.info('')
  
  // Create directories first
  const directories = new Set<string>()
  for (const authFile of allAuthFiles) {
    // Normalize path separators to forward slashes for Unix
    const normalizedPath = authFile.relativePath.replace(/\\/g, '/')
    const dir = normalizedPath.split('/').slice(0, -1).join('/')
    if (dir) {
      directories.add(dir)
    }
  }
  
  for (const dir of directories) {
    logger.info(`   railway ssh -p ${projectId} -e ${environmentId} -s ${serviceId} "mkdir -p /data/auth/${dir}"`)
  }
  logger.info('')
  
  // Show upload commands for each file
  logger.info('   # Upload files:')
  for (const authFile of allAuthFiles) {
    try {
      const content = readFileSync(authFile.fullPath, 'utf-8')
      const base64Content = Buffer.from(content).toString('base64')
      
      // Convert Windows paths to Unix paths for Railway
      const unixPath = authFile.relativePath.replace(/\\/g, '/')
      logger.info(`   railway ssh -p ${projectId} -e ${environmentId} -s ${serviceId} "echo '${base64Content}' | base64 -d > /data/auth/${unixPath}"`)
    } catch (error) {
      const unixPath = authFile.relativePath.replace(/\\/g, '/')
      logger.warn(`   # Could not read ${unixPath} - may be binary file`)
      logger.info(`   railway ssh -p ${projectId} -e ${environmentId} -s ${serviceId} "cp /local/path/to/${unixPath} /data/auth/${unixPath}"`)
    }
  }
  logger.info('')
    
  logger.info('')
  logger.info('🚀 ALTERNATIVE SOLUTION:')
  logger.info('Instead of manual upload, you can:')
  logger.info('1. Copy the auth files to your Docker build context')
  logger.info('2. Modify your Dockerfile to COPY them to /data/auth')
  logger.info('3. Redeploy the service')
  logger.info('')
  logger.info('📝 Example Dockerfile addition:')
  logger.info('   COPY local-auth/ /data/auth/')
  logger.info('')
  logger.info('✨ This approach will persist the auth files in your deployment')
  logger.info('   and solve the chicken-and-egg problem automatically.')
  logger.info('')
  logger.info('🔄 After uploading, restart the service:')
  logger.info(`   railway service --restart -s ${serviceId}`)
}

uploadAuthFiles().catch(console.error)
