-- ============================================================================
-- Fix TaskEvent Table Schema - Add Missing updatedAt Column
-- ============================================================================

-- Check current TaskEvent table structure
\d "TaskEvent";

-- Add missing updatedAt column if it doesn't exist
ALTER TABLE "TaskEvent" 
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Also add createdAt if missing
ALTER TABLE "TaskEvent" 
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Update any existing records to have proper timestamps
UPDATE "TaskEvent" 
SET "updatedAt" = "createdAt" 
WHERE "updatedAt" IS NULL AND "createdAt" IS NOT NULL;

-- Verify the table structure after changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'TaskEvent' 
ORDER BY ordinal_position;
