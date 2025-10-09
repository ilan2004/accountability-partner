# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project: Accountability Partner — monorepo (pnpm workspaces) for a Next.js web dashboard and a TypeScript worker that integrates Notion and WhatsApp. Database via Prisma. See README.md for overview and setup.

Commands (PowerShell-friendly)

- Install dependencies (root and all workspaces):
  ```bash path=null start=null
  pnpm install
  ```

- Run all apps in development (parallel):
  ```bash path=null start=null
  pnpm dev
  ```

- Run a single package in development:
  ```bash path=null start=null
  pnpm --filter @accountability/web dev
  pnpm --filter @accountability/worker dev
  pnpm --filter @accountability/shared dev
  ```

- Build all packages/apps:
  ```bash path=null start=null
  pnpm build
  ```

- Build a single package/app:
  ```bash path=null start=null
  pnpm --filter @accountability/web build
  pnpm --filter @accountability/worker build
  pnpm --filter @accountability/shared build
  pnpm --filter @accountability/db build  # runs prisma generate
  ```

- Lint (root runs across workspaces using eslint.config.mjs):
  ```bash path=null start=null
  pnpm lint
  ```

- Type-check across workspaces:
  ```bash path=null start=null
  pnpm type-check
  ```

- Start (production-like):
  ```bash path=null start=null
  pnpm --filter @accountability/web start   # Next.js
  pnpm --filter @accountability/worker start
  ```

- Database (from packages/db):
  ```bash path=null start=null
  pnpm --filter @accountability/db db:generate    # prisma generate
  pnpm --filter @accountability/db db:push        # push schema (dev)
  pnpm --filter @accountability/db db:migrate     # create/apply dev migration
  pnpm --filter @accountability/db db:studio      # open Prisma Studio
  pnpm --filter @accountability/db db:seed        # run seed
  ```

- Worker utility scripts (useful for local verification):
  ```bash path=null start=null
  pnpm --filter @accountability/worker poll:once       # single Notion poll cycle
  pnpm --filter @accountability/worker notify:once     # process pending notifications once
  pnpm --filter @accountability/worker schedule:test   # exercise schedulers
  pnpm --filter @accountability/worker notion:test     # Notion connectivity
  pnpm --filter @accountability/worker whatsapp:setup  # initialize WhatsApp session (QR)
  pnpm --filter @accountability/worker wa:test         # send test message
  ```

- Web API quick checks:
  ```bash path=null start=null
  # With dev server running (@accountability/web):
  # GET http://localhost:3000/api/test-db
  ```

Notes on testing

- No unit test framework or test scripts are configured in this repo, and no test files were found. The worker provides task-specific scripts (above) that function as integration checks.

Environment and configuration

- Root .env management is expected (see README.md). Typical variables observed in code:
  - Web (NextAuth providers): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD, EMAIL_FROM
  - Database: DATABASE_URL (Prisma datasource; SQLite in dev by default)
  - Worker: dotenv is used; Notion and WhatsApp details are primarily persisted in the database via onboarding/settings APIs
- Setup flow from README.md:
  - Copy .env.example to .env and populate values
  - Initialize database via packages/db scripts
  - Run pnpm dev at repo root

Linting and formatting

- ESLint (flat config in eslint.config.mjs) with @typescript-eslint and Prettier compatibility. Ignores: dist, node_modules, .next, coverage. Run via pnpm lint.
- Prettier configured in .prettierrc.

High-level architecture

- Monorepo: pnpm workspaces
  - apps/web (Next.js)
    - Pages-based routing (src/pages/*) with API routes under src/pages/api
    - Auth via next-auth with PrismaAdapter; session strategy 'database'
    - API endpoints:
      - POST /api/onboarding: creates Pair, stores NotionConfig, default Settings
      - GET/POST /api/settings: fetch and update pair settings and Notion databaseId (token handled server-side)
  - apps/worker (TypeScript)
    - Notion integration (apps/worker/src/notion/*): NotionClient fetches tasks either full or incrementally (last_edited_time), parses into NotionTask
    - WhatsApp integration (apps/worker/src/whatsapp/*): wrapper around Baileys; manages connection lifecycle, QR onboarding, reconnection
    - Services (apps/worker/src/services/*):
      - NotionPollerService: polls Notion on interval; upserts TaskMirror; emits TaskEvent with idempotency key to avoid duplicates
      - NotificationService: consumes TaskEvent, formats messages, sends via WhatsApp with retries and exponential backoff; records Notification status
      - SchedulerService: cron-based daily warning and summary; delegates to WarningScheduler and DailySummaryScheduler using per-pair Settings (timezone and times)
  - packages/db (Prisma)
    - Prisma schema models core domain:
      - User, Pair (two-user link), NotionConfig (databaseId + integrationToken), Settings (timezone, times, templates, WhatsApp JID)
      - TaskMirror (Notion task projection), TaskEvent (state transitions and completion), Notification (delivery tracking)
      - NextAuth tables: Account, Session, VerificationToken
    - Exports a singleton PrismaClient for reuse across web and worker
  - packages/shared
    - Shared TS library built with tsc; used by web and worker

Data flow overview

1) Web onboarding persists a Pair with NotionConfig and default Settings
2) Worker NotionPollerService periodically syncs Notion tasks into TaskMirror and emits TaskEvent on creation or status change
3) NotificationService scans TaskEvent and sends formatted WhatsApp messages to the pair group; updates Notification status and marks events processed
4) SchedulerService sends daily warnings/summaries based on Settings (timezone, times), summarizing due/overdue and completion rates

Conventions and tips specific to this repo

- Use pnpm --filter to target a specific workspace for any script (dev, build, start, db:*).
- The worker’s WhatsApp session bootstrap displays a QR in-terminal; run the whatsapp:setup script to establish a local auth session directory (apps/worker/auth/<sessionName>).
- Prisma uses SQLite by default in development (see packages/db/prisma/schema.prisma). Update DATABASE_URL to switch providers.

