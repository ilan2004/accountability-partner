# Environment Variables Setup Guide

This guide covers setting up environment variables after migrating to Supabase.

## Prerequisites

Before setting up environment variables, ensure you have:

1. **Supabase Project**: Created and configured with the schema from `supabase-complete-setup.sql`
2. **Vercel Project**: For hosting the web application
3. **Railway Project**: For hosting the worker service
4. **WhatsApp Group**: Set up for accountability notifications
5. **Notion Integration**: Created with appropriate permissions

## Required Environment Variables

### 1. Supabase Configuration

Get these from your Supabase project dashboard (https://supabase.com/dashboard):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find these:**
- Go to your Supabase project dashboard
- Navigate to Settings → API
- Copy the Project URL, anon/public key, and service_role key

### 2. NextAuth Configuration

```bash
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret-here
```

**How to generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3. Google OAuth (Required)

```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**How to get these:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to APIs & Services → Credentials
5. Create OAuth 2.0 Client ID
6. Add your domain to authorized redirect URIs: `https://your-domain.vercel.app/api/auth/callback/google`

### 4. WhatsApp Configuration

```bash
WA_GROUP_JID=your-whatsapp-group-id@g.us
WA_SESSION_NAME=accountability-bot
WA_AUTH_PATH=./auth-temp
WA_PRINT_QR=false
```

**How to get WhatsApp Group JID:**
- Add your WhatsApp bot to the group
- The worker will log the group JID when it connects
- Alternatively, use WhatsApp Web developer tools to inspect group messages

### 5. Worker Configuration

```bash
PAIR_ID=your-pair-uuid-from-database
TZ=Asia/Kolkata
WARNING_TIME=20:00
SUMMARY_TIME=23:55
NODE_ENV=production
```

### 6. Optional: Email Provider

```bash
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=noreply@your-domain.com
```

## Environment Setup by Service

### Web Application (Vercel)

Set these in your Vercel project dashboard (Settings → Environment Variables):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NextAuth
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Email
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=noreply@your-domain.com
```

### Worker Service (Railway)

Set these in your Railway project dashboard (Variables tab):

```bash
# Supabase (same as web)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Worker Configuration
PAIR_ID=your-pair-uuid-from-database
NODE_ENV=production

# WhatsApp
WA_GROUP_JID=your-whatsapp-group-id@g.us
WA_SESSION_NAME=accountability-bot
WA_AUTH_PATH=./auth-temp
WA_PRINT_QR=false

# Timezone & Scheduling
TZ=Asia/Kolkata
WARNING_TIME=20:00
SUMMARY_TIME=23:55

# Worker Intervals (optional)
WORKER_POLL_INTERVAL_MS=60000
NOTIFY_PROCESS_INTERVAL_MS=5000
NOTION_DEBOUNCE_MS=30000
NOTIFY_MAX_RETRIES=3
NOTIFY_RETRY_BASE_DELAY_MS=1000
NOTION_RATE_LIMIT_RETRIES=5
NOTION_RATE_LIMIT_DELAY_MS=1000
```

**Important Notes for Worker:**
- **Remove** `DATABASE_URL` if it exists (we're no longer using Railway Postgres)
- **Remove** any `NOTION_TOKEN` and `NOTION_DATABASE_ID` (these are now stored in the database per pair)
- The worker will create dummy users and pair if `PAIR_ID` doesn't exist

## Migration Script Environment

For running the migration script, create a `.env` file in the `scripts/` directory:

```bash
# Source Database (Railway Postgres)
RAILWAY_DATABASE_URL=postgresql://postgres:password@host:port/railway

# Target Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Setting Up Environment Variables

### 1. Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login and link your project
vercel login
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXTAUTH_URL
vercel env add NEXTAUTH_SECRET
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
```

### 2. Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link your project
railway login
railway link

# Set environment variables
railway variables set NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
railway variables set PAIR_ID=your-pair-id
railway variables set WA_GROUP_JID=your-group-jid@g.us
railway variables set NODE_ENV=production
railway variables set TZ=Asia/Kolkata
railway variables set WARNING_TIME=20:00
railway variables set SUMMARY_TIME=23:55

# Remove old environment variables if they exist
railway variables delete DATABASE_URL
railway variables delete NOTION_TOKEN  
railway variables delete NOTION_DATABASE_ID
```

## Verification

### Web App Verification
1. Deploy to Vercel: `vercel --prod`
2. Visit your domain
3. Sign in with Google
4. Complete onboarding flow
5. Check that data appears in Supabase dashboard

### Worker Verification
1. Deploy to Railway: `railway up`
2. Check Railway logs: `railway logs`
3. Look for successful Supabase connection messages
4. Verify worker creates pair/notion config if needed
5. Test Notion polling by making a change in your shared database

### Database Verification
1. Go to Supabase dashboard → Table Editor
2. Check that tables have data after onboarding
3. Verify RLS policies are working (you can only see your own data)
4. Check that task events are created when worker polls

## Troubleshooting

### Common Issues

**Web app can't connect to Supabase:**
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check Supabase project is active and accessible

**Worker can't connect to Supabase:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check that the service role key has admin permissions

**Authentication fails:**
- Verify `NEXTAUTH_SECRET` is set and consistent
- Check Google OAuth credentials and redirect URIs
- Ensure `NEXTAUTH_URL` matches your deployed domain

**Worker can't find pair:**
- Check `PAIR_ID` exists in the database
- If not set, worker will create dummy pair (check logs)

**WhatsApp not working:**
- Verify `WA_GROUP_JID` format (should end with @g.us)
- Check bot is added to the WhatsApp group
- Ensure auth files are persistent in Railway (use volume if needed)

**No notifications sent:**
- Check that Settings table has `whatsappGroupJid` for your pair
- Verify notification status in database
- Check worker logs for send failures

## Security Notes

- **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client side**
- Use strong, unique `NEXTAUTH_SECRET`
- Store sensitive environment variables as secrets, not in code
- Regularly rotate API keys and tokens
- Enable 2FA on all service accounts

## Next Steps

After setting up environment variables:
1. Run the migration script to transfer data
2. Deploy both web and worker services
3. Test the full flow end-to-end
4. Monitor logs for any issues
5. Set up monitoring and alerting for production use
