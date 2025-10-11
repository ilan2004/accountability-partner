-- ============================================================================
-- Fix Notification Table Schema - Add Missing id Column with UUID Generation
-- ============================================================================

-- Check current Notification table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'Notification' 
ORDER BY ordinal_position;

-- Drop the id column if it exists (to recreate with proper default)
ALTER TABLE "Notification" DROP COLUMN IF EXISTS id;

-- Add id column with UUID default
ALTER TABLE "Notification" 
ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- Add missing timestamp columns if they don't exist
ALTER TABLE "Notification" 
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "Notification" 
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Verify the table structure after changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'Notification' 
ORDER BY ordinal_position;
