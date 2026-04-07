# Security Audit Report -- Phase 23

**Audited:** 2026-03-30
**Routes:** 12 / 12 covered
**Layers:** Route handlers, proxy guard, RLS policies
**Auditor:** Phase 23 Plan 1 (read-only analysis)

---

## Executive Summary

The IMA Accelerator API surface has a **strong baseline security posture** for auth/role/ownership checks, but has a **single universal gap** across all mutation routes: no CSRF Origin header verification.

| Severity | Count | Summary |
|----------|-------|---------|
| Critical | 0 | No routes have missing auth checks on mutations |
| High | 1 | FIND-01: All 10 mutation routes lack CSRF Origin verification |
| Medium | 2 | FIND-03: auth/callback no rate limit; FIND-05: reports/[id]/review report-ID probing |
| Info | 3 | FIND-02: signout dead code; FIND-04: calendar no rate limit; FIND-06: proxy createClient singleton bypass |
| **Total** | **6** | |

**Overall posture:** All 12 routes have correct auth (getUser) and role checks. All student-mutation routes correctly filter by `profile.id` for ownership isolation. Coach routes have solid ownership verification. The one High finding (CSRF) is a universal gap requiring 10 targeted one-line additions. No Critical findings exist — no route allows unauthenticated mutations or role escalation.

---

## Route-by-Route Audit Table

| Route | Method | Auth Check | Role Check | Ownership / Isolation | CSRF Check | Rate Limited | Gaps |
|-------|--------|-----------|-----------|----------------------|-----------|-------------|------|
| `auth/signout` | POST | None (signOut called directly) | None | N/A — idempotent | None | No | FIND-01 (CSRF), FIND-02 (dead code, no auth) |
| `auth/callback` | GET | `exchangeCodeForSession` + `getUser()` | Implicit (routes by role after profile lookup) | Invite/magic code validated; email match enforced | N/A (GET) | No | FIND-03 (no rate limit on user-creating endpoint) |
| `calendar` | GET | `createClient().auth.getUser()` | coach or owner only | Coach: `student.coach_id === profile.id`; Owner: unrestricted | N/A (GET) | No | FIND-04 (no rate limit on read) |
| `reports` | POST | `createClient().auth.getUser()` | student only | `student_id` always from `profile.id`, never body | None | Yes | FIND-01 (CSRF) |
| `reports/[id]/review` | PATCH | `createClient().auth.getUser()` | coach only | Two-step: fetch report → verify `report.student_id` has `coach_id = profile.id` | None | Yes | FIND-01 (CSRF), FIND-05 (report-ID probing via 404 vs 403) |
| `work-sessions` | POST | `createClient().auth.getUser()` | student only | `student_id` from `profile.id`; active-session check uses `eq("student_id", profile.id)` | None | Yes | FIND-01 (CSRF) |
| `work-sessions/[id]` | PATCH | `createClient().auth.getUser()` | student only | Fetch filters `.eq("id", id).eq("student_id", profile.id)`; delete also double-filters | None | Yes | FIND-01 (CSRF) |
| `roadmap` | PATCH | `createClient().auth.getUser()` | student only | Step fetch: `.eq("student_id", profile.id).eq("step_number", step_number)`; unlock update uses `profile.id` | None | Yes | FIND-01 (CSRF) |
| `invites` | POST | `createClient().auth.getUser()` | coach or owner | No ID param; `invited_by: profile.id`; `coach_id` from `profile.id` for coaches | None | Yes | FIND-01 (CSRF) |
| `magic-links` (POST) | POST | `createClient().auth.getUser()` | coach or owner | No ID param; `created_by: profile.id` always | None | Yes | FIND-01 (CSRF) |
| `magic-links` (PATCH) | PATCH | `createClient().auth.getUser()` | coach or owner | Fetches link by ID; checks `link.created_by === profile.id OR role === 'owner'` | None | Yes | FIND-01 (CSRF) |
| `assignments` | PATCH | `createClient().auth.getUser()` | owner only | Verifies `studentId` is a student row; `coach_id` verified as active coach before update | None | Yes | FIND-01 (CSRF) |
| `alerts/dismiss` | POST | `createClient().auth.getUser()` | owner only | `owner_id` from `profile.id` exclusively; upsert idempotent | None | Yes | FIND-01 (CSRF) |

