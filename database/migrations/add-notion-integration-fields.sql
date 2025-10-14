-- Migration: Add Notion Integration Fields to Users Table
-- Description: Add columns to store Notion access token, workspace info, and database ID

-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS notion_access_token TEXT,
ADD COLUMN IF NOT EXISTS notion_workspace_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS notion_workspace_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS notion_task_database_id VARCHAR(100);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_workspace_id ON users(notion_workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_database_id ON users(notion_task_database_id);

-- Add comments for documentation
COMMENT ON COLUMN users.notion_access_token IS 'Encrypted access token for Notion API integration';
COMMENT ON COLUMN users.notion_workspace_id IS 'Notion workspace ID where user authenticated';
COMMENT ON COLUMN users.notion_workspace_name IS 'Human-readable name of the Notion workspace';
COMMENT ON COLUMN users.notion_task_database_id IS 'Notion database ID used for task management';

-- Update RLS policies if needed (they should still work with the existing notion_id)
