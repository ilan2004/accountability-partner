# Web App Setup Guide

This guide will help you set up the Accountability Partner web application with proper authentication.

## Prerequisites

1. **Node.js** (version 18 or higher)
2. **pnpm** (version 10 or higher)
3. **Google Developer Account** (optional, for Google OAuth)
4. **Email Provider** (optional, for magic link authentication)

## Environment Configuration

### 1. Copy Environment Variables

Copy the `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

### 2. Configure NextAuth

Set the following required variables in your `.env` file:

```bash
# NextAuth Configuration (REQUIRED)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-change-this-in-production
```

**Generate a secure secret:**
```bash
openssl rand -base64 32
```

### 3. Configure Authentication Providers

Choose one or both authentication methods:

#### Option A: Google OAuth (Recommended)

1. Go to [Google Developer Console](https://console.developers.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Add to your `.env`:

```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

#### Option B: Email Magic Links

Configure SMTP settings in your `.env`:

```bash
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your_email_here
EMAIL_SERVER_PASSWORD=your_app_password_here
EMAIL_FROM=noreply@accountability.app
```

**For Gmail:**
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password (not your regular password)

### 4. Database Setup

The application uses SQLite by default. The database will be created automatically.

```bash
# Navigate to the database package
cd packages/db

# Generate Prisma client
pnpm run db:generate

# Push database schema
pnpm run db:push
```

## Development

### 1. Install Dependencies

From the root directory:

```bash
pnpm install
```

### 2. Start Development Server

```bash
cd apps/web
pnpm run dev
```

The application will be available at `http://localhost:3000`.

### 3. First Time Setup

1. Navigate to `http://localhost:3000`
2. Sign in using Google or Email
3. Complete the onboarding process:
   - Enter your partner's email
   - Configure Notion integration
   - Set up WhatsApp notifications (optional)

## Production Deployment

### Environment Variables

For production, ensure you have:

1. **Secure NextAuth Secret:**
   ```bash
   NEXTAUTH_SECRET=a-very-long-random-string-for-production
   ```

2. **Correct NextAuth URL:**
   ```bash
   NEXTAUTH_URL=https://your-domain.com
   ```

3. **Database URL** (if using external database):
   ```bash
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

### OAuth Redirect URIs

Update your Google OAuth configuration:
- Authorized redirect URIs: `https://your-domain.com/api/auth/callback/google`

## Troubleshooting

### Authentication Issues

1. **"Authentication Not Configured" message:**
   - Ensure at least one provider (Google or Email) is properly configured
   - Check environment variables are loaded correctly

2. **Google OAuth errors:**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
   - Check redirect URIs match exactly
   - Ensure Google+ API is enabled

3. **Email authentication not working:**
   - Verify SMTP settings
   - Check spam folder for magic link emails
   - For Gmail, ensure App Password is used

### Database Issues

1. **Prisma errors:**
   ```bash
   cd packages/db
   pnpm run db:push
   ```

2. **Reset database (development only):**
   ```bash
   rm packages/db/dev.db
   pnpm run db:push
   ```

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check server logs for authentication errors
3. Verify environment variables are set correctly
4. Ensure all prerequisites are installed

## Security Notes

- Never commit your `.env` file
- Use strong, unique secrets for production
- Regularly rotate API keys and secrets
- Use HTTPS in production
- Consider using a managed database for production
