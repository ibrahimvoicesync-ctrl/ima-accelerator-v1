---
phase: 35-chat-system
plan: "01"
subsystem: api
tags: [chat, polling, messages, api-routes, date-fns, zod, csrf, rate-limit]

# Dependency graph
requires: []
provides:
  - usePolling hook (useRef pattern, 5s interval, enabled flag, stale-closure safe)
  - chat-utils: formatDaySeparator, formatMessageTime, formatRelativeTime, groupMessagesByDay, shouldShowTimestamp, isConsecutive
  - MESSAGE_POLL_INTERVAL=5000, MESSAGE_PAGE_SIZE=30, MAX_MESSAGE_LENGTH=2000
  - MessageWithSender, MessageGroup, ConsecutiveGroup types
  - GET /api/messages: no CSRF/rate-limit, cursor pagination, conversation summaries mode
  - POST /api/messages: CSRF + rate limit + Zod, 1:1 and broadcast, 2000 char max
  - PATCH /api/messages/read: CSRF, no rate limit, bulk read_at update
  - messages table Row/Insert/Update types in src/lib/types.ts
affects: [35-03, 35-04, 35-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef callback pattern for polling (prevents stale closures in setInterval)"
    - "GET polling routes omit CSRF and rate limit (consistent with /api/calendar)"
    - "PATCH mark-as-read omits rate limit (fires at most once per conversation open)"
    - "conversation summaries via JS aggregation of last 200 messages"

key-files:
  created:
    - src/lib/hooks/usePolling.ts
    - src/lib/chat-utils.ts
    - src/app/api/messages/route.ts
    - src/app/api/messages/read/route.ts
  modified:
    - src/lib/types.ts

key-decisions:
  - "GET /api/messages has no rate limit — polling every 5s would exhaust 30 req/min cap in 2.5 min"
  - "PATCH /api/messages/read has no rate limit — fires at most once per conversation open"
  - "messages table TypeScript types added to types.ts for TypeScript compilation (migration 00015 created by parallel plan)"
  - "Conversation summaries built via JS aggregation (last 200 msgs) to avoid RPC requirement in wave 1"
  - "Student query OR-filter: DMs to/from student + all broadcasts from coach_id"

patterns-established:
  - "usePolling pattern: useRef stores callback, second useEffect runs interval with [intervalMs, enabled] deps"
  - "chat-utils: all timestamp formatting and message grouping utilities are pure functions, no React dependency"

requirements-completed: [CHAT-03, CHAT-04, CHAT-05, CHAT-07, CHAT-08, CHAT-12]

# Metrics
duration: 25min
completed: 2026-04-04
---

# Phase 35 Plan 01: Chat System API Backend Summary

**Polling hook (useRef stale-closure safe), date-fns timestamp utilities, and three API routes (GET poll/POST send/PATCH read) for the chat system data layer**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-04T00:00:00Z
- **Completed:** 2026-04-04T00:25:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- usePolling hook with useRef callback pattern prevents stale closures in 5-second polling interval
- chat-utils exports all timestamp formatters (formatDaySeparator, formatMessageTime, formatRelativeTime), groupMessagesByDay, shouldShowTimestamp, isConsecutive, and three constants (MESSAGE_POLL_INTERVAL, MESSAGE_PAGE_SIZE, MAX_MESSAGE_LENGTH)
- Three API route handlers: GET (no CSRF/rate limit, cursor pagination, conversation summaries), POST (CSRF + rate limit + Zod, 2000 char max, 1:1 and broadcast), PATCH read (CSRF, no rate limit, bulk read_at)
- messages table Row/Insert/Update TypeScript types added to types.ts so downstream plans compile

## Task Commits

Each task was committed atomically:

1. **Task 1: Create usePolling hook and chat utility functions** - `8595beb` (feat)
2. **Task 2: Create GET/POST /api/messages and PATCH /api/messages/read API routes** - `b070036` (feat)

## Files Created/Modified
- `src/lib/hooks/usePolling.ts` - React hook: useRef callback pattern, setInterval, enabled toggle, cleanup
- `src/lib/chat-utils.ts` - Pure functions: timestamp formatters, message grouping, 3 chat constants, MessageWithSender/MessageGroup/ConsecutiveGroup types
- `src/app/api/messages/route.ts` - GET (polling, no CSRF/rate-limit, pagination, conversation summaries) + POST (CSRF, rate-limit, Zod, broadcast)
- `src/app/api/messages/read/route.ts` - PATCH: CSRF, no rate-limit, bulk read_at update by role
- `src/lib/types.ts` - Added messages table Row/Insert/Update/Relationships types

## Decisions Made
- GET /api/messages has no rate limit by design (polling every 5s would exhaust the 30 req/min cap in 2.5 minutes)
- PATCH /api/messages/read has no rate limit (fires at most once per conversation open, not user-controlled frequency)
- Conversation summaries built via JS aggregation of last 200 messages rather than an RPC — avoids a database migration dependency in wave 1
- messages TypeScript types added manually to types.ts since migration 00015 is created by a parallel plan; this unblocks TypeScript compilation for all chat files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added messages table TypeScript types to types.ts**
- **Found during:** Task 2 (API routes creation)
- **Issue:** src/lib/types.ts had no `messages` table entry; API routes and chat-utils use MessageWithSender type which extends the messages Row — without the type, TypeScript compilation would fail for all chat plans
- **Fix:** Added messages Row/Insert/Update/Relationships to Database type in types.ts, matching the schema in the PLAN.md interface block
- **Files modified:** src/lib/types.ts
- **Verification:** npx tsc --noEmit exits 0
- **Committed in:** b070036 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical type)
**Impact on plan:** Essential for TypeScript compilation. Migration 00015 with actual DB schema is owned by a separate plan. No scope creep.

## Issues Encountered
- Supabase JS `.update().select("*", { count: "exact", head: true })` — the `select()` on update doesn't accept a second options argument; fixed to `.select("id")` and count via `.length`

## Known Stubs
None — all API routes are fully implemented with real database queries. No hardcoded/placeholder values.

## Next Phase Readiness
- usePolling hook ready for import in coach and student chat page components (35-03, 35-04)
- GET /api/messages ready for polling; POST ready for send; PATCH ready for mark-as-read
- MessageWithSender, MessageGroup, ConsecutiveGroup types ready for chat UI components
- Plan 35-02 (nav config + badge RPC) runs in parallel — no blocking dependency

---
*Phase: 35-chat-system*
*Completed: 2026-04-04*
