#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment from root .env
dotenv.config({ path: '../../.env' });

const supabaseUrl = 'https://tgdsoavhplrurbbexfvm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZHNvYXZocGxydXJiYmV4ZnZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA3MDMzMiwiZXhwIjoyMDc1NjQ2MzMyfQ.rmRT5PabcmucI2LSSf6fdDk19eO73nLmSSWsrw9TWaI';
const pairId = 'cmgkeu00h0003v0lg1vkfcw3u-fixed';
const whatsappGroupJid = '120363421579500257@g.us';

async function updateWhatsAppJid() {
  console.log('Updating WhatsApp Group JID in Settings...');
  
  // Use service role key to bypass RLS
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
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
    
    const now = new Date().toISOString();
    
    if (existingSettings) {
      // Update existing settings
      const { data, error } = await supabase
        .from('Settings')
        .update({ 
          whatsappGroupJid: whatsappGroupJid,
          updatedAt: now
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
          id: uuidv4(),
          pairId: pairId,
          whatsappGroupJid: whatsappGroupJid,
          timezone: 'Asia/Kolkata',
          warningTime: '20:00',
          summaryTime: '23:55',
          createdAt: now,
          updatedAt: now
        })
        .select();
      
      if (error) throw error;
      console.log('✅ Created new Settings with WhatsApp Group JID:', data);
    }
    
    console.log('\nWhatsApp Group JID has been set to:', whatsappGroupJid);
    console.log('Group Name: Accountability partner');
    console.log('Pair ID:', pairId);
    
  } catch (error) {
    console.error('❌ Error updating settings:', error);
  }
}

updateWhatsAppJid();
