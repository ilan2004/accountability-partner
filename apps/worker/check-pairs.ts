#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tgdsoavhplrurbbexfvm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZHNvYXZocGxydXJiYmV4ZnZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA3MDMzMiwiZXhwIjoyMDc1NjQ2MzMyfQ.rmRT5PabcmucI2LSSf6fdDk19eO73nLmSSWsrw9TWaI';

async function checkPairs() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('Checking existing pairs in database...\n');
  
  // Check pairs
  const { data: pairs, error: pairsError } = await supabase
    .from('Pair')
    .select('*');
  
  if (pairsError) {
    console.error('Error fetching pairs:', pairsError);
    return;
  }
  
  console.log(`Found ${pairs?.length || 0} pairs:`);
  pairs?.forEach(pair => {
    console.log(`\n- ID: ${pair.id}`);
    console.log(`  Active: ${pair.isActive}`);
    console.log(`  User1: ${pair.user1Id}`);
    console.log(`  User2: ${pair.user2Id}`);
  });
  
  // Check settings
  const { data: settings, error: settingsError } = await supabase
    .from('Settings')
    .select('*');
  
  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
    return;
  }
  
  console.log(`\n\nFound ${settings?.length || 0} settings:`);
  settings?.forEach(setting => {
    console.log(`\n- Pair ID: ${setting.pairId}`);
    console.log(`  WhatsApp JID: ${setting.whatsappGroupJid || 'Not set'}`);
    console.log(`  Timezone: ${setting.timezone}`);
  });
}

checkPairs();
