import { config } from 'dotenv';
import { join } from 'path';
import { SupabaseWorkerHelpers, supabase } from '../lib/supabase';
import pino from 'pino';

// Load environment variables from root
config({ path: join(__dirname, '../../../../.env') });

const logger = pino({ name: 'fix-user-matching' });

async function fixUserMatching() {
  logger.info('🔧 Attempting to fix user matching...');
  
  try {
    const pairId = process.env.PAIR_ID;
    if (!pairId) {
      logger.error('❌ PAIR_ID not found in environment variables');
      return;
    }
    
    // Get the pair and users
    const pair = await SupabaseWorkerHelpers.getPairWithUsers(pairId);
    if (!pair) {
      logger.error('❌ No pair found');
      return;
    }
    
    logger.info(`👥 Found pair with users:`);
    logger.info(`  User 1: "${pair.user1.name}" (Notion ID: ${pair.user1.notionId || 'None'})`);
    logger.info(`  User 2: "${pair.user2.name}" (Notion ID: ${pair.user2.notionId || 'None'})`);
    
    // Look for recent tasks that couldn't be matched
    const { data: unlinkedTasks, error } = await supabase
      .from('TaskMirror')
      .select('*')
      .is('ownerId', null)
      .order('createdAt', { ascending: false })
      .limit(10);
    
    if (error) {
      logger.error('Error fetching unlinked tasks:', error);
      return;
    }
    
    logger.info(`📋 Found ${unlinkedTasks?.length || 0} unlinked tasks`);
    
    // For the user "ilan usman", let's try to find a match
    const users = [pair.user1, pair.user2];
    const targetNames = ['ilan usman', 'ilan', 'usman'];
    
    for (const user of users) {
      const userName = user.name?.toLowerCase() || '';
      for (const targetName of targetNames) {
        if (userName.includes(targetName) || targetName.includes(userName)) {
          logger.info(`🎯 Potential match found: "${user.name}" could be the owner of tasks assigned to "ilan usman"`);
          
          // Let's create a Notion ID mapping if we can find the Notion person ID
          // This would need to be done by checking recent tasks from Notion
          break;
        }
      }
    }
    
    logger.info('✅ User matching analysis complete');
    logger.info('💡 Next steps:');
    logger.info('1. Check your Notion database for the exact assignee name');
    logger.info('2. Make sure the assignee name matches a user in your accountability pair');
    logger.info('3. Or update the user name in your system to match Notion');
    
  } catch (error) {
    logger.error('❌ Error:', error);
  }
}

fixUserMatching();
