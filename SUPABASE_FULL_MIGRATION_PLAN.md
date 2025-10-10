## Phase 0 — Prerequisites (10 min)

Goal: Prepare environments and credentials so the web and worker can both use Supabase as the single source of truth.

- Supabase project is created and reachable
  - You already have: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- Supabase SQL Editor access (to run SQL once)
- Railway worker will be refactored to use Supabase (service role key)
- Web (Vercel) will keep using Supabase (anon + optional server-side service role for API routes)
- WhatsApp bot stays in worker (Railway); it will read/write data in Supabase via service role

Deliverables:
- Centralized DB = Supabase PostgreSQL
- No Prisma/Railway-Postgres usage left in worker

---

## Phase 1 — Schema & Policies (30–45 min)

Goal: Ensure Supabase schema matches app needs, and end-user access is enforced by RLS (worker uses service role and bypasses RLS automatically).

1) Apply the existing schema and policies
- Open Supabase SQL Editor
- Run contents of your repo file: supabase-rls-setup.sql
  - Enables RLS on all tables
  - Adds policies for end-user reads/writes
  - Installs trigger to auto-create public."User" row from auth.users

2) Add performance indexes
Run these in Supabase SQL Editor:

```sql
CREATE INDEX IF NOT EXISTS idx_taskmirror_owner ON "TaskMirror"("ownerId");
CREATE INDEX IF NOT EXISTS idx_taskevent_task ON "TaskEvent"("taskMirrorId");
CREATE UNIQUE INDEX IF NOT EXISTS idx_taskevent_idem ON "TaskEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS idx_notification_status ON "Notification"(status, "createdAt");
CREATE INDEX IF NOT EXISTS idx_pair_users ON "Pair"("user1Id", "user2Id");
```

3) Verify tables exist in Supabase
- User, Pair, NotionConfig, TaskMirror, TaskEvent, Notification, Settings

---

## Phase 2 — Data Migration (45–90 min)

Goal: Move all app data from Railway Postgres to Supabase so the worker and web read/write the same data.

Important:
- User IDs in Supabase must equal auth.users.id (UUID). Your trigger handles creation on signup. If you have users in Railway DB, map by email to the Supabase auth user ids and upsert accordingly.

Options:
- A) pg_dump/pg_restore (fastest if schemas match); or
- B) Safe programmatic copy via a Node script (recommended for control/idempotency)

Node upsert script (skeleton):

```ts
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const SRC = process.env.RAILWAY_DATABASE_URL!; // e.g. postgresql://user:pass@host:port/railway
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const src = new Client({ connectionString: SRC });
  await src.connect();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Example: copy Pair
  const pairs = (await src.query('SELECT * FROM "Pair"')).rows;
  for (const p of pairs) {
    // Upsert by id (string UUID)
    const { error } = await supabase.from('Pair').upsert(p, { onConflict: 'id' });
    if (error) throw error;
  }

  // Repeat for Settings, NotionConfig, TaskMirror, TaskEvent, Notification, User
  // If User mapping is required: SELECT users from Railway, fetch Supabase auth users by email,
  // map old -> new ids, and rewrite foreign keys before upsert.

  await src.end();
}

main().catch(err => { console.error(err); process.exit(1); });
```

Minimum sets to migrate:
- Pair
- Settings (ensure whatsappGroupJid is set where applicable)
- NotionConfig (databaseId, integrationToken). Optionally encrypt later (Phase 8)
- TaskMirror / TaskEvent / Notification (existing rows OK; or start fresh)
- User (only if needed; web trigger will create on next login)

Sanity checks after migration:
- SELECT counts on each table in Supabase match expectations
- A known pair has Settings.whatsappGroupJid and NotionConfig rows

---

## Phase 3 — Worker Refactor to Supabase (1.5–3 hours)

Goal: Remove Prisma + any Railway-Postgres coupling. Worker should use only Supabase client with service role key.

1) Remove Prisma from worker
- In apps/worker:
  - Remove prisma imports/usage
  - Remove prisma schema/generate steps from Dockerfile/build
- Delete code paths that perform Prisma operations

2) Add a Supabase service client factory

```ts
// apps/worker/src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // DO NOT expose publicly
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

3) Replace queries with supabase-js

- Load pair/settings/notion config for the worker scope:
```ts
const supabase = createServiceClient();

// If you use a PAIR_ID env, resolve it
const PAIR_ID = process.env.PAIR_ID;
let pairId: string | null = null;

if (PAIR_ID) {
  const { data: pair, error } = await supabase
    .from('Pair')
    .select('*')
    .eq('id', PAIR_ID)
    .single();
  if (error) throw error;
  pairId = pair.id;
}

// Settings
const { data: settings } = await supabase
  .from('Settings')
  .select('*')
  .eq('pairId', pairId!)
  .single();

// NotionConfig
const { data: notionConfig } = await supabase
  .from('NotionConfig')
  .select('*')
  .eq('pairId', pairId!)
  .single();
```

- Pull pending notifications, send, update status:
```ts
const { data: pending, error: qErr } = await supabase
  .from('Notification')
  .select('*')
  .eq('status', 'pending')
  .order('createdAt', { ascending: true })
  .limit(50);
if (qErr) throw qErr;

