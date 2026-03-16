# Pitfalls Research

**Domain:** Next.js App Router + Supabase multi-role coaching platform
**Researched:** 2026-03-16
**Confidence:** HIGH (most pitfalls verified via official Supabase docs + GitHub discussions + Vercel blog)

---

## Critical Pitfalls

### Pitfall 1: OAuth Redirect URL Mismatch (localhost vs. production)

**What goes wrong:**
After Google OAuth login in local development, the user gets redirected to the production URL instead of `localhost:3000`. Or after deploying, the production app still redirects to `localhost:3000`. Both break the auth flow entirely.

**Why it happens:**
Supabase's `signInWithOAuth` has a `redirectTo` option. If you don't set it dynamically, Supabase falls back to the hardcoded **Site URL** configured in the Supabase Dashboard — which will be wrong for whichever environment you're NOT currently using. Separately, Google Cloud Console requires you to whitelist every Authorized JavaScript Origin and Redirect URI; it does not support wildcards, so `localhost:3000` and your production domain are both required separately.

A secondary trigger: `localhost` and `127.0.0.1` are treated as different origins by both Google OAuth and Supabase, causing auth failures even after correct configuration.

**How to avoid:**
1. Always pass a dynamic `redirectTo` in `signInWithOAuth`:
   ```typescript
   const redirectTo = `${window.location.origin}/api/auth/callback`;
   supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
   ```
2. In Supabase Dashboard → Auth → URL Configuration: set Site URL to production URL, add `http://localhost:3000/**` to Additional Redirect URLs.
3. In Google Cloud Console: add both `http://localhost:3000` and your production domain to Authorized JavaScript Origins, and both `http://localhost:3000/api/auth/callback` and `https://yourdomain.com/api/auth/callback` to Authorized Redirect URIs.
4. Use `localhost` consistently (not `127.0.0.1`) in local dev.

**Warning signs:**
- Login redirects to wrong domain after OAuth
- "redirect_uri_mismatch" error from Google
- Auth works in one environment but not the other
- `getUser()` returns null immediately after OAuth callback

**Phase to address:** Phase 1 — Foundation (auth flow setup)

---

### Pitfall 2: Using `getSession()` Instead of `getUser()` in Server Code

**What goes wrong:**
Session appears valid on the server, but the data can be spoofed. A malicious user can craft a cookie that passes `getSession()` but would be rejected by `getUser()`. This breaks route protection completely — any user can access any protected route.

**Why it happens:**
`getSession()` reads directly from the cookie without making a network request to Supabase Auth servers. It trusts the cookie data at face value. `getUser()` sends a request to Supabase Auth servers on every call to revalidate the token, making it the only trustworthy check in server-side code.

This is extremely common because `getSession()` looks equivalent to `getUser()` in the API surface, and it's faster (no network call). Developers reach for it first.

**How to avoid:**
Use `supabase.auth.getUser()` for ALL server-side auth checks — in middleware, server components, and API route handlers. Only use `getSession()` in client components where the UX just needs to display something non-sensitive.

```typescript
// CORRECT — server component or middleware
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) redirect('/login');

// WRONG — server component or middleware
const { data: { session } } = await supabase.auth.getSession(); // Do not use
```

**Warning signs:**
- Auth check code uses `getSession()` in any file without `"use client"`
- Route protection "seems to work" in testing but hasn't been tested with manipulated cookies
- Middleware passes even with an expired or invalid session token

**Phase to address:** Phase 1 — Foundation (auth flow + middleware setup)

---

### Pitfall 3: Storing Role in `user_metadata` (Updateable by Users)

**What goes wrong:**
A student can promote themselves to `coach` or `owner` by calling `supabase.auth.updateUser({ data: { role: 'owner' } })` from the browser. RLS policies that rely on `auth.jwt() -> 'user_metadata' -> 'role'` are then bypassed by any authenticated user.

**Why it happens:**
`user_metadata` (`raw_user_meta_data`) is specifically designed to be updated by authenticated users. It is not a secure place for authorization data. Many tutorials store the role in `user_metadata` for convenience, without flagging the security risk. The subtle part: even official Supabase examples sometimes put role there for quickstart purposes.