---

## Findings

### [FIND-01] -- High -- ALL 10 mutation routes -- No CSRF Origin header verification

- **Layer:** Route handler
- **Files:** `src/app/api/reports/route.ts`, `src/app/api/reports/[id]/review/route.ts`, `src/app/api/work-sessions/route.ts`, `src/app/api/work-sessions/[id]/route.ts`, `src/app/api/roadmap/route.ts`, `src/app/api/invites/route.ts`, `src/app/api/magic-links/route.ts` (POST + PATCH), `src/app/api/assignments/route.ts`, `src/app/api/alerts/dismiss/route.ts`, `src/app/api/auth/signout/route.ts`
- **Description:** None of the 10 mutation handlers (POST/PATCH/DELETE) verify the `Origin` header. CSRF protection is NOT automatic for Next.js route handlers — only Server Actions receive it. A malicious third-party website could make state-changing requests to these endpoints using the victim's browser session (cookies are sent automatically by the browser on cross-origin requests when the victim is authenticated).
- **Attack vector:** Attacker hosts `evil.com` with JavaScript that sends `fetch("https://ima-accelerator.com/api/reports", { method: "POST", credentials: "include", body: JSON.stringify({...}) })`. The victim's browser attaches the Supabase session cookie automatically. The request passes the auth check and role check. The attacker can submit fake daily reports, start/abandon work sessions, or dismiss alerts on behalf of the victim.
- **Proposed fix:** Add a shared `verifyOrigin(request)` helper (`src/lib/csrf.ts`) that compares the `Origin` header against `NEXT_PUBLIC_APP_URL`. Call it at the top of each mutation handler (before auth check for performance). Return 403 on mismatch or missing Origin.

---

### [FIND-02] -- Info -- auth/signout -- Dead code route with no auth guard

- **Layer:** Route handler
- **File:** `src/app/api/auth/signout/route.ts` (line 4)
- **Description:** The signout POST route calls `supabase.auth.signOut()` without any auth check. An unauthenticated POST to `/api/auth/signout` will execute (Supabase signOut on a non-session is a no-op). More importantly, confirmed via `grep -rn "api/auth/signout" src/` — this route has **zero client references**. The Sidebar component (`src/components/layout/Sidebar.tsx:114`) calls `supabase.auth.signOut()` directly via the client SDK, bypassing this route entirely.
- **Attack vector:** Minimal. The action is idempotent and non-destructive. An unauthenticated POST cannot harm any data. No client code ever calls this route, so it is unreachable in practice.
- **Proposed fix:** No fix required for current v1 scope. Route can be deleted entirely (it is dead code). If re-activated in future, add auth check before signOut call.

---

### [FIND-03] -- Medium -- auth/callback GET -- No rate limiting on unauthenticated user-creating endpoint

- **Layer:** Route handler
- **File:** `src/app/api/auth/callback/route.ts` (line 6)
- **Description:** The OAuth callback GET endpoint creates user profiles (inserts into `users`, `roadmap_progress`, increments `magic_links.use_count`). It has no rate limiting. A malicious actor controlling multiple Google OAuth accounts could spam registrations or exhaust magic link `max_uses` counts at unbounded speed. The Google OAuth provider may throttle this, but the IMA endpoint has no independent defense.
- **Attack vector:** Attacker creates multiple Google accounts, generates OAuth codes via Google's API, and calls `/api/auth/callback?code=...&magic_code=...` in rapid succession. Each call creates a user profile. This could exhaust magic link uses, create junk student accounts, or cause DB row bloat.
- **Proposed fix:** Rate limit by IP address on the callback route (not by user ID, since user has no profile yet at callback time). Note: this is not in scope for Plan 2 (adding rate limiting by IP requires new infrastructure); documented here for awareness. The magic link's `max_uses` field provides the primary defense.

