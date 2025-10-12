-- Accountability Partner System Database Schema
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create custom types/enums
CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'done');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE effort_level AS ENUM ('low', 'medium', 'high');

-- =============================================
-- TABLES
-- =============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    notion_id VARCHAR(100) UNIQUE NOT NULL,
    whatsapp_number VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    description TEXT,
    status task_status DEFAULT 'not_started' NOT NULL,
    priority priority_level DEFAULT 'medium' NOT NULL,
    effort_level effort_level DEFAULT 'medium' NOT NULL,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    reminder_time TIME DEFAULT '06:00:00' NOT NULL,
    summary_time TIME DEFAULT '22:00:00' NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata' NOT NULL
);

-- =============================================
-- INDEXES
-- =============================================

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_users_notion_id ON users(notion_id);
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_number ON users(whatsapp_number);

-- =============================================
-- TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for tasks table
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default settings for new users
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO settings (user_id, reminder_time, summary_time, timezone)
    VALUES (NEW.id, '06:00:00', '22:00:00', 'Asia/Kolkata');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-create settings for new users
CREATE TRIGGER create_settings_for_new_user AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_user_settings();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid()::text = notion_id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid()::text = notion_id);

CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = notion_id);

-- Tasks policies
CREATE POLICY "Users can view their own tasks" ON tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = tasks.user_id 
            AND users.notion_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own tasks" ON tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = tasks.user_id 
            AND users.notion_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own tasks" ON tasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = tasks.user_id 
            AND users.notion_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete their own tasks" ON tasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = tasks.user_id 
            AND users.notion_id = auth.uid()::text
        )
    );

-- Settings policies
CREATE POLICY "Users can view their own settings" ON settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = settings.user_id 
            AND users.notion_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own settings" ON settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = settings.user_id 
            AND users.notion_id = auth.uid()::text
        )
    );

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to get user by notion_id
CREATE OR REPLACE FUNCTION get_user_by_notion_id(notion_user_id TEXT)
RETURNS users AS $$
    SELECT * FROM users WHERE notion_id = notion_user_id;
$$ LANGUAGE SQL STABLE;

-- Function to get tasks for today
CREATE OR REPLACE FUNCTION get_today_tasks(user_uuid UUID)
RETURNS SETOF tasks AS $$
    SELECT * FROM tasks 
    WHERE user_id = user_uuid 
    AND (due_date = CURRENT_DATE OR due_date IS NULL)
    ORDER BY priority DESC, created_at ASC;
$$ LANGUAGE SQL STABLE;

-- Function to get task completion rate for a user
CREATE OR REPLACE FUNCTION get_completion_rate(user_uuid UUID, target_date DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC AS $$
DECLARE
    total_tasks INTEGER;
    completed_tasks INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_tasks 
    FROM tasks 
    WHERE user_id = user_uuid 
    AND (due_date = target_date OR due_date IS NULL)
    AND created_at::date <= target_date;
    
    SELECT COUNT(*) INTO completed_tasks 
    FROM tasks 
    WHERE user_id = user_uuid 
    AND (due_date = target_date OR due_date IS NULL)
    AND created_at::date <= target_date
    AND status = 'done';
    
    IF total_tasks = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((completed_tasks::NUMERIC / total_tasks::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get daily summary for both users
CREATE OR REPLACE FUNCTION get_daily_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    user_name TEXT,
    user_id UUID,
    total_tasks INTEGER,
    completed_tasks INTEGER,
    completion_rate NUMERIC,
    pending_tasks INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.name,
        u.id,
        COALESCE(task_counts.total, 0)::INTEGER as total_tasks,
        COALESCE(task_counts.completed, 0)::INTEGER as completed_tasks,
        COALESCE(ROUND((task_counts.completed::NUMERIC / NULLIF(task_counts.total, 0)::NUMERIC) * 100, 2), 0) as completion_rate,
        COALESCE(task_counts.total - task_counts.completed, 0)::INTEGER as pending_tasks
    FROM users u
    LEFT JOIN (
        SELECT 
            t.user_id,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE t.status = 'done') as completed
        FROM tasks t
        WHERE (t.due_date = target_date OR t.due_date IS NULL)
        AND t.created_at::date <= target_date
        GROUP BY t.user_id
    ) task_counts ON u.id = task_counts.user_id
    ORDER BY u.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================
-- REAL-TIME SUBSCRIPTIONS
-- =============================================

-- Enable real-time for tasks table (for dashboard updates)
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- =============================================
-- INITIAL DATA (Optional)
-- =============================================

-- Note: You can add initial users here if needed
-- Example:
-- INSERT INTO users (name, notion_id, whatsapp_number) VALUES 
-- ('Ilan', 'your_notion_id_here', '+1234567890'),
-- ('Sidra', 'sidra_notion_id_here', '+0987654321');

-- =============================================
-- GRANTS (for service role access)
-- =============================================

-- Grant necessary permissions for service role operations
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
