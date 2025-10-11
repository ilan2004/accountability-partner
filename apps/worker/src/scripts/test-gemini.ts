import { config } from 'dotenv';
import { join } from 'path';
import { GeminiService, GeminiMessageContext } from '../services/gemini-service';
import pino from 'pino';

// Load environment variables from root
config({ path: join(__dirname, '../../../../.env') });

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function testGemini() {
  logger.info('🤖 Testing Gemini AI integration...');
  
  const geminiService = new GeminiService();
  
  if (!geminiService.isGeminiEnabled()) {
    logger.warn('❌ Gemini is not enabled. Check your environment variables:');
    logger.warn('   - GEMINI_API_KEY should be set');
    logger.warn('   - USE_GEMINI_MESSAGES should be "true"');
    return;
  }
  
  logger.info('✅ Gemini is enabled and ready');
  
  // Test different message types
  const testCases: GeminiMessageContext[] = [
    {
      originalMessage: "✅ John completed: Fix login bug\nStatus: Done\nPriority: High\nDue: Today\n🔗 https://notion.so/...",
      eventType: 'completed',
      task: {
        title: 'Fix login bug',
        status: 'Done',
        priority: 'High',
        dueDate: 'Today'
      },
      user: { name: 'John' },
      partner: { name: 'Sarah' },
      timeOfDay: 'morning',
      recentActivity: {
        tasksCompletedToday: 2,
        tasksCompletedThisWeek: 8
      }
    },
    {
      originalMessage: "📝 Sarah created: API documentation\nStatus: Not started\nPriority: Medium\nDue: Tomorrow",
      eventType: 'created',
      task: {
        title: 'API documentation',
        status: 'Not started',
        priority: 'Medium',
        dueDate: 'Tomorrow'
      },
      user: { name: 'Sarah' },
      partner: { name: 'John' },
      timeOfDay: 'afternoon',
      recentActivity: {
        tasksCompletedToday: 1,
        tasksCompletedThisWeek: 5
      }
    },
    {
      originalMessage: "📊 John updated: Database optimization\nStatus: Not started → In progress\nPriority: High",
      eventType: 'status_changed',
      task: {
        title: 'Database optimization',
        status: 'In progress',
        priority: 'High'
      },
      user: { name: 'John' },
      partner: { name: 'Sarah' },
      timeOfDay: 'evening',
      recentActivity: {
        tasksCompletedToday: 0,
        tasksCompletedThisWeek: 3
      }
    }
  ];
  
  for (const [index, testCase] of testCases.entries()) {
    logger.info(`\n--- Test ${index + 1}: ${testCase.eventType} ---`);
    logger.info(`Original: ${testCase.originalMessage}`);
    
    try {
      const enhanced = await geminiService.enhanceMessage(testCase);
      logger.info(`Enhanced: ${enhanced}`);
      logger.info(`✅ Success! Message enhanced from ${testCase.originalMessage.length} to ${enhanced.length} characters`);
    } catch (error) {
      logger.error(`❌ Failed to enhance message: ${error}`);
    }
  }
  
  logger.info('\n🎉 Gemini testing completed!');
}

testGemini().catch(error => {
  logger.error(error, '❌ Failed to test Gemini');
  process.exit(1);
});