---

### [FIND-04] -- Info -- calendar GET -- No rate limiting on read endpoint

- **Layer:** Route handler
- **File:** `src/app/api/calendar/route.ts` (line 11)
- **Description:** The calendar GET endpoint is authenticated (requires coach or owner role) but has no rate limiting. An authenticated coach could poll it rapidly to scrape all student calendar data. Impact is low — coaches should have legitimate access to their students' data, and the data is not sensitive beyond what they already see.
- **Attack vector:** Authenticated coach account (potentially compromised) hammers the calendar endpoint to download all student work session and report data. Impact is low since the data access is legitimate for the role.
- **Proposed fix:** No immediate fix required. If high-volume scraping becomes a concern, add `checkRateLimit` with a higher limit (e.g., 60/min vs 30/min for mutations).

---

### [FIND-05] -- Medium -- reports/[id]/review PATCH -- Report ID probing via 404 vs 403 distinction

- **Layer:** Route handler
- **File:** `src/app/api/reports/[id]/review/route.ts` (lines 71-91)
- **Description:** The endpoint performs a two-step ownership check: (1) fetch report by ID with no ownership filter (`admin.from("daily_reports").select("id, student_id").eq("id", id).single()`), then (2) verify the report's `student_id` belongs to this coach. If step 1 returns no row (report ID doesn't exist), the handler returns **404**. If step 1 finds the report but step 2 fails (not this coach's student), the handler returns **403**. This 404 vs 403 distinction leaks information: a coach can probe arbitrary UUIDs to discover which report IDs exist in the system, even for reports belonging to other coaches' students.
- **Attack vector:** Compromised coach account sends `PATCH /api/reports/{uuid}/review` for a series of UUIDs. A 404 means the UUID is not a report ID; a 403 means the UUID IS a valid report ID belonging to another coach's student. Over time, this enumerates all report IDs in the database. The attacker cannot read the report content, but can confirm report existence — a form of information disclosure.
- **Proposed fix:** Return 404 for ALL failure modes in the ownership chain (both "report not found" and "not your student"), OR rewrite as a single query that joins `daily_reports + users` on `student_id` with `coach_id = profile.id` filter (returns zero rows for both non-existent and unauthorized reports).

---

### [FIND-06] -- Info -- proxy.ts -- Direct createClient() instead of createAdminClient() singleton

- **Layer:** Proxy route guard
- **File:** `src/proxy.ts` (lines 54-58, 82-85)
- **Description:** The proxy creates service-role Supabase clients using `createClient(url, serviceRoleKey)` directly from `@supabase/supabase-js`. This bypasses the `createAdminClient()` singleton established in Phase 19 (`src/lib/supabase/admin.ts`) which caches the client at module level. The proxy creates a **new client instance on every protected page load**, defeating the singleton pattern's connection-reuse benefit. This is not a security gap but is an architectural inconsistency and a minor performance issue.
- **Attack vector:** Not a security issue. Each proxy invocation opens a new connection to Supabase instead of reusing the cached singleton. Under high load, this could exhaust Supabase connection pool limits faster than necessary.
- **Proposed fix:** Import `createAdminClient` from `@/lib/supabase/admin` in `src/proxy.ts` and replace the two inline `createClient(url, serviceRoleKey)` calls with `createAdminClient()`. Note: the proxy file cannot use the `"server-only"` import restriction easily (it's a proxy, not a standard server component), so this requires confirming `admin.ts` works in the proxy context.

---

## Layer 2: Proxy Route Guard

**File:** `src/proxy.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Auth check on protected routes | **PASS** | `supabase.auth.getUser()` called via `createServerClient`; unauthenticated requests redirect to `/login` (line 75-79) |
| Role-based route protection | **PASS** | `ROLE_ROUTE_ACCESS` map enforces prefix matching (`owner` → `/owner`, `coach` → `/coach`, `student` → `/student`). Cross-role access redirects to role's own dashboard (line 98-105) |
| API routes excluded from proxy | **PASS** | Matcher explicitly excludes `api/` prefix: `"/((?!_next/static|_next/image|favicon.ico|api/).*)"` (line 113). API routes do their own auth — this is intentional and correct |
| Public route redirect when authenticated | **PASS** | `/login`, `/register`, `/no-access` redirect logged-in users to their role dashboard (lines 47-72) |
| No-access page allows unauthenticated | **PASS** | `/no-access` is in the "public routes" block — unauthenticated users see the page (not redirected to /login) |
| Admin client singleton usage | **GAP (Info)** | Lines 54-58 and 82-85 use `createClient(url, serviceRoleKey)` directly instead of `createAdminClient()` singleton — documented as FIND-06 |

**Summary:** The proxy route guard is functionally correct and provides solid defense-in-depth for all page-level access control. The API exclusion is intentional. The only gap is the singleton bypass (Info severity).

---

## Layer 3: RLS Policy Audit

| Table | Policy Name | Operation | initplan Wrapper | Status |
|-------|-------------|-----------|-----------------|--------|
| `users` | `owner_select_users` | SELECT | `(select get_user_role()) = 'owner'` | PASS |
| `users` | `coach_select_users` | SELECT | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `users` | `student_select_users` | SELECT | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `users` | `owner_update_users` | UPDATE | `(select get_user_role()) = 'owner'` | PASS |
| `users` | `coach_update_users` | UPDATE | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `users` | `student_update_users` | UPDATE | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `invites` | `owner_select_invites` | SELECT | `(select get_user_role()) = 'owner'` | PASS |
| `invites` | `owner_insert_invites` | INSERT | `(select get_user_role()) = 'owner'` | PASS |
| `invites` | `owner_update_invites` | UPDATE | `(select get_user_role()) = 'owner'` | PASS |
| `invites` | `coach_select_invites` | SELECT | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `invites` | `coach_insert_invites` | INSERT | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `magic_links` | `owner_select_magic_links` | SELECT | `(select get_user_role()) = 'owner'` | PASS |
| `magic_links` | `owner_insert_magic_links` | INSERT | `(select get_user_role()) = 'owner'` | PASS |
| `magic_links` | `owner_update_magic_links` | UPDATE | `(select get_user_role()) = 'owner'` | PASS |
| `magic_links` | `coach_select_magic_links` | SELECT | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `magic_links` | `coach_insert_magic_links` | INSERT | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `magic_links` | `coach_update_magic_links` | UPDATE | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `work_sessions` | `owner_select_work_sessions` | SELECT | `(select get_user_role()) = 'owner'` | PASS |
| `work_sessions` | `coach_select_work_sessions` | SELECT | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `work_sessions` | `student_select_work_sessions` | SELECT | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `work_sessions` | `student_insert_work_sessions` | INSERT | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `work_sessions` | `student_update_work_sessions` | UPDATE | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `work_sessions` | `student_delete_work_sessions` | DELETE | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `roadmap_progress` | `owner_select_roadmap` | SELECT | `(select get_user_role()) = 'owner'` | PASS |
| `roadmap_progress` | `coach_select_roadmap` | SELECT | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `roadmap_progress` | `coach_update_roadmap` | UPDATE | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `roadmap_progress` | `student_select_roadmap` | SELECT | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `roadmap_progress` | `student_update_roadmap` | UPDATE | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `daily_reports` | `owner_select_reports` | SELECT | `(select get_user_role()) = 'owner'` | PASS |
| `daily_reports` | `coach_select_reports` | SELECT | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `daily_reports` | `coach_update_reports` | UPDATE | `(select get_user_role()) = 'coach'` + `(select get_user_id())` | PASS |
| `daily_reports` | `student_select_reports` | SELECT | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `daily_reports` | `student_insert_reports` | INSERT | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `daily_reports` | `student_update_reports` | UPDATE | `(select get_user_role()) = 'student'` + `(select get_user_id())` | PASS |
| `alert_dismissals` | `owner_select_dismissals` | SELECT | `(select get_user_role()) = 'owner'` + `(select get_user_id())` | PASS |
| `alert_dismissals` | `owner_insert_dismissals` | INSERT | `(select get_user_role()) = 'owner'` + `(select get_user_id())` | PASS |

**Total policies audited:** 36 across 7 tables. **All 36 PASS.** No bare `auth.uid()` calls exist in any policy.

### Admin Client Bypass Note

All 10 mutation route handlers use `createAdminClient()` (service_role key) which bypasses RLS entirely. RLS is the third defense line — it protects against direct DB access but NOT against application-level bugs in route handlers. The application-level checks (auth + role + ownership filter via `eq("student_id", profile.id)`) documented in Layer 1 are the PRIMARY security gates. This is intentional per the project architecture — route handlers use admin client to avoid RLS context initialization overhead. The combination of: (1) auth check, (2) role check, (3) user ID filtering in every admin client query provides equivalent protection to RLS for application-layer access.

---

## DB-03 Status

**Requirement:** All RLS policies use `(SELECT auth.uid())` instead of bare `auth.uid()` for initplan optimization, preventing per-row volatile function scans.

**Finding:** All 36 policies in `supabase/migrations/00001_create_tables.sql` and `supabase/migrations/00004_alert_dismissals.sql` use `(select get_user_role())` and `(select get_user_id())` wrappers. These helper functions internally call `auth.uid()` inside a `STABLE SECURITY DEFINER` function body, which Postgres evaluates once per query via the initplan mechanism. The `supabase/migrations/00006_v1_1_schema.sql` migration adds no new RLS policies — only schema changes and a trigger update.

No bare `auth.uid()` exists anywhere in any RLS policy across all three migration files.

**Evidence:**
```sql
-- Pattern confirmed in 00001_create_tables.sql (all policies):
CREATE POLICY "student_select_work_sessions" ON public.work_sessions
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'student' AND student_id = (select get_user_id()));

-- Helper functions use STABLE marking (enables initplan evaluation):
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.users WHERE auth_id = auth.uid() $$;
```

**Status: SATISFIED.** DB-03 is formally closed. All 36 RLS policies across all 7 tables use the `(select get_user_role())` / `(select get_user_id())` initplan pattern consistently.

---

## Approval Instructions

This audit report is the output of Phase 23 Plan 1. Plan 2 (remediation) will add CSRF protection to all mutation routes and fix the `reports/[id]/review` report-ID probing gap.

**To proceed with remediation:**

1. Review all findings above, noting severity levels
2. For each finding, confirm whether the proposed fix should be applied:
   - **FIND-01 (High):** Apply CSRF helper to all 10 mutation routes — **recommended**
   - **FIND-02 (Info):** No fix needed (dead code) — **can be deferred or deleted**
   - **FIND-03 (Medium):** Not in Plan 2 scope (IP-based rate limiting requires new infra) — **defer to future phase**
   - **FIND-04 (Info):** No immediate fix needed — **defer**
   - **FIND-05 (Medium):** Fix 404 vs 403 distinction in `reports/[id]/review` — **recommended**
   - **FIND-06 (Info):** Proxy singleton fix is low priority — **can be deferred**
3. Type "approved" to proceed with all recommended fixes, or list specific findings to include/skip
4. Plan 2 will then implement: `src/lib/csrf.ts` CSRF helper + insert `verifyOrigin()` calls in all 10 mutation handlers + fix FIND-05 ownership ordering

**Plan 2 is blocked until this explicit approval is received.**
