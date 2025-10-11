# Implementation Plan: Task Notifications, Error Handling, and Cost Optimization

This document combines the product behavior plan (aggregate task list on new task creations, completion notifications) with a robust error-handling strategy and Railway credits optimization. It is organized phase-by-phase for incremental delivery and safe rollouts.

## Goals
- After new tasks are created, send one “Current Tasks” list message. If another task is created later, re-send the updated list.
- When a task is completed, send a celebratory completion notification.
- Prevent repeated failures and reduce idle compute and log noise to avoid wasting Railway credits.

## Current Behavior (Summary)
- Notion poller fetches changes and writes TaskMirror. Events are generated in TaskEvent: created, status_changed (coerced to completed when newStatus=Done). Debounce + idempotency.
- Notification processor sends per-event messages using MessageFormatter; logs failures, retries with basic backoff, and marks event processed on success.
- WhatsApp client sends messages and logs detailed send attempts; sanitizes text.
- Daily warning and summary schedulers send list messages at configured times.

Key files:
- apps/worker/src/services/notion-poller-supabase.ts
- apps/worker/src/services/notification-service-supabase.ts
- apps/worker/src/whatsapp/client.ts
- apps/worker/src/services/message-formatter.ts
- apps/worker/src/services/warning-scheduler-supabase.ts
- apps/worker/src/services/daily-summary-scheduler-supabase.ts
- apps/worker/src/lib/supabase.ts (helpers and types)

## Target Behavior (Summary)
- On creation bursts: aggregate any ‘created’ events and send a single “Current Tasks” list message representing all open tasks; mark related events processed.
- On subsequent single creations: send the updated task list again (after a short aggregation window).
- On completion: send a celebratory message (optionally include remaining-open count).
- Robust error classification and next-attempt scheduling to avoid retry storms.
- Dynamic backoff for idle loops; optional single-shot cron mode; optional on-demand WhatsApp connection.

---

## Phase 1: Aggregate “Current Tasks” list for creations

Scope
- When one or more TaskEvent rows are of type created in a batch/window, send exactly one WhatsApp message with the current open task list for the pair. Mark those events as processed and avoid per-task created messages.

Changes
- Message formatting
  - Add a list builder (new function or class) to build “[Bot] 📋 Current Tasks” grouped by owner with bullets including title and Notion link; include due dates if present.
  - Location: apps/worker/src/services/message-formatter.ts (or new helper file).
- Notification processing
  - In apps/worker/src/services/notification-service-supabase.ts processUnsentEvents:
    - Partition unprocessed events by eventType.
    - If any ‘created’ present:
      - Fetch all open tasks (status != 'Done') via SupabaseWorkerHelpers.getAllTasksForPair.
      - Send one list message to WhatsApp.
      - Mark all ‘created’ TaskEvent rows processed. Option A: create one Notification tied to the most recent created event, mark others processed without creating extra Notification rows.
  - Introduce a small aggregation window (e.g., 5–10s) so multiple creations in the same poll cycle burst result in one message.

Env/config
- TASK_LIST_ON_CREATE=true/false
- TASK_LIST_AGGREGATION_WINDOW_MS=5000-10000

Acceptance criteria
- Creating multiple tasks in Notion within a minute results in one “Current Tasks” message.
- Creating another task later triggers another updated list message.
- No per-task created messages are sent anymore.

---

## Phase 2: Completion notifications refinement

Scope
- Keep completion messages for eventType=completed. Optionally include a “Remaining open tasks: N” line.

Changes
- In NotificationService, when processing a completed event, query count of open tasks (status != 'Done') and append line to the message (configurable).

Env/config
- COMPLETION_INCLUDE_REMAINING_COUNT=true/false

Acceptance criteria
- When marking a task as Done, the WhatsApp group receives a celebratory message with optional remaining-open count.

---

## Phase 3: Notification state machine and error classification

Scope
- Prevent repeated “Failed to send notification” loops. Distinguish permanent vs transient errors. Schedule retries with nextAttemptAt instead of tight loops.

DB
- Add Notification.nextAttemptAt TIMESTAMP NULL.
- Add an index on Notification(status, nextAttemptAt) and on TaskEvent(processedAt).
- Status remains a string; supported values: pending, processing, sent, permanently_failed.

