import { promises as fs } from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import pino from 'pino'

const logger = pino({ name: 'whatsapp-bootstrap' })

/**
 * Bootstrap WhatsApp authentication files from environment variable
 * This runs once on container startup if the auth directory is empty
 */
export async function bootstrapWhatsAppAuth(): Promise<void> {
  const authPath = process.env.WA_AUTH_PATH || '/app/auth'
  const sessionName = process.env.WA_SESSION_NAME || 'accountability-bot'
  const dir = path.join(authPath, sessionName)

  try {
    // Create auth directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true })

    // Check if directory already has files
    const existing = await fs.readdir(dir)
    if (existing.length > 0) {
      logger.info({ dir, fileCount: existing.length }, 'Auth directory already populated, skipping bootstrap')
      return
    }

    // Check if we have auth data in environment
    const authZipB64 = process.env.AUTH_ZIP_B64
    if (!authZipB64) {
      logger.info('No AUTH_ZIP_B64 found, skipping bootstrap (expecting manual auth setup)')
      return
    }

    logger.info({ dir }, 'Bootstrapping WhatsApp auth files from environment...')

    // Write base64 data to temporary zip file
    const tmpZip = path.join(authPath, 'auth-bootstrap.zip')
    await fs.writeFile(tmpZip, Buffer.from(authZipB64, 'base64'))

    // Extract zip file using system unzip command
    await new Promise<void>((resolve, reject) => {
      const unzipCmd = `unzip -o "${tmpZip}" -d "${dir}" && rm -f "${tmpZip}"`
      const process = spawn('sh', ['-c', unzipCmd], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('exit', (code) => {
        if (code === 0) {
          logger.info({ dir, stdout }, 'Successfully extracted auth files')
          resolve()
        } else {
          logger.error({ dir, code, stderr, stdout }, 'Failed to extract auth files')
          reject(new Error(`unzip failed with code ${code}: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        logger.error({ dir, error }, 'Failed to spawn unzip process')
        reject(error)
      })
    })

    // Verify files were extracted
    const extractedFiles = await fs.readdir(dir)
    logger.info({ dir, extractedFiles }, 'Auth bootstrap completed successfully')

    // Optional: Set proper ownership if running as non-root user
    if (process.env.WA_AUTH_USER) {
      const uid = process.env.WA_AUTH_USER
      const gid = process.env.WA_AUTH_GROUP || uid
      
      await new Promise<void>((resolve, reject) => {
        const chownCmd = `chown -R ${uid}:${gid} "${authPath}"`
        const process = spawn('sh', ['-c', chownCmd], { stdio: 'pipe' })
        
        process.on('exit', (code) => {
          if (code === 0) {
            logger.info({ authPath, uid, gid }, 'Updated auth file ownership')
            resolve()
          } else {
            logger.warn({ authPath, uid, gid, code }, 'Failed to update auth file ownership (continuing anyway)')
            resolve() // Don't fail the bootstrap for ownership issues
          }
        })
        
        process.on('error', (error) => {
          logger.warn({ authPath, error }, 'Failed to spawn chown process (continuing anyway)')
          resolve() // Don't fail the bootstrap for ownership issues
        })
      })
    }

  } catch (error) {
    logger.error({ dir, error }, 'WhatsApp auth bootstrap failed')
    throw error
  }
}

/**
 * Clean up the AUTH_ZIP_B64 environment variable after successful bootstrap
 * This is a security measure to remove the base64 auth data from memory
 */
export function cleanupAuthEnvironment(): void {
  if (process.env.AUTH_ZIP_B64) {
    delete process.env.AUTH_ZIP_B64
    logger.info('Cleaned up AUTH_ZIP_B64 from environment')
  }
}
