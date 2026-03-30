# Phase 22: Spike Protection & Rate Limiting - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

All mutation API routes enforce a 30 requests/minute per-user-per-endpoint limit backed by a Supabase `rate_limit_log` table, so the limit is consistent across all serverless container instances. Includes a cleanup pg_cron job and a `checkRateLimit()` async helper with atomic INSERT + COUNT pattern.

</domain>

<decisions>
## Implementation Decisions

### Route Coverage
- **D-01:** Rate limit ALL mutation routes (POST/PATCH/DELETE), not just student-facing ones. Admin routes (invites, magic-links, assignments, alert dismiss) are included — an admin route getting hammered is just as bad, and the cost of adding `checkRateLimit()` everywhere is near zero.
- **D-02:** Full list of routes to protect:
  - `POST /api/reports` (student report submission)
  - `PATCH /api/reports/[id]/review` (coach marks report reviewed)
  - `POST /api/work-sessions` (start session)
  - `PATCH /api/work-sessions/[id]` (update/complete/abandon session)
  - `PATCH /api/roadmap` (update roadmap progress)
  - `POST /api/invites` (create invite)
  - `POST /api/magic-links` (create magic link)
  - `PATCH /api/magic-links` (update magic link)
  - `PATCH /api/assignments` (assign student to coach)
  - `POST /api/alerts/dismiss` (dismiss alert)
- **D-03:** `POST /api/auth/signout` is excluded — it's dead code per PROJECT.md (Sidebar uses client SDK signOut directly).

### Limit Granularity
- **D-04:** 30 requests per minute **per endpoint per user**, not 30 total across all endpoints. The `rate_limit_log` table tracks per-endpoint via an `endpoint` column. A student legitimately submits a report, starts a session, and updates roadmap in the same minute — that's 3 endpoints, each with its own 30/min budget.
- **D-05:** Rationale: per-endpoint avoids one hot endpoint (like work session start/pause/resume) eating the budget for everything else.

### Error Response
- **D-06:** 429 HTTP response with `Retry-After` header (seconds until window resets). Response body includes a human-readable message for client-side toast: "Too many requests, try again in X seconds."
- **D-07:** Client-side: show error toast with the message from the 429 response. Standard pattern, no special error state needed.

### Claude's Discretion
- Table schema details (column types, constraints, index design) — follow research Pattern 7 from ARCHITECTURE.md
- pg_cron cleanup schedule and retention window
- checkRateLimit() function signature and return type details
- Migration file naming (research suggests 00012)
- Whether to use INSERT + COUNT in a single query or two separate queries (atomic pattern preferred per success criteria)
- Exact `Retry-After` calculation (seconds remaining in current window)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Security & Protection — SEC-01 acceptance criteria
- `.planning/REQUIREMENTS.md` §Out of Scope — no Redis/Upstash, no in-memory rate limiting

### v1.2 Research
- `.planning/research/ARCHITECTURE.md` §Pattern 7 — Supabase-backed rate limiter table design, helper function, integration flow
- `.planning/research/PITFALLS.md` §Pitfall 3 — why in-memory rate limiting is broken in serverless, DB-backed alternative
- `.planning/research/PITFALLS.md` §Pitfall 14 — load testing auth rate limits (relevant for Phase 24 but context for rate limit design)

### Existing Code
- `src/app/api/reports/route.ts` — student report submission (POST)
- `src/app/api/reports/[id]/review/route.ts` — coach report review (PATCH)
- `src/app/api/work-sessions/route.ts` — start work session (POST)
- `src/app/api/work-sessions/[id]/route.ts` — update/complete/abandon session (PATCH)
- `src/app/api/roadmap/route.ts` — update roadmap progress (PATCH)
- `src/app/api/invites/route.ts` — create invite (POST)
- `src/app/api/magic-links/route.ts` — create/update magic link (POST, PATCH)
- `src/app/api/assignments/route.ts` — assign student to coach (PATCH)
- `src/app/api/alerts/dismiss/route.ts` — dismiss alert (POST)
- `src/lib/supabase/admin.ts` — singleton admin client (from Phase 19)

### Database
- `supabase/migrations/00011_write_path.sql` — latest migration (Phase 21); next migration is 00012
- `supabase/migrations/00001_create_tables.sql` — base schema, RLS policies, helper functions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getAdminClient()` singleton from Phase 19 — use for all rate limit DB queries
- `requireRole()` / `getSessionUser()` from `src/lib/session.ts` — auth pattern already established in all routes
- Existing route handler pattern: auth check → role verification → Zod validation → mutation

### Established Patterns
- All API routes use `createAdminClient()` (now singleton) for DB access
- Auth verification via `getSessionUser()` at top of every handler
- Zod `safeParse` on request body for input validation
- `try-catch` with `console.error` and appropriate HTTP status codes
- pg_cron jobs established in Phase 21 (`refresh_student_kpi_summaries`)

### Integration Points
- `checkRateLimit()` inserts between auth verification and Zod validation in every mutation route handler
- New `src/lib/rate-limit.ts` helper module
- New `supabase/migrations/00012_rate_limit_log.sql` migration
- pg_cron cleanup job alongside existing Phase 21 cron job

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following research Pattern 7.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-spike-protection-rate-limiting*
*Context gathered: 2026-03-30*
