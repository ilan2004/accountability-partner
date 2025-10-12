#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

// Apply optimizations for Railway deployment
const optimization = require('./config/optimization');
optimization.applyOptimizations();

const SchedulerService = require('./services/scheduler');
const NotionSyncService = require('./services/notion-sync');
const WhatsAppNotificationBot = require('./whatsapp-notification-bot');
const HealthCheckServer = require('./health-server');

/**
 * Main Accountability System Service
 * 
 * Orchestrates the complete accountability system:
 * - Notion task synchronization
 * - WhatsApp notifications
 * - Scheduled summaries
 * - Real-time change detection
 */
class AccountabilitySystem {
  constructor() {
    this.scheduler = null;
    this.healthServer = null;
    this.isRunning = false;
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      this.shutdown('UNCAUGHT_EXCEPTION');
    });

    console.log('🤖 Accountability System initialized');
  }

  async start() {
    try {
      console.log('🚀 Starting Accountability System...');
      
      // Validate environment variables
      this.validateEnvironment();
      
      // Start health check server for Railway
      this.healthServer = new HealthCheckServer();
      this.healthServer.start();
      
      // Initialize scheduler (includes WhatsApp bot and Notion sync)
      this.scheduler = new SchedulerService();
      await this.scheduler.initialize();
      
      // Test components
      await this.runInitialTests();
      
      this.isRunning = true;
      console.log('✅ Accountability System running successfully!');
      console.log('📅 Active schedules:');
      console.log('  🌅 Morning summaries: 06:00 IST daily');
      console.log('  🌙 Evening summaries: 22:00 IST daily');
      console.log('  🔄 Notion sync: Every 5 minutes');
      console.log('  💊 Health checks: Every hour');
      console.log('');
      console.log('📱 WhatsApp bot ready for notifications');
      console.log('📄 Notion sync monitoring both users');
      console.log('🤖 AI-powered message formatting active');
      
    } catch (error) {
      console.error('❌ Failed to start Accountability System:', error);
      process.exit(1);
    }
  }

  async shutdown(signal) {
    if (!this.isRunning) return;
    
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    try {
      if (this.scheduler) {
        this.scheduler.stopAllJobs();
        console.log('⏸️ Stopped all scheduled jobs');
      }
      
      if (this.healthServer) {
        this.healthServer.stop();
        console.log('⏸️ Stopped health check server');
      }
      
      // Give some time for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }

  validateEnvironment() {
    const required = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'GEMINI_API_KEY',
      'WA_GROUP_JID'
    ];

    const missing = required.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing);
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    console.log('✅ Environment variables validated');
  }

  async runInitialTests() {
    try {
      console.log('🧪 Running initial system tests...');
      
      // Test Notion sync service
      const notionSync = new NotionSyncService();
      const users = await notionSync.getAllUsers();
      console.log(`✅ Found ${users.length} users in database`);
      
      // Test Gemini formatter
      const geminiTest = await this.scheduler.geminiFormatter.testFormatting();
      if (geminiTest) {
        console.log('✅ Gemini AI formatter working');
      }
      
      // Test WhatsApp connection status
      const whatsappStatus = this.scheduler.whatsappBot?.getConnectionStatus();
      if (whatsappStatus?.connected) {
        console.log('✅ WhatsApp bot connected');
      } else {
        console.log('⚠️ WhatsApp bot not yet connected (will retry)');
      }
      
    } catch (error) {
      console.error('⚠️ Some tests failed:', error);
      // Don't fail startup on test errors
    }
  }

  // Expose manual trigger methods for testing/debugging
  async triggerMorningSummary() {
    if (this.scheduler) {
      await this.scheduler.triggerMorningSummary();
    }
  }

  async triggerEveningSummary() {
    if (this.scheduler) {
      await this.scheduler.triggerEveningSummary();
    }
  }

  async triggerNotionSync() {
    if (this.scheduler) {
      await this.scheduler.triggerNotionSync();
    }
  }

  getStatus() {
    if (!this.scheduler) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'running',
      jobs: this.scheduler.getJobStatus(),
      whatsapp: this.scheduler.whatsappBot?.getConnectionStatus(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      lastSync: this.scheduler.notionSync?.getLastSyncTime()
    };
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const system = new AccountabilitySystem();
  
  switch (command) {
    case 'start':
    case undefined:
    case '':
      system.start();
      break;
      
    case 'morning':
      system.start().then(() => {
        console.log('🧪 Triggering morning summary...');
        return system.triggerMorningSummary();
      }).then(() => {
        console.log('✅ Morning summary sent');
        process.exit(0);
      }).catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
      break;
      
    case 'evening':
      system.start().then(() => {
        console.log('🧪 Triggering evening summary...');
        return system.triggerEveningSummary();
      }).then(() => {
        console.log('✅ Evening summary sent');
        process.exit(0);
      }).catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
      break;
      
    case 'sync':
      system.start().then(() => {
        console.log('🧪 Triggering Notion sync...');
        return system.triggerNotionSync();
      }).then(() => {
        console.log('✅ Notion sync completed');
        process.exit(0);
      }).catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
      break;
      
    case 'status':
      system.start().then(() => {
        const status = system.getStatus();
        console.log('📊 System Status:', JSON.stringify(status, null, 2));
        process.exit(0);
      }).catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
      break;
      
    case 'help':
      console.log(`
🤖 Accountability System Commands:

Usage: node accountability-system.js [command]

Commands:
  start       Start the full system (default)
  morning     Trigger morning summary manually  
  evening     Trigger evening summary manually
  sync        Trigger Notion sync manually
  status      Show system status
  help        Show this help message

Examples:
  node accountability-system.js           # Start the system
  node accountability-system.js morning   # Send morning summary now
  node accountability-system.js sync      # Run sync now
      `);
      break;
      
    default:
      // Unknown command - just start the system (Railway deployment)
      console.log(`⚠️ Unknown command "${command}", starting system...`);
      system.start();
      break;
  }
} else {
  // Export for use as module
  module.exports = AccountabilitySystem;
}
