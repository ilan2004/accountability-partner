# Quick Fix: Add User with Correct Username

## Option 1: Using the Web App (Recommended)

1. **Go to your accountability web app** (localhost:3000 or your deployed URL)
2. **Click "Get Started"** to go to the signup page
3. **Sign up with:**
   - **Username**: `ilan usman` (exactly as you have in Notion)
   - **Email**: Your email address
   - **Password**: Your chosen password
4. **Complete onboarding** to set up your accountability pair

## Option 2: Direct Database Update (Quick Fix)

If you want to quickly fix the existing issue, you can update your current user's name in Supabase:

1. **Go to your Supabase dashboard** (https://supabase.com/dashboard)
2. **Navigate to Table Editor → User table**
3. **Find your user record**
4. **Update the `name` field** to `ilan usman`
5. **Save the changes**

## Option 3: SQL Update (Advanced)

If you have access to SQL editor in Supabase:

```sql
-- Update user name to match Notion assignee
UPDATE "User" 
SET "name" = 'ilan usman' 
WHERE "email" = 'your-email@example.com';
```

## Test the Fix

After adding/updating the user:

1. **In Notion**: Make a change to the "A new test" task (change status from Done to In Progress)
2. **Wait 1-2 minutes** for the system to poll Notion
3. **Check your WhatsApp group** for the enhanced AI notification

You should see something like:
*"Hey ilan usman! ⚡ Progress! You moved 'A new test' to In Progress. Building momentum on your tasks! 🚀"*

## Why This Fixes It

The system matches tasks by:
1. **First**: Trying to match by Notion ID (if set)
2. **Second**: Trying to match by exact name

By ensuring your username in the accountability system matches exactly what you put as assignee in Notion ("ilan usman"), the system will be able to:
- ✅ Sync your tasks properly
- ✅ Send WhatsApp notifications
- ✅ Use AI enhancement for messages
- ✅ Generate task lists correctly
