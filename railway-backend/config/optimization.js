/**
 * Optimization Configuration for Railway Deployment
 * 
 * These settings help minimize resource usage and save Railway credits
 */

module.exports = {
  // Memory optimization
  memory: {
    // Limit Node.js heap size to prevent excessive memory usage
    maxHeapSize: process.env.MAX_HEAP_SIZE || '256',  // MB
    
    // Garbage collection settings
    enableAgressiveGC: true,
    gcInterval: 60000  // Run GC every minute
  },

  // WhatsApp connection optimization
  whatsapp: {
    // Reduce reconnection attempts to save CPU
    maxReconnectAttempts: 3,
    reconnectDelay: 30000,  // 30 seconds between attempts
    
    // Disable unnecessary features
    disableMediaAutoDownload: true,
    syncFullHistory: false,
    
    // Connection keepalive settings
    keepaliveInterval: 30000  // 30 seconds
  },

  // Notion sync optimization
  notion: {
    // Batch requests to reduce API calls
    batchSize: 10,
    
    // Cache duration for task data
    cacheDuration: 300000,  // 5 minutes
    
    // Only sync when changes detected
    smartSync: true
  },

  // Scheduler optimization
  scheduler: {
    // Use lightweight cron implementation
    useLightweightCron: true,
    
    // Reduce logging verbosity in production
    logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'info'
  },

  // API optimization
  api: {
    // Implement request caching
    enableCaching: true,
    cacheTimeout: 60000,  // 1 minute
    
    // Rate limiting to prevent abuse
    rateLimit: {
      windowMs: 60000,  // 1 minute
      maxRequests: 10
    }
  },

  // General optimizations
  general: {
    // Enable production mode optimizations
    nodeEnv: 'production',
    
    // Disable unnecessary debug features
    disableDebugLogs: true,
    
    // Use clustering for better CPU utilization (optional)
    enableClustering: false,
    
    // Periodic memory cleanup
    memoryCleanupInterval: 300000  // 5 minutes
  }
};

// Apply optimizations
function applyOptimizations() {
  const config = module.exports;
  
  // Set Node.js memory limit
  if (config.memory.maxHeapSize) {
    process.env.NODE_OPTIONS = `--max-old-space-size=${config.memory.maxHeapSize}`;
  }
  
  // Enable aggressive garbage collection
  if (config.memory.enableAgressiveGC && global.gc) {
    setInterval(() => {
      try {
        global.gc();
        console.log('🔄 Manual garbage collection performed');
      } catch (e) {
        // GC not available
      }
    }, config.memory.gcInterval);
  }
  
  // Set production environment
  if (config.general.nodeEnv === 'production') {
    process.env.NODE_ENV = 'production';
  }
  
  // Periodic memory cleanup
  if (config.general.memoryCleanupInterval) {
    setInterval(() => {
      // Clear require cache for unused modules
      Object.keys(require.cache).forEach(key => {
        if (key.includes('node_modules') && !key.includes('baileys')) {
          delete require.cache[key];
        }
      });
      
      console.log('🧹 Memory cleanup performed. Current usage:', 
        Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB');
    }, config.general.memoryCleanupInterval);
  }
  
  console.log('⚡ Optimizations applied for Railway deployment');
}

module.exports.applyOptimizations = applyOptimizations;
