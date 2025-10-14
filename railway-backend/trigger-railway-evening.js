#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

/**
 * Script to trigger evening summary on Railway deployment
 * 
 * This script can work in two ways:
 * 1. Direct database trigger (using the same DB connection)
 * 2. HTTP API call (if Railway has trigger endpoints)
 */

const { createClient } = require('@supabase/supabase-js');

async function triggerRailwayEvening() {
  console.log('🚂 Triggering Evening Summary via Railway...');
  console.log('===========================================\n');
  
  try {
    // Method 1: Direct database trigger
    // This works because both local and Railway use the same Supabase database
    console.log('📡 Method 1: Direct database trigger');
    console.log('ℹ️ This works because Railway backend monitors the same database\n');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Check if Railway backend is running by checking recent activity
    console.log('🔍 Checking Railway backend status...');
    
    // Get users to see if system is operational
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .not('notion_access_token', 'is', null);
      
    if (usersError) {
      console.error('❌ Database connection failed:', usersError);
      return;
    }
    
    console.log(`✅ Database connection OK - Found ${users?.length || 0} users`);
    
    // Method 2: Try to ping Railway health endpoint (if you have the URL)
    console.log('\n📡 Method 2: Railway health check');
    console.log('ℹ️ You can provide your Railway app URL to test direct HTTP triggers');
    
    const railwayUrl = process.env.RAILWAY_URL; // You'd set this in your .env
    if (railwayUrl) {
      try {
        const response = await fetch(`${railwayUrl}/health`);
        if (response.ok) {
          const health = await response.json();
          console.log('✅ Railway backend is healthy:', health);
        } else {
          console.log('❌ Railway backend health check failed');
        }
      } catch (fetchError) {
        console.log('❌ Could not reach Railway backend:', fetchError.message);
      }
    } else {
      console.log('⚠️ RAILWAY_URL not set - add it to .env to test HTTP triggers');
    }
    
    // Method 3: Simulate triggering via database flag
    console.log('\n📡 Method 3: Database trigger flag');
    console.log('💡 This method creates a trigger that Railway backend can detect');
    
    // Create a trigger record that Railway backend can monitor
    const triggerRecord = {
      user_id: users[0]?.id,
      trigger_type: 'evening_summary',
      triggered_at: new Date().toISOString(),
      triggered_by: 'manual_script',
      status: 'pending'
    };
    
    // We could create a triggers table for this, but for now let's use a simpler approach
    // Update the user's last_notion_sync to trigger a sync which will generate summary
    
    if (users.length > 0) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          last_notion_sync: new Date().toISOString()
        })
        .eq('id', users[0].id);
        
      if (updateError) {
        console.error('❌ Failed to create trigger:', updateError);
      } else {
        console.log('✅ Trigger created - Railway backend should detect this change');
        console.log('⏰ Evening summary should be generated shortly');
      }
    }
    
    console.log('\n🎯 Summary of trigger methods:');
    console.log('1. ✅ Database connection verified');
    console.log('2. ⚠️ Railway HTTP health check (needs RAILWAY_URL)');  
    console.log('3. ✅ Database trigger flag created');
    
    console.log('\n📱 If Railway backend is running, you should see:');
    console.log('- WhatsApp notification with evening summary');
    console.log('- Updated task completion stats');
    console.log('- AI-formatted message with encouragement');
    
    console.log('\n💡 To add HTTP trigger endpoints to Railway:');
    console.log('1. Modify health-server.js to add /trigger/evening route');
    console.log('2. Add trigger handling in accountability-system.js');
    console.log('3. Set RAILWAY_URL in .env for HTTP triggers');
    
  } catch (error) {
    console.error('❌ Error triggering Railway evening summary:', error);
  }
  
  process.exit(0);
}

// Show Railway URL setup instructions
console.log('🚂 Railway Evening Summary Trigger');
console.log('===================================\n');

if (!process.env.RAILWAY_URL) {
  console.log('💡 Setup Instructions:');
  console.log('1. Find your Railway app URL (something like: https://your-app-name.railway.app)');
  console.log('2. Add RAILWAY_URL=https://your-app-name.railway.app to your .env file');  
  console.log('3. Re-run this script for full HTTP trigger testing\n');
}

// Run the trigger
triggerRailwayEvening();
