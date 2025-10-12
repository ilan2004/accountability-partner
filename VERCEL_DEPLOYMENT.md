# Vercel Deployment Guide

## Required Environment Variables

When deploying to Vercel, you need to set the following environment variables in your Vercel project settings:

### Essential Variables (Required for basic functionality)

1. **Supabase Configuration**
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

2. **Application Configuration**
   - `NEXT_PUBLIC_APP_URL` - Your Vercel deployment URL (e.g., https://your-app.vercel.app)
   - `JWT_SECRET` - A secure random string for JWT signing

### Optional Variables (Features will work with fallbacks if not provided)

3. **Gemini AI** (Optional - will use fallback messages if not set)
   - `GEMINI_API_KEY` - Your Google Gemini API key
   - `GEMINI_MODEL` - Model to use (default: gemini-1.5-flash)

4. **Notion OAuth** (Required only if using Notion integration)
   - `NOTION_CLIENT_ID` - Your Notion OAuth client ID
   - `NOTION_CLIENT_SECRET` - Your Notion OAuth client secret
   - `NOTION_REDIRECT_URI` - Your callback URL (e.g., https://your-app.vercel.app/auth/callback)

## Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with its value
4. Select the environments where the variable should be available (Production/Preview/Development)

## Important Notes

- The app will work without `GEMINI_API_KEY`, but will use fallback message templates
- Make sure to use `NEXT_PUBLIC_` prefix for variables that need to be accessible on the client side
- Don't commit any `.env` files with actual values to your repository

## Build Error Fix

If you encounter the "GEMINI_API_KEY is required" error during build, the code has been updated to handle missing API keys gracefully. The Gemini service will only initialize if the API key is available.

## Post-Deployment

After deployment, verify:
1. The app loads without errors
2. Database connections work (check Supabase integration)
3. If Gemini API key is set, AI features should work
4. If not set, fallback messages should be used
