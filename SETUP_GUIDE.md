# Accountability Partner - Setup Guide

## Prerequisites

1. **Notion Integration**
2. **WhatsApp Account**
3. **WhatsApp Group with your accountability partner**

## Step 1: Set up Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Configure:
   - Name: "Accountability Partner" (or any name you prefer)
   - Select your workspace
   - Check the required capabilities:
     - Read content
     - Update content
     - Read comments (optional)
4. Click "Submit"
5. Copy the "Internal Integration Token" (starts with `secret_`)

## Step 2: Get Notion Database ID

1. Open your Tasks database in Notion
2. Click "Share" in the top right
3. Invite your integration (search for "Accountability Partner")
4. Copy the database ID from the URL:
   - URL format: `https://www.notion.so/[workspace]/[DATABASE_ID]?v=[view_id]`
   - The DATABASE_ID is the 32-character string after your workspace name

## Step 3: Update Environment Variables

1. Copy `.env.local` to `.env`:
   ```powershell
   Copy-Item .env.local .env
   ```

2. Edit `.env` and update:
   - `NOTION_TOKEN`: Paste your integration token
   - `NOTION_DATABASE_ID`: Paste your database ID

## Step 4: Test Notion Connection

Run the Notion test script to verify connection:
```powershell
cd apps/worker
pnpm notion:test
```

This should list your tasks from Notion.

## Step 5: Connect WhatsApp

1. Run the WhatsApp setup:
   ```powershell
   cd apps/worker
   pnpm whatsapp:setup
   ```

2. Scan the QR code with WhatsApp on your phone:
   - Open WhatsApp
   - Go to Settings → Linked Devices
   - Click "Link a Device"
   - Scan the QR code

3. Once connected, the script will list your groups. Copy the JID of your accountability group.

4. Update `.env` with:
   - `WA_GROUP_JID`: The group JID (format: `1234567890-1234567890@g.us`)

## Step 6: Run a Full Test

1. Start the worker:
   ```powershell
   cd apps/worker
   pnpm dev
   ```

2. In another terminal, start the web app:
   ```powershell
   cd apps/web
   pnpm dev
   ```

3. Open http://localhost:3000 and sign in

4. Test by changing a task status to "Done" in Notion - you should receive a WhatsApp message!

## Optional: Email Authentication

If you want to use email sign-in:

1. For Gmail:
   - Enable 2-factor authentication
   - Generate an app password: https://myaccount.google.com/apppasswords
   - Update in `.env`:
     ```
     EMAIL_SERVER_HOST=smtp.gmail.com
     EMAIL_SERVER_PORT=587
     EMAIL_SERVER_USER=your-email@gmail.com
     EMAIL_SERVER_PASSWORD=your-app-password
     EMAIL_FROM=noreply@accountability.app
     ```

## Optional: Google OAuth

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Update `.env` with client ID and secret

## Troubleshooting

- **Notion connection fails**: Ensure the integration is added to your database
- **WhatsApp QR expires**: Re-run `pnpm whatsapp:setup`
- **No messages received**: Check the worker logs and ensure WA_GROUP_JID is correct
