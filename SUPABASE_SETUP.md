# 🚀 Supabase Migration Guide

This guide will help you complete the migration from NextAuth + SQLite to Supabase for the Accountability Partner app.

## ✅ What's Been Completed

- ✅ **Dependencies**: Installed Supabase packages
- ✅ **Schema Migration**: Updated Prisma schema for PostgreSQL with UUID IDs
- ✅ **Auth System**: Replaced NextAuth with Supabase Auth
- ✅ **Components**: Updated Layout, signin page, and auth context
- ✅ **Auth UI**: Integrated Supabase Auth UI with custom styling

## 🎯 Next Steps

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in project details:
   - **Name**: `accountability-partner`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
4. Wait for project setup (2-3 minutes)

### 2. Configure Environment Variables

Update your `.env` file with your Supabase project details:

```bash
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database URL for Prisma
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public"
```

**To get these values:**
- Go to Project Settings → API
- Copy `URL` and `anon public` key
- Copy `service_role` key (keep this secure!)
- Go to Project Settings → Database to get connection string

### 3. Set Up Database Schema

```bash
# Navigate to database package
cd packages/db

# Generate Prisma client for PostgreSQL
pnpm run db:generate

# Push schema to Supabase
pnpm run db:push
```

### 4. Configure Authentication Providers

#### Google OAuth Setup

1. **In Supabase Dashboard:**
   - Go to Authentication → Providers
   - Enable Google provider
   - Add your redirect URL: `https://your-project-ref.supabase.co/auth/v1/callback`

2. **In Google Cloud Console:**
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret to Supabase

#### Email Authentication

- Already enabled by default in Supabase
- Configure email templates in Authentication → Settings

### 5. Set Up Row Level Security (RLS)

Run these SQL commands in Supabase SQL Editor:

```sql
-- Enable RLS on all tables
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

-- Similar policies for TaskEvent, Notification, etc.
CREATE POLICY "Users can view pair task events" ON "TaskEvent"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "TaskMirror" tm
            JOIN "Pair" p ON (p."user1Id" = tm."ownerId" OR p."user2Id" = tm."ownerId")
            WHERE tm.id = "taskMirrorId"
            AND (p."user1Id" = auth.uid()::text OR p."user2Id" = auth.uid()::text)
        )
    );

-- Pair-specific settings and config
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
```

### 6. Update API Routes

Replace Prisma client usage with Supabase client. Example for `/api/onboarding.ts`:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerSupabaseClient();
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use Supabase instead of Prisma
  const { data, error } = await supabase
    .from('User')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
}
```

### 7. Add Real-time Subscriptions

Example for live task updates:

```typescript
// In your dashboard component
import { useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

export function useLiveTaskUpdates(pairId: string, onTaskUpdate: (task: any) => void) {
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    const subscription = supabase
      .channel('task_updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'TaskMirror',
          filter: `ownerId=eq.${userId}` // You'll need to get userId from auth
        }, 
        onTaskUpdate
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [pairId, onTaskUpdate, supabase]);
}
```

## 🔧 Benefits After Migration

### **Immediate Benefits:**
- 🔐 **Built-in Auth UI**: No more custom auth pages
- 🗄️ **PostgreSQL**: Production-ready database
- 🔄 **Real-time**: Live updates between partners
- 📱 **Better Mobile**: Native mobile app support
- 🛡️ **Row Level Security**: Database-level security

### **Development Benefits:**
- 📊 **Supabase Dashboard**: Visual database management
- 🔍 **Built-in Analytics**: User insights and metrics
- 🚀 **Edge Functions**: Serverless API capabilities
- 📧 **Email Templates**: Customizable auth emails
- 🔧 **CLI Tools**: Database migrations and deployments

### **Production Benefits:**
- 🌍 **Global CDN**: Fast worldwide performance
- 📈 **Auto-scaling**: Handles traffic spikes
- 🔒 **SOC2 Compliant**: Enterprise security
- 💾 **Automated Backups**: Data protection
- 📊 **Monitoring**: Built-in observability

## 🧪 Testing Checklist

- [ ] **Authentication**: Google OAuth and email magic links work
- [ ] **Database**: CRUD operations via Supabase work
- [ ] **Real-time**: Task updates appear live for both partners
- [ ] **Security**: RLS policies prevent unauthorized access
- [ ] **Performance**: Page load times are fast
- [ ] **Mobile**: Auth works on mobile devices

## 🚀 Production Deployment

### Environment Variables
```bash
# Production Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key

# Database
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public"
```

### OAuth Configuration
- Update Google OAuth redirect URIs to production URLs
- Configure Supabase redirect URLs for production domain

## 📞 Support

If you encounter issues:
1. Check Supabase Dashboard → Logs for database errors
2. Check browser console for client-side auth errors
3. Verify environment variables are loaded correctly
4. Test RLS policies in Supabase SQL editor

## 🎉 Next Features to Add

With Supabase, you can easily add:
- **Push Notifications** via Supabase Edge Functions
- **File Storage** for task attachments
- **Advanced Analytics** for productivity insights
- **Team Features** for multiple accountability groups
- **Mobile App** using React Native + Supabase

The migration to Supabase sets you up for rapid feature development and scaling! 🚀
