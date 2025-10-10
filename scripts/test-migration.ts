#!/usr/bin/env tsx

/**
 * Test Migration Script
 * 
 * This script tests the migration environment and validates schemas
 * before running the actual migration.
 * 
 * Usage:
 * 1. Set environment variables: RAILWAY_DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 2. Run: npx tsx scripts/test-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface TableInfo {
  name: string;
  exists: boolean;
  count?: number;
}

async function testConnections() {
  console.log('🔍 Testing database connections...\n');

  // Test Railway connection
  const railwayUrl = process.env.RAILWAY_DATABASE_URL;
  if (!railwayUrl) {
    throw new Error('RAILWAY_DATABASE_URL not set');
  }

  const railwayClient = new Client({ connectionString: railwayUrl });
  
  try {
    await railwayClient.connect();
    console.log('✅ Railway connection successful');
    
    // Test a simple query
    const result = await railwayClient.query('SELECT NOW() as current_time');
    console.log(`   Current Railway time: ${result.rows[0].current_time}`);
  } catch (error) {
    console.error('❌ Railway connection failed:', error);
    throw error;
  }

  // Test Supabase connection
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not set');
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { data, error } = await supabaseClient.from('User').select('id').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = table is empty, which is fine
      throw error;
    }
    console.log('✅ Supabase connection successful');
    console.log(`   Supabase URL: ${supabaseUrl}`);
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    throw error;
  }

  await railwayClient.end();
  return { railwayClient, supabaseClient };
}

async function checkSchemas() {
  console.log('\n📋 Checking database schemas...\n');

  const railwayUrl = process.env.RAILWAY_DATABASE_URL!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const railwayClient = new Client({ connectionString: railwayUrl });
  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  await railwayClient.connect();

  const expectedTables = ['User', 'Pair', 'NotionConfig', 'Settings', 'TaskMirror', 'TaskEvent', 'Notification'];
  const railwayTables: TableInfo[] = [];
  const supabaseTables: TableInfo[] = [];

  // Check Railway tables
  console.log('Railway Tables:');
  for (const tableName of expectedTables) {
    try {
      const result = await railwayClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const count = parseInt(result.rows[0].count);
      railwayTables.push({ name: tableName, exists: true, count });
      console.log(`  ✅ ${tableName.padEnd(15)} - ${count} records`);
    } catch (error) {
      railwayTables.push({ name: tableName, exists: false });
      console.log(`  ❌ ${tableName.padEnd(15)} - table not found`);
    }
  }

  // Check Supabase tables
  console.log('\nSupabase Tables:');
  for (const tableName of expectedTables) {
    try {
      const { count, error } = await supabaseClient
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        supabaseTables.push({ name: tableName, exists: false });
        console.log(`  ❌ ${tableName.padEnd(15)} - ${error.message}`);
      } else {
        supabaseTables.push({ name: tableName, exists: true, count: count || 0 });
        console.log(`  ✅ ${tableName.padEnd(15)} - ${count || 0} records`);
      }
    } catch (error) {
      supabaseTables.push({ name: tableName, exists: false });
      console.log(`  ❌ ${tableName.padEnd(15)} - error: ${error}`);
    }
  }

  await railwayClient.end();

  return { railwayTables, supabaseTables };
}

async function checkUserMapping() {
  console.log('\n👥 Checking user mapping potential...\n');

  const railwayUrl = process.env.RAILWAY_DATABASE_URL!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const railwayClient = new Client({ connectionString: railwayUrl });
  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  await railwayClient.connect();

  try {
    // Get Railway users
    const railwayResult = await railwayClient.query('SELECT id, email FROM "User" ORDER BY "createdAt"');
    const railwayUsers = railwayResult.rows;

    console.log(`Railway users: ${railwayUsers.length}`);
    if (railwayUsers.length > 0) {
      console.log('Sample Railway users:');
      railwayUsers.slice(0, 3).forEach(user => {
        console.log(`  - ${user.email} (${user.id})`);
      });
    }

    // Get Supabase auth users
    const { data: authData, error } = await supabaseClient.auth.admin.listUsers();
    if (error) {
      console.error('❌ Error fetching Supabase auth users:', error.message);
      return;
    }

    const supabaseUsers = authData.users;
    console.log(`\nSupabase auth users: ${supabaseUsers.length}`);
    if (supabaseUsers.length > 0) {
      console.log('Sample Supabase users:');
      supabaseUsers.slice(0, 3).forEach(user => {
        console.log(`  - ${user.email} (${user.id})`);
      });
    }

    // Check for email matches
    const matches = [];
    for (const railwayUser of railwayUsers) {
      const supabaseUser = supabaseUsers.find(su => su.email === railwayUser.email);
      if (supabaseUser) {
        matches.push({ railway: railwayUser, supabase: supabaseUser });
      }
    }

    console.log(`\n📊 Email matches found: ${matches.length} out of ${railwayUsers.length} Railway users`);
    if (matches.length > 0) {
      console.log('Sample matches:');
      matches.slice(0, 3).forEach(match => {
        console.log(`  - ${match.railway.email}: ${match.railway.id} → ${match.supabase.id}`);
      });
    }

    if (matches.length < railwayUsers.length) {
      console.log(`\n⚠️  ${railwayUsers.length - matches.length} Railway users have no Supabase auth account`);
      console.log('   These users will need to sign up again, or you can create auth accounts for them');
    }

  } catch (error) {
    console.error('❌ Error checking user mapping:', error);
  }

  await railwayClient.end();
}

async function main() {
  try {
    console.log('🧪 MIGRATION ENVIRONMENT TEST\n');
    console.log('='.repeat(50));

    await testConnections();
    const { railwayTables, supabaseTables } = await checkSchemas();
    await checkUserMapping();

    console.log('\n' + '='.repeat(50));
    console.log('📋 TEST SUMMARY\n');

    // Summary
    const railwayMissing = railwayTables.filter(t => !t.exists);
    const supabaseMissing = supabaseTables.filter(t => !t.exists);

    if (railwayMissing.length === 0 && supabaseMissing.length === 0) {
      console.log('✅ All required tables exist in both databases');
      console.log('✅ Ready for migration!');
    } else {
      if (railwayMissing.length > 0) {
        console.log(`❌ Missing Railway tables: ${railwayMissing.map(t => t.name).join(', ')}`);
      }
      if (supabaseMissing.length > 0) {
        console.log(`❌ Missing Supabase tables: ${supabaseMissing.map(t => t.name).join(', ')}`);
        console.log('   Run the supabase-complete-setup.sql script in your Supabase SQL Editor');
      }
    }

    // Data summary
    const totalRailwayRecords = railwayTables.reduce((sum, t) => sum + (t.count || 0), 0);
    const totalSupabaseRecords = supabaseTables.reduce((sum, t) => sum + (t.count || 0), 0);

    console.log(`\n📊 Data summary:`);
    console.log(`   Railway records: ${totalRailwayRecords}`);
    console.log(`   Supabase records: ${totalSupabaseRecords}`);

    if (totalRailwayRecords === 0) {
      console.log('⚠️  No data to migrate from Railway');
    } else {
      console.log(`🚀 Ready to migrate ${totalRailwayRecords} records`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
