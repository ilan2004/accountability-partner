const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const P = require('pino');

/**
 * WhatsApp Notification Bot for Accountability System
 * 
 * Purpose: Send outgoing notifications to accountability group
 * - Morning task summaries (6 AM IST)
 * - Evening completion summaries (10 PM IST)  
 * - Real-time task update notifications
 * - Task completion celebrations
 * 
 * Note: This bot ONLY sends messages, does not process incoming messages
 */
class WhatsAppNotificationBot {
  constructor() {
    this.sock = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.groupJid = process.env.WA_GROUP_JID || process.env.WHATSAPP_GROUP_ID;
    this.sessionPath = process.env.WA_AUTH_PATH || './wa-session';
    
    // Ensure session directory exists
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }

    console.log('📱 WhatsApp Notification Bot initialized');
    console.log('👥 Group JID:', this.groupJid);
    console.log('📂 Session Path:', this.sessionPath);
  }

  async initialize() {
    try {
      console.log('🔄 Initializing WhatsApp connection...');
      
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`📱 Using WhatsApp v${version.join('.')}, isLatest: ${isLatest}`);

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      
      this.sock = makeWASocket({
        version,
        logger: P({ level: 'info' }),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'info' }))
        },
        browser: Browsers.macOS('Desktop'),
        generateHighQualityLinkPreview: true,
      });

      // Handle connection updates
      this.sock.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(update);
      });

      // Handle credentials update
      this.sock.ev.on('creds.update', saveCreds);

      // Note: We don't listen for incoming messages - this is a notification-only bot

      console.log('✅ WhatsApp notification bot event listeners set up');

    } catch (error) {
      console.error('❌ Error initializing WhatsApp bot:', error);
      await this.handleReconnection();
    }
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('📱 QR Code generated!');
      console.log('');
      console.log('Please scan this QR code with your WhatsApp:');
      console.log('');
      
      // Try to display QR code in terminal
      try {
        const QRCode = require('qrcode-terminal');
        QRCode.generate(qr, { small: true });
      } catch (error) {
        console.log('QR Code data:', qr);
        console.log('');
        console.log('If you can\'t see the QR code above, you can:');
        console.log('1. Install qrcode-terminal: npm install qrcode-terminal');
        console.log('2. Or visit: https://qr.io/ and paste the QR data above');
      }
      
      console.log('');
      console.log('⏰ Waiting for you to scan the QR code...');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      
      console.log('🔌 Connection closed due to:', lastDisconnect?.error);
      
      if (shouldReconnect) {
        console.log('🔄 Reconnecting WhatsApp...');
        await this.handleReconnection();
      } else {
        console.log('🚪 Logged out from WhatsApp');
        this.isConnected = false;
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connected successfully');
      this.isConnected = true;
      this.retryCount = 0;
      
      // Send startup notification
      await this.sendStartupNotification();
    }
  }

  async handleReconnection() {
    if (this.retryCount >= this.maxRetries) {
      console.log('❌ Max retry attempts reached. Stopping reconnection.');
      return;
    }

    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Exponential backoff, max 30s
    
    console.log(`🔄 Reconnecting in ${delay/1000}s... (attempt ${this.retryCount}/${this.maxRetries})`);
    
    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        console.error('❌ Reconnection failed:', error);
        await this.handleReconnection();
      }
    }, delay);
  }

  async sendMessage(text, options = {}) {
    if (!this.isConnected || !this.sock) {
      console.log('❌ WhatsApp not connected, cannot send message');
      return false;
    }

    if (!this.groupJid) {
      console.log('❌ Group JID not configured, cannot send message');
      return false;
    }

    try {
      await this.sock.sendMessage(this.groupJid, { text });
      console.log('📤 Message sent successfully');
      console.log('📝 Preview:', text.substring(0, 100) + '...');
      return true;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      return false;
    }
  }

  // Morning Summary (6 AM IST)
  async sendMorningTaskSummary(summaryData) {
    try {
      console.log('🌅 Sending morning task summary...');
      
      // The formatted message already contains everything we need
      const message = summaryData.formatted_message;

      const success = await this.sendMessage(message);
      if (success) {
        console.log('✅ Morning task summary sent successfully');
      }
      return success;
    } catch (error) {
      console.error('❌ Error sending morning summary:', error);
      return false;
    }
  }

  // Evening Summary (10 PM IST)
  async sendEveningCompletionSummary(summaryData) {
    try {
      console.log('🌙 Sending evening completion summary...');
      
      // The formatted message already contains everything we need
      const message = summaryData.formatted_message;

      const success = await this.sendMessage(message);
      if (success) {
        console.log('✅ Evening completion summary sent successfully');
      }
      return success;
    } catch (error) {
      console.error('❌ Error sending evening summary:', error);
      return false;
    }
  }

  // Task Update Notification (Real-time)
  async sendTaskUpdateNotification(updateData) {
    try {
      console.log('📝 Sending task update notification...');
      
      let message = '';
      
      switch (updateData.type) {
        case 'task_added':
          message = `➕ **Task Added**

${updateData.user_name} added a new task:
📋 "${updateData.task_name}"

${updateData.contextual_message || ''}`;
          
          // Add task list if provided
          if (updateData.task_list && updateData.task_list.length > 0) {
            message += `\n\n📝 **Updated Task List for ${updateData.user_name}:**\n`;
            updateData.task_list.forEach((task, index) => {
              const emoji = task.priority === 'high' ? '🔥' : task.priority === 'medium' ? '🟡' : '🟢';
              let taskLine = `${index + 1}. ${task.task_name} ${emoji}`;
              if (task.due_date) {
                const dueDate = new Date(task.due_date).toLocaleDateString('en-IN', { 
                  day: 'numeric',
                  month: 'short',
                  weekday: 'short'
                });
                taskLine += ` (Due: ${dueDate})`;
              }
              message += `${taskLine}\n`;
            });
            
            // Add task count summary
            const taskCount = updateData.task_list.length;
            message += `\n🎯 Total pending tasks: ${taskCount}`;
          }
          break;
          
        case 'task_completed':
          message = `✅ **Task Completed**

🎉 ${updateData.user_name} completed:
📋 "${updateData.task_name}"

${updateData.contextual_message || 'Great job! 🎯'}`;
          break;
          
        case 'task_updated':
          message = `📝 **Task Updated**

${updateData.user_name} updated:
📋 "${updateData.task_name}"

${updateData.contextual_message || ''}`;
          break;
          
        default:
          message = `🔄 **Task Update**

${updateData.contextual_message}`;
      }

      const success = await this.sendMessage(message);
      if (success) {
        console.log('✅ Task update notification sent successfully');
      }
      return success;
    } catch (error) {
      console.error('❌ Error sending task update notification:', error);
      return false;
    }
  }

  // Multiple tasks update (when sync detects multiple changes)
  async sendBulkTaskUpdateNotification(bulkUpdateData) {
    try {
      console.log('📊 Sending bulk task update notification...');
      
      const message = `🔄 **Task Updates**

${bulkUpdateData.formatted_message}

📅 Updated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

      const success = await this.sendMessage(message);
      if (success) {
        console.log('✅ Bulk task update notification sent successfully');
      }
      return success;
    } catch (error) {
      console.error('❌ Error sending bulk update notification:', error);
      return false;
    }
  }

  // Startup notification when bot comes online
  async sendStartupNotification() {
    const message = `🤖 **Accountability Bot is Online!**

Ready to keep you both accountable! 📊

✅ Morning summaries at 06:00 IST
✅ Evening summaries at 22:00 IST  
✅ Real-time task notifications
✅ Completion celebrations

Focus on your Notion workspace - I'll handle the updates! 💪`;
    
    await this.sendMessage(message);
  }

  // Health check notification
  async sendHealthCheck() {
    const status = this.getConnectionStatus();
    const message = `🔍 **Bot Health Check**

Connection: ${status.connected ? '✅ Connected' : '❌ Disconnected'}
Group: ${status.groupJid ? '✅ Configured' : '❌ Not configured'}
Session: ${status.sessionPath}
Uptime: ${process.uptime().toFixed(0)}s

System operational! 🚀`;

    return await this.sendMessage(message);
  }

  async disconnect() {
    if (this.sock) {
      await this.sock.logout();
      this.isConnected = false;
      console.log('👋 WhatsApp notification bot disconnected');
    }
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      retryCount: this.retryCount,
      groupJid: this.groupJid,
      sessionPath: this.sessionPath,
      uptime: process.uptime()
    };
  }

  // Test method for development
  async sendTestMessage(messageText = 'Test message from accountability bot! 🤖') {
    console.log('🧪 Sending test message...');
    return await this.sendMessage(messageText);
  }
}

module.exports = WhatsAppNotificationBot;
