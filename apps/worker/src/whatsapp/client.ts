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
    try {
      // Get auth state from files
      const authPath = join(process.cwd(), this.config.authPath!, this.config.sessionName!);
      const { state, saveCreds } = await useMultiFileAuthState(authPath);

      // Get latest version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(`Using Baileys v${version}${isLatest ? ' (latest)' : ''}`);

      // Create socket
      this.socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: false,
      });

      // Handle connection updates
      this.socket.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(update);
      });

      // Handle credential updates
      this.socket.ev.on('creds.update', saveCreds);

      // Handle messages (for debugging)
      this.socket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
          logger.debug('Received message:', msg);
        }
      });

      logger.info('WhatsApp client initialized');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
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

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
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
   * Send a text message
   */
  async sendMessage(message: WhatsAppMessage): Promise<void> {
    if (!this.socket || !this.connectionState.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      const jid = message.to.includes('@') ? message.to : `${message.to}@g.us`;
      
      await this.socket.sendMessage(jid, {
        text: message.text,
      });

      logger.info(`Message sent to ${jid}`);
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
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
      const groups = await this.socket.groupFetchAllParticipating();
      
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
    return this.connectionState.isConnected;
  }
}
