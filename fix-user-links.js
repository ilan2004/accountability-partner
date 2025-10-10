#!/usr/bin/env node

/**
 * Fix script to link task owners to the correct pair
 * This ensures notifications can find the correct events
 */

console.log('=== Fixing User-Pair Links for Notifications ===');

const { execSync } = require('child_process');

const pairId = process.env.PAIR_ID;

console.log('PAIR_ID:', pairId);

if (!pairId) {
  console.error('❌ Missing PAIR_ID environment variable');
  process.exit(1);
}

try {
  // Create a simple fix by updating all users who own tasks to be linked to this pair
  // Since this is a single-user accountability bot, we can link all task owners to user1
  
  console.log('\n1. Finding users who own tasks but are not linked to any pair...');
  
  const updateSql = `
UPDATE "User" 
SET "pairAsUser1Id" = '${pairId}' 
WHERE "id" IN (
  SELECT DISTINCT "ownerId" 
  FROM "TaskMirror" 
  WHERE "ownerId" NOT IN (
    SELECT "user1Id" FROM "Pair" WHERE "id" = '${pairId}'
    UNION 
    SELECT "user2Id" FROM "Pair" WHERE "id" = '${pairId}'
  )
) 
AND "pairAsUser1Id" IS NULL 
AND "pairAsUser2Id" IS NULL;
  `;

  console.log('SQL Update Query:');
  console.log(updateSql);
  
  // Create temp file for the SQL
  const fs = require('fs');
  const tempFile = 'temp-update.sql';
  fs.writeFileSync(tempFile, updateSql);
  
  console.log('\n2. Executing update...');
  const result = execSync(`railway run npx prisma db execute --schema packages/db/prisma/schema.prisma --file ${tempFile}`, {
    encoding: 'utf8'
  });
  console.log('Update result:', result);
  
  // Clean up temp file
  fs.unlinkSync(tempFile);
  
  console.log('\n✅ User-Pair links updated successfully!');
  console.log('Task owners should now be properly linked to the pair.');
  console.log('Notifications should start working within 5 seconds.');

} catch (error) {
  console.error('❌ Failed to update user links:', error.message);
  process.exit(1);
}

console.log('\n=== Fix Complete ===');
