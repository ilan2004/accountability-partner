# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is an **Accountability Partner System** for Ilan and Sidra - a dual-service application that synchronizes tasks from Notion workspaces and sends WhatsApp notifications powered by AI message formatting.

### Architecture

**Two-Service Architecture:**
1. **Next.js Frontend** (`/`) - Web dashboard for user management, task viewing, and configuration
2. **Railway Backend Service** (`/railway-backend/`) - Standalone Node.js service running WhatsApp bot, Notion sync, and scheduled tasks

## Common Development Commands

### Frontend (Next.js)
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

### Backend Service (Railway)
```bash
cd railway-backend

# Install dependencies
npm install

# Start the full accountability system
npm start
# or
node accountability-system.js

# Development mode with auto-reload
npm run dev

# Manual triggers for testing
npm run morning    # Send morning summary
npm run evening    # Send evening summary
npm run sync       # Run Notion sync
npm run status     # Show system status

# Test WhatsApp connection only
node test-whatsapp.js
```

## High-Level Architecture

### Core Services Integration

**Frontend ↔ Backend Communication:**
- Frontend calls backend via environment variable `NEXT_PUBLIC_APP_URL`
- Backend calls frontend AI endpoints at `/api/ai/morning-message` and `/api/ai/evening-message`

**WhatsApp Integration:**
- Uses `@whiskeysockets/baileys` for WhatsApp connection
- Session persistence in `railway-session/` directory
- Automatic reconnection with exponential backoff for stream conflicts
- Group messaging to accountability partners

**Notion Sync Pipeline:**
```
Notion Workspaces → NotionSyncService → Supabase Database → Change Detection → WhatsApp Notifications
```

**AI Message Formatting:**
- Gemini 2.0 Flash (`@google/generative-ai`) formats all messages
- Morning summaries: energetic task overview
- Evening summaries: completion statistics and motivation
- Real-time notifications: contextual task updates

### Service Architecture Details

**Railway Backend Service Components:**
1. **SchedulerService** - Manages all cron jobs and orchestration
2. **NotionSyncService** - Handles OAuth tokens and workspace sync
3. **WhatsAppNotificationBot** - Core WhatsApp messaging functionality
4. **WhatsAppBot** - Wrapper with enhanced error handling for stream conflicts
5. **GeminiFormatterService** - AI-powered message formatting

**Scheduled Operations:**
- Morning summaries: 06:00 IST daily
- Evening summaries: 22:00 IST daily  
- Notion sync: Every 5 minutes
- Health checks: Every hour

### Database Schema (Supabase)

**Key Tables:**
- `users` - User profiles with Notion OAuth tokens and workspace IDs
- `tasks` - Synchronized task data from Notion workspaces
- Change tracking for real-time notifications

## Environment Configuration

### Frontend Environment Variables
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Backend Environment Variables
```bash
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash-exp
WA_GROUP_JID=whatsapp-group-id@g.us
WA_AUTH_PATH=./railway-session
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development Workflow

### Local Development Setup
1. Configure environment variables in both root and `railway-backend/` directories
2. Start frontend: `npm run dev` (runs on :3000)
3. Start backend: `cd railway-backend && npm run dev` (runs on :3001)
4. Test WhatsApp connection: `cd railway-backend && node test-whatsapp.js`

### Testing Task Notifications
1. Connect WhatsApp bot using test script
2. Add/modify tasks in Notion workspace
3. Check Notion sync is running (every 5 minutes)
4. Verify notifications appear in WhatsApp group

### Deployment Architecture
- **Frontend**: Deployed to Vercel/similar platform
- **Backend**: Deployed to Railway as persistent service
- **Session Management**: WhatsApp session files stored in Railway persistent volume

## Key Implementation Notes

### WhatsApp Connection Resilience
The system handles WhatsApp "Stream Errored (conflict)" issues through:
- Automatic reconnection with exponential backoff
- Session conflict detection and recovery
- Graceful degradation when messaging fails

### Notion Integration Patterns  
- OAuth token management per user in Supabase
- Dynamic database ID discovery for task sources  
- Flexible property mapping for different Notion setups
- Change detection based on last modification timestamps

### AI Message Formatting
- Context-aware prompts for different message types
- Fallback to template messages if AI fails
- Personality-matched emojis for each user (🧑‍💻 for Ilan, 👩‍🎓 for Sidra)
- **Gemini 2.0 Flash advantages**: Faster response times, more natural language, better context understanding

## Troubleshooting

### WhatsApp Issues
- "Stream Errored (conflict)": Multiple sessions conflict - bot auto-retries
- "item-not-found": Check group JID is correct and bot has access
- Connection drops: Session files may need refresh - delete `railway-session/` directory

### Notion Sync Issues  
- Check OAuth tokens are valid in Supabase `users` table
- Verify `notion_task_database_id` is configured for each user
- Property mapping failures: Check Notion database schema matches parser

### AI Formatting Issues
- Verify `GEMINI_API_KEY` is configured and valid
- Check API quotas and rate limits
- Fallback messages used when AI service unavailable
