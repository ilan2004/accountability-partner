# Accountability Partner

A system to help accountability partners track tasks and stay on top of commitments through Notion integration and WhatsApp notifications.

## Overview

This project integrates with:
- **Notion**: For task management and tracking
- **WhatsApp**: For real-time notifications and daily summaries
- **Web Dashboard**: For viewing progress and managing settings

## Project Structure

```
accountability/
├── apps/
│   ├── web/        # Next.js web dashboard
│   └── worker/     # Background worker for polling and notifications
├── packages/
│   ├── shared/     # Shared types and configurations
│   └── db/         # Prisma database layer
└── plan.md         # Detailed project plan and phases
```

## Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd accountability
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your actual values:
   - `NOTION_TOKEN`: Your Notion integration token
   - `NOTION_DATABASE_ID`: Your shared Notion database ID
   - `WA_GROUP_JID`: Your WhatsApp group JID
   - Other settings as needed

4. **Set up the database**
   ```bash
   cd packages/db
   pnpm db:push
   ```

5. **Run the development servers**
   ```bash
   # In the root directory
   pnpm dev
   ```

## Development

- **Web app**: Runs on http://localhost:3000
- **Worker**: Runs in the background, checking for tasks and sending notifications

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Node.js worker with TypeScript
- **Database**: Prisma with SQLite (dev) / PostgreSQL (prod)
- **Integrations**: Notion API, WhatsApp (Baileys)

## License

MIT
