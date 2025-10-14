#!/usr/bin/env node

// Load environment variables
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');

async function runNotionMigration() {
  console.log('🔄 Running Notion integration migration...');
  console.log('=======================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add-notion-integration-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL:');
    console.log('================');
    console.log(migrationSQL);
    console.log('================\n');
    
    // Execute the migration
    console.log('⚡ Executing migration...');
    const { data, error } = await supabase.rpc('exec', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      
      // If RPC doesn't work, suggest manual execution
      console.log('\n📝 Please run this migration manually in Supabase SQL Editor:');
      console.log('1. Go to your Supabase dashboard > SQL Editor');
      console.log('2. Copy and paste the SQL above');
      console.log('3. Click "Run"');
      return;
    }
    
    console.log('✅ Migration executed successfully!');
    
    // Verify the new columns exist
    console.log('\n🔍 Verifying new columns...');
    const { data: columns, error: columnsError } = await supabase
      .from('users')
      .select('notion_access_token, notion_workspace_id, notion_workspace_name, notion_task_database_id')
      .limit(0);
      
    if (columnsError) {
      console.log('❌ Could not verify columns:', columnsError.message);
    } else {
      console.log('✅ New columns verified successfully!');
      console.log('   - notion_access_token');
      console.log('   - notion_workspace_id'); 
      console.log('   - notion_workspace_name');
      console.log('   - notion_task_database_id');
    }
    
    console.log('\n🎉 Migration complete! You can now store Notion integration data.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    
    // Fallback: show manual instructions
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add-notion-integration-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\n📝 Please run this migration manually in Supabase SQL Editor:');
    console.log('======================================================');
    console.log(migrationSQL);
    console.log('======================================================');
  }
  
  process.exit(0);
}

// Run the migration
runNotionMigration();
