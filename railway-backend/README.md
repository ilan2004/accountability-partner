# Accountability System - Railway Backend

A complete accountability partner system for **Ilan & Sidra** that integrates Notion task management with WhatsApp notifications powered by AI.

## 🎯 System Overview

This system creates a seamless accountability loop where both users can focus on their Notion workspace for task management while staying connected and motivated through automated WhatsApp updates.

### Key Features

- **📄 Notion Integration**: Syncs tasks from both users' Notion workspaces every 5 minutes
- **📱 WhatsApp Notifications**: Automated morning/evening summaries and real-time updates
- **🤖 AI-Powered Messages**: Gemini 1.5 Flash generates contextual, motivational messages
- **⏰ Smart Scheduling**: IST timezone-aware cron jobs for perfect timing
- **🔄 Change Detection**: Real-time task update notifications when changes are made in Notion

## 📊 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  Notion (Tasks) │◄──►│  Railway Backend │◄──►│ Supabase (Sync) │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │                 │
                       │  Gemini 1.5     │
                       │  (Formatting)   │
                       │                 │
                       └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │                 │    │                 │
                       │ WhatsApp Bot    │◄──►│ Next.js Frontend│
                       │ (Baileys)       │    │ (Dashboard)     │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘
```

## 📅 Scheduled Operations

| Time | Operation | Description |
|------|-----------|-------------|
| **06:00 IST** | Morning Summary | AI-generated task overview for both users |
| **22:00 IST** | Evening Summary | Completion stats with motivational feedback |
| **Every 5 min** | Notion Sync | Detect changes and sync tasks to Supabase |
| **Every hour** | Health Check | Monitor system status and reconnect if needed |

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Environment variables configured
- WhatsApp Business account (for bot)
- Notion workspace access
- Supabase database

### Installation

```bash
# Install dependencies
npm install

# Start the system
npm start

# Or run specific commands
npm run morning  # Trigger morning summary
npm run evening  # Trigger evening summary  
npm run sync     # Run Notion sync
npm run status   # Show system status
```

### Environment Variables

Create a `.env` file in the railway-backend directory:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini AI Configuration  
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# WhatsApp Configuration
WA_GROUP_JID=your_whatsapp_group_jid
WA_AUTH_PATH=./wa-session
WA_PRINT_QR=true

# Optional: Next.js Frontend URL
NEXT_PUBLIC_APP_URL=your_frontend_url
```

## 🔧 System Components

### 1. WhatsApp Notification Bot (`whatsapp-notification-bot.js`)

**Purpose**: Send outgoing notifications only (no incoming message processing)

**Features**:
- Morning task summaries with friendly formatting
- Evening completion statistics  
- Real-time task update notifications
- Task completion celebrations
- Automatic reconnection with exponential backoff

### 2. Notion Sync Service (`services/notion-sync.js`)

**Purpose**: Bidirectional sync between Notion workspaces and Supabase

**Features**:
- OAuth token management for each user
- Automatic task database discovery
- Change detection based on timestamps
- Flexible property mapping (Name/Task/Title fields)
- Support for Status, Priority, Effort Level, Due Date

### 3. Scheduler Service (`services/scheduler.js`)

**Purpose**: Orchestrate all scheduled operations and change processing

**Features**:
- IST timezone-aware cron jobs
- Morning/evening message generation
- Change detection and notification routing
- Health monitoring and recovery
- Manual trigger support for testing

### 4. Gemini Formatter Service (`services/gemini-formatter.js`)

**Purpose**: AI-powered message formatting for natural, contextual communication

**Features**:
- Morning summaries with task breakdown
- Evening summaries with completion statistics
- Contextual task update notifications
- Bulk change notifications
- Fallback messages if AI is unavailable

### 5. Main System (`accountability-system.js`)

**Purpose**: System orchestration, initialization, and CLI interface

**Features**:
- Graceful startup and shutdown
- Environment validation
- Component testing
- CLI commands for manual operations
- Status monitoring and reporting

## 📱 WhatsApp Message Examples

### Morning Summary (06:00 IST)
```
🌅 Good Morning, Accountability Partners!

Here are today's tasks:

🧑‍💻 Ilan
1. Client call (Due: 10/12/2025) 🔥
2. Code review
3. Update documentation

👩‍🎓 Sidra
1. Research presentation
2. Team meeting prep
(Sidra hasn't added tasks for today.)

Date: 2025-10-12
Time: 06:00 IST

Let's make today productive! 💪
```

