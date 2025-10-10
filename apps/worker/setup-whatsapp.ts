import { config } from 'dotenv';
import { join } from 'path';
import { WhatsAppClient } from './src/whatsapp/client';

// Load environment variables from root
config({ path: join(__dirname, '../../.env') });

async function setupWhatsApp() {
  console.log('📱 Setting up WhatsApp with new number...\n');
  
  // Initialize WhatsApp client
  const whatsappClient = new WhatsAppClient({
    sessionName: 'accountability-bot',
    authPath: './auth',
    printQR: true,
  });
  
  console.log('🔄 Connecting to WhatsApp...');
  console.log('📱 Please scan the QR code with your NEW WhatsApp number:\n');
  
  try {
    await whatsappClient.connect();
    
    console.log('\n✅ Connected successfully!');
    console.log('\n📋 Fetching your WhatsApp groups...');
    
    // Get groups
    const groups = await whatsappClient.getGroups();
    
    if (groups.length === 0) {
      console.log('❌ No groups found. Make sure your new number is added to the accountability group.');
      return;
    }
    
    console.log(`\n📱 Found ${groups.length} groups:`);
    console.log('=' .repeat(50));
    
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      console.log(`${i + 1}. ${group.subject || 'Unnamed Group'}`);
      console.log(`   JID: ${group.id}`);
      console.log(`   Participants: ${group.participants.length} members`);
      console.log(`   Members: ${group.participants.join(', ')}`);
      console.log('');
    }
    
    console.log('🔍 Look for your accountability group above.');
    console.log('📝 Copy the JID of your accountability group.');
    console.log('\n⚠️ IMPORTANT: Update your .env file:');
    console.log('WA_GROUP_JID=<paste the correct group JID here>');
    
    await whatsappClient.disconnect();
    
  } catch (error) {
    console.error('❌ Failed to set up WhatsApp:', error);
  }
}

setupWhatsApp();
