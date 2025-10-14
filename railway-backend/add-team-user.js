#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function addTeamUser() {
  console.log('👥 Adding team workspace user to database...');
  console.log('===============================================\n');
  
  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // New user details from the team workspace
    const newUser = {
      notion_id: 'e351c86e-9951-4902-ab9e-de704497be55', // From your error log
      name: 'Ilan Usman',
      whatsapp_number: null // You can add this later
    };
    
    console.log('📝 Creating user:', newUser);
    
    // Insert user directly with service role (bypasses RLS)
    const { data: createdUser, error: userError } = await supabase
      .from('users')
      .insert([newUser])
      .select()
      .single();
      
    if (userError) {
      console.error('❌ Error creating user:', userError);
      return;
    }
    
    console.log('✅ User created successfully!');
    console.log('   ID:', createdUser.id);
    console.log('   Name:', createdUser.name);
    console.log('   Notion ID:', createdUser.notion_id);
    
    // Create default settings for this user
    console.log('\n⚙️ Creating default settings...');
    
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .insert([{
        user_id: createdUser.id,
        reminder_time: '06:00:00',
        summary_time: '22:00:00',
        timezone: 'Asia/Kolkata'
      }])
      .select()
      .single();
      
    if (settingsError) {
      console.error('❌ Error creating settings:', settingsError);
    } else {
      console.log('✅ Settings created successfully!');
    }
    
    console.log('\n🎉 User setup complete! You should now be able to log in.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
  
  process.exit(0);
}

// Run the script
addTeamUser();
