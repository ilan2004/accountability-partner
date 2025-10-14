#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function checkSidra() {
  console.log('🔍 Checking if Sidra is in the database...');
  console.log('=========================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');
      
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`👥 Total users in database: ${users?.length || 0}\n`);
    
    // Show all users
    console.log('📋 All users:');
    users?.forEach(user => {
      console.log(`   🧑‍💼 ID: ${user.id}`);
      console.log(`      Name: ${user.name}`);
      console.log(`      Notion ID: ${user.notion_id}`);
      console.log(`      WhatsApp: ${user.whatsapp_number || 'Not set'}`);
      console.log(`      Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });
    
    // Check specifically for Sidra
    const sidraUser = users?.find(user => 
      user.name.toLowerCase().includes('sidra')
    );
    
    if (sidraUser) {
      console.log('✅ FOUND: Sidra is in the database!');
      console.log(`   Name: ${sidraUser.name}`);
      console.log(`   ID: ${sidraUser.id}`);
      console.log(`   Notion ID: ${sidraUser.notion_id}`);
      console.log(`   WhatsApp: ${sidraUser.whatsapp_number || 'Not set'}`);
    } else {
      console.log('❌ NOT FOUND: No user named "Sidra" in the database');
    }
    
    // Also check for partial matches
    const partialMatches = users?.filter(user => 
      user.name.toLowerCase().includes('sidra') ||
      user.name.toLowerCase().includes('sidr')
    );
    
    if (partialMatches?.length > 0) {
      console.log('\n🔍 Partial name matches:');
      partialMatches.forEach(user => {
        console.log(`   - ${user.name} (ID: ${user.id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

// Run the check
checkSidra();