for (const n of pending ?? []) {
  try {
    // ... send WhatsApp using settings.whatsappGroupJid
    const messageId = 'wa_' + Date.now(); // from the client

    await supabase
      .from('Notification')
      .update({ status: 'sent', sentAt: new Date().toISOString(), messageId })
      .eq('id', n.id);
  } catch (err: any) {
    await supabase
      .from('Notification')
      .update({ status: 'failed', lastError: String(err) })
      .eq('id', n.id);
  }
}
```

- Mirror tasks from Notion with upsert:
```ts
await supabase.from('TaskMirror').upsert({
  id,              // keep stable if you have it, or let DB default uuid()
  notionId,        // UNIQUE
  title,
  status,          // 'Todo' | 'In Progress' | 'Done'
  dueDate,
  ownerId,         // must be a valid User.id (Supabase auth UID)
  lastEditedTime,
  notionUrl,
}, { onConflict: 'notionId' });
```

4) Worker environment (Railway)
- Remove DATABASE_URL
- Ensure:
  - NEXT_PUBLIC_SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - If you centralize Notion config per pair in DB, do NOT use NOTION_TOKEN env — read from NotionConfig
  - WhatsApp envs remain (WA_SESSION_NAME, WA_AUTH_PATH, etc.) if code needs them, or read whatsappGroupJid from Settings

5) Logging & safety
- Log all errors with enough context (notificationId, pairId)
- Add retry with jitter for WhatsApp send failures

---

## Phase 4 — Web App: Supabase Only (Done/Verify)

Goal: Ensure the web app uses Supabase exclusively for auth and DB.

- Remove any remaining Prisma usage in web API routes/components
- Verify API routes use createServerSupabaseClient or service role only when strictly necessary (server-side admin ops)
- Optional Realtime: subscribe to TaskMirror/TaskEvent changes

```ts
const channel = supabase.channel('task_updates').on(
  'postgres_changes',
  { event: '*', schema: 'public', table: 'TaskMirror' },
  (payload) => {
    // update UI state
  }
).subscribe();
```

---

## Phase 5 — Environment Matrix (15 min)

Web (Vercel):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- (Optional for server routes) SUPABASE_SERVICE_ROLE_KEY — keep secret and server-only if used

Worker (Railway):
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (required)
- Remove DATABASE_URL
- WhatsApp envs (if applicable): WA_SESSION_NAME, WA_AUTH_PATH, WA_PRINT_QR (false), etc.
- If pair-specific configs are in DB: PAIR_ID (optional) OR derive pairs dynamically

---

## Phase 6 — Cutover Plan (60–90 min)

1) Freeze writes in old Railway DB (optional but recommended)
2) Final data copy to Supabase (re-run Node upsert with onConflict)
3) Deploy worker with Supabase-only build (no Prisma, no DB push)
4) Verify worker logs:
   - No Prisma output
   - Notion poll OK
   - Notifications processed and Sent (look for message IDs)
5) Deploy web (already using Supabase)
6) Monitor for 24–48 hours, then decommission Railway Postgres

Rollback Plan:
- Keep a feature flag/env to switch worker back to Railway DB for a short window if necessary (only during migration)
- Keep the migration script to re-sync if needed

---

## Phase 7 — System Testing

End-to-end tests after worker cutover:
- Web signup/signin → ensure public."User" row is auto-created
- Onboarding → creates Pair, NotionConfig, Settings in Supabase
- Notion change → worker writes TaskMirror/TaskEvent/Notification in Supabase, WhatsApp sends
- Dashboard → shows TaskMirror & recent TaskEvent (Supabase data)
- Settings updates → change times and whatsappGroupJid, verify worker uses them
- Multi-user/pair flows → ensure RLS allows only the right views for each signed-in user

---

## Phase 8 — Observability & Hardening

- Indexes applied (Phase 1)
- Notification pipeline: add retry/backoff, capture lastError consistently
- Add simple operational dashboards (e.g., count pending notifications, last poll time)
- Backups (Supabase has automated backups)
- Optional: Encrypt Notion integrationToken at rest (pgcrypto) or keep in secrets manager
- Rate limiting for WhatsApp if needed

Optional encryption sketch:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE "NotionConfig" ADD COLUMN IF NOT EXISTS "integrationTokenEnc" bytea;
-- Set DB GUC once: ALTER DATABASE postgres SET app.encryption_key = '<KMS_OR_ENV_KEY>';

-- Migrate (example only)
UPDATE "NotionConfig"
SET "integrationTokenEnc" = pgp_sym_encrypt("integrationToken", current_setting('app.encryption_key'))
WHERE "integrationTokenEnc" IS NULL;
```

---

## Common Pitfalls

- Mixing DBs: Once worker is on Supabase, remove any usage of Railway Postgres + Prisma
- User ID alignment: public."User".id must equal Supabase auth UID
- Policies: Test with a real signed-in user to confirm RLS is correct (worker bypasses RLS via service role)
- WhatsApp group: Ensure the bot is a member and Settings.whatsappGroupJid is set per pair in Supabase
- Notion properties: Status values must exactly match ('Todo' | 'In Progress' | 'Done')

---

## Concrete Next Actions

1) Apply Phase 1 SQL (RLS + indexes) in Supabase
2) Choose migration method and run Phase 2 (recommend Node upsert script)
3) Refactor worker per Phase 3 (remove Prisma, add supabase-js, replace queries)
4) Configure envs per Phase 5 (remove DATABASE_URL, add service role key)
5) Execute cutover per Phase 6, validate with Phase 7 tests
6) Harden and observe per Phase 8

If you’d like, I can:
- Generate a ready-to-run migration script that maps users by email
- Patch the worker to remove Prisma and add supabase-js queries
- Add small diagnostics endpoints/CLIs to validate data paths