Processing logic
- processUnsentEvents should select notifications where status in {pending, processing} and (nextAttemptAt IS NULL OR nextAttemptAt <= now()).
- On each attempt:
  - Set status=processing at the start.
  - If permanent configuration error (e.g., no WhatsApp group configured, invalid JID) → set status=permanently_failed; mark TaskEvent processed; do not retry.
  - If transient error (not connected, timeouts) → compute backoff with jitter, set nextAttemptAt, keep status=pending.
  - On success → set status=sent, set sentAt, and mark TaskEvent processed.
- Ensure that if any Notification exists with status in {sent, permanently_failed} for a TaskEvent, we mark that TaskEvent processed and skip.

Supabase helpers
- Update getUnprocessedTaskEvents or add a new query to join/find eligible notifications by nextAttemptAt; or manage eligibility entirely within NotificationService.

Acceptance criteria
- Permanent misconfigurations immediately stop retrying for affected events and mark them processed with permanently_failed.
- Transient failures are retried based on nextAttemptAt; no tight retry loops.

---

## Phase 4: Dynamic backoff for idle loops

Scope
- Reduce CPU/wakeups when there’s no work.

Changes
- Notion poller (apps/worker/src/services/notion-poller-supabase.ts)
  - Track currentPollInterval. If a cycle returns 0 changed/processed tasks → increase interval exponentially up to a cap (e.g., 30–180s). If changes found → reset to min (e.g., 15–30s).
- Notification service (apps/worker/src/services/notification-service-supabase.ts)
  - Track currentProcessInterval. If no events eligible for processing → increase interval exponentially up to a cap (e.g., 5–60s). Reset to min when work appears.

Env/config
- POLLER_MIN_INTERVAL_MS, POLLER_MAX_INTERVAL_MS
- NOTIFIER_MIN_INTERVAL_MS, NOTIFIER_MAX_INTERVAL_MS
- BACKOFF_FACTOR (default 2)

Acceptance criteria
- When idle, loops slow down to max interval. When work appears, they reset to min interval.

---

## Phase 5: Optional on-demand WhatsApp connection

Scope
- Avoid keeping the WhatsApp socket connected 24/7.

Changes
- Add a strategy in NotificationService and SchedulerService to:
  - Connect when there is work to send (or a scheduled send triggers), send all, then disconnect after an idle timeout.
- Persist auth so reconnections are fast.
- Provide WA_ON_DEMAND=true/false. If false, keep current always-on behavior.

Acceptance criteria
- With WA_ON_DEMAND=true, the service only connects for bursts, reducing baseline compute and egress. Scheduled messages still go out.

---

## Phase 6: Observability and log noise reduction

Scope
- Make logs actionable and less noisy.

Changes
- Standardize structured fields on logs: { eventId, notificationId, eventType, attempt, reason }.
- Downgrade repetitive transient errors to debug or warn. Keep one-line summaries per cycle.
- Add periodic counters (every N minutes) summarizing processed/sent/permanently_failed.

Acceptance criteria
- Logs are readable and sparse at info level; detailed traces available at debug.

---

## Phase 7: Edge cases and UX

Unassigned tasks policy
- Choose one:
  - Skip tasks with no matched user (current behavior).
  - Show under an “Unassigned” section in task list.
  - Auto-create placeholder users for unknown Notion owners.

Message size safety
- If the “Current Tasks” list is very long, send first N per owner and summarise the rest (with counts + link hints). Configurable.

Settings cache
- Cache Pair/Settings for short TTL (e.g., 60s) to reduce DB reads for each event.

Feature flags
- ENABLE_POLLER, ENABLE_NOTIFIER, ENABLE_SCHEDULER.
- TASK_LIST_ON_CREATE, COMPLETION_INCLUDE_REMAINING_COUNT, WA_ON_DEMAND.

Acceptance criteria
- No surprises when owners are missing; list messages fit comfortably; fewer DB round-trips for settings.

---

## Phase 8: Tests, scripts, and runbooks

Unit tests
- List builder formats grouped tasks with links, due dates, and owner sections.
- Error classifier maps specific errors to permanent vs transient correctly.
- Backoff calculation includes jitter and respects max caps.

Integration tests
- Creating multiple tasks quickly sends one “Current Tasks” message.
- A later single creation sends an updated list.
- Completion sends a celebratory message with optional remaining count.
- Permanent config errors generate permanently_failed notifications and do not retry.

Scripts
- Extend apps/worker/src/scripts/notify-once.ts or add a new test script to simulate batches and verify Notification/TaskEvent states and logs.

