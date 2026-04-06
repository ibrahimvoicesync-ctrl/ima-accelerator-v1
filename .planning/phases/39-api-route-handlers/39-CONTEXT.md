# Phase 39: API Route Handlers - Context

**Gathered:** 2026-04-06 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

All deal mutation and query endpoints exist, are secured, and are testable before any UI is built. Four endpoints: POST /api/deals, PATCH /api/deals/[id], DELETE /api/deals/[id], GET /api/deals. Each enforces CSRF, rate limiting, Zod validation, and role-scoped access.

</domain>

<decisions>
## Implementation Decisions

### Cache Revalidation Tags
- **D-01:** Use `deals-{studentId}` as the revalidateTag name — scoped per student so Phase 42 dashboard stats can revalidate precisely after mutations.
- **D-02:** All mutation endpoints (POST, PATCH, DELETE) call `revalidateTag(\`deals-${studentId}\`)` after successful write.

### POST 23505 Retry
- **D-03:** On 23505 unique_violation (deal_number conflict from concurrent inserts), retry the insert once inline — no delay, no exponential backoff. If the retry also fails, return 500.
- **D-04:** Retry is server-side only; the client never sees the conflict.

### Validation Constants
- **D-05:** Hardcode revenue/profit Zod limits directly in Phase 39 route schemas (e.g., revenue max, profit constraints). Phase 40 will extract these into `VALIDATION.deals` in config.ts and refactor the imports — phases run sequentially.

### GET Endpoint Query Design
- **D-06:** `student_id` is a required query parameter on GET /api/deals. No additional filters (no date range, no sort param) — default sort is most-recent-first (created_at DESC).
- **D-07:** `page` query parameter for pagination, 25 per page. Return `{ data: Deal[], total: number, page: number }` so the client can compute total pages.

### Route Handler Pattern
- **D-08:** Follow established codebase order: CSRF -> Auth -> Profile -> Role check -> Rate limit -> Body parse -> Zod -> Ownership check -> DB operation -> revalidateTag -> Response.
- **D-09:** All `.from()` queries use admin client (per CLAUDE.md Hard Rule #4).
- **D-10:** Rate limit endpoint strings: `/api/deals` for POST/GET, `/api/deals/[id]` for PATCH/DELETE.

### Delete Role Logic
- **D-11:** DELETE checks three tiers: (1) student/student_diy deletes own deal (deal.student_id = profile.id), (2) coach deletes assigned student's deal (join users to verify coach_id), (3) owner deletes any deal. Unauthorized = 403.
- **D-12:** Coach assignment check: query `users` table where `id = deal.student_id AND coach_id = profile.id` — two-step verification per Phase 38 D-11 pattern.

### Claude's Discretion
- Exact Zod schema field names and hardcoded limits for revenue/profit
- UUID validation approach on [id] params (regex or Zod)
- Error message wording for 400/403/429 responses
- Whether to split POST+GET into `/api/deals/route.ts` and PATCH+DELETE into `/api/deals/[id]/route.ts` (likely yes, matching existing codebase structure)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Route handler patterns
- `src/app/api/reports/route.ts` — POST pattern: CSRF, auth, profile, role, rate limit, body parse, Zod, insert, revalidateTag
- `src/app/api/work-sessions/[id]/route.ts` — PATCH with dynamic [id] param, Next.js 16 `Promise<{ id: string }>` params pattern
- `src/app/api/glossary/[id]/route.ts` — PUT + DELETE in same route file, UUID validation, 23505 conflict handling, role-scoped access

### Security infrastructure
- `src/lib/csrf.ts` — verifyOrigin() function, must be first check in mutation handlers
- `src/lib/rate-limit.ts` — checkRateLimit(userId, endpoint) at 30 req/min default

### Data model
- `src/lib/types.ts` lines 662-699 — Deal type (Row/Insert/Update), revenue/profit as `string | number`
- `src/lib/config.ts` lines 320-333 — VALIDATION constants pattern (Phase 40 will add DEALS section)

### Database schema
- `supabase/migrations/00021_deals.sql` — Table schema, RLS policies, trigger, indexes (Phase 38 output)
- `.planning/phases/38-database-foundation/38-CONTEXT.md` — All schema decisions (D-01 through D-16)

### Requirements
- `.planning/REQUIREMENTS.md` — DEAL-01, DEAL-04, DEAL-05, VIEW-05, VIEW-06, INFR-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `verifyOrigin()` from `src/lib/csrf.ts` — CSRF check, returns NextResponse or null
- `checkRateLimit()` from `src/lib/rate-limit.ts` — DB-backed rate limiter, returns `{ allowed, remaining, retryAfterSeconds }`
- `createClient()` / `createAdminClient()` from `src/lib/supabase/` — auth client for getUser(), admin for all DB ops
- `revalidateTag()` from `next/cache` — used in all existing mutation routes

### Established Patterns
- Route file structure: `/api/{resource}/route.ts` for collection endpoints (POST, GET), `/api/{resource}/[id]/route.ts` for item endpoints (PATCH, DELETE)
- Profile lookup via admin client: `admin.from("users").select("id, role").eq("auth_id", authUser.id).single()`
- Coach assignment check: join `users` table on `coach_id` column (used in messages, report_comments routes)
- 23505 handling: check `error.code === "23505"` and return 409 (glossary route pattern)
- Response shapes: `{ error: string }` for errors, `{ data: T }` or flat object for success

### Integration Points
- New route files: `src/app/api/deals/route.ts` (POST + GET) and `src/app/api/deals/[id]/route.ts` (PATCH + DELETE)
- Phase 41 UI will call these endpoints via fetch()
- Phase 42 dashboard will use `deals-{studentId}` cache tag for revalidation
- Phase 43 coach/owner tabs will call GET /api/deals with student_id param

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard API route handlers following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 39-api-route-handlers*
*Context gathered: 2026-04-06*
