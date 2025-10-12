#!/usr/bin/env node

/**
 * Database Migration Runner
 * Adds notion_id column to tasks table
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔄 Running database migration...');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('📝 Database Migration Required!');
  console.log('\n🔴 The tasks table is missing the notion_id column.');
  console.log('ℹ️  You need to run this SQL manually in Supabase SQL Editor:\n');
  
  console.log('\x1b[33m' + '='.repeat(60) + '\x1b[0m');
  console.log('\x1b[36m');
  console.log('ALTER TABLE tasks ');
  console.log('ADD COLUMN IF NOT EXISTS notion_id VARCHAR(100) UNIQUE;');
  console.log('');
  console.log('CREATE INDEX IF NOT EXISTS idx_tasks_notion_id ON tasks(notion_id);');
  console.log('');
  console.log("COMMENT ON COLUMN tasks.notion_id IS 'Notion database entry ID for syncing with Notion';");
  console.log('\x1b[0m');
  console.log('\x1b[33m' + '='.repeat(60) + '\x1b[0m');
  
  console.log('\n🌐 Steps:');
  console.log('1. Go to: \x1b[34mhttps://supabase.com/dashboard/project/tgdsoavhplrurbbexfvm/sql/new\x1b[0m');
  console.log('2. Copy and paste the SQL above');
  console.log('3. Click "Run"');
  console.log('4. Run your notion sync again');
  
  console.log('\n✅ After running the migration, your tasks will sync properly!');
}

// Run the migration
runMigration();
