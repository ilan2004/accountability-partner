import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  ConnectionState as BaileysConnectionState,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { join } from 'path';
import qrcode from 'qrcode-terminal';
import { WhatsAppConfig, WhatsAppMessage, WhatsAppGroup, ConnectionState } from './types';

const logger = pino({ name: 'whatsapp-client' });

export class WhatsAppClient {
  private socket: WASocket | null = null;
  private config: WhatsAppConfig;
  private connectionState: ConnectionState = { isConnected: false };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectBaseDelayMs = 5000; // Start with 5 seconds
  private reconnectMaxDelayMs = 60000; // Cap at 60 seconds
  private isManuallyDisconnected = false;
  private lastActivityTime: number = Date.now();
  private idleTimeoutMs = 60000; // 1 minute idle timeout

  constructor(config: WhatsAppConfig = {}) {
    this.config = {
      sessionName: 'accountability-bot',
      authPath: './auth',
      printQR: true,
      ...config,
    };

    // Optional overrides via env
    if (process.env.WA_MAX_RECONNECT_ATTEMPTS) {
      this.maxReconnectAttempts = Number(process.env.WA_MAX_RECONNECT_ATTEMPTS);
    }
    if (process.env.WA_RECONNECT_BASE_DELAY_MS) {
      this.reconnectBaseDelayMs = Number(process.env.WA_RECONNECT_BASE_DELAY_MS);
    }
    if (process.env.WA_RECONNECT_MAX_DELAY_MS) {
      this.reconnectMaxDelayMs = Number(process.env.WA_RECONNECT_MAX_DELAY_MS);
    }
  }

  /**
   * Initialize and connect to WhatsApp
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      logger.debug('Already connected to WhatsApp');
      return;
    }
    
    this.isManuallyDisconnected = false;
    this.lastActivityTime = Date.now();
    
    try {
      // Check if auth path exists and is accessible
      const basePath = this.config.authPath!.startsWith('/') 
        ? this.config.authPath! 
        : join(process.cwd(), this.config.authPath!);
      const authPath = join(basePath, this.config.sessionName!);
      logger.info(`Attempting WhatsApp connection with auth path: ${authPath}`);
      
      let state, saveCreds;
      try {
        const authResult = await useMultiFileAuthState(authPath);
        state = authResult.state;
        saveCreds = authResult.saveCreds;
        logger.info('Successfully loaded authentication state');
      } catch (authError) {
        logger.warn('Failed to load authentication state:', authError);
        throw new Error('Authentication files not accessible or corrupted');
      }

      // Get latest version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(`Using Baileys v${version}${isLatest ? ' (latest)' : ''}`);

      // Create a promise that resolves when connected or rejects on failure
      const connectionPromise = new Promise<void>((resolve, reject) => {
        let isResolved = false;
        let connectionTimer: NodeJS.Timeout;

        const resolveOnce = () => {
          if (!isResolved) {
            isResolved = true;
            if (connectionTimer) clearTimeout(connectionTimer);
            resolve();
          }
        };

        const rejectOnce = (error: Error) => {
          if (!isResolved) {
            isResolved = true;
            if (connectionTimer) clearTimeout(connectionTimer);
            reject(error);
          }
        };

        try {
          // Create socket
          this.socket = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            generateHighQualityLinkPreview: false,
            connectTimeoutMs: 30000, // 30 second connection timeout
          });

          logger.info('WhatsApp socket created, waiting for connection...');

          // Handle connection updates
          this.socket.ev.on('connection.update', async (update) => {
            logger.info('Connection update received:', {
              connection: update.connection,
              receivedPendingNotifications: update.receivedPendingNotifications,
              isOnline: update.isOnline,
              isNewLogin: update.isNewLogin
            });
            
            await this.handleConnectionUpdate(update);
            
            // Resolve the promise when connected
            if (update.connection === 'open') {
              logger.info('WhatsApp connection established successfully');
              resolveOnce();
            } else if (update.connection === 'close') {
              const reason = (update.lastDisconnect?.error as Boom)?.output?.statusCode;
              const errorMessage = update.lastDisconnect?.error?.message || 'Unknown error';
              
              logger.warn(`Connection closed. Reason code: ${reason}, Error: ${errorMessage}`);
              
              if (reason === DisconnectReason.loggedOut) {
                rejectOnce(new Error('Logged out from WhatsApp. Authentication required.'));
              } else if (reason === DisconnectReason.badSession) {
                rejectOnce(new Error('Bad WhatsApp session. Re-authentication required.'));
              } else if (reason === DisconnectReason.timedOut) {
                rejectOnce(new Error('WhatsApp connection timed out. Network or server issues.'));
              } else {
                rejectOnce(new Error(`WhatsApp connection failed: ${errorMessage}`));
              }
            }
          });

          // Handle credential updates
          this.socket.ev.on('creds.update', saveCreds);

          // Handle messages (for debugging)
          this.socket.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.key.fromMe && m.type === 'notify') {
              logger.debug('Received message:', { from: msg.key.remoteJid, id: msg.key.id });
            }
          });

          // Set a timeout to avoid hanging forever (increased to 90 seconds)
          connectionTimer = setTimeout(() => {
            rejectOnce(new Error('WhatsApp connection timeout after 90 seconds. This may indicate network issues or that re-authentication is required.'));
          }, 90000);
          
        } catch (socketError) {
          logger.error('Failed to create WhatsApp socket:', socketError);
          rejectOnce(new Error(`Failed to initialize WhatsApp socket: ${socketError.message}`));
        }
      });

      logger.info('WhatsApp client initialized, establishing connection...');
      
      // Wait for connection to be established
      await connectionPromise;
      logger.info('✅ WhatsApp client connected successfully');
      
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      
      // Clean up any partial socket creation
      if (this.socket) {
        try {
          this.socket.ev.removeAllListeners();
          this.socket.ws.close();
        } catch (cleanupError) {
          logger.warn('Error during WhatsApp socket cleanup:', cleanupError);
        }
        this.socket = null;
      }
      
      throw error;
    }
  }

  /**
   * Handle connection state updates
   */
  private async handleConnectionUpdate(update: Partial<BaileysConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.connectionState.qr = qr;
      this.connectionState.isNewLogin = true;
      
      if (this.config.printQR) {
        console.log('\n📱 Scan this QR code with WhatsApp:\n');
        qrcode.generate(qr, { small: true });
        console.log('\n');
      }
    }

