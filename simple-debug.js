#!/usr/bin/env node

/**
 * Simple debug script to check database state
 */

const { execSync } = require('child_process');

console.log('=== Simple Database Debug ===');

function runQuery(description, sql) {
  console.log(`\n${description}:`);
  console.log('SQL:', sql);
  try {
    const result = execSync(`railway run -- bash -c 'echo "${sql}" | npx prisma db execute --stdin'`, {
      encoding: 'utf8',
      timeout: 10000
    });
    console.log('Result:', result);
  } catch (error) {
    console.log('Error:', error.message);
  }
}

// Simple count queries
runQuery('Count TaskEvents', 'SELECT COUNT(*) FROM "TaskEvent";');
runQuery('Count unprocessed TaskEvents', 'SELECT COUNT(*) FROM "TaskEvent" WHERE "processedAt" IS NULL;');
runQuery('Count Pairs', 'SELECT COUNT(*) FROM "Pair";');
runQuery('Count Settings', 'SELECT COUNT(*) FROM "Settings";');
runQuery('Count Users', 'SELECT COUNT(*) FROM "User";');

console.log('\n=== Debug Complete ===');
