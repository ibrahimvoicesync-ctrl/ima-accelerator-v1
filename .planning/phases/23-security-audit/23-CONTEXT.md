# Phase 23: Security Audit - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit every API route's auth/role/ownership checks, add CSRF protection to mutation handlers, and verify cross-student data isolation — across three defense-in-depth layers: route handlers, proxy route guard, and RLS policies. Produces an audit report first for human sign-off; code changes applied only after approval.

</domain>

<decisions>
## Implementation Decisions

### Report-then-Fix Workflow
- **D-01:** Two-pass approach. First pass produces the audit report — every route documented, every gap identified, no code changes. Second pass applies fixes only after explicit human approval.
- **D-02:** This maps to two separate plans: Plan 1 = audit report (read-only), Plan 2 = remediation (code changes). The HALT gate lives between Plan 1 and Plan 2.
- **D-03:** Rationale: combining report and fixes defeats the `requires-human-review` flag — you'd be approving changes you haven't seen yet.

### Audit Depth
- **D-04:** Three-layer audit covering the full defense-in-depth chain: route handlers -> proxy route guard -> RLS policies.
- **D-05:** All 12 API routes audited (auth/signout, auth/callback, calendar, reports, reports/[id]/review, work-sessions, work-sessions/[id], roadmap, invites, magic-links, assignments, alerts/dismiss).
- **D-06:** Server components excluded — they run server-side only and are less critical than the three audited layers.

### Severity Classification
- **D-07:** Each finding in the audit report gets a severity level: Critical / High / Medium / Info. This lets the reviewer prioritize and selectively approve fixes.
- **D-08:** Severity guidance: missing auth check on mutation = Critical; missing CSRF on mutation = High; missing CSRF on read-only GET = Info; missing ownership filter with RLS backup = Medium.

### Folded Requirement: DB-03
- **D-09:** DB-03 ("All RLS policies use `(SELECT auth.uid())` instead of `auth.uid()` for initplan optimization") is folded into this phase's RLS audit layer. Phase 19 context says policies already use `(select get_user_role())` wrappers — this audit formally verifies that claim and closes DB-03.

### Claude's Discretion
- CSRF Origin header implementation details (env-based host matching, dev/prod handling, helper function design) — standard approach, no user input needed
- Cross-student isolation edge cases — the audit should discover these, not pre-define them
- Audit report document format and structure (beyond severity classification)
- Specific remediation code patterns for each finding

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Security & Protection — SEC-02, SEC-03, SEC-04 acceptance criteria
- `.planning/REQUIREMENTS.md` §Database & Monitoring — DB-03 (folded into this phase per D-09)

### v1.2 Research
- `.planning/research/ARCHITECTURE.md` — Current architecture patterns, auth flow
- `.planning/research/PITFALLS.md` §Pitfall on CSRF — "CSRF is NOT automatic for route handlers (only Server Actions)"

### Prior Phase Context
- `.planning/phases/22-spike-protection-rate-limiting/22-CONTEXT.md` — Rate limiting decisions, full route list (D-02), auth pattern used
- `.planning/phases/19-database-foundation/19-CONTEXT.md` — RLS initplan verification (D-06, D-07), admin client singleton

### API Routes (all 12 — audit targets)
- `src/app/api/auth/signout/route.ts` — dead code per PROJECT.md
- `src/app/api/auth/callback/route.ts` — OAuth callback
- `src/app/api/calendar/route.ts` — GET, coach/owner access with studentId param
- `src/app/api/reports/route.ts` — POST, student report submission
- `src/app/api/reports/[id]/review/route.ts` — PATCH, coach marks reviewed
- `src/app/api/work-sessions/route.ts` — POST, start session
- `src/app/api/work-sessions/[id]/route.ts` — PATCH, update/complete/abandon
- `src/app/api/roadmap/route.ts` — PATCH, complete roadmap step
- `src/app/api/invites/route.ts` — POST, create invite
- `src/app/api/magic-links/route.ts` — POST/PATCH, create/update magic link
- `src/app/api/assignments/route.ts` — PATCH, assign student to coach
- `src/app/api/alerts/dismiss/route.ts` — POST, dismiss alert

### Auth & Session
- `src/lib/session.ts` — getSessionUser(), requireRole() (used in server components, not API routes)
- `src/lib/supabase/admin.ts` — singleton admin client
- `src/lib/supabase/server.ts` — request-scoped server client (cookies)
- `src/proxy.ts` — route guard (proxy, not middleware)

### Database & RLS
- `supabase/migrations/00001_create_tables.sql` — base schema, all RLS policies, helper functions (get_user_id, get_user_role)
- `supabase/migrations/00006_v1_1_schema.sql` — v1.1 schema additions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireRole()` / `getSessionUser()` from `src/lib/session.ts` — used in server components but NOT in API routes (routes do manual auth inline)
- `checkRateLimit()` from `src/lib/rate-limit.ts` — already integrated in all mutation routes (Phase 22)
- RLS helper functions `get_user_id()` and `get_user_role()` — marked STABLE + SECURITY DEFINER

### Established Patterns
- API route auth pattern: `createClient() -> getUser() -> createAdminClient() -> profile lookup -> role check` (manual in each route)
- Defense-in-depth: student mutation routes filter by `profile.id` (reports, work-sessions, roadmap)
- Calendar route checks `coach_id !== profile.id` for coach-student relationship
- Admin routes (invites, magic-links, assignments) check for owner/coach role

### Integration Points
- CSRF helper will insert between auth check and rate limit check in mutation routes
- Audit report goes in phase directory as a markdown document
- RLS audit reads migration SQL files directly
- Proxy route guard audit reads `src/proxy.ts`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The audit should discover gaps, not confirm pre-defined expectations.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-security-audit*
*Context gathered: 2026-03-30*
