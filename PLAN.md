# Accountability Partner Project — Execution Plan

This document outlines a phased plan to build an accountability partner system integrated with Notion and WhatsApp, plus a simple Next.js dashboard. It’s structured so each phase can be marked “Done” before moving to the next.

Decisions (MVP)
- WhatsApp: Use Baileys with your own number (unofficial, ToS risk accepted for dev), posting to a 2-person group (you + partner).
- Notion: Single shared database with properties: Title (title), Status (status: Todo | In Progress | Done), Due (date), Owner (people). The Notion integration will be shared on this database.
- Scheduling: One timezone initially; suggested defaults — Asia/Kolkata; warning 20:00; summary 23:55 (override in settings later).

---

## Phase 0: Prereqs & decisions
Objective
- Lock in core choices and prepare credentials.

Tasks
- Use Baileys with your number for MVP; create a 2-person WhatsApp group with your partner.
- Choose timezone and times (warning, summary). Default suggestion: Asia/Kolkata, warning 20:00, summary 23:55.
- Create a Notion internal integration; create a shared Tasks database with properties: Title (title), Status (status: Todo/In Progress/Done), Due (date), Owner (people). Share DB with the integration.

Definition of Done
- Notion token and database ID are ready.
- WhatsApp group created.
- Timezone and times decided.

---

## Phase 1: Repo scaffold
Objective
- Stand up a clean monorepo ready for dev.

Tasks
- Initialize pnpm workspace at A:\Git\Accountability with:
  - apps/web (Next.js + TypeScript)
  - apps/worker (Node + TypeScript)
  - packages/shared (shared types/config)
  - packages/db (Prisma)
- Configure TypeScript, ESLint, Prettier; add .env and .env.example:
  - NOTION_TOKEN, NOTION_DATABASE_ID, WA_GROUP_JID, TZ, WARNING_TIME, SUMMARY_TIME
- Implement hello-world servers for web and worker.

Definition of Done
- Both apps start locally and read env variables.

---

## Phase 2: Database models & migration
Objective
- Persist core data for users, settings, mirrored tasks, and notifications.

Tasks
- Define Prisma schema: User, Pair, NotionConfig, TaskMirror, TaskEvent, Notification, Settings.
- Use SQLite for dev; run initial migration; generate client.
- Seed with two users and a pair (optional for local dev).

Definition of Done
- DB created; simple read/write verified from worker and web.

---

## Phase 3: Notion client & schema mapping
Objective
- Read tasks from Notion in a typed, resilient way.

Tasks
- Implement Notion SDK wrapper and Task types.
- Map Notion properties to TaskMirror fields; handle missing fields safely.
- Add rate-limit handling/backoff.
- Script to list tasks from the DB for quick verification.

Definition of Done
- Running a “notion:pull” script lists tasks from the shared Notion DB.

---

## Phase 4: Baileys bot skeleton & auth
Objective
- Connect to WhatsApp using your number and be able to send a message.

Tasks
- Implement Baileys with persistent auth saved to ./auth; QR scan with your phone at first run.
- Add reconnection logic; utility to list groups and log their JIDs; a simple sendMessage function.

Definition of Done
- A test message is delivered to your 2-person group; group JID recorded in config.

---

## Phase 5: Notion poller & task mirroring
Objective
- Keep a local mirror of tasks and detect transitions.

Tasks
- Poll Notion by last_edited_time since last_sync_at.
- Upsert into TaskMirror; record last_edited_time.
- Generate TaskEvent when status transitions to Done; create idempotency keys for events.

Definition of Done
- Changing a task to Done in Notion creates a TaskEvent within ~1–2 minutes.

---

## Phase 6: Notification pipeline (real-time)
Objective
- Post real-time completion updates to WhatsApp.

Tasks
- Consume TaskEvents and send messages to the group with templates (e.g., “[Bot] ✅ {Owner} completed {Task} (due {date}) {link}”).
- Implement idempotency and retries with exponential backoff; structured logging.

Definition of Done
- A Done transition results in exactly one automated message to the group.

---

## Phase 7: Schedulers — warnings & daily summary
Objective
- Deliver daily accountability messages at the right times.

Tasks
- Implement schedulers (node-cron) using pair timezone.
- Warning at configured time: list Due today and not Done per owner.
- Daily summary: counts per owner (done, pending, overdue) and any overdue carry-overs; include Notion links.

Definition of Done
- Messages appear at the configured times; manual trigger works for testing.

---

## Phase 8: Web app (auth, dashboard, settings)
Objective
- Give a UI to see status and manage settings.

Tasks
- Add NextAuth (Email/Google) and basic onboarding for the pair.
- Dashboard: mirrored tasks with filters, recent events, links to Notion pages.
- Settings: Notion DB ID, timezone, warning/summary times, WhatsApp group JID, message templates.

Definition of Done
- You can log in, see data, and change settings that affect the worker.

---

## Phase 9: Admin utilities & health
Objective
- Operability and safe admin controls.

Tasks
- Endpoints/UI for manual resync, send test WhatsApp, list groups (JID discovery), health check.
- Basic rate limiting on admin actions.

Definition of Done
- Utilities work; health endpoint returns OK; rate limits protect from misuse.

---

## Phase 10: Reliability & UX polish
Objective
- Make it robust and pleasant to use.

Tasks
- Debounce frequent edits (10–30s) to avoid spam; exponential backoff on Notion/WA failures.
- Strong reconnection for Baileys; restart strategy; structured logs; better templates (mentions, links).

Definition of Done
- Smoke tests show resilience; logs are clean; messages well formatted and non-duplicative.

---

## Phase 11: Documentation
Objective
- Clear, repeatable setup and operation steps.

Tasks
- README: setup steps, .env variables, Notion integration and sharing steps, WhatsApp QR steps, run scripts.
- Security notes (don’t log secrets), backup instructions for ./auth.

Definition of Done
- A new dev can follow docs and run locally end-to-end.

---

## Phase 12: Deployment & ops (optional now)
Objective
- Keep it running reliably.

Tasks
- Local ops on Windows: run worker under pm2/nodemon; ensure ./auth persists and is backed up.
- Optional deploy: web to Vercel; worker to Railway/Render/VPS; environment secrets configured.

Definition of Done
- Services survive restart; WA session persists; backup strategy verified.

---

Next step
- If this plan looks good, we’ll start with Phase 1 (Repo scaffold) in A:\Git\Accountability, then proceed sequentially, marking each phase as Done.

