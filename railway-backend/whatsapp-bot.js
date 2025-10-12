const WhatsAppNotificationBot = require('./whatsapp-notification-bot');

/**
 * WhatsApp Bot wrapper for server.js compatibility
 * 
 * This class wraps WhatsAppNotificationBot to match the interface expected by server.js
 * while adding improved error handling for Stream Errored conflicts
 */
class WhatsAppBot {
  constructor() {
    this.notificationBot = new WhatsAppNotificationBot();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000; // Start with 2 seconds
    this.isReconnecting = false;
    
    console.log('📱 WhatsApp Bot wrapper initialized');
  }

  async initialize() {
    try {
      console.log('🔄 Initializing WhatsApp bot...');
      await this.notificationBot.initialize();
      this.reconnectAttempts = 0;
      console.log('✅ WhatsApp bot initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing WhatsApp bot:', error);
      
      // Handle specific Stream Errored conflicts
      if (error.message && error.message.includes('Stream Errored (conflict)')) {
        console.log('🔄 Stream conflict detected, attempting recovery...');
        await this.handleStreamConflict();
      } else {
        throw error;
      }
    }
  }

  async handleStreamConflict() {
    if (this.isReconnecting) {
      console.log('⏳ Already attempting reconnection, skipping...');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached, giving up');
      throw new Error('Failed to recover from stream conflict after multiple attempts');
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    try {
      console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      // Wait before attempting reconnection
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      
      // Try to disconnect first (if possible)
      try {
        await this.notificationBot.disconnect();
        console.log('🔌 Disconnected from previous session');
      } catch (disconnectError) {
        console.log('⚠️ Could not disconnect cleanly:', disconnectError.message);
      }
      
      // Wait a bit more before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create a new notification bot instance
      this.notificationBot = new WhatsAppNotificationBot();
      await this.notificationBot.initialize();
      
      console.log('✅ Successfully recovered from stream conflict');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 2000; // Reset delay
      
    } catch (error) {
      console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      
      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log(`⏰ Will retry in ${this.reconnectDelay/1000}s...`);
        // Schedule another attempt
        setTimeout(() => {
          this.isReconnecting = false;
          this.handleStreamConflict();
        }, this.reconnectDelay);
      } else {
        throw new Error('Failed to recover from stream conflict');
      }
    }
    
    this.isReconnecting = false;
  }

  async sendMessage(text) {
    try {
      return await this.notificationBot.sendMessage(text);
    } catch (error) {
      if (error.message && error.message.includes('Stream Errored (conflict)')) {
        console.log('🔄 Stream conflict during message send, attempting recovery...');
        await this.handleStreamConflict();
        // Retry the message after recovery
        return await this.notificationBot.sendMessage(text);
      }
      throw error;
    }
  }

  async sendMorningMessage(data) {
    try {
      return await this.notificationBot.sendMorningTaskSummary(data);
    } catch (error) {
      if (error.message && error.message.includes('Stream Errored (conflict)')) {
        console.log('🔄 Stream conflict during morning message, attempting recovery...');
        await this.handleStreamConflict();
        return await this.notificationBot.sendMorningTaskSummary(data);
      }
      throw error;
    }
  }

  async sendEveningMessage(data) {
    try {
      return await this.notificationBot.sendEveningCompletionSummary(data);
    } catch (error) {
      if (error.message && error.message.includes('Stream Errored (conflict)')) {
        console.log('🔄 Stream conflict during evening message, attempting recovery...');
        await this.handleStreamConflict();
        return await this.notificationBot.sendEveningCompletionSummary(data);
      }
      throw error;
    }
  }

  async sendTaskNotification(data) {
    try {
      return await this.notificationBot.sendTaskUpdateNotification(data);
    } catch (error) {
      if (error.message && error.message.includes('Stream Errored (conflict)')) {
        console.log('🔄 Stream conflict during task notification, attempting recovery...');
        await this.handleStreamConflict();
        return await this.notificationBot.sendTaskUpdateNotification(data);
      }
      throw error;
    }
  }

  async disconnect() {
    try {
      console.log('🔌 Disconnecting WhatsApp bot...');
      await this.notificationBot.disconnect();
      console.log('✅ WhatsApp bot disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting WhatsApp bot:', error);
      // Don't throw on disconnect errors - we're shutting down anyway
    }
  }

  getConnectionStatus() {
    return {
      ...this.notificationBot.getConnectionStatus(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      isReconnecting: this.isReconnecting
    };
  }

  // Test method
  async sendTestMessage(message) {
    return await this.notificationBot.sendTestMessage(message);
  }
}

module.exports = WhatsAppBot;
