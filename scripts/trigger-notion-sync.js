#!/usr/bin/env node

/**
 * Trigger script for Notion sync
 * 
 * This script serves as a bridge to the actual accountability system
 * located in the railway-backend directory.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔄 Triggering Notion sync...');

// Load environment variables from railway-backend directory
require('dotenv').config({ path: path.join(__dirname, '..', 'railway-backend', '.env') });

// Path to the actual accountability system
const backendDir = path.join(__dirname, '..', 'railway-backend');
const scriptPath = path.join(backendDir, 'accountability-system.js');

// Spawn the sync process
const syncProcess = spawn('node', [scriptPath, 'sync'], {
  cwd: backendDir,
  stdio: 'inherit', // This will show the output in the current terminal
  env: process.env   // Pass through all environment variables
});

// Handle process exit
syncProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Notion sync trigger completed successfully');
  } else {
    console.error(`❌ Notion sync trigger failed with code ${code}`);
    process.exit(code);
  }
});

// Handle errors
syncProcess.on('error', (error) => {
  console.error('❌ Error starting sync process:', error);
  process.exit(1);
});
