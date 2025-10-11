-- Add nextAttemptAt column to Notification table
ALTER TABLE public."Notification"
ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP WITH TIME ZONE;

-- Create index on status and nextAttemptAt for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_status_next_attempt
ON public."Notification" ("status", "nextAttemptAt");

-- Create index on TaskEvent processedAt for efficient filtering
CREATE INDEX IF NOT EXISTS idx_task_event_processed_at
ON public."TaskEvent" ("processedAt");

-- Update existing pending notifications to have nextAttemptAt = now()
-- so they get picked up immediately
UPDATE public."Notification"
SET "nextAttemptAt" = NOW()
WHERE "status" = 'pending' AND "nextAttemptAt" IS NULL;
