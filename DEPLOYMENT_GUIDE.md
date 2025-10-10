# Deployment and Cutover Guide

This guide walks you through the deployment process for the Supabase migration.

## Prerequisites

Before deploying, ensure you have completed:

1. ✅ **Phase 0**: Verified Supabase environment
2. ✅ **Phase 1**: Applied schema and RLS policies
3. ✅ **Phase 2**: Created migration scripts
4. ✅ **Phase 3**: Refactored worker code
5. ✅ **Phase 4**: Verified web app uses Supabase exclusively
6. ✅ **Phase 5**: Configured environment variables

## Deployment Order

**IMPORTANT**: Deploy in this specific order to minimize downtime:

1. **Database Setup** (Supabase schema and policies)
2. **Data Migration** (if you have existing data)
3. **Web Application** (Vercel deployment)
4. **Worker Service** (Railway deployment)
5. **Verification & Testing**

## Step 1: Database Setup

### 1.1 Apply Schema and Policies

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the complete setup script:

```sql
-- Copy and paste the contents of supabase-complete-setup.sql
-- This includes schema, RLS policies, triggers, and indexes
```

### 1.2 Verify Schema

Check that all tables exist:

```sql
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected tables:
- User
- Pair
- NotionConfig
- Settings
- TaskMirror
- TaskEvent
- Notification

## Step 2: Data Migration (If Needed)

### 2.1 Install Dependencies

```bash
cd scripts
npm install
```

### 2.2 Configure Environment

Create `.env` file in `scripts/` directory:

```bash
RAILWAY_DATABASE_URL=postgresql://user:pass@host:port/railway
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2.3 Test Migration

```bash
cd scripts
npm run test-migration
```

### 2.4 Run Migration

```bash
cd scripts
npm run migrate
```

Monitor the output for:
- Successful connections to both databases
- User mapping statistics
- Migration progress for each table
- Final summary with error count

## Step 3: Web Application Deployment

### 3.1 Update Dependencies

```bash
cd apps/web
npm install
```

### 3.2 Configure Vercel Environment

Set these variables in Vercel dashboard:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
```

### 3.3 Deploy Web App

```bash
cd apps/web
vercel --prod
```

### 3.4 Verify Web Deployment

1. Visit your deployed URL
2. Test Google authentication
3. Complete onboarding flow
4. Check data appears in Supabase

## Step 4: Worker Service Deployment

### 4.1 Update Dependencies

```bash
cd apps/worker
npm install
```

### 4.2 Configure Railway Environment

Set these variables in Railway dashboard:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=production

# Worker Config
PAIR_ID=your-pair-uuid-from-database
TZ=Asia/Kolkata
WARNING_TIME=20:00
SUMMARY_TIME=23:55

# WhatsApp
WA_GROUP_JID=your-whatsapp-group-id@g.us
WA_SESSION_NAME=accountability-bot
WA_AUTH_PATH=./auth-temp
WA_PRINT_QR=false
```

### 4.3 Remove Old Environment Variables

```bash
railway variables delete DATABASE_URL
railway variables delete NOTION_TOKEN
railway variables delete NOTION_DATABASE_ID
```

### 4.4 Deploy Worker

```bash
cd apps/worker
railway up
```

### 4.5 Monitor Worker Logs

```bash
railway logs --tail
```

Look for:
- ✅ Successful Supabase connection
- ✅ NotionConfig loaded or created
- ✅ WhatsApp client connected
- ✅ Services started (poller, notifier, scheduler)
- ❌ Any connection errors or failures

## Step 5: Verification & Testing

### 5.1 Database Verification

Check Supabase dashboard:
- Tables have appropriate data
- RLS policies are working
- Users can only see their own data

### 5.2 Web App Testing

1. **Authentication**:
   - Google OAuth login works
   - User session persists
   - Sign out works

2. **Onboarding**:
   - Can create new pairs
   - Notion config is saved
   - Settings are created

3. **Dashboard**:
   - Tasks display correctly
   - Recent activity shows

4. **Settings**:
   - Can update preferences
   - WhatsApp group JID can be set

### 5.3 Worker Testing

1. **Notion Integration**:
   - Create/update a task in Notion
   - Check worker logs for polling activity
   - Verify task appears in Supabase