The platform has a `users` table with a `role` column — this is the right pattern. The pitfall is RLS policies that check the JWT's `user_metadata.role` instead of cross-referencing the `users` table.

**How to avoid:**
Store roles ONLY in the `users` table (already correct per the schema). In RLS policies, check role by joining against the `users` table, not by reading JWT claims:

```sql
-- CORRECT: join against users table
CREATE POLICY "students can view own sessions"
ON work_sessions FOR SELECT
USING (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'student'
  )
);

-- WRONG: trust JWT user_metadata
USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'student');
```

If performance requires avoiding the join, use `app_metadata` (not `user_metadata`) via a Custom Access Token Hook — `app_metadata` cannot be modified by users.

**Warning signs:**
- RLS policies contain `user_metadata` anywhere
- Role is set in Supabase's built-in `raw_user_meta_data` field during signup
- No validation that the role in the JWT matches the `users` table at auth time

**Phase to address:** Phase 1 — Foundation (schema + RLS policy design)

---

### Pitfall 4: RLS Enabled But Policies Silently Return Empty Results

**What goes wrong:**
After enabling RLS on a table, all queries return empty arrays instead of the expected data. No error is thrown — empty results are valid SQL responses. The feature appears completely broken, and the root cause is non-obvious because there's no error to debug.

**Why it happens:**
Supabase's default when RLS is enabled is "deny all." A missing policy means zero rows match, not an error. This is intentional security behavior but causes significant confusion during development. The anon key client and the service_role key client behave differently (service_role bypasses RLS), which can make it appear to work in Supabase Studio's Table Editor while failing in the app.

**How to avoid:**
1. Write all RLS policies in migrations immediately alongside `ENABLE ROW LEVEL SECURITY`
2. Test every policy with the actual anon key client (not service_role) before marking a feature complete
3. Use the Supabase Dashboard's SQL Editor with `SET ROLE authenticated; SET request.jwt.claims TO '{"sub":"<user-uuid>"}';` to test policies manually
4. Always verify the policy covers ALL operations your app needs: SELECT, INSERT, UPDATE, DELETE — a missing operation silently fails

**Warning signs:**
- Queries return empty arrays but data exists in the table
- Feature works when tested in Supabase Dashboard (using service_role) but not in the app
- New table added without explicit policy definition
- RLS is enabled on a table but the migration has no corresponding `CREATE POLICY` statement

**Phase to address:** Phase 1 — Foundation (schema + RLS policies)

---

### Pitfall 5: Cross-Role Data Leakage via RLS Policies

**What goes wrong:**
A coach can query work sessions, reports, or roadmap progress for students NOT assigned to them. Or a student can read another student's daily reports. The three-role model (owner/coach/student) requires precise RLS policies for each role, and missing a policy edge case exposes data across role boundaries.

**Why it happens:**
The naive policy `student_id = auth.uid()` only locks down student-to-student. It does not address what a coach can see. If a coach's SELECT policy is `true` (or missing entirely), coaches can access all student data. The `coach_id` relationship on the `users` table must be used in RLS policies for coach-scope access.

For the owner role, the temptation is to write `role = 'owner'` in the JWT — but as per Pitfall 3, this is insecure. The join against `users` table is required.

**How to avoid:**
Design policies per table per role explicitly. For this project's schema, every policy needs three clauses — one per role:

```sql
-- work_sessions: students see own, coaches see assigned students', owner sees all
CREATE POLICY "role-based access on work_sessions"
ON work_sessions FOR SELECT
USING (
  -- Student: own sessions only
  student_id = (SELECT id FROM users WHERE auth_id = auth.uid() AND role = 'student')
  OR
  -- Coach: only their assigned students
  EXISTS (
    SELECT 1 FROM users coach
    WHERE coach.auth_id = auth.uid()
    AND coach.role = 'coach'
    AND student_id IN (
      SELECT id FROM users WHERE coach_id = coach.id
    )
  )
  OR
  -- Owner: all sessions
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'owner')
);
```

**Warning signs:**
- Policies written as a single simple expression without role branching
- A coach can see a student from another coach's roster
- No end-to-end test that verifies coach A cannot access coach B's students

