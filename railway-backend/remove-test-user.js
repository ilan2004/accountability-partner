#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function removeTestUser() {
  console.log('🗑️ Removing test user from database...');
  console.log('=====================================\n');
  
  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    const testUserId = 'e351c86e-9951-4902-ab9e-de704497be55';
    
    console.log('🔍 Looking for user with notion_id:', testUserId);
    
    // Find the user first
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('notion_id', testUserId)
      .single();
      
    if (findError || !user) {
      console.log('❌ User not found or error:', findError?.message);
      return;
    }
    
    console.log('👤 Found user:');
    console.log('   ID:', user.id);
    console.log('   Name:', user.name);
    console.log('   Notion ID:', user.notion_id);
    
    // Delete the user (CASCADE will handle settings and tasks)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id);
      
    if (deleteError) {
      console.error('❌ Error deleting user:', deleteError);
      return;
    }
    
    console.log('✅ User deleted successfully!');
    console.log('📝 Settings and tasks were also deleted due to CASCADE');
    console.log('\n🧪 You can now test fresh authentication!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
  
  process.exit(0);
}

// Run the script
removeTestUser();
