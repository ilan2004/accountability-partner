# Accountability Web App - Development Guide

## 🎉 Issues Fixed

This document covers the fixes applied to resolve the major issues you were experiencing.

### ✅ Problems Resolved

1. **"useAuth must be used within an AuthProvider" errors**
2. **404 errors on auth pages and redirects**  
3. **500 errors from missing API endpoints**
4. **Build compilation errors**
5. **Missing navigation and callback handlers**

## 🔧 What Was Fixed

### 1. Auth Provider Boundaries
- Wrapped `src/pages/auth/signup.tsx` and `src/pages/auth/signin.tsx` with `withAuthProvider` HOC
- Added `getServerSideProps` to disable SSG for auth pages (prevents SSR context issues)
- Created `EnsureAuthProvider` safety component for future use

### 2. Missing API Endpoints
- **Created `src/pages/api/auth/create-profile.ts`**: Handles user profile creation after signup
- **Created `src/pages/auth/callback.tsx`**: Handles OAuth redirects from Google/Notion
- **Enhanced existing API routes**: Better error handling and service role client usage

### 3. Navigation & 404 Fixes
- **Created `src/pages/auth/index.tsx`**: Redirects `/auth` → `/auth/signin`
- **Created `src/pages/auth/notion-connect.tsx`**: Placeholder page to prevent 404s after sign-in

### 4. Supabase Context Issues
- **Memoized Supabase client** in AuthProvider to prevent multiple instances
- **Fixed scope bugs** in the `signUp` function
- **Added SSR safety guards** for browser-only APIs

### 5. Build & TypeScript Fixes
- Added missing React imports throughout the codebase
- Fixed TypeScript generic constraints in HOCs
- Added null safety checks for data arrays
- Created ESLint config for browser environments

## 🚀 How to Run

### Prerequisites
- Node.js 18+
- PNPM (this is a monorepo using PNPM workspaces)
- Supabase project with proper environment variables

### Environment Variables
Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional OAuth (for Google/Notion sign-in)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NOTION_CLIENT_ID=your_notion_client_id
NOTION_CLIENT_SECRET=your_notion_client_secret
```

### Running the Development Server

Due to monorepo workspace complexity, use one of these approaches:

**Option 1: From the web directory (recommended)**
```bash
cd apps/web
npm run dev
```

**Option 2: From the monorepo root**
```bash
pnpm --filter @accountability/web dev
```

**Option 3: If you encounter module resolution issues**
```bash
cd apps/web
npx next@15.1.3 dev -p 3000
```

### Building for Production
```bash
cd apps/web
npm run build
```

## 🧪 Testing the Fixes

### Manual Testing Checklist

1. **Visit http://localhost:3000**
   - ✅ Should show the home page without errors
   - ✅ Navigation links should work

2. **Visit http://localhost:3000/auth/signup**  
   - ✅ Should render without "useAuth must be used within AuthProvider" error
   - ✅ Form should be functional
   - ✅ OAuth buttons should work

3. **Visit http://localhost:3000/auth/signin**
   - ✅ Should render without provider errors
   - ✅ Can toggle between signin/signup
   - ✅ Form validation should work

4. **Visit http://localhost:3000/auth**
   - ✅ Should automatically redirect to /auth/signin

5. **API Endpoints**
   - ✅ POST `/api/auth/create-profile` should exist
   - ✅ GET/POST `/auth/callback` should handle OAuth

### Automated Validation
Run the included test script:
```bash
cd apps/web
node test-manual.js
```

## 📂 Key Files Modified/Created

### New Files Created
- `src/pages/api/auth/create-profile.ts` - User profile API endpoint
- `src/pages/auth/callback.tsx` - OAuth callback handler
- `src/pages/auth/notion-connect.tsx` - Notion connection placeholder
- `src/pages/auth/index.tsx` - Auth index redirect
- `.eslintrc.json` - ESLint configuration
- `DEV-GUIDE.md` - This guide
- `test-manual.js` - Validation script

### Modified Files
- `src/contexts/AuthContext.tsx` - Memoized client, added safety wrappers, fixed bugs
- `src/pages/auth/signup.tsx` - Wrapped with AuthProvider, disabled SSG
- `src/pages/auth/signin.tsx` - Wrapped with AuthProvider, disabled SSG
- `src/pages/dashboard.tsx` - Added null safety for data
- `src/components/Layout.tsx` - Added missing React import
- Multiple files - Added React imports, fixed TypeScript issues

## 🔄 Authentication Flow

### Sign Up Flow
1. User visits `/auth/signup` → Renders with AuthProvider wrapper
2. User submits form → Calls AuthContext.signUp()
3. AuthContext creates Supabase user → Calls `/api/auth/create-profile`
4. API creates user record → Returns success
5. AuthContext handles redirect based on user status

### OAuth Flow  
1. User clicks "Sign in with Google/Notion"
2. Redirected to OAuth provider → User authorizes
3. Provider redirects to `/auth/callback` with code
4. Callback page exchanges code for session
5. Redirects to dashboard or notion-connect based on user state

### Error Handling
- All pages wrapped with AuthProvider safety
- API endpoints have comprehensive error handling
- Missing pages return proper redirects instead of 404s
- Build process handles SSR/browser context properly

## 📋 Database Requirements

Your Supabase database should have these tables:

```sql
-- Users table
CREATE TABLE "User" (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  "notionId" TEXT,
  "emailVerified" TIMESTAMP,
  image TEXT,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);

-- Other tables as referenced in your app
CREATE TABLE "Pair" (...);
CREATE TABLE "TaskMirror" (...);
CREATE TABLE "TaskEvent" (...);
```

## 🐛 Common Issues & Solutions

### "next command not found"
- This is due to PNPM workspace hoisting
- Use `npm run dev` from the web directory 
- Or use `npx next@15.1.3 dev -p 3000`

### Module resolution errors
- Ensure you're running from the correct directory
- Try clearing `.next` and `node_modules` directories
- Run `pnpm install` from the monorepo root

### Build failures
- Check that all environment variables are set
- Ensure Supabase environment variables are correct
- Run `pnpm install` from the monorepo root first

## ✨ Next Steps

1. **Verify Environment**: Confirm all Supabase environment variables are set correctly
2. **Test Auth Flows**: Try signing up and signing in to ensure the complete flow works
3. **Database Setup**: Ensure your Supabase tables match the schema expectations
4. **Production Deploy**: The build process now works correctly for deployment

All the major architectural issues have been resolved. The app should now run without the errors you were experiencing!