**Phase to address:** Phase 1 — Foundation (RLS policies), verified again in Phase 3 (coach pages)

---

### Pitfall 6: Invite-Only Registration Race Condition and State Mismatches

**What goes wrong:**
An invite code is valid when the user clicks the link, but by the time they complete Google OAuth and the callback runs, the code has expired or been used. The user gets a confusing error after completing OAuth. Alternatively, a code is consumed before the user's Supabase Auth account is created (if the callback errors mid-flight), leaving an orphaned used=true invite with no corresponding user.

**Why it happens:**
The invite flow involves multiple systems: the invite code in the `invites` table, the Google OAuth flow (external round-trip), and the `users` table insert. These are not atomic. The Supabase Auth `onAuthStateChange` callback happens after the OAuth redirect, which is after the user has already authenticated with Google — if anything fails between these steps, state diverges.

A specific failure mode: the custom registration logic runs in the `/api/auth/callback` handler, which marks `invites.used = true`. If the `users` table INSERT fails after that (e.g., a constraint violation), the invite is consumed but the user doesn't exist.

**How to avoid:**
1. Validate and reserve the invite code BEFORE redirecting to Google OAuth (store `invite_code` in the OAuth `state` parameter or a short-lived session)
2. Mark `invites.used = true` and insert into `users` in a single Postgres transaction in the callback handler
3. Use a Supabase `before_user_created` Auth Hook to validate the invite before Supabase creates the auth user — this keeps the check closest to the creation point
4. Handle the "invite expired after OAuth" case with a clear error page that explains what happened (not a generic auth error)
5. Store invite code in `redirectTo` URL state parameter through the OAuth flow so it's still accessible at the callback

**Warning signs:**
- Callback handler marks invite used before inserting the user row
- No transaction wrapping the invite consumption + user creation
- Error page for invite failures shows a generic "authentication error"
- No cleanup path for orphaned in_progress OAuth sessions with expired invites

**Phase to address:** Phase 1 — Foundation (auth flow + invite registration)

---

### Pitfall 7: Work Session Timer State Lost on Navigation or Refresh

**What goes wrong:**
A student starts a 45-minute work session, navigates to the roadmap page or refreshes the browser, and the timer is gone. The session shows as `in_progress` in the database forever. The student's daily cycle count is wrong. On the next session start, the UI may allow starting a second `in_progress` session, creating duplicates.

**Why it happens:**
The timer is a client-side React state using `setInterval`. When the user navigates away in Next.js App Router (which uses client-side routing), the component unmounts and the interval is cleared. The `started_at` timestamp IS persisted in the database, but the UI-side countdown and `in_progress` status have no persistence. On return, there is no logic to detect an existing `in_progress` session and resume the countdown.

**How to avoid:**
1. On the work session page load (server component), always check for an existing `in_progress` session. If one exists, calculate the elapsed time from `started_at` and pass the remaining seconds to the client timer component.
2. The timer component must accept a `initialRemainingSeconds` prop and start counting from that value, not from 2700 (45 min).
3. Handle the case where an `in_progress` session has exceeded 45 minutes (likely abandoned): auto-mark as abandoned on page load if `started_at` is more than 45+ grace minutes ago.
4. Store only one `in_progress` session per student per day per cycle. Enforce this with a database constraint: `UNIQUE(student_id, date, cycle_number)`.
5. Clean up `setInterval` in the useEffect return to prevent duplicate timers.

**Warning signs:**
- `work_sessions` table accumulates multiple `in_progress` rows for the same student
- Timer starts from 45:00 instead of the remaining time when re-opening the page
- No detection of stale `in_progress` sessions on the work tracker page load
- Timer continues running in the background while user is on roadmap or report page

**Phase to address:** Phase 2 — Student Pages (work tracker)

---

### Pitfall 8: `createServerClient` Cookie Handler Using Deprecated `get/set/remove` API

**What goes wrong:**
Auth sessions silently fail in server components. `getUser()` returns null despite a valid cookie in the browser. Or cookie refreshes don't persist, causing users to be logged out unexpectedly after token expiry.

