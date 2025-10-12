-- Migration: Add notion_id column to tasks table
-- This allows syncing tasks with Notion database entries

-- Add notion_id column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS notion_id VARCHAR(100) UNIQUE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_notion_id ON tasks(notion_id);

-- Add comment
COMMENT ON COLUMN tasks.notion_id IS 'Notion database entry ID for syncing with Notion';

-- Grant necessary permissions if needed
-- You may need to run this in Supabase SQL Editor
SELECT 'Migration completed: Added notion_id column to tasks table';
