#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function checkDatabaseSchema() {
  console.log('🔍 Checking database schema and setup...');
  console.log('==========================================\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    console.log('🔗 Database URL:', process.env.SUPABASE_URL);
    console.log('🔑 Service Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('');
    
    // Check if tables exist by trying to query them
    console.log('📋 Checking if tables exist...');
    
    // Check users table
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true });
      
      if (usersError) {
        console.log('❌ users table: ERROR -', usersError.message);
      } else {
        console.log('✅ users table: EXISTS (count:', users || 0, ')');
      }
    } catch (e) {
      console.log('❌ users table: NOT ACCESSIBLE -', e.message);
    }
    
    // Check tasks table
    try {
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('count', { count: 'exact', head: true });
      
      if (tasksError) {
        console.log('❌ tasks table: ERROR -', tasksError.message);
      } else {
        console.log('✅ tasks table: EXISTS (count:', tasks || 0, ')');
      }
    } catch (e) {
      console.log('❌ tasks table: NOT ACCESSIBLE -', e.message);
    }
    
    // Check settings table
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('count', { count: 'exact', head: true });
      
      if (settingsError) {
        console.log('❌ settings table: ERROR -', settingsError.message);
      } else {
        console.log('✅ settings table: EXISTS (count:', settings || 0, ')');
      }
    } catch (e) {
      console.log('❌ settings table: NOT ACCESSIBLE -', e.message);
    }
    
    console.log('\n🔒 Checking Row Level Security (RLS)...');
    
    // Try to get actual data to test RLS
    try {
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('*')
        .limit(1);
        
      if (userDataError) {
        console.log('❌ RLS/Permissions issue on users:', userDataError.message);
      } else {
        console.log('✅ Can query users table successfully');
      }
    } catch (e) {
      console.log('❌ Cannot query users:', e.message);
    }
    
    console.log('\n🔧 Suggested fixes:');
    console.log('1. If tables don\'t exist: Run the schema.sql file in Supabase SQL Editor');
    console.log('2. If RLS errors: Check/disable RLS policies for service_role');
    console.log('3. If permission errors: Verify service_role key is correct');
    
  } catch (error) {
    console.error('❌ Connection Error:', error);
  }
  
  process.exit(0);
}

// Run the check
checkDatabaseSchema();
