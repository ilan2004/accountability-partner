# Railway WhatsApp Setup Instructions

## Prerequisites
- Railway CLI installed and configured
- Access to Railway project

## Setup Steps

### 1. Upload Auth Files to Railway Volume

The auth files in `auth/accountability-bot/` need to be uploaded to Railway's persistent volume.

```bash
# First, ensure you're in the worker directory
cd apps/worker

# Create a tar archive of the auth files
tar -czf whatsapp-auth.tar.gz auth/

# Deploy with the auth files
railway up
```

### 2. Set Environment Variables

Add these environment variables in Railway:

```
WA_GROUP_JID=120363421579500257@g.us
WA_AUTH_PATH=/app/auth
WA_SESSION_NAME=accountability-bot
```

### 3. Update Volume Mount (if needed)

Ensure the Railway volume is mounted at `/app/auth` path.

### 4. Test the Connection

After deployment, check the logs to verify WhatsApp connects successfully:

```bash
railway logs --tail=50
```

You should see:
- "Successfully loaded authentication state"
- "✅ WhatsApp client connected successfully"

## Important Notes

- The auth files contain your WhatsApp session. Keep them secure.
- If WhatsApp disconnects, you may need to re-authenticate locally and re-upload the auth files.
- The bot will send messages to the group "Accountability partner" (JID: 120363421579500257@g.us)

## Troubleshooting

If WhatsApp fails to connect:
1. Check if the auth files were uploaded correctly
2. Verify environment variables are set
3. Ensure the volume is mounted properly
4. Check Railway logs for specific error messages
