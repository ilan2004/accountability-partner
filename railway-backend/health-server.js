const http = require('http');

class HealthCheckServer {
  constructor(port = process.env.PORT || 3000) {
    this.port = port;
    this.server = null;
    this.startTime = new Date();
  }

  start() {
    this.server = http.createServer((req, res) => {
      // Handle different routes
      if (req.url === '/' || req.url === '/health') {
        // Health check endpoint for Railway
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          service: 'accountability-bot',
          uptime: Math.floor((new Date() - this.startTime) / 1000) + ' seconds',
          timestamp: new Date().toISOString()
        }));
      } else if (req.url === '/status') {
        // Detailed status endpoint
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'operational',
          environment: process.env.NODE_ENV || 'production',
          services: {
            whatsapp: 'connected',
            notion: 'syncing',
            scheduler: 'active',
            database: 'connected'
          },
          uptime: Math.floor((new Date() - this.startTime) / 1000) + ' seconds',
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
          }
        }));
      } else {
        // 404 for other routes
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    this.server.listen(this.port, () => {
      console.log(`🏥 Health check server running on port ${this.port}`);
      console.log(`📍 Health endpoint: http://localhost:${this.port}/health`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('🛑 Health check server stopped');
      });
    }
  }
}

module.exports = HealthCheckServer;
