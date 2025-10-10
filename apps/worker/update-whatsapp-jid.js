const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgdsoavhplrurbbexfvm.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZHNvYXZocGxydXJiYmV4ZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNzAzMzIsImV4cCI6MjA3NTY0NjMzMn0.PA48PBRGk1OH0alVkvamfTupJ1KjqnxF7MNB1YdemV4';
const pairId = process.env.PAIR_ID || 'cmgkeu00h0003v0lg1vkfcw3u';
const whatsappGroupJid = '120363421579500257@g.us';

async function updateWhatsAppJid() {
  console.log('Updating WhatsApp Group JID in Settings...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Check if settings exist for this pair
    const { data: existingSettings, error: fetchError } = await supabase
      .from('Settings')
      .select('*')
      .eq('pairId', pairId)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }
    
    if (existingSettings) {
      // Update existing settings
      const { data, error } = await supabase
        .from('Settings')
        .update({ 
          whatsappGroupJid: whatsappGroupJid,
          updatedAt: new Date().toISOString()
        })
        .eq('pairId', pairId)
        .select();
      
      if (error) throw error;
      console.log('✅ Updated WhatsApp Group JID:', data);
    } else {
      // Create new settings
      const { data, error } = await supabase
        .from('Settings')
        .insert({
          id: crypto.randomUUID(),
          pairId: pairId,
          whatsappGroupJid: whatsappGroupJid,
          timezone: 'Asia/Kolkata',
          warningTime: '20:00',
          summaryTime: '23:55',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select();
      
      if (error) throw error;
      console.log('✅ Created new Settings with WhatsApp Group JID:', data);
    }
    
    console.log('\nWhatsApp Group JID has been set to:', whatsappGroupJid);
    console.log('Group Name: Accountability partner');
    
  } catch (error) {
    console.error('❌ Error updating settings:', error);
  }
}

updateWhatsAppJid();
