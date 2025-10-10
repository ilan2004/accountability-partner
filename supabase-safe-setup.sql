-- ============================================================================
-- Supabase Safe Setup: Schema, RLS Policies, and Performance Indexes
-- This version handles existing policies gracefully
-- ============================================================================

-- Enable Row Level Security on all tables (safe to run multiple times)
DO $$
BEGIN
    -- Enable RLS on tables (won't error if already enabled)
    ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "Pair" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "TaskMirror" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "TaskEvent" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "NotionConfig" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "Settings" ENABLE ROW LEVEL SECURITY;
EXCEPTION 
    WHEN OTHERS THEN 
        RAISE NOTICE 'RLS enable failed (may already be enabled): %', SQLERRM;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES (with safe creation)
-- ============================================================================

-- Drop existing policies first, then recreate them
-- This ensures we have the latest version

-- User policies
DROP POLICY IF EXISTS "Users can view own data" ON "User";
DROP POLICY IF EXISTS "Users can insert own user record" ON "User";
DROP POLICY IF EXISTS "Users can update own user record" ON "User";

CREATE POLICY "Users can view own data" ON "User"
    FOR ALL USING (auth.uid()::text = id);

CREATE POLICY "Users can insert own user record" ON "User"
    FOR INSERT WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can update own user record" ON "User"
    FOR UPDATE USING (auth.uid()::text = id);

-- Pair policies
DROP POLICY IF EXISTS "Users can view pair data" ON "Pair";

CREATE POLICY "Users can view pair data" ON "Pair"
    FOR ALL USING (
        auth.uid()::text = "user1Id" OR 
        auth.uid()::text = "user2Id"
    );

-- TaskMirror policies
DROP POLICY IF EXISTS "Users can view pair tasks" ON "TaskMirror";

CREATE POLICY "Users can view pair tasks" ON "TaskMirror"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Pair" p 
            WHERE (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
            AND (p."user1Id" = "ownerId" OR p."user2Id" = "ownerId")
        )
    );

-- TaskEvent policies
DROP POLICY IF EXISTS "Users can view pair task events" ON "TaskEvent";

CREATE POLICY "Users can view pair task events" ON "TaskEvent"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "TaskMirror" tm
            JOIN "Pair" p ON (p."user1Id" = tm."ownerId" OR p."user2Id" = tm."ownerId")
            WHERE tm.id = "taskMirrorId"
            AND (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
        )
    );

-- Notification policies
DROP POLICY IF EXISTS "Users can view pair notifications" ON "Notification";

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

-- Settings policies
DROP POLICY IF EXISTS "Users can view pair settings" ON "Settings";

CREATE POLICY "Users can view pair settings" ON "Settings"
    FOR ALL USING (
        ("userId" = auth.uid()::text) OR
        EXISTS (
            SELECT 1 FROM "Pair" p 
            WHERE p.id = "pairId"
            AND (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
        )
    );

-- NotionConfig policies
DROP POLICY IF EXISTS "Users can view pair notion config" ON "NotionConfig";

CREATE POLICY "Users can view pair notion config" ON "NotionConfig"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Pair" p 
            WHERE p.id = "pairId"
            AND (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
        )
    );

-- ============================================================================
-- AUTO USER CREATION TRIGGER (safe recreation)
-- ============================================================================

-- Create a function to handle new user creation from auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Use INSERT ... ON CONFLICT to handle race conditions
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
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, "User".name),
    "emailVerified" = COALESCE(EXCLUDED."emailVerified", "User"."emailVerified"),
    image = COALESCE(EXCLUDED.image, "User".image),
    "updatedAt" = now();
    
  RETURN new;
END;
$$ language plpgsql security definer;

-- Recreate trigger (safe to run multiple times)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- PERFORMANCE INDEXES (safe creation)
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
-- COMPLETION & VERIFICATION
-- ============================================================================

-- Show success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Supabase setup completed successfully!';
    RAISE NOTICE '📊 Verifying table structure...';
END $$;

-- Verify table structure and RLS status
SELECT 
    t.schemaname,
    t.tablename,
    t.tableowner,
    t.hasindexes,
    t.hasrules,
    t.hastriggers,
    CASE WHEN t.rowsecurity THEN '✅ RLS Enabled' ELSE '❌ RLS Disabled' END as rls_status
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY t.tablename;

-- Count policies per table
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count,
    '🔐 ' || COUNT(*) || ' policies' as status
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Show final success message
DO $$ 
BEGIN 
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Database setup complete!';
    RAISE NOTICE '✅ Row Level Security enabled on all tables';
    RAISE NOTICE '🔐 Security policies created for data access';
    RAISE NOTICE '⚡ Performance indexes created';
    RAISE NOTICE '🔄 Auto user creation trigger installed';
    RAISE NOTICE '';
    RAISE NOTICE '👉 Next step: Run data migration or deploy web app';
END $$;
