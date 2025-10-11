-- ============================================================================
-- Fix Notification Table updatedAt Column - Add Default Value
-- ============================================================================

-- Add default value to updatedAt column
ALTER TABLE "Notification" 
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Update any existing records with null updatedAt
UPDATE "Notification" 
SET "updatedAt" = "createdAt" 
WHERE "updatedAt" IS NULL;

-- Verify the fix
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'Notification' AND column_name = 'updatedAt';