**Why it happens:**
The `@supabase/ssr` package requires using only `getAll` and `setAll` methods for the cookie handler. The older pattern using individual `get`, `set`, `remove` methods is deprecated and causes session token refresh to fail silently. Many tutorials and AI-generated code still use the old pattern.

Additionally, in Next.js 15+, `cookies()` from `next/headers` is async and must be awaited. Forgetting this causes a runtime error or stale cookie reads.

**How to avoid:**
Use the current `@supabase/ssr` pattern exactly:

```typescript
// server client (server-components.ts)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies(); // await in Next.js 15+
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); }, // getAll only, not get
        setAll(cookiesToSet) {                      // setAll only, not set/remove
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

Never import `@supabase/auth-helpers-nextjs` — it is deprecated and will conflict with `@supabase/ssr`.

**Warning signs:**
- Cookie handler uses `get()`, `set()`, `remove()` methods
- `@supabase/auth-helpers-nextjs` appears in `package.json`
- Users get logged out after an hour (token refresh failing silently)
- `getUser()` returns null in server component despite active browser session

**Phase to address:** Phase 1 — Foundation (Supabase client setup)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip RLS, use service_role for all server queries | Faster initial development, no policy debugging | Any server-side bug exposes full database access; can never add client-side queries safely | Never — this project explicitly requires defense-in-depth |
| Put role in `user_metadata` for quick JWT access | Avoids table join in RLS policies | Students can promote themselves to owner; full auth bypass | Never — use `users` table join or `app_metadata` |
| Use `getSession()` instead of `getUser()` in server | No network RTT per auth check | Spoofable sessions; route protection ineffective | Never in server code — acceptable only in display-only client components |
| Single `in_progress` session allowed (no constraint) | Simpler insert logic | Multiple orphaned sessions accumulate; cycle count wrong | Never — enforce at DB level with unique constraint |
| Hardcode redirectTo URL in OAuth | Simpler setup code | Auth breaks in one environment or the other | Never — always make redirectTo dynamic |
| Skip migrations, use Supabase Dashboard UI for schema changes | Faster iteration on schema | Schema drift between local/production; changes not reproducible | Never for production schema — acceptable only for pure local exploration |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth + Google OAuth | Not adding both localhost and production to Google Console Authorized Redirect URIs | Add all environments to both Google Console AND Supabase Additional Redirect URLs |
| Supabase Auth + Next.js middleware | Calling `getSession()` in middleware for auth check | Always use `getUser()` in middleware; `getSession()` is insecure server-side |
| Supabase Admin Client | Using admin client in client-side code with `NEXT_PUBLIC_` service role key | Admin client must only exist in server files; service_role key must never be prefixed with `NEXT_PUBLIC_` |
| Supabase CLI + Docker | Running `supabase start` without Docker Desktop running | Verify Docker is running first; `supabase start` will hang silently if Docker is off |
| Supabase CLI + local-to-prod migrations | Manual schema edits via Dashboard bypassing migration files | All schema changes through migration files only; never edit prod directly via Dashboard |
| Next.js `cookies()` + Supabase SSR | Not awaiting `cookies()` in Next.js 15+ | `const cookieStore = await cookies()` — it is async in Next.js 15+ |
| Google OAuth local dev | App running on `127.0.0.1:3000` instead of `localhost:3000` | Ensure dev server binds to `localhost`, match exactly what's in Google Console |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| RLS policies with unindexed `student_id`, `coach_id` foreign keys | Slow page loads; queries take 200-500ms even for simple row reads | Add BTREE indexes on all columns referenced in RLS policies (`student_id`, `coach_id`, `auth_id`) | With 50+ students and frequent queries — this project's scale, not hypothetical |
| RLS policy calling `auth.uid()` on every row (not wrapped in SELECT) | Query plans show repeated function calls; scales linearly with row count | Wrap in subselect: `(SELECT auth.uid())` to allow Postgres to cache per statement | After ~1,000 rows — will affect this app's `work_sessions` and `daily_reports` tables |
| RLS subquery JOIN direction wrong | Same symptoms as above; EXPLAIN shows nested loop | Structure as `table.field IN (SELECT field FROM lookup WHERE user = auth.uid())` not the reverse | After ~500 rows |
| Server component fetching data already fetched in parent layout | Doubled database queries per page load; waterfall requests | Use React's `cache()` or pass data as props from parent | From day 1 — visible in Network tab |
| N+1 queries in coach dashboard (one query per student for their stats) | Coach dashboard with 10+ students becomes slow | Aggregate queries with JOIN instead of per-student fetches | Coach with 10+ students |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `SUPABASE_SERVICE_ROLE_KEY` prefixed with `NEXT_PUBLIC_` | Full database read/write/delete for anyone — bypasses all RLS | Never use `NEXT_PUBLIC_` prefix on service role key; only access in server-side files |
| RLS policies checking `user_metadata.role` from JWT | Any user can escalate their own role | Use `users` table join for role checks, not JWT `user_metadata` |
| Invite code validation only client-side | Attacker can bypass client checks and register without a valid invite | Validate invite code server-side in the callback handler — never trust client-supplied code alone |
| Admin API route without role verification | Coaches or students can call owner-only endpoints | Every API route must verify both authentication (getUser) and authorization (role from users table) |
| Coach viewing any student's data by guessing UUID | Data leakage — coach A reads coach B's students | RLS policies must scope coach access to `users WHERE coach_id = coach.id`; verify in integration test |
| Marking invite as used before creating user (non-atomic) | Invite consumed, user creation fails, invite is permanently used with no account | Wrap invite consumption + user insert in a database transaction |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Timer showing 45:00 on return to work tracker page | Student loses track of active session; thinks timer reset; may start a duplicate cycle | Detect existing `in_progress` session on page load, restore remaining time |
| Generic "Authentication Error" for expired invite | User has no idea what went wrong, cannot self-serve | Detect invite expiry specifically, show "Your invite link has expired. Contact your coach." |
| Daily report form doesn't pre-fill hours from work sessions | Student manually re-enters hours they already tracked; inconsistency between tracker and report | Auto-calculate hours from completed work sessions for the day on report form load |
| Role-based redirect after login shows flash of wrong dashboard | Users see a flash of incorrect content before redirect | Determine role on the server in the OAuth callback and redirect immediately; never redirect on the client after hydration |
| "4 cycles done" shows even if a session was abandoned | Misleads student about actual work completed | Only count `status = 'completed'` sessions toward daily cycle count |
| Empty coach analytics page with no explanation | Coach doesn't know if it's loading or genuinely empty | Always show empty state with context ("No data yet — students need to submit reports") |

---

## "Looks Done But Isn't" Checklist

- [ ] **Google OAuth**: Works locally AND in production — tested both; redirect URLs confirmed in both Google Console and Supabase Dashboard
- [ ] **Invite registration**: Invite validation is server-side in the callback, not just client-side; expired invite shows a clear error (not a generic one)
- [ ] **Work session timer**: Restores remaining time when navigating back to the page; does not allow two `in_progress` sessions on the same cycle
- [ ] **Role-based routing**: Tested that a student URL (`/student/work`) returns 403 or redirect when accessed as a coach or owner — not just a redirect for unauthenticated users
- [ ] **RLS policies**: All policies tested with anon-key client (not service_role); queried from outside the app to verify no data leaks
- [ ] **Service role key**: Confirm `SUPABASE_SERVICE_ROLE_KEY` does NOT appear in any `NEXT_PUBLIC_` env var; confirm it only exists in server files
- [ ] **Daily report auto-hours**: Hours field in the report form reflects actual completed work sessions, not whatever the student types (or it's clearly a manual override)
- [ ] **Coach scope**: Coach A cannot access a student assigned to Coach B — verified by query with Coach A's credentials
- [ ] **Middleware refresh**: Token refresh middleware runs on all protected routes; users are not silently logged out after JWT expiry (default 1 hour)
- [ ] **Migration parity**: `supabase db diff` shows no drift between local and production schema before deploying Phase 1

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| OAuth redirect loops in production | LOW | Update Site URL in Supabase Dashboard + redeploy env vars |
| RLS blocking all queries (policies missing) | LOW | Add missing policies via migration; no data loss |
| Role stored in user_metadata (discovered post-launch) | HIGH | Migrate all logic to users table join; audit all existing RLS policies; re-test all auth paths |
| Service role key exposed in client bundle | CRITICAL | Immediately rotate key in Supabase Dashboard; update all environments; audit access logs |
| Work sessions table has orphaned `in_progress` rows | LOW-MEDIUM | Write a one-time migration to mark stale sessions as `abandoned` where `started_at` is >2 hours old |
| Schema drift (prod diverged from migrations) | MEDIUM | Use `supabase db diff` to identify drift; write a catch-up migration; never edit prod directly again |
| Invite codes permanently consumed by failed registrations | LOW-MEDIUM | Add an admin endpoint to reset `used = false` on orphaned invites; add the transaction fix to prevent recurrence |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| OAuth redirect URL mismatch | Phase 1 | Test login flow locally AND from production URL |
| `getSession()` vs `getUser()` in server | Phase 1 | Code review all server files; grep for `getSession` |
| Role in `user_metadata` | Phase 1 | Inspect all RLS policies for `user_metadata` references |
| RLS enabled with no policies | Phase 1 | Every `ENABLE ROW LEVEL SECURITY` in migration has corresponding `CREATE POLICY` |
| Cross-role data leakage | Phase 1 (design) + Phase 3 (coach) | Test coach A cannot read coach B's students with raw SQL |
| Invite race condition / orphan state | Phase 1 | Test: start OAuth, let invite expire before callback, verify clean error |
| Work session timer lost on navigation | Phase 2 | Navigate away mid-session and return; verify timer resumes correctly |
| Deprecated `get/set/remove` cookie handler | Phase 1 | Use only `getAll/setAll` from day one; verify no `auth-helpers-nextjs` in package.json |
| RLS performance (missing indexes) | Phase 1 | All FK columns indexed in initial migration |
| Service role key exposure | Phase 1 | `grep -r NEXT_PUBLIC_SUPABASE_SERVICE` returns no results |
| Schema drift local-to-production | Phase 1 + Phase 5 | `supabase db diff` run before every production push |

---

## Sources

- [Supabase: Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — cookie handler `getAll/setAll` pattern
- [Supabase: RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — index optimization, subquery direction
- [Supabase: Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — role storage security
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) — OAuth redirect configuration
- [Supabase GitHub Discussion: Google OAuth not working locally #20353](https://github.com/orgs/supabase/discussions/20353) — localhost vs 127.0.0.1 issue
- [Supabase GitHub Discussion: Always redirects to localhost despite correct redirect URLs #26483](https://github.com/orgs/supabase/discussions/26483) — dynamic redirectTo pattern
- [Supabase GitHub Issue: AuthSessionMissingError in Next.js 14.2+/15 despite valid cookie #107](https://github.com/supabase/ssr/issues/107) — SSR cookie handler failures
- [Supabase GitHub Discussion: Magic Link Expiration - Invite User #13527](https://github.com/orgs/supabase/discussions/13527) — invite expiry edge cases
- [Supabase GitHub Discussion: OTP expiration setting vs Email invite expiration #23444](https://github.com/orgs/supabase/discussions/23444) — invite system timing issues
- [Vercel Blog: Common mistakes with the Next.js App Router and how to fix them](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them) — server component patterns
- [Supabase: Token Security and Row Level Security](https://supabase.com/docs/guides/auth/oauth-server/token-security) — JWT `user_metadata` vulnerability
- [Supabase: Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) — invite validation at auth creation
- [Supabase GitHub Discussion: Sync local and prod schemas when they're out of sync #18483](https://github.com/orgs/supabase/discussions/18483) — schema drift recovery
- [GitHub: @supabase/ssr AuthSessionMissingError #107](https://github.com/supabase/ssr/issues/107) — verified getUser vs getSession behavior
- [LogRocket: React Server Components performance pitfalls](https://blog.logrocket.com/react-server-components-performance-mistakes) — N+1 and hydration issues

---
*Pitfalls research for: Next.js App Router + Supabase multi-role coaching platform (IMA Accelerator V1)*
*Researched: 2026-03-16*