Runbooks
- Startup sanity checks: env presence, JID present, WhatsApp auth available.
- Troubleshooting matrix: connection issues, Notion rate limits, Supabase errors.

---

## Database migration (minimal)

- Add Notification.nextAttemptAt TIMESTAMP NULL.
- Indexes:
  - Notification(status, nextAttemptAt)
  - TaskEvent(processedAt)
- No changes to enums; status remains string with values we document.

---

## Environment variables (proposed)

```env path=null start=null
# Feature gates
ENABLE_POLLER=true
ENABLE_NOTIFIER=true
ENABLE_SCHEDULER=true
WA_ON_DEMAND=false
TASK_LIST_ON_CREATE=true
COMPLETION_INCLUDE_REMAINING_COUNT=true

# Aggregation
TASK_LIST_AGGREGATION_WINDOW_MS=8000

# Backoff controls
POLLER_MIN_INTERVAL_MS=30000
POLLER_MAX_INTERVAL_MS=180000
NOTIFIER_MIN_INTERVAL_MS=5000
NOTIFIER_MAX_INTERVAL_MS=60000
BACKOFF_FACTOR=2

# Retry behavior
NOTIFY_MAX_RETRIES=3
NOTIFY_RETRY_BASE_DELAY_MS=1000
NOTIFY_RETRY_MAX_DELAY_MS=30000
```

---

## Implementation checklist by file

- apps/worker/src/services/message-formatter.ts
  - Add list builder (formatTaskListByOwner) with due date and links; handle long lists (truncate + counts).
- apps/worker/src/services/notification-service-supabase.ts
  - Aggregate created events; send one list; mark all created events processed.
  - Implement nextAttemptAt logic; set processing/pending/sent/permanently_failed appropriately.
  - Classify permanent vs transient errors; stop retrying permanent.
  - Dynamic processInterval backoff.
- apps/worker/src/services/notion-poller-supabase.ts
  - Dynamic pollInterval backoff.
- apps/worker/src/lib/supabase.ts
  - Extend helpers as needed (e.g., a helper to fetch open tasks, or reuse getAllTasksForPair and filter in code).
- apps/worker/src/whatsapp/client.ts
  - Optional: expose connect/disconnect helpers for on-demand.
- apps/worker/src/index.ts
  - Feature gates for services; optional WA_ON_DEMAND wiring.

---

## Permanent vs transient error classification (initial rules)

Permanent
- Missing/invalid WhatsApp group JID.
- Invalid JID error returned by API (if detectable).
- Missing critical env vars (PAIR_ID, NOTION_TOKEN, NOTION_DATABASE_ID) → log once and exit gracefully; do not reboot-loop.

Transient
- WhatsApp not connected, timeouts, intermittent network errors.
- Supabase temporary outages.
- Notion rate limits.

Action
- Permanent → status=permanently_failed, mark TaskEvent processed.
- Transient → compute nextAttemptAt, keep status=pending, retry later.

---

## Cost-saving options and modes

- Dynamic backoff for idle loops (Phase 4) – default.
- Cron single-shot mode (optional): run pollOnce + processUnsentEvents then exit; schedule every 1–5 minutes if near real-time is not required.
- WA_ON_DEMAND=true to only connect for bursts and scheduled sends.
- Reduce log verbosity and avoid serializing large payloads.

---

## Acceptance criteria (global)

- Created tasks result in aggregated “Current Tasks” messages instead of per-task spam.
- Completed tasks still send a single celebratory message.
- No repeated failure loops for permanent problems; such notifications are classified and closed.
- When idle, worker loops back off to their caps; on activity, they reset to min interval.
- Optional modes further reduce runtime/credits without losing reliability.

---

## Rollout plan

1) Phase 1–2 (behavior): Implement list aggregation for creations and refine completion messages.
2) Phase 3 (state machine): Add nextAttemptAt + classification; add DB column and indexes.
3) Phase 4 (backoff): Introduce dynamic backoff for poller/notifier.
4) Phase 6 (observability): Tighten logs and counters.
5) Phase 5/7/8 (optional + polish): On-demand WA, unassigned policy, tests/runbooks.

Use feature flags to toggle new behaviors on slowly; default to safe values.

---

## Open decisions

- Unassigned policy: skip, list under “Unassigned”, or auto-create placeholder? (Recommend “Unassigned” section.)
- Message length limits: cap per owner or total lines? (Recommend cap with summary counts.)
- On-demand WhatsApp: enable now or later? (Recommend later, after stability with backoff.)

