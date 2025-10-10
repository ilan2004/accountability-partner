-- Enable Row Level Security on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pair" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskMirror" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotionConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Settings" ENABLE ROW LEVEL SECURITY;

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

-- Allow authenticated users to insert their own user record (for manual creation)
CREATE POLICY "Users can insert own user record" ON "User"
    FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Allow users to update their own record
CREATE POLICY "Users can update own user record" ON "User"
    FOR UPDATE USING (auth.uid()::text = id);