    if (connection === 'close') {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      
      logger.warn(
        `Connection closed, reason: ${reason}, reconnect: ${shouldReconnect}`
      );

      this.connectionState.isConnected = false;
      this.connectionState.lastDisconnect = {
        error: lastDisconnect?.error as Error,
        date: new Date(),
      };

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts && !this.isManuallyDisconnected) {
        this.reconnectAttempts++;
        // exponential backoff with jitter and cap
        const base = this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts - 1);
        const capped = Math.min(base, this.reconnectMaxDelayMs);
        const jitter = Math.floor(capped * (0.8 + Math.random() * 0.4));
        logger.info(
          `Reconnecting in ${Math.round(jitter / 1000)}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        setTimeout(() => this.connect(), jitter);
      } else if (reason === DisconnectReason.loggedOut) {
        logger.error('Logged out from WhatsApp. Please re-authenticate.');
      } else if (this.isManuallyDisconnected) {
        logger.info('Disconnected manually, not reconnecting');
      } else {
        logger.error('Max reconnection attempts reached. Please restart the bot.');
      }
    }

    if (connection === 'open') {
      logger.info('✅ Connected to WhatsApp');
      this.connectionState.isConnected = true;
      this.connectionState.isNewLogin = false;
      this.reconnectAttempts = 0;
    }

    if (connection === 'connecting') {
      logger.info('Connecting to WhatsApp...');
    }
  }

  /**
   * Sanitize message text for WhatsApp compatibility
   * Removes or replaces problematic characters that might cause sending to fail
   */
  private sanitizeMessageText(text: string): string {
    if (!text) return text;

    // Remove emojis and other unicode symbols that might cause issues
    // This regex matches most emoji characters
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    
    let sanitized = text
      .replace(emojiRegex, '') // Remove emojis
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // Remove variation selectors
      .replace(/[\u{200D}]/gu, '') // Remove zero-width joiners
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    logger.debug('Message sanitization:', {
      original: text.substring(0, 50),
      sanitized: sanitized.substring(0, 50),
      originalLength: text.length,
      sanitizedLength: sanitized.length,
      hadEmojis: text !== sanitized
    });

    return sanitized;
  }

  /**
   * Send a text message
   */
  async sendMessage(message: WhatsAppMessage): Promise<void> {
    if (!this.socket) {
      const error = new Error('WhatsApp socket is null');
      logger.error('Send message failed - socket is null', { 
        message: message.text?.substring(0, 100), 
        to: message.to 
      });
      throw error;
    }

    if (!this.connectionState.isConnected) {
      const error = new Error('WhatsApp client is not connected');
      logger.error('Send message failed - not connected', { 
        message: message.text?.substring(0, 100), 
        to: message.to,
        connectionState: this.connectionState
      });
      throw error;
    }

    try {
      const jid = message.to.includes('@') ? message.to : `${message.to}@g.us`;
      
      // Sanitize the message text to remove problematic characters
      const sanitizedText = this.sanitizeMessageText(message.text || '');
      
      logger.info(`Attempting to send message to ${jid}`, {
        originalLength: message.text?.length,
        sanitizedLength: sanitizedText.length,
        messagePreview: sanitizedText.substring(0, 50),
        hadEmojis: message.text !== sanitizedText
      });
      
      await this.socket.sendMessage(jid, {
        text: sanitizedText,
      });

      logger.info(`✅ Message sent successfully to ${jid}`);
      this.lastActivityTime = Date.now();
    } catch (error) {
      logger.error('❌ Failed to send message - detailed error:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        errorStringified: JSON.stringify(error),
        to: message.to,
        messageLength: message.text?.length
      });
      
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`WhatsApp send failed: ${error.message}`);
      } else {
        throw new Error(`WhatsApp send failed: ${JSON.stringify(error)}`);
      }
    }
  }

  /**
   * Get list of groups
   */
  async getGroups(): Promise<WhatsAppGroup[]> {
    if (!this.socket || !this.connectionState.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      logger.info('Fetching WhatsApp groups...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Group fetch timeout after 30 seconds'));
        }, 30000);
      });
      
      const groupsPromise = this.socket.groupFetchAllParticipating();
      
      const groups = await Promise.race([groupsPromise, timeoutPromise]);
      
      logger.info(`Successfully fetched ${Object.keys(groups).length} groups`);
      
      return Object.values(groups).map(group => ({
        id: group.id,
        subject: group.subject,
        participants: group.participants.map(p => p.id),
        owner: group.owner,
        desc: group.desc,
        creation: group.creation,
      }));
    } catch (error) {
      logger.error('Failed to fetch groups:', error);
      throw error;
    }
  }

  /**
   * Disconnect from WhatsApp
   */
  async disconnect(): Promise<void> {
    this.isManuallyDisconnected = true;
    if (this.socket) {
      this.socket.ev.removeAllListeners();
      this.socket.ws.close();
      this.socket = null;
      this.connectionState.isConnected = false;
      logger.info('Disconnected from WhatsApp');
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    const connected = this.connectionState.isConnected && this.socket !== null;
    logger.debug(`Connection check: connected=${connected}, socket=${!!this.socket}, state=${this.connectionState.isConnected}`);
    return connected;
  }

  /**
   * Get detailed connection info for debugging
   */
  getConnectionInfo() {
    return {
      isConnected: this.connectionState.isConnected,
      hasSocket: !!this.socket,
      socketReadyState: this.socket?.ws?.readyState,
      reconnectAttempts: this.reconnectAttempts,
      lastDisconnect: this.connectionState.lastDisconnect,
      config: {
        sessionName: this.config.sessionName,
        authPath: this.config.authPath
      }
    };
  }
  
  /**
   * Get time since last activity
   */
  getIdleTime(): number {
    return Date.now() - this.lastActivityTime;
  }
  
  /**
   * Check if connection should timeout due to inactivity
   */
  isIdleTimeout(): boolean {
    return this.getIdleTime() > this.idleTimeoutMs;
  }
  
  /**
   * Set idle timeout duration
   */
  setIdleTimeout(ms: number): void {
    this.idleTimeoutMs = ms;
  }
  
  /**
   * Reset activity timer
   */
  resetActivityTimer(): void {
    this.lastActivityTime = Date.now();
  }
}
