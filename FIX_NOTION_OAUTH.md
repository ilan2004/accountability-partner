# Fix for Notion OAuth Integration

## The Problem

Your system has a fundamental architecture issue:

1. **Supabase OAuth** only provides basic authentication (login)
2. **Notion API access** requires a separate integration token with page permissions
3. These are TWO DIFFERENT things that can't be combined in a single OAuth flow

## Current Issues

- Supabase's Notion OAuth doesn't request page access permissions
- The "Allow pages" prompt only shows for the integration owner
- Dashboard fails because no tasks are synced from Notion
- The `notion_access_token` in the database doesn't have the right permissions

## Solutions

### Option 1: Two-Step Authentication (Recommended)

1. **Step 1**: User logs in with Notion OAuth (current flow)
2. **Step 2**: After login, redirect to Notion integration installation:

```typescript
// In your dashboard or after login:
if (!user.has_notion_integration) {
  // Redirect to Notion integration installation
  const integrationUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&redirect_uri=${YOUR_REDIRECT_URI}&owner=user`;
  window.location.href = integrationUrl;
}
```

### Option 2: Use Notion's OAuth Directly (Skip Supabase OAuth)

Instead of using Supabase's Notion provider, implement Notion OAuth directly:

```typescript
// Direct Notion OAuth that includes page permissions
const notionOAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&redirect_uri=${YOUR_CALLBACK_URL}&owner=user`;

// This will show the page selection prompt!
```

### Option 3: Manual Integration Link (Quick Fix)

1. Get your integration's installation URL from Notion Developer Portal
2. Add it to your dashboard:

```typescript
// In dashboard
<Alert>
  <AlertTitle>Connect Notion</AlertTitle>
  <AlertDescription>
    To sync your tasks, please install the Notion integration:
    <Button onClick={() => window.open(NOTION_INTEGRATION_URL)}>
      Install Integration
    </Button>
  </AlertDescription>
</Alert>
```

## Implementation Steps

### For Option 1 (Recommended):

1. **Update auth callback** to check for integration:
```typescript
// In /auth/callback
const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('notion_id', session.user.id)
  .single();

if (!user.notion_access_token) {
  // Redirect to integration installation
  router.push('/connect-notion');
}
```

2. **Create /connect-notion page**:
```typescript
export default function ConnectNotion() {
  const handleConnect = () => {
    window.location.href = NOTION_INTEGRATION_URL;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Notion Integration</CardTitle>
        <CardDescription>
          Grant access to your Notion pages to sync tasks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleConnect}>
          Allow Notion Access
        </Button>
      </CardContent>
    </Card>
  );
}
```

3. **Handle integration callback** to store the token:
```typescript
// New route: /api/notion/callback
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Exchange code for access token
  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: YOUR_REDIRECT_URI,
    }),
  });

  const data = await response.json();
  
  // Store the access token with proper permissions
  await supabase
    .from('users')
    .update({ 
      notion_access_token: data.access_token,
      notion_workspace_id: data.workspace_id 
    })
    .eq('notion_id', session.user.id);
}
```

## Quick Fix for Now

1. Share this link with Sidra:
   - Go to https://developers.notion.com/
   - Get your integration's installation URL
   - Send it to Sidra to install

2. After she installs it, you'll need to manually store her access token in the database

3. Or implement Option 1 above for a proper fix

## Why This Happens

- Supabase's OAuth providers are designed for authentication, not API access
- Notion requires explicit page permissions that must be granted separately
- The integration installation is what shows the "Allow pages" prompt
- Without this, the sync service can't access Notion data
