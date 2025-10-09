# WhatsApp Setup Guide

This guide will help you set up WhatsApp integration using Baileys for the Accountability Partner system.

## Important Notes

⚠️ **Disclaimer**: This uses an unofficial WhatsApp client library (Baileys). While it works well for development and personal use, be aware that:
- WhatsApp's Terms of Service technically prohibit unofficial clients
- Your WhatsApp account could theoretically be banned (though this is rare for personal/development use)
- Use a secondary WhatsApp number if you're concerned about this risk

## Prerequisites

1. A WhatsApp account with an active phone number
2. WhatsApp installed on your phone
3. A group created with your accountability partner

## Step 1: Create a WhatsApp Group

1. Open WhatsApp on your phone
2. Create a new group with your accountability partner
3. Give it a meaningful name like "Accountability Tasks"

## Step 2: Run the WhatsApp Test

1. Navigate to the worker directory:
   ```bash
   cd apps/worker
   ```

2. Run the WhatsApp test script:
   ```bash
   pnpm wa:test
   ```

3. A QR code will appear in your terminal

## Step 3: Connect Your WhatsApp

1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices
3. Tap "Link a Device"
4. Scan the QR code shown in your terminal

## Step 4: Find Your Group JID

After connecting, the script will list all your WhatsApp groups with their IDs (JIDs). Look for output like:

```
📋 Found 3 groups:
1. Family Group (120363123456789012@g.us)
2. Accountability Tasks (120363234567890123@g.us)
3. Work Team (120363345678901234@g.us)
```

Copy the JID of your accountability group (the long number ending with @g.us).

## Step 5: Update Your .env File

Edit the `.env` file and update:

```env
WA_GROUP_JID=120363234567890123@g.us
```

Replace with your actual group JID.

## Step 6: Test Sending a Message

Run the test script again:
```bash
pnpm wa:test
```

This time it should send a test message to your group!

## How Authentication Works

- Authentication credentials are stored in the `auth/` directory
- Once you scan the QR code, you won't need to do it again unless:
  - You unlink the device from your phone
  - You delete the `auth/` directory
  - You log out from the bot

## Troubleshooting

### QR Code not appearing
- Make sure your terminal supports Unicode characters
- Try running in a different terminal emulator

### Connection keeps dropping
- Check your internet connection
- Make sure your phone has WhatsApp running and connected to the internet
- The phone doesn't need to be actively open, but should have internet access

### Can't see groups
- Make sure you're a member of at least one group
- Try creating a new group if needed

### Message not sending
- Verify the group JID is correct (including @g.us suffix)
- Make sure you're still a member of the group
- Check that the bot is still linked in WhatsApp → Settings → Linked Devices

## Security Notes

- Keep your `auth/` directory secure and don't commit it to git (it's already in .gitignore)
- The auth files contain your WhatsApp session - anyone with these files could access your WhatsApp
- If you suspect your session is compromised, unlink the device from your phone immediately