2. **Notifications**:
   - Complete a task in Notion
   - Check for notification creation in database
   - Verify WhatsApp message is sent

3. **Scheduling**:
   - Wait for scheduled times (warning/summary)
   - Check logs for scheduled message sending

### 5.4 End-to-End Flow

Complete this full test:

1. **Setup**: Sign up new user via web app
2. **Configure**: Complete onboarding with partner email
3. **Integrate**: Set up Notion database and integration
4. **Connect**: Configure WhatsApp group JID
5. **Test**: Create and complete tasks in Notion
6. **Verify**: Check all notifications are sent

## Step 6: Post-Deployment Monitoring

### 6.1 Set Up Monitoring

1. **Web App**:
   - Monitor Vercel deployment health
   - Check error rates in Vercel dashboard
   - Set up uptime monitoring

2. **Worker**:
   - Monitor Railway service health
   - Set up log monitoring and alerts
   - Track notification delivery rates

3. **Database**:
   - Monitor Supabase performance
   - Check connection pool usage
   - Set up query performance alerts

### 6.2 Health Checks

Create these health check endpoints:

**Web App** (`pages/api/health.ts`):
```typescript
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function handler(req, res) {
  try {
    const supabase = createServerSupabaseClient(req, res)
    const { data, error } = await supabase.from('User').select('id').limit(1)
    
    if (error) throw error
    
    res.status(200).json({ status: 'healthy', database: 'connected' })
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message })
  }
}
```

**Worker** (add to main service):
```typescript
// Add health check endpoint to worker
app.get('/health', async (req, res) => {
  try {
    const { data } = await supabase.from('User').select('id').limit(1)
    res.json({ 
      status: 'healthy', 
      services: {
        database: 'connected',
        poller: poller.isRunning,
        notifier: notifier.isRunning,
        scheduler: scheduler.isRunning
      }
    })
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message })
  }
})
```

## Rollback Plan

If issues occur, follow this rollback procedure:

### 6.3 Emergency Rollback

1. **Immediate**: Disable worker to stop notifications
   ```bash
   railway service pause
   ```

2. **Web App**: Revert to previous Vercel deployment
   ```bash
   vercel rollback
   ```

3. **Worker**: Deploy previous version or roll back environment
   ```bash
   # Restore old environment variables
   railway variables set DATABASE_URL=old-railway-url
   railway up --detach
   ```

4. **Database**: Keep Supabase running (data is safe due to migration)

## Common Issues & Solutions

### Web App Issues

**Issue**: Authentication failures
**Solution**: 
- Check `NEXTAUTH_SECRET` is set
- Verify Google OAuth redirect URIs
- Confirm `NEXTAUTH_URL` matches domain

**Issue**: 500 errors on API routes
**Solution**:
- Check Supabase service role key
- Verify RLS policies allow operations
- Check Supabase project is active

### Worker Issues

**Issue**: Worker won't start
**Solution**:
- Check all required environment variables are set
- Verify Supabase connection string
- Ensure PAIR_ID exists or can be created

**Issue**: No notifications sent
**Solution**:
- Verify WhatsApp group JID format
- Check bot is added to group
- Ensure Settings table has whatsappGroupJid

**Issue**: Notion polling fails
**Solution**:
- Check NotionConfig has valid token and database ID
- Verify Notion integration permissions
- Check rate limiting in logs

## Success Criteria

Deployment is successful when:

- ✅ Web app loads and authentication works
- ✅ Users can complete onboarding flow
- ✅ Worker starts without errors
- ✅ Notion tasks sync to database
- ✅ Notifications are sent to WhatsApp
- ✅ No data loss from migration
- ✅ Performance is acceptable
- ✅ All health checks pass

## Next Steps

After successful deployment:

1. **Documentation**: Update README with new setup instructions
2. **Monitoring**: Set up comprehensive monitoring and alerting
3. **Backup**: Configure automated backups for Supabase
4. **Security**: Review and harden security settings
5. **Performance**: Monitor and optimize query performance
6. **Scaling**: Plan for user growth and scaling needs

## Support

If you encounter issues during deployment:

1. Check the troubleshooting sections in this guide
2. Review service logs for error messages
3. Verify all environment variables are correctly set
4. Test components individually to isolate issues
5. Consult the Supabase and Railway documentation

Remember: The migration preserves all data, so rolling back is always possible if needed.
