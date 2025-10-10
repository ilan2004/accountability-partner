#!/usr/bin/env node

/**
 * Debug script to check why notifications aren't being processed
 */

console.log('=== Debugging Notification Service ===');

const { execSync } = require('child_process');

const pairId = process.env.PAIR_ID;
const groupJid = process.env.WA_GROUP_JID;

console.log('PAIR_ID:', pairId);
console.log('WA_GROUP_JID:', groupJid);

if (!pairId) {
  console.error('❌ Missing PAIR_ID environment variable');
  process.exit(1);
}

console.log('\n=== Checking Database Structure ===');

try {
  // Check if there are unprocessed task events
  console.log('1. Checking unprocessed TaskEvents...');
  const eventsQuery = `
SELECT 
  te.id, 
  te.eventType, 
  te.processedAt, 
  te.createdAt,
  tm.title as taskTitle,
  u.name as ownerName,
  u.id as ownerId
FROM "TaskEvent" te 
JOIN "TaskMirror" tm ON te."taskMirrorId" = tm.id 
JOIN "User" u ON tm."ownerId" = u.id 
WHERE te."processedAt" IS NULL 
ORDER BY te."createdAt" DESC 
LIMIT 10;
  `;
  
  console.log('SQL Query:');
  console.log(eventsQuery);
  
  const eventsResult = execSync(`echo "${eventsQuery}" | railway run npx prisma db execute --stdin`, {
    encoding: 'utf8'
  });
  console.log('Unprocessed Events:', eventsResult);

  // Check pair structure
  console.log('\n2. Checking Pair structure...');
  const pairQuery = `
SELECT 
  p.id, 
  p."user1Id", 
  p."user2Id",
  u1.name as user1Name,
  u2.name as user2Name
FROM "Pair" p
LEFT JOIN "User" u1 ON p."user1Id" = u1.id
LEFT JOIN "User" u2 ON p."user2Id" = u2.id
WHERE p.id = '${pairId}';
  `;
  
  const pairResult = execSync(`echo "${pairQuery}" | railway run npx prisma db execute --stdin`, {
    encoding: 'utf8'
  });
  console.log('Pair Info:', pairResult);

  // Check Settings
  console.log('\n3. Checking Settings...');
  const settingsQuery = `
SELECT * FROM "Settings" WHERE "pairId" = '${pairId}';
  `;
  
  const settingsResult = execSync(`echo "${settingsQuery}" | railway run npx prisma db execute --stdin`, {
    encoding: 'utf8'
  });
  console.log('Settings:', settingsResult);

  // Check if users in pair own any tasks
  console.log('\n4. Checking TaskMirror ownership...');
  const ownershipQuery = `
SELECT 
  tm.id,
  tm.title,
  tm."ownerId",
  u.name as ownerName,
  CASE 
    WHEN u."pairAsUser1Id" = '${pairId}' THEN 'user1'
    WHEN u."pairAsUser2Id" = '${pairId}' THEN 'user2'
    ELSE 'not_in_pair'
  END as pairRole
FROM "TaskMirror" tm
JOIN "User" u ON tm."ownerId" = u.id
WHERE u."pairAsUser1Id" = '${pairId}' OR u."pairAsUser2Id" = '${pairId}'
LIMIT 5;
  `;
  
  const ownershipResult = execSync(`echo "${ownershipQuery}" | railway run npx prisma db execute --stdin`, {
    encoding: 'utf8'
  });
  console.log('Task Ownership:', ownershipResult);

} catch (error) {
  console.error('❌ Database query failed:', error.message);
}

console.log('\n=== Debug Complete ===');
