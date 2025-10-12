#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const GeminiFormatterService = require('./services/gemini-formatter');

async function testGeminiFormatting() {
  console.log('🤖 Testing Gemini 2.0 Flash Integration...');
  console.log('==========================================');
  
  // Check required environment variables
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Missing GEMINI_API_KEY environment variable');
    console.log('📝 Please set your Gemini API key in .env file');
    process.exit(1);
  }
  
  console.log('✅ Gemini API key found');
  console.log('🤖 Model:', process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp');
  console.log('');
  
  try {
    const formatter = new GeminiFormatterService();
    console.log('✅ Gemini formatter service initialized');
    
    // Test morning message formatting
    console.log('🌅 Testing morning message formatting...');
    const mockMorningData = {
      date: new Date().toLocaleDateString('en-IN'),
      users_summaries: [
        {
          user: { name: 'Ilan' },
          tasks: [
            { task_name: 'Complete project documentation', priority: 'high', due_date: '2025-01-15' },
            { task_name: 'Review pull requests', priority: 'medium' },
            { task_name: 'Update deployment scripts' }
          ]
        },
        {
          user: { name: 'Sidra' },
          tasks: [
            { task_name: 'Study for upcoming exam', priority: 'high', due_date: '2025-01-12' },
            { task_name: 'Complete assignment draft', priority: 'medium' }
          ]
        }
      ],
      missing_task_users: []
    };
    
    const morningMessage = await formatter.formatMorningMessage(mockMorningData);
    console.log('📤 Morning message generated:');
    console.log('---');
    console.log(morningMessage);
    console.log('---\n');
    
    // Test evening summary formatting
    console.log('🌙 Testing evening summary formatting...');
    const mockEveningData = {
      date: new Date().toLocaleDateString('en-IN'),
      overall_completion_rate: 75,
      users_summaries: [
        {
          user: { name: 'Ilan' },
          completed_count: 2,
          total_count: 3,
          completion_rate: 67
        },
        {
          user: { name: 'Sidra' },
          completed_count: 2,
          total_count: 2,
          completion_rate: 100
        }
      ]
    };
    
    const eveningMessage = await formatter.formatEveningMessage(mockEveningData);
    console.log('📤 Evening summary generated:');
    console.log('---');
    console.log(eveningMessage);
    console.log('---\n');
    
    // Test task update formatting
    console.log('📝 Testing task update notification...');
    const mockUpdateData = {
      type: 'task_completed',
      user_name: 'Ilan',
      task_name: 'Complete project documentation',
      old_status: 'in_progress',
      new_status: 'done'
    };
    
    const taskUpdate = await formatter.formatTaskUpdateMessage(mockUpdateData);
    console.log('📤 Task update notification generated:');
    console.log('---');
    console.log(taskUpdate);
    console.log('---\n');
    
    console.log('🎉 All Gemini 2.0 Flash tests completed successfully!');
    console.log('✅ The AI formatter is working correctly with the new model');
    
  } catch (error) {
    console.error('❌ Gemini test failed:');
    console.error(error);
    
    if (error.message.includes('API key')) {
      console.log('');
      console.log('💡 Possible issues:');
      console.log('   - Invalid or expired Gemini API key');
      console.log('   - API key doesn\'t have access to the requested model');
      console.log('   - Check your Google AI Studio settings');
    }
    
    if (error.message.includes('quota')) {
      console.log('');
      console.log('💡 API quota exceeded - try again later or check your limits');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the test
testGeminiFormatting();
