
UPDATE "User" 
SET "pairAsUser1Id" = 'cmgkeu00h0003v0lg1vkfcw3u-fixed' 
WHERE "id" IN (
  SELECT DISTINCT "ownerId" 
  FROM "TaskMirror" 
  WHERE "ownerId" NOT IN (
    SELECT "user1Id" FROM "Pair" WHERE "id" = 'cmgkeu00h0003v0lg1vkfcw3u-fixed'
    UNION 
    SELECT "user2Id" FROM "Pair" WHERE "id" = 'cmgkeu00h0003v0lg1vkfcw3u-fixed'
  )
) 
AND "pairAsUser1Id" IS NULL 
AND "pairAsUser2Id" IS NULL;
  