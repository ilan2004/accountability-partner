-- ============================================================================
-- Supabase Complete Setup: Schema, RLS Policies, and Performance Indexes
-- ============================================================================

-- First, ensure the schema exists with all tables
-- (This assumes you've already created the tables via Prisma or direct SQL)

-- Enable Row Level Security on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pair" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskMirror" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotionConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Settings" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Users can only access their own data
CREATE POLICY "Users can view own data" ON "User"
    FOR ALL USING (auth.uid()::text = id);

-- Users can access their pair data
CREATE POLICY "Users can view pair data" ON "Pair"
    FOR ALL USING (
        auth.uid()::text = "user1Id" OR 
        auth.uid()::text = "user2Id"
    );

-- Users can access tasks from their pair
CREATE POLICY "Users can view pair tasks" ON "TaskMirror"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Pair" p 
            WHERE (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
            AND (p."user1Id" = "ownerId" OR p."user2Id" = "ownerId")
        )
    );

-- Users can view task events from their pair's tasks
CREATE POLICY "Users can view pair task events" ON "TaskEvent"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "TaskMirror" tm
            JOIN "Pair" p ON (p."user1Id" = tm."ownerId" OR p."user2Id" = tm."ownerId")
            WHERE tm.id = "taskMirrorId"
            AND (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
        )
    );

-- Users can view notifications from their pair's task events
CREATE POLICY "Users can view pair notifications" ON "Notification"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "TaskEvent" te
            JOIN "TaskMirror" tm ON tm.id = te."taskMirrorId"
            JOIN "Pair" p ON (p."user1Id" = tm."ownerId" OR p."user2Id" = tm."ownerId")
            WHERE te.id = "taskEventId"
            AND (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
        )
    );

-- Users can view pair settings and config
CREATE POLICY "Users can view pair settings" ON "Settings"
    FOR ALL USING (
        ("userId" = auth.uid()::text) OR
        EXISTS (
            SELECT 1 FROM "Pair" p 
            WHERE p.id = "pairId"
            AND (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
        )
    );

CREATE POLICY "Users can view pair notion config" ON "NotionConfig"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Pair" p 
            WHERE p.id = "pairId"
            AND (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
        )
    );

-- Allow authenticated users to insert their own user record (for manual creation)
CREATE POLICY "Users can insert own user record" ON "User"
    FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Allow users to update their own record
CREATE POLICY "Users can update own user record" ON "User"
    FOR UPDATE USING (auth.uid()::text = id);

-- ============================================================================
-- AUTO USER CREATION TRIGGER
-- ============================================================================

-- Create a function to handle new user creation from auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public."User" (id, email, name, "emailVerified", image, "createdAt", "updatedAt")
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    CASE 
      WHEN new.email_confirmed_at IS NOT NULL THEN new.email_confirmed_at
      ELSE NULL
    END,
    new.raw_user_meta_data->>'avatar_url',
    now(),
    now()
  );
  RETURN new;
END;
$$ language plpgsql security definer;

-- Create trigger to automatically create user records
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index for TaskMirror by owner for efficient pair queries
CREATE INDEX IF NOT EXISTS idx_taskmirror_owner ON "TaskMirror"("ownerId");

-- Index for TaskEvent by task for efficient event queries
CREATE INDEX IF NOT EXISTS idx_taskevent_task ON "TaskEvent"("taskMirrorId");

-- Unique index for TaskEvent idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_taskevent_idem ON "TaskEvent"("idempotencyKey");

-- Index for Notification status and created time for worker queries
CREATE INDEX IF NOT EXISTS idx_notification_status ON "Notification"(status, "createdAt");

-- Index for Pair users for efficient pair lookups
CREATE INDEX IF NOT EXISTS idx_pair_users ON "Pair"("user1Id", "user2Id");

-- Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_taskmirror_notion_id ON "TaskMirror"("notionId");
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_settings_pair ON "Settings"("pairId");
CREATE INDEX IF NOT EXISTS idx_notionconfig_pair ON "NotionConfig"("pairId");

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Verify table structure
SELECT schemaname, tablename, tableowner, hasindexes, hasrules, hastriggers
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
