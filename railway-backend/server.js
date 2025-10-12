// Railway Backend Service - WhatsApp Bot & Cron Jobs
// This runs separately from the Next.js frontend

const express = require('express');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.json({ 
    status: 'Railway Backend Service Running',
    services: ['WhatsApp Bot', 'Cron Jobs', 'Task Processing'],
    timestamp: new Date().toISOString()
  });
});

// WhatsApp bot status endpoint
app.get('/whatsapp/status', (req, res) => {
  res.json({ 
    status: 'WhatsApp service ready',
    connected: false // Will update when we implement Baileys
  });
});

// Webhook for manual triggers
app.post('/api/send-morning-message', (req, res) => {
  console.log('Manual morning message trigger');
  res.json({ message: 'Morning message triggered' });
});

app.post('/api/send-evening-summary', (req, res) => {
  console.log('Manual evening summary trigger');
  res.json({ message: 'Evening summary triggered' });
});

// Cron jobs
console.log('Setting up cron jobs...');

// Morning message at 6:00 AM IST (00:30 UTC)
cron.schedule('30 0 * * *', () => {
  console.log('Running morning message job at 6:00 AM IST');
  // Will implement actual morning message logic here
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Evening summary at 10:00 PM IST (16:30 UTC)
cron.schedule('30 16 * * *', () => {
  console.log('Running evening summary job at 10:00 PM IST');
  // Will implement actual evening summary logic here
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Railway Backend Service running on port ${PORT}`);
  console.log('📱 WhatsApp bot service initialized');
  console.log('⏰ Cron jobs scheduled for 6:00 AM and 10:00 PM IST');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    console.log('HTTP server closed')
  })
});