### Evening Summary (22:00 IST)
```
🌙 End of Day Summary

🧑‍💻 Ilan — 3/4 tasks completed (75%)
👩‍🎓 Sidra — 2/2 tasks completed (100%)

📊 Overall Completion Rate: 83%
Date: 2025-10-12
Time: 22:00 IST

Excellent work today! 🔥 Keep the momentum going!
```

### Task Update Notification
```
✅ Task Completed

🎉 Sidra completed:
📋 "Research presentation"

Great job! 🎯
```

## 🛠️ Development & Testing

### Manual Testing Commands

```bash
# Test morning summary
node accountability-system.js morning

# Test evening summary  
node accountability-system.js evening

# Test Notion sync
node accountability-system.js sync

# Check system status
node accountability-system.js status

# Show help
node accountability-system.js help
```

### Development Mode

```bash
# Run with auto-restart on changes
npm run dev
```

### Debugging

The system includes comprehensive logging:

```bash
# Start with debug logging
DEBUG=* npm start

# Monitor logs in Railway
railway logs
```

## 🔄 Change Detection Flow

1. **Notion Update**: User adds/completes/updates task in Notion
2. **Sync Detection**: 5-minute sync detects timestamp changes  
3. **Change Classification**: System identifies type (added/completed/updated)
4. **AI Formatting**: Gemini generates contextual message
5. **WhatsApp Notification**: Bot sends formatted update to group

## 🏗️ Database Schema

The system uses your existing Supabase schema with these key tables:

- `users`: User profiles with Notion OAuth tokens
- `tasks`: Synced tasks with Notion metadata
- `settings`: User preferences for timing and notifications

## 🚀 Railway Deployment

### Deploy to Railway

1. **Connect Repository**: Link your GitHub repo to Railway
2. **Set Environment Variables**: Add all required env vars in Railway dashboard
3. **Deploy**: Railway will automatically build and deploy

### Post-Deployment Setup

1. **WhatsApp QR Code**: Check Railway logs for QR code to scan
2. **Test Messages**: Use Railway CLI to trigger test messages
3. **Monitor Logs**: Verify cron jobs are running correctly

```bash
# Railway CLI commands
railway login
railway link [project-id]
railway logs --follow
railway run npm run status
```

## 📈 Monitoring & Health Checks

The system includes built-in health monitoring:

- **WhatsApp Connection**: Automatic reconnection attempts
- **Notion API**: Token refresh and error handling  
- **Cron Jobs**: Status tracking and manual recovery
- **Memory Usage**: Process monitoring and cleanup

Check system health:
```bash
curl https://your-railway-domain.com/health
# Or via CLI
npm run status
```

## 🔐 Security & Privacy

- **Environment Variables**: All secrets stored securely
- **OAuth Tokens**: Encrypted storage in Supabase
- **Phone Numbers**: Only group JID stored, no personal numbers
- **API Keys**: Never logged or exposed in responses

## 🐛 Troubleshooting

### Common Issues

**WhatsApp won't connect:**
```bash
# Clear session and re-authenticate
rm -rf ./wa-session
npm start
# Scan new QR code
```

**Notion sync failing:**
```bash
# Check OAuth tokens
npm run status
# Re-authenticate users if needed
```

**Messages not sending:**
```bash
# Check group JID configuration
echo $WA_GROUP_JID
# Verify WhatsApp bot is in the group
```

**Cron jobs not running:**
```bash
# Verify timezone settings
npm run status
# Check Railway logs for cron execution
```

### Getting Help

1. Check Railway logs for detailed error messages
2. Use `npm run status` for system health overview
3. Test individual components with manual triggers
4. Verify all environment variables are set correctly

## 📚 API Reference

The system exposes these internal methods for testing:

- `triggerMorningSummary()`: Send morning summary now
- `triggerEveningSummary()`: Send evening summary now  
- `triggerNotionSync()`: Run Notion sync now
- `getStatus()`: Get system status object

## 🎯 Roadmap

Future enhancements planned:

- [ ] Notion webhook support for instant updates
- [ ] Custom message templates per user
- [ ] Task priority-based notifications
- [ ] Weekly/monthly summary reports
- [ ] Integration with more task management tools

---

**Built with ❤️ for accountability partners Ilan & Sidra**

Keep each other motivated and achieve your goals together! 🚀
