# Railway Deployment with Gemini AI

## Environment Variables to Add in Railway

### 1. Go to your Railway project dashboard
### 2. Navigate to Variables tab
### 3. Add these new variables:

```env
# Gemini AI Configuration
GEMINI_API_KEY=AIzaSyBG103SUK9dwdTRgkpxxWPqLPX-Rm-v_Jk
USE_GEMINI_MESSAGES=true
GEMINI_MODEL=gemini-2.0-flash-exp
```

## Deployment Steps

### Option 1: Via Railway Dashboard (Recommended)
1. Go to [Railway Dashboard](https://railway.app)
2. Select your Accountability project
3. Click on your worker service
4. Go to "Variables" tab
5. Add the three Gemini variables above
6. Deploy will trigger automatically

### Option 2: Via Railway CLI
```bash
# Install Railway CLI if you haven't
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Add environment variables
railway variables set GEMINI_API_KEY=AIzaSyBG103SUK9dwdTRgkpxxWPqLPX-Rm-v_Jk
railway variables set USE_GEMINI_MESSAGES=true
railway variables set GEMINI_MODEL=gemini-2.0-flash-exp

# Deploy
railway up
```

## Verification Steps

### 1. Check Logs
After deployment, check Railway logs to see:
```
✅ Gemini is enabled and ready
Initializing Gemini with API key: AIzaSyBG103SUK9dwdTR...
Using Gemini model: gemini-2.0-flash-exp
```

### 2. Test a Task
Create or complete a task in Notion and check your WhatsApp group for enhanced messages.

### 3. Monitor Costs
- Gemini 2.0 Flash is very cost-effective
- Expected cost: $5-20/month for typical usage
- Monitor at [Google Cloud Console](https://console.cloud.google.com)

## Troubleshooting

### If Gemini doesn't work on Railway:
1. **Check environment variables** are set correctly
2. **Verify API key** hasn't expired
3. **Check Railway logs** for Gemini errors
4. **Regional restrictions** - some regions may block Google AI APIs

### If messages seem static:
- Check `USE_GEMINI_MESSAGES=true` is set
- Look for "Message enhanced by Gemini" in logs
- Fallback to original messages if AI fails (expected behavior)

## Cost Optimization

### Current Settings (Recommended)
- **Model**: `gemini-2.0-flash-exp` (fastest, cheapest)
- **Fallback**: Always falls back to original message if AI fails
- **Rate limiting**: Built-in via Google's API limits

### Alternative Models (if needed)
```env
# For higher quality (more expensive)
GEMINI_MODEL=gemini-1.5-pro

# For basic functionality (if 2.0 has issues)
GEMINI_MODEL=gemini-1.5-flash
```

## Expected Behavior

### ✅ Success Messages:
- Task completions get celebratory, context-aware messages
- New tasks get encouraging planning messages  
- Status changes get momentum-building messages
- Partner mentions when relevant
- Time-of-day awareness

### 🔄 Fallback Behavior:
- If Gemini API fails → uses original static message
- If quota exceeded → uses original static message
- If network issues → uses original static message

This ensures your app always works, with AI enhancement when available!

## Next Steps

1. **Add variables to Railway** ✅
2. **Deploy and test** ✅
3. **Monitor for a few days** to see enhanced messages in action
4. **Consider additional AI features** from the integration plan:
   - Weekly AI insights
   - Productivity pattern analysis
   - Smart coaching suggestions
