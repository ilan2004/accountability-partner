-- Delete all failed notifications to start fresh
-- This will stop the endless retry loop that's wasting credits

DELETE FROM "Notification" WHERE status = 'failed';

-- Reset task events so they can be reprocessed if needed
UPDATE "TaskEvent" SET "processedAt" = NULL WHERE "processedAt" IS NOT NULL;
