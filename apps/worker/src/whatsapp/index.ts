import { WhatsAppClient } from './client';
import { WhatsAppMessage, WhatsAppGroup, WhatsAppConfig } from './types';

/**
 * WhatsAppBot - Wrapper around WhatsAppClient for backward compatibility
 * This provides the interface expected by the setup script
 */
export class WhatsAppBot {
  private client: WhatsAppClient;

  constructor(config?: WhatsAppConfig) {
    this.client = new WhatsAppClient(config);
  }

  /**
   * Connect to WhatsApp
   */
  async connect(): Promise<void> {
    return this.client.connect();
  }

  /**
   * Get list of groups
   */
  async getGroups(): Promise<WhatsAppGroup[]> {
    return this.client.getGroups();
  }

  /**
   * Send a message to a group or contact
   */
  async sendMessage(to: string, text: string): Promise<void> {
    return this.client.sendMessage({ to, text });
  }

  /**
   * Disconnect from WhatsApp
   */
  async disconnect(): Promise<void> {
    return this.client.disconnect();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client.isConnected();
  }

  /**
   * Get connection state
   */
  getConnectionState() {
    return this.client.getConnectionState();
  }
}

// Export all types as well
export * from './types';
export { WhatsAppClient } from './client';
