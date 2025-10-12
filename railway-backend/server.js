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
app.post('/api/send-morning-message', async (req, res) => {
  console.log('📱 Manual morning message trigger');
  try {
    const result = await sendMorningMessage();
    res.json({ success: true, message: 'Morning message sent', data: result });
  } catch (error) {
    console.error('Error sending morning message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/send-evening-summary', async (req, res) => {
  console.log('📊 Manual evening summary trigger');
  try {
    const result = await sendEveningSummary();
    res.json({ success: true, message: 'Evening summary sent', data: result });
  } catch (error) {
    console.error('Error sending evening summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cron jobs
console.log('Setting up cron jobs...');

// Morning message at 6:00 AM IST (00:30 UTC)
cron.schedule('30 0 * * *', async () => {
  console.log('🌅 Running morning message job at 6:00 AM IST');
  try {
    await sendMorningMessage();
  } catch (error) {
    console.error('❌ Morning message job failed:', error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Evening summary at 10:00 PM IST (16:30 UTC)
cron.schedule('30 16 * * *', async () => {
  console.log('🌙 Running evening summary job at 10:00 PM IST');
  try {
    await sendEveningSummary();
  } catch (error) {
    console.error('❌ Evening summary job failed:', error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Gemini AI Integration Functions
async function sendMorningMessage() {
  try {
    console.log('🤖 Generating morning message with Gemini AI...');
    
    // Get the frontend URL from environment or default
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Call the frontend API to generate morning message
    const response = await fetch(`${frontendUrl}/api/ai/morning-message`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Morning message API failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      const morningMessage = data.data.formatted_message;
      console.log('✅ Morning message generated successfully');
      console.log('Message:', morningMessage);
      
      // Here we would send to WhatsApp (will implement with Baileys)
      // For now, just log the message
      
      return { 
        success: true, 
        message: morningMessage,
        userCount: data.data.users_summaries.length,
        missingTasks: data.data.missing_task_users.length
      };
    } else {
      throw new Error('Failed to generate morning message');
    }
  } catch (error) {
    console.error('❌ Error in sendMorningMessage:', error);
    throw error;
  }
}

async function sendEveningSummary() {
  try {
    console.log('🤖 Generating evening summary with Gemini AI...');
    
    // Get the frontend URL from environment or default
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Call the frontend API to generate evening message
    const response = await fetch(`${frontendUrl}/api/ai/evening-message`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Evening message API failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      const eveningMessage = data.data.formatted_message;
      console.log('✅ Evening summary generated successfully');
      console.log('Message:', eveningMessage);
      
      // Here we would send to WhatsApp (will implement with Baileys)
      // For now, just log the message
      
      return { 
        success: true, 
        message: eveningMessage,
        completionRate: data.data.overall_completion_rate,
        userCount: data.data.users_summaries.length
      };
    } else {
      throw new Error('Failed to generate evening summary');
    }
  } catch (error) {
    console.error('❌ Error in sendEveningSummary:', error);
    throw error;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Railway Backend Service running on port ${PORT}`);
  console.log('📱 WhatsApp bot service initialized');
  console.log('⏰ Cron jobs scheduled for 6:00 AM and 10:00 PM IST');
  console.log('🤖 Gemini AI integration ready');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    console.log('HTTP server closed')
  })
});
