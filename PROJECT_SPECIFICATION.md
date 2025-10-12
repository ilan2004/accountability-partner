# Accountability Partner System - Project Specification

## Project Overview

**Name**: Accountability Partner System  
**Description**: A smart accountability system between Ilan and Sidra integrating Notion OAuth, Supabase, Baileys (WhatsApp), and Gemini 1.5 Flash. The system synchronizes tasks from Notion, sends reminders and summaries via WhatsApp, and maintains a simple Next.js dashboard.

### Deployment Architecture
- **Backend**: Railway
- **Database**: Supabase (PostgreSQL)  
- **Frontend**: Next.js (hosted on Railway)
- **Timezone**: Asia/Kolkata (IST)

## Authentication
- **Provider**: Notion OAuth
- **Auth Flow**: Users log in via Notion OAuth handled through Supabase Auth, redirected to the Next.js dashboard after authentication.

## Users
- **Current Users**: Ilan, Sidra
- **Type**: Private pair
- **WhatsApp Group**: Accountability Group (Ilan + Sidra + Bot)

## Data Flow Architecture

### Task Source: Notion
- **Sync Logic**: A background service periodically (every 5 mins) syncs tasks from each user's connected Notion workspace into Supabase.

### Task Structure
**Fields**:
- Task name
- Status  
- Assignee
- Due date
- Priority
- Description
- Effort level

**Enums**:
- **Status**: `["not_started", "in_progress", "done"]`
- **Priority**: `["low", "medium", "high"]`  
- **Effort Level**: `["low", "medium", "high"]`

## WhatsApp Integration (Baileys)

### Connection
- Initially local development
- Deployed on Railway for production

### Message Flows

#### 1. Daily Morning Message
- **Time**: 06:00 IST
- **Trigger**: Cron job
- **Behavior**: Fetch both users' tasks from Supabase (synced from Notion). If a user has no tasks for the day, Gemini generates a message like "Sidra hasn't added tasks yet."
- **Gemini Processing**: Gemini formats the tasks list into a natural, friendly message with emojis and sections.

**Example Output**:
```
🌅 Good morning!
Here are today's tasks:

🧑‍💻 Ilan
1. Finish client report
2. Edit product photos

👩‍🎓 Sidra
(Sidra hasn't added tasks yet.)
```

#### 2. Task Update Trigger
- **Trigger**: Notion webhook or periodic sync detects change (task added/updated/done)
- **Behavior**: Gemini generates a contextual update message (e.g., "Sidra added 2 new tasks — updated list below ↓")
- **Backend Action**: Send message to WhatsApp group with refreshed task list

#### 3. Task Completion
- **Trigger**: Detected status change in Notion → 'done'
- **Behavior**: Send message: "✅ Task 'Edit video' marked as done."
- **Follow-up**: Gemini regenerates and sends an updated list for that user

#### 4. End of Day Summary
- **Time**: 22:00 IST
- **Trigger**: Cron job
- **Gemini Processing**: Generate a daily performance summary — completed vs pending tasks, positive and contextual tone

**Example Output**:
```
🌙 End of Day Summary:

🧑‍💻 Ilan — 3/4 tasks completed
👩‍🎓 Sidra — 4/5 tasks completed

Strong consistency today 🔥 Keep it rolling!
```

## Gemini 1.5 Flash Integration

### Roles
1. **Message Formatting**: Generate structured, human-friendly summaries of tasks (morning + end-of-day)
2. **Contextual Updates**: Rephrase and personalize updates (e.g., "Sidra added a new task about research — updated list below.")
3. **Missing Task Detection**: Identify when a user has not added tasks and generate corresponding messages
4. **Summary Analysis**: At 10 PM, calculate completion rate and tone-adjusted motivational message

### API Flow

**Input Format**:
```json
{
  "user_data": {
    "ilan_tasks": [
      {"task_name": "Finish client report", "status": "in_progress"},
      {"task_name": "Edit product photos", "status": "done"}
    ],
    "sidra_tasks": []
  },
  "context": {"time": "06:00 IST", "date": "2025-10-12"}
}
```

**Output Format**:
```json
{
  "message": "🌅 Good morning! Here are today's tasks:\n\n🧑‍💻 Ilan\n1. Finish client report\n2. Edit product photos\n\n👩‍🎓 Sidra\n(Sidra hasn't added tasks yet.)"
}
```

## Frontend (Next.js)

### Features
1. **Notion OAuth Login**: Via Supabase Auth
2. **Dashboard**: Personal task list, synced from Notion
3. **Progress Graphs**: Completed vs pending visualization
4. **Settings**: Configure reminder and summary times (default 6 AM / 10 PM)

### Routes
- `/login` - Authentication page
- `/dashboard` - Main task dashboard
- `/settings` - User preferences

## Edge Case Handling

### Same Task Names
**Solution**: Allowed; tasks are distinguished by Notion ID

### Missing Tasks
**Solution**: Gemini adds a note in morning message if one user hasn't added tasks

### Network Failure  
**Solution**: Baileys retries message send up to 3 times before logging error

### Notion Sync Failure
**Solution**: Fallback to last cached data in Supabase

## Cron Jobs Schedule

1. **06:00 IST** — Morning Task Message
2. **22:00 IST** — End-of-Day Summary  
3. **Every 5 minutes** — Sync Notion updates to Supabase

## Key System Flows

### Morning Flow (6 AM)
1. Cron job triggers
2. Fetch latest tasks from Supabase (already synced from Notion)
3. Send task data to Gemini for formatting
4. Gemini generates friendly morning message
5. WhatsApp bot sends message to group

### Task Update Flow
1. User updates task in Notion
2. Background sync (every 5 min) detects change
3. Task updated in Supabase
4. Change detection triggers WhatsApp update
5. Gemini formats contextual update message
6. WhatsApp bot sends update to group

### Evening Summary Flow (10 PM)
1. Cron job triggers
2. Calculate completion rates from Supabase data
3. Send stats to Gemini for summary generation
4. Gemini creates motivational end-of-day message
5. WhatsApp bot sends summary to group

## Technical Architecture

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

This system creates a seamless accountability loop where both users can focus on their Notion workspace for task management while staying connected and motivated through automated WhatsApp updates powered by AI-generated contextual messaging.
