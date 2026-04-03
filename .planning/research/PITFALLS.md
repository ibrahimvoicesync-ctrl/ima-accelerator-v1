# Pitfalls Research

**Domain:** Adding 4th role, polling chat, resources tab, skip tracker, coach assignments, report comments, and invite limits to an existing Next.js 16 + Supabase coaching platform (v1.4)
**Researched:** 2026-04-03
**Confidence:** HIGH — all pitfalls grounded in direct codebase audit (proxy.ts, config.ts, Sidebar.tsx, assignments route, RLS migrations) plus established patterns from prior v1.x pitfall analyses

> **Scope:** These pitfalls are specific to v1.4 features being ADDED to a production system with real students. The platform has shipped v1.0–v1.3. Every pitfall below is about what breaks when you introduce a 4th role, a polling chat system, a Discord iframe, a skip tracker, elevated coach permissions, report comments, and invite limits on top of an existing role-gated, RLS-protected, rate-limited system — not about building from scratch.

---

## Critical Pitfalls

### Pitfall 1: Partial Role Expansion — Adding student_diy Without Updating All Eight Role Gates

**What goes wrong:**
`proxy.ts` has `DEFAULT_ROUTES` and `ROLE_ROUTE_ACCESS` as plain `Record<string, string[]>` objects. Adding `student_diy` to the `users` table CHECK constraint but forgetting to add it to `DEFAULT_ROUTES` causes an infinite redirect loop: the proxy falls through to `DEFAULT_ROUTES[profile.role] || "/"`, returning `"/"`, which is not a protected route. The user lands at a blank page or 404 instead of `/student-diy`.

The problem is not one location — it is eight interdependent locations that must all be updated atomically:

1. `users` table `CHECK (role IN ('owner','coach','student'))` — DB constraint
2. `proxy.ts` `DEFAULT_ROUTES` — the post-login redirect target
3. `proxy.ts` `ROLE_ROUTE_ACCESS` — which URL prefixes the role may access
4. `config.ts` `ROLES` const — the canonical string values
5. `config.ts` `Role` type — TypeScript union (triggers compile errors at call sites if updated)
6. `config.ts` `ROLE_HIERARCHY` — numeric ordering used in invite permission checks
7. `config.ts` `NAVIGATION` — nav items rendered by Sidebar (crashes at runtime if missing)
8. `config.ts` `INVITE_CONFIG.inviteRules` — who may invite student_diy users

Also: the `invites` table has `CHECK (role IN ('coach', 'student'))` and the `magic_links` table has the same constraint. These must be widened in the schema migration if student_diy users can be invited through either pathway.

**Why it happens:**
Developers add the DB migration and the new dashboard page, test by logging in as a student_diy — and hit the redirect loop. The config file and proxy are treated as separate concerns and each is updated in a different commit.

**How to avoid:**
Update all eight locations in a single atomic commit before writing any page code. Use the TypeScript compiler as a guide: once `student_diy` is added to the `Role` union type in `config.ts`, the compiler will produce errors at every site that pattern-matches on `Role` exhaustively — each error points to a location that needs updating. Fix them all before the first test run.

**Warning signs:**
- `DEFAULT_ROUTES["student_diy"]` returns `undefined`; proxy redirects to `"/"` in a loop.
- `NAVIGATION["student_diy"]` returns `undefined`; `links.map(...)` throws `TypeError: Cannot read properties of undefined`.
- TypeScript still compiles because the `Role` type was not updated (the type mismatch is hidden).

**Phase to address:**
student_diy database + config foundation phase — all eight locations updated in the same commit, before any page code.

---

### Pitfall 2: RLS Policies Missing student_diy — Silent Empty Dashboards

**What goes wrong:**
Every existing RLS policy uses `get_user_role() = 'student'` for student-side access. After the migration adds `student_diy` to the CHECK constraint, student_diy users authenticate successfully and reach the database — but no RLS policy matches them. For tables they should NOT access (daily_reports, chat_messages), the default-deny is correct. For tables they SHOULD access (work_sessions, roadmap_progress, daily_plans), all SELECT policies return zero rows and all INSERT/UPDATE policies reject writes with `new row violates row-level security`, appearing as mysterious 500 errors.

The critical failure mode: API routes use `createAdminClient()` which bypasses RLS entirely. Everything works in development (admin client in use), but the production defense-in-depth is broken. If anyone queries these tables through the anon client (e.g., a future realtime subscription or a misconfigured route), student_diy data is inaccessible.

**Why it happens:**
The developer tests the student_diy flow exclusively through the admin client (which bypasses RLS), sees data correctly, and marks the feature complete. The RLS policies are never validated with the anon client.

**How to avoid:**
Write the student_diy RLS policies in the same migration that adds the role. Map access before writing the SQL:

| Table | student_diy access |
|-------|-------------------|
| users | SELECT own row |
| work_sessions | SELECT + INSERT + UPDATE own rows |
| roadmap_progress | SELECT + UPDATE own rows |
| daily_plans | SELECT + INSERT own rows |
| daily_reports | No access |
| invites | No access |
| chat_messages (new) | No access — DIY has no chat |
| glossary (new) | SELECT only |

All existing policies using `get_user_role() = 'student'` need an OR clause: `get_user_role() IN ('student', 'student_diy')` where DIY should have identical data access. Policies for coach/owner visibility of student data may also need expanding (e.g., coaches querying their assigned students' work sessions must now handle `role IN ('student')` — DIY students have no coach, so the coach visibility policy doesn't need changing for DIY).

**Warning signs:**
- student_diy user logs in but sees empty Work Tracker and Roadmap with no error messages.
- Server logs show `new row violates row-level security policy` for work_sessions INSERT by student_diy users.
- No TypeScript error because admin client bypasses RLS.

**Phase to address:**
student_diy database + config foundation phase — must be in the same migration as the role expansion. Validate by testing with the anon client directly in Supabase Studio.

---

### Pitfall 3: Chat Polling setInterval Memory Leak and Stale Closure

**What goes wrong:**
A `useEffect` sets up a 5-second polling interval to fetch new chat messages. If the component unmounts (user navigates away) before the cleanup runs, the interval keeps firing, calling `setState` on an unmounted component. In React 19 this produces silent state corruption. The stale closure variant: the interval captures `conversationId` from its closure at creation time. If the parent switches the active conversation, the interval still polls the old conversation ID — showing stale messages in the new thread.

The common implementation that has both bugs:
```typescript
useEffect(() => {
  const id = setInterval(fetchMessages, 5000);
  // missing: return () => clearInterval(id)
}, [conversationId]); // if conversationId changes, old interval is not cleared
```

**Why it happens:**
React StrictMode double-invokes effects in development, which masks the missing cleanup because the effect fires twice and React cleans up automatically between the two invocations. The leak only manifests in production. Developers test in dev mode, see no interval leak, and ship.

**How to avoid:**
Always return the cleanup:
```typescript
useEffect(() => {
  const id = setInterval(fetchMessages, 5000);
  return () => clearInterval(id);
}, [conversationId]);
```

Use a `useRef` to hold the latest `fetchMessages` callback without adding it to the dependency array, preventing unnecessary interval recreation while still avoiding stale closures:
```typescript
const fetchRef = useRef(fetchMessages);
useEffect(() => { fetchRef.current = fetchMessages; });
useEffect(() => {
  const id = setInterval(() => fetchRef.current(), 5000);
  return () => clearInterval(id);
}, [conversationId]);
```

Also add a `visibilitychange` listener to pause polling when `document.hidden === true`. At 5k students all polling at 5-second intervals, this reduces load by ~60% (most tabs are backgrounded at any given moment). The existing rate limiter allows 30 req/min per user per endpoint — chat polling at 12 req/min fits within the limit, but do NOT apply `checkRateLimit()` to the GET polling endpoint (see Pitfall 7).

**Warning signs:**
- Browser Network tab shows requests to `/api/chat` continuing after navigating away from the chat page.
- Memory usage climbs steadily in long-running sessions.
- Chat shows messages from a previous conversation after switching to a new one.

**Phase to address:**
Chat implementation phase. Add the `visibilitychange` optimization in the same phase, not as a follow-up.

---

### Pitfall 4: Discord WidgetBot iframe Blocked in Production by Missing CSP Headers

**What goes wrong:**
`next.config.ts` currently has no `headers()` configuration and no Content-Security-Policy. When the Resources tab embeds a WidgetBot iframe pointing to `https://e.widgetbot.io`, browsers in production block it with:

```
Refused to frame 'https://e.widgetbot.io/' because it violates the following Content Security Policy directive: "frame-src 'self'"
```

Vercel's Edge Network injects a default `X-Frame-Options: SAMEORIGIN` header for Next.js deployments. An iframe that renders fine on localhost (no Vercel headers) fails silently in production — showing a blank area with no JavaScript error visible to the user.

Additionally, WidgetBot requires the embedding page's origin to be allowlisted in the WidgetBot dashboard. This is a configuration step outside the codebase entirely.

**Why it happens:**
Local development has no Vercel-injected headers, so the iframe loads successfully. The developer ships without testing on the actual Vercel deployment URL. The error is only visible in the production browser console.

**How to avoid:**
Add `frame-src` to `next.config.ts` `headers()` before building the Resources page component:
```typescript
// next.config.ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [{
      key: 'Content-Security-Policy',
      value: "frame-src 'self' https://e.widgetbot.io; img-src 'self' data: https://cdn.discordapp.com;"
    }]
  }]
}
```

Also add `https://e.widgetbot.io` to `img-src` (WidgetBot loads user avatars from Discord's CDN). The existing AI chat iframe at `/student/ask` embeds `AI_CONFIG.iframeUrl` — when Abu Lahya provides that URL, the CSP must be updated to include it. Writing the CSP in the resources phase is the right time to address all iframe sources comprehensively.

Test on a Vercel preview deployment, not localhost, before calling the phase complete.

**Warning signs:**
- Blank area where the iframe should appear on the production URL.
- Browser console shows `Refused to frame` error only on Vercel, not localhost.
- WidgetBot shows "This website is not authorized" inside the frame (different from the CSP block — this is the WidgetBot allowlist missing).

**Phase to address:**
Resources tab implementation phase — add CSP headers as the very first step before building any iframe component.

---

### Pitfall 5: ISO Week Skip Tracker — Monday Boundary and UTC Mismatch

**What goes wrong:**
The skip tracker counts days with no completed session in "this week" (Monday–Sunday ISO week, Decision v1.4 D-01). Two failure modes:

**Mode A — wrong week boundary:** JavaScript `new Date().getDay()` returns 0 for Sunday, 1 for Monday. Computing "this week's Monday" as `date - date.getDay()` produces Sunday, not Monday. The correct ISO formula is `date - ((date.getDay() + 6) % 7)`.

**Mode B — UTC vs. local timezone:** The `work_sessions` table stores `date` as a Postgres `date` column set by `getTodayUTC()`. "Today" for a student in UTC+3 at 11pm is already tomorrow in UTC. If the RPC function uses `CURRENT_DATE` (Postgres UTC), it misidentifies the student's "today" and counts a non-skip for the student's current local day — or counts Sunday as already skipped before the student has a chance to work.

This is not theoretical. The calendar view had this exact UTC/local off-by-one and required a gap-closure fix (documented in PROJECT.md v1.1 Phase 17).

**Why it happens:**
Skip counting feels simple: "count dates in the current ISO week with no session row." The Monday boundary math is subtly wrong in JavaScript, and the UTC/local split is invisible when testing with a developer in the same timezone as the server.

**How to avoid:**
Write the skip count as a PostgreSQL RPC function. Use `date_trunc('week', p_today)` for the Monday boundary — PostgreSQL's `date_trunc('week')` correctly returns the ISO Monday (not Sunday). Pass the student's "today" as a parameter from the application layer using `getTodayUTC()`, rather than relying on `CURRENT_DATE` inside the function:

```sql
CREATE OR REPLACE FUNCTION get_weekly_skip_count(p_student_id uuid, p_today date)
RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT (p_today - date_trunc('week', p_today)::date + 1)
       - COUNT(DISTINCT ws.date)
  FROM work_sessions ws
  WHERE ws.student_id = p_student_id
    AND ws.date >= date_trunc('week', p_today)::date
    AND ws.date <= p_today
    AND ws.status = 'completed'
$$;
```

Test at Monday 00:01 UTC, Sunday 23:59 UTC, and with a student in UTC+3 at 23:00 their local time.

**Warning signs:**
- Skip count shows 7 on Monday (entire previous week counted as current week).
- Skip count shows 0 on Sunday for a student who hasn't worked all week.
- Skip count is 1 higher than expected for students in UTC+ timezones on Sunday evening.

**Phase to address:**
Skip tracker database + API phase — the RPC function must use the passed `p_today` parameter, not `CURRENT_DATE`.

---

### Pitfall 6: Coach Assignment Escalation — Unbounded Student List and student_diy Bypass

**What goes wrong:**
The current `PATCH /api/assignments` route checks `profile.role !== "owner"` and returns 403. When coaches gain assignment power (Decision v1.4 D-02), this becomes `owner OR coach`. Two escalation vectors emerge:

**Vector A — unbounded student enumeration:** The coach assignment UI needs a list of all unassigned students and all active coaches. Previously this data was only visible to the owner. If the developer copies the owner's assignments page to the coach dashboard without adding a filter, every coach can enumerate every student on the platform — including students assigned to other coaches.

**Vector B — student_diy assignment:** Decision v1.4 D-04 states "student_diy has NO coach assignment." The existing route checks `.eq("role", "student")` when verifying the target student. When the role expansion migration runs, `student_diy` becomes a valid role value but is distinct from `student`. The existing filter already blocks it — but only if the filter string is exactly `"student"`. If the developer changes the filter to accommodate the new role check (e.g., `.in("role", ["student", "student_diy"])`), the guard is removed.

**Why it happens:**
The developer copies the owner's assignment page component to the coach dashboard and removes the `role !== 'owner'` check. The new coach assignment page works, but the data-fetching server component returns platform-wide students and coaches without a scope filter.

**How to avoid:**
For the coach assignment UI data fetch, restrict the unassigned student list to `WHERE role = 'student' AND coach_id IS NULL` — not all students. The coach does not need to see students already assigned to other coaches.

In `PATCH /api/assignments`, the check must remain: target student must have `role = 'student'` (not student_diy). Keep the existing `.eq("role", "student")` filter untouched. Add an explicit comment: `// student_diy cannot be assigned — D-04`.

**Warning signs:**
- A coach can access a list of all 5k platform students at the assignment page.
- Attempt to assign a student_diy via the API returns 200 instead of 404.
- The coach can see students assigned to other coaches in the assignment dropdown.

**Phase to address:**
Coach assignments phase. Include a security test in the success criteria: attempt to assign student_diy as a coach actor; expect 404.

---

### Pitfall 7: Chat GET Polling Endpoint Hit by Rate Limiter — 429 After 2.5 Minutes

**What goes wrong:**
The rate limiter at `src/lib/rate-limit.ts` defaults to 30 req/min per user per endpoint. Chat polling at 5-second intervals generates 12 req/min. The limit is not hit individually — but the `checkRateLimit()` function also INSERTs a row into `rate_limit_log` for every ALLOWED request. Applied to a GET polling endpoint, this means:

- 12 INSERT + 12 SELECT per user per minute into `rate_limit_log`
- 5k students active simultaneously = 60,000 INSERT + 60,000 SELECT per minute
- 120,000 DB operations per minute against a single table, with a pg_cron cleanup every 2 hours

At 2,000 rows/sec the table accumulates ~14.4 million rows before the next cleanup — far beyond the indexed scan range, causing the cleanup query to run for minutes and lock the table. Additionally, if the endpoint is labeled with a different key (e.g., `/api/chat/messages`) and the per-endpoint limit is 30 req/min, the 12 req/min from polling fits fine — but there is no guarantee a developer doesn't copy-paste the rate limiter call from a mutation route into the polling GET handler.

**Why it happens:**
The rate limiter boilerplate is copy-pasted from an existing mutation route. It compiles, it runs, and in testing (single user) no issue appears. The table bloat only manifests at real scale.

**How to avoid:**
Do not call `checkRateLimit()` in read-only GET endpoints. Rate limiting is for mutation routes (POST, PATCH, DELETE). If abuse protection is needed for the chat poll endpoint, implement a lightweight IP-based or session-based counter with a high ceiling (e.g., 120 req/min) using a separate mechanism — not the rate_limit_log table.

The existing `src/lib/rate-limit.ts` documentation and the v1.2 Phase 22 pattern apply only to mutation routes. Add a comment at the top of the rate-limit helper: "Use only in mutation routes (POST/PATCH/DELETE). Do not apply to polling GET endpoints."

**Warning signs:**
- `rate_limit_log` row count exceeds 1 million within 30 minutes of chat going live.
- pg_cron cleanup job takes more than 10 seconds (table lock).
- Students get 429 errors after 2.5 minutes on the chat page.

**Phase to address:**
Chat API design phase — confirm `checkRateLimit()` is NOT called in the chat polling GET handler.

---

### Pitfall 8: Report Comment Endpoint Missing Ownership Verification

**What goes wrong:**
Report comments are "single coach comment per daily report, coach-only" (Decision v1.4 D-03). The simplest implementation adds a `coach_comment text` column and `commented_by uuid` to the `daily_reports` table, then exposes a `PATCH /api/reports/[id]/comment` route.

The gap: the route must verify that the requesting coach is assigned to the student who submitted the report. Without this check, any authenticated coach can POST a comment to any student's report — including students assigned to other coaches.

This exact ownership gap existed on `POST /api/reports/[id]/review` and was fixed in v1.2 Phase 23 (documented in PROJECT.md). The fix was to fetch the report first, get the `student_id`, then verify the student's `coach_id` matches the requesting coach's `id`. The comment endpoint will have the same shape and must follow the same fix.

**Why it happens:**
The developer writes `UPDATE daily_reports SET coach_comment = $1 WHERE id = $2` and only verifies the report exists — not that the coach has jurisdiction over the student who submitted it. The "only coaches see the UI" reasoning is used to skip the server-side check.

**How to avoid:**
Two-step ownership check in the comment route, mirroring the review route fix:
```typescript
// 1. Fetch the report to get student_id
const { data: report } = await admin
  .from("daily_reports")
  .select("student_id")
  .eq("id", reportId)
  .single();

if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

// 2. Verify the requesting coach is assigned to this student
//    (owners bypass this check)
if (profile.role === "coach") {
  const { data: student } = await admin
    .from("users")
    .select("id")
    .eq("id", report.student_id)
    .eq("coach_id", profile.id)
    .single();

  if (!student) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

Include this verification in the phase success criteria. Test by attempting to comment on a report from a student assigned to a different coach.

**Warning signs:**
- Any coach can PATCH a comment to any report ID.
- The route checks `report.id` exists but not `student.coach_id = profile.id`.
- Test: POST a comment on a report from another coach's student — expect 403, not 200.

**Phase to address:**
Report comments phase. Ownership check must be in the success criteria.

---

### Pitfall 9: Glossary Term — Missing Case-Insensitive Uniqueness Constraint

**What goes wrong:**
The glossary requires unique terms (e.g., "CPM" and "cpm" should not both exist). A standard `UNIQUE` constraint on a `text` column is case-sensitive in PostgreSQL. A standard `UNIQUE` constraint allows both "CPM" and "cpm" to coexist.

The API-level uniqueness check using `WHERE term = $1` is also case-sensitive. Using `ilike` or `lower(term) = lower($1)` in the application check without a corresponding functional index causes a full sequential scan for every glossary lookup as the term count grows.

**Why it happens:**
The developer thinks "it's a glossary, it will have at most 100 terms." Correct about scale — but still wrong about correctness. Two coaches adding "CPM" and "cpm" is a real scenario that a uniqueness constraint exists to prevent.

**How to avoid:**
```sql
CREATE UNIQUE INDEX idx_glossary_term_lower ON glossary (lower(term));
```

In the Zod schema for the API, normalize with `.trim().toLowerCase()` before the uniqueness check query:
```typescript
const normalizedTerm = parsed.data.term.trim();
const { data: existing } = await admin
  .from("glossary")
  .select("id")
  .ilike("term", normalizedTerm) // uses the functional index
  .maybeSingle();
```

Store terms in their original case (do not force lowercase storage) — display "CPM" as entered. Only enforce uniqueness case-insensitively at the DB level.

**Warning signs:**
- "CPM" and "cpm" both appear in the glossary list.
- Searching for "cpm" returns no results when "CPM" is stored.
- The uniqueness check passes at the API layer (exact match) but a second insert with different casing succeeds.

**Phase to address:**
Resources — Glossary implementation phase, in the migration that creates the glossary table.

---

### Pitfall 10: Invite max_uses Default — Existing Rows Remain Unlimited

**What goes wrong:**
Decision v1.4 D-13 changes the default `max_uses` from null (unlimited) to 10. The `magic_links` table already has `max_uses int` (nullable, currently null = unlimited for all existing links). Adding `DEFAULT 10` to the column changes new inserts but does NOT retroactively update existing rows — standard SQL behavior.

The UI that displays usage count must handle the null case: `${link.use_count} / ${link.max_uses ?? '∞'}` — rendering null as the string "null" is a visible bug. Additionally, if the application logic that checks whether a link is "at capacity" reads `link.use_count >= link.max_uses`, and `max_uses` is null, the comparison `3 >= null` evaluates to `false` in JavaScript — existing links never hit capacity even if the intent is to cap them.

**Why it happens:**
Column defaults feel like global settings. Developers expect `DEFAULT 10` to apply to existing rows. The null-handling bug in the capacity check is easy to miss because null comparisons in JavaScript silently evaluate to false.

**How to avoid:**
In the migration, explicitly decide and document: either run `UPDATE magic_links SET max_uses = 10 WHERE max_uses IS NULL` to retroactively cap existing links, or leave them as-is (grandfathered unlimited). Add a comment in the migration explaining the choice.

In the capacity-check logic, always handle null explicitly:
```typescript
const atCapacity = link.max_uses !== null && link.use_count >= link.max_uses;
```

In the `POST /api/magic-links` route, pass `max_uses: 10` explicitly in the insert body rather than relying on the DB default — this is more explicit and testable.

**Warning signs:**
- Existing invite links show "3 / " or "3 / null" in the UI.
- An existing link allows more than 10 registrations after the feature ships.
- New links created via the API have `max_uses: null` because the route did not pass the default.

**Phase to address:**
Invite limits phase. Migration must document whether existing null rows are grandfathered or retroactively capped.

---

### Pitfall 11: Chat Unread Badges — Separate Polling Loop Doubles Request Rate

**What goes wrong:**
The sidebar needs unread chat badge counts (Decision v1.4 D-08 implies students and coaches need to see unread indicators). A common implementation mistake: add a second `setInterval` to poll `/api/chat/unread-count` at 5-second intervals, independent from the message-fetching interval. This means:

- On the chat page: 2 intervals firing = 24 req/min
- On any non-chat page: the unread badge still polls at 12 req/min (background)

Globally, the Sidebar component runs on every dashboard page. If the unread count is fetched inside the Sidebar via its own polling interval, every page in the app polls the chat endpoint — not just the chat page.

**Why it happens:**
The Sidebar needs badge counts for other features (unreviewed reports, active alerts). Adding another badge count for chat follows the same pattern. The developer adds a `useEffect` with `setInterval` inside the Sidebar for chat unread counts, mirroring existing badge count logic.

**How to avoid:**
Return the unread count as part of the same message-fetch response on the chat page:
```json
{ "messages": [...], "unread_count": 3 }
```

On non-chat pages, pass the unread count as a server-rendered prop from the layout's server component (fetched once on page load), not via a client-side polling interval. Badge counts that are slightly stale (up to the next page load) are acceptable for non-chat pages.

Never add polling intervals inside the `Sidebar` component — it renders on every dashboard page.

**Warning signs:**
- Two `setInterval` calls visible in React DevTools for the chat page.
- Network tab shows requests to `/api/chat/unread-count` on the Roadmap page and Work Tracker page.
- `Sidebar.tsx` contains a `useEffect` with `setInterval`.

**Phase to address:**
Chat implementation phase, when designing the message API response shape.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding `"student_diy"` role string in page files instead of importing from `config.ts` | Faster | Diverges from config-is-truth; breaks when role is renamed | Never |
| Inline `role === 'student' \|\| role === 'student_diy'` checks in components | Fast | Each component that needs this check diverges; no central update point | Never — create `isStudentRole(role)` utility in config.ts |
| Polling without `visibilitychange` pause | Simpler code | Unnecessary DB load from backgrounded tabs; 60k+ req/min at scale | Never in production |
| `checkRateLimit()` applied to the chat polling GET endpoint | Copy-paste from mutation routes | rate_limit_log bloats to millions of rows; 429s for students after 2.5 min | Never |
| Skipping ownership check on report comments ("only coaches see this UI") | Saves one DB call | Any user who discovers the endpoint can comment on any report | Never |
| Testing Discord iframe on localhost only (not Vercel preview) | Faster dev loop | CSP block is invisible locally; ships as silent blank in production | Never — Vercel preview test is required |
| Adding `student_diy` to proxy without updating RLS policies | Route guards work | Defense-in-depth broken; admin client bypass masks the gap | Never |
| Storing chat messages without a `conversation_id` index | Simpler schema | Full table scan for message history as row count grows | Only if chat is guaranteed to stay under 5k total messages |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Discord WidgetBot | Testing iframe on localhost (no Vercel headers) | Test on a Vercel preview URL before marking the phase complete |
| Discord WidgetBot | Embedding without adding the app domain to WidgetBot allowlist | Register production URL in WidgetBot dashboard — deployment prerequisite, not code |
| Discord WidgetBot | Not handling "bot offline" / "server unavailable" state | Wrap iframe in an error boundary; show a fallback message |
| Supabase RPC for skip count | Using `CURRENT_DATE` (Postgres UTC) instead of a passed parameter | Pass the student's `getTodayUTC()` value as the `p_today` parameter |
| Chat API and rate limiter | Copying `checkRateLimit()` into the GET polling handler | GET polling endpoints must not call `checkRateLimit()` |
| CSP headers in Next.js | Attempting to set headers in `proxy.ts` instead of `next.config.ts` | Security headers go in `next.config.ts` `headers()` function, not in the proxy |
| New mutation routes (comment, chat POST, glossary CRUD) | Forgetting `verifyOrigin()` and `checkRateLimit()` | Every new mutation route must start with `verifyOrigin(request)` then auth, role, rate limit, Zod — the established pipeline from v1.2 |
| Invite `max_uses` null check | `use_count >= max_uses` evaluates to false when `max_uses` is null | Always guard: `max_uses !== null && use_count >= max_uses` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 skip tracker — one query per student in coach dashboard | Coach dashboard slow with 50+ students | Single RPC returning skip counts for all assigned students at once | >10 students visible |
| rate_limit_log bloat from chat GET polling | Table grows to millions of rows; pg_cron cleanup takes >10s | Never call `checkRateLimit()` in GET endpoints | Immediate at 5k students |
| Unread badge polling in Sidebar (every page) | 12 req/min per user even when not on chat page | Server-render unread count on page load; do not poll in Sidebar | Immediately noticeable at >100 concurrent users |
| Chat message table without `(conversation_id, created_at DESC)` index | Slow message list queries as history grows | Add this index at table creation | ~10k total messages |
| Glossary search on every keystroke | High-frequency API calls on glossary search | Debounce 300ms, or filter client-side on already-fetched terms (glossary is small) | Immediately noticeable in UI jank |
| skip_count re-computed on every coach page load | Slow coach dashboard with many students | Cache the result in `student_kpi_summaries` (already pre-aggregated by pg_cron) or compute once per request using a single RPC | >50 students per coach |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Coach assignment page returns all platform students (not filtered by `coach_id IS NULL`) | Coach enumerates all 5k students including those assigned to other coaches | Server-side filter: return only `role = 'student' AND coach_id IS NULL` for the assignment picker |
| `PATCH /api/assignments` expanded to coaches without blocking `student_diy` targets | Coach assigns a DIY student, breaking the "no coach for DIY" contract and proxy guard assumptions | Explicit `.eq("role", "student")` filter on the target user lookup remains unchanged |
| Report comment endpoint without ownership verification | Any authenticated coach comments on any report | Two-step: fetch report → verify `student.coach_id = requesting_coach.id` — same pattern as existing review fix |
| `student_diy` users accessing `/student/*` routes in proxy | DIY user navigates to `/student/report` or `/student/ask` which they should not access | `ROLE_ROUTE_ACCESS["student_diy"]` must list only `/student-diy`, never `/student` |
| Chat messages without sender/receiver filtering | Student A can poll for messages between Coach B and Student B | API filter: `(coach_id = X AND student_id = authenticated_user_id)` for students; coaches see only their own conversations |
| Broadcast messages without coach assignment filter | Students receive broadcasts from coaches they are not assigned to | Broadcast: `coach_id = student.coach_id` — filter by the student's own assigned coach |
| New routes missing `verifyOrigin()` | CSRF attack on comment, chat, glossary, assignment routes | Every new POST/PATCH/DELETE route must call `verifyOrigin(request)` as the first line |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Chat auto-scrolls to bottom even when user is scrolled up reading old messages | Interrupts reading; user loses their position | Only auto-scroll if the user is already at the bottom (within 100px); show "New messages ↓" button otherwise |
| Chat clears input text on network error | User's message is lost; no way to retry | On error, restore input value and show a toast; do not clear input until server confirms 201 |
| Skip tracker shows data for student_diy users (who don't have the "skip" concept) | Misleading — DIY has no daily report requirement | Filter the skip tracker query to `role = 'student'` only; show "N/A" or hide the metric for DIY |
| Discord WidgetBot with fixed pixel height on mobile | Iframe truncated at 375px; unusable on phone | Use responsive height: `min-h-[400px] h-[60vh]` |
| Glossary search returns no results for "CPM " (trailing space) | User thinks term doesn't exist | `.trim()` all search input before querying |
| Invite usage counter showing "3 / " when max_uses is null | Looks like a rendering bug | Always render `max_uses !== null ? max_uses : '∞'` |
| Chat page shows no messages on first load (loading state same as empty state) | User thinks they have no conversations | Distinguish "loading" (spinner) from "empty" (empty state message) |

---

## "Looks Done But Isn't" Checklist

- [ ] **student_diy role:** Added to DB CHECK constraint, proxy DEFAULT_ROUTES, proxy ROLE_ROUTE_ACCESS, config ROLES, config NAVIGATION, config INVITE_CONFIG, and TypeScript Role type — verify ALL EIGHT locations, not just the new page files.
- [ ] **student_diy role:** RLS policies cover work_sessions, roadmap_progress, daily_plans with `IN ('student', 'student_diy')` — verify with anon client directly in Supabase Studio, not through admin client.
- [ ] **Chat polling:** `clearInterval` cleanup exists in `useEffect` return — verify by navigating away from the chat page; no fetch calls should appear in the Network tab after navigation.
- [ ] **Chat polling:** `visibilitychange` listener pauses polling when the tab is backgrounded — verify by switching tabs and confirming network requests stop.
- [ ] **Chat rate limiter:** `checkRateLimit()` is NOT called in the chat GET polling handler — grep the file to confirm.
- [ ] **Discord iframe:** Loads on Vercel preview deployment (not localhost) — verify CSP header is set in `next.config.ts` and WidgetBot domain is allowlisted.
- [ ] **Skip tracker:** Monday boundary returns ISO Monday, not Sunday — test by computing the week start on a Monday.
- [ ] **Skip tracker:** Test with UTC+3 student at 23:00 local time — skip count uses passed `p_today` param, not `CURRENT_DATE`.
- [ ] **Coach assignments:** student_diy cannot be assigned to a coach — test the API with a student_diy user ID; expect 404.
- [ ] **Coach assignments:** Coach assignment page shows only unassigned students — not all 5k platform students.
- [ ] **Report comments:** Ownership check blocks cross-student commenting — test by sending a comment to a report from a student assigned to a different coach; expect 403.
- [ ] **Glossary:** Functional index `lower(term)` exists on the glossary table — verify in Supabase Studio `\d glossary`.
- [ ] **Glossary:** Case-insensitive uniqueness enforced at DB level — insert "CPM" then attempt to insert "cpm"; expect a unique violation.
- [ ] **Invite max_uses:** UI renders `∞` for null rows — check an existing invite link in the UI before the feature is "done."
- [ ] **All new mutation routes:** `verifyOrigin(request)` is the first call — grep every new POST/PATCH/DELETE handler.
- [ ] **All new mutation routes:** `checkRateLimit()` is present in mutation handlers and absent from GET handlers — grep every new route file.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Partial role expansion (redirect loop for student_diy) | LOW | Fix the missed locations in config/proxy; deploy; no data migration needed |
| RLS missing student_diy (empty dashboards) | LOW | Write a new migration adding the missing policies; no data corruption |
| Chat polling memory leak in production | MEDIUM | Ship a patch with `clearInterval` cleanup and `visibilitychange` listener; no data impact but requires deploy |
| Discord iframe blocked by CSP in production | LOW | Add `frame-src` to `next.config.ts` headers; redeploy; no schema changes |
| Skip tracker wrong Monday boundary | LOW | Fix the RPC function; redeploy; no data corruption, just wrong counts |
| Coach assignment exposes all students | HIGH | Revert or hotfix the data-fetching query immediately; audit whether any coach accessed another coach's student data; log a security incident |
| Report comment without ownership check | HIGH | Revert or hotfix the endpoint; audit which cross-student comments were created; manually remove illegitimate comment rows |
| rate_limit_log bloat from chat polling | MEDIUM | Remove rate limit from GET chat endpoint; run `DELETE FROM rate_limit_log WHERE endpoint = '/api/chat/messages'`; table recovers at next pg_cron cycle |
| Glossary case duplicates in production | MEDIUM | Deduplicate rows via manual SQL; add the functional index via migration; no data loss |
| Invite max_uses null handling broken | LOW | Fix the null guard in the UI and capacity-check logic; deploy; no schema change needed unless retroactive capping is desired |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Partial role expansion (all 8 locations) | student_diy database + config foundation | TypeScript compiles with strict `Record<Role, NavItem[]>` type; login as student_diy succeeds |
| RLS missing student_diy | student_diy database + config foundation (same migration) | Test INSERT to work_sessions with anon client as student_diy; expect success |
| Sidebar crash for student_diy | student_diy database + config foundation | `NAVIGATION["student_diy"]` defined; TypeScript strict check passes |
| Chat polling memory leak | Chat implementation phase | Network tab shows no chat requests after navigating away |
| Chat rate limiter misconfiguration | Chat API design phase | `checkRateLimit()` absent from GET polling handler (grep check) |
| Chat unread badge double-polling | Chat implementation phase | Single request per 5-second interval; no polling in Sidebar |
| Discord iframe CSP block | Resources tab phase (first step before iframe component) | Loads on Vercel preview URL; verify in production browser console |
| WidgetBot domain allowlist | Resources deployment step | WidgetBot admin panel shows production domain as allowed |
| Skip tracker ISO Monday boundary | Skip tracker API phase | Monday boundary test returns correct date |
| Skip tracker UTC mismatch | Skip tracker API phase | `p_today` parameter used; not `CURRENT_DATE` |
| Coach assignment student enumeration | Coach assignments phase | Coach assignment page filtered to unassigned students only |
| student_diy assignment bypass | Coach assignments phase | student_diy target returns 404 when coach attempts to assign |
| Report comment ownership gap | Report comments phase | Cross-coach attempt returns 403; in success criteria |
| Glossary case-insensitive uniqueness | Resources — Glossary migration | Functional index on `lower(term)` exists; duplicate case test fails at DB |
| Invite max_uses null handling | Invite limits phase | UI renders `∞`; capacity check guards null correctly |
| Missing `verifyOrigin()` on new routes | Every new API route phase | Grep each new POST/PATCH/DELETE file for `verifyOrigin` before marking done |
| Missing `checkRateLimit()` on new mutation routes | Every new API route phase | Grep each new mutation route file for `checkRateLimit` before marking done |

---

## Sources

- Codebase audit: `src/proxy.ts` — `DEFAULT_ROUTES`, `ROLE_ROUTE_ACCESS` as plain Record objects; no student_diy key
- Codebase audit: `src/lib/config.ts` — `ROLES`, `Role` type, `NAVIGATION: Record<Role, NavItem[]>`, `ROLE_HIERARCHY`, `INVITE_CONFIG.inviteRules`
- Codebase audit: `src/components/layout/Sidebar.tsx` — `NAVIGATION[role]` direct lookup; crash if key missing
- Codebase audit: `supabase/migrations/00001_create_tables.sql` — `users CHECK (role IN ('owner','coach','student'))`, `invites CHECK (role IN ('coach', 'student'))`, `get_user_role()` RLS helper pattern
- Codebase audit: `supabase/migrations/00013_daily_plans_undo_log.sql` — `get_user_role() = 'coach'` RLS pattern; template for student_diy policies
- Codebase audit: `src/lib/rate-limit.ts` — INSERT on every allowed request; unsafe for high-frequency GET endpoints
- Codebase audit: `src/app/api/assignments/route.ts` — `profile.role !== "owner"` check to expand; `.eq("role", "student")` filter that must be preserved
- Codebase audit: `src/lib/supabase/admin.ts` — singleton pattern confirmed; all routes use admin client (RLS bypass)
- Codebase audit: `next.config.ts` — no `headers()` defined; CSP is not set; iframe will be blocked by Vercel default headers
- `.planning/PROJECT.md` — Key Decisions D-01 through D-14; v1.1 Phase 17 UTC off-by-one calendar gap closure
- `.planning/PROJECT.md` — v1.2 Phase 23: `reports/[id]/review` ownership leak fix (template for report comments)
- React documentation: `useEffect` cleanup requirement; stale closure in `setInterval`; React StrictMode double-invoke masking cleanup bugs
- PostgreSQL documentation: `date_trunc('week')` returns ISO Monday; functional index for case-insensitive uniqueness
- MDN Web Docs: `document.visibilityState` API for pausing background polling
- Vercel documentation: default security headers injected for Next.js deployments

---
*Pitfalls research for: IMA Accelerator v1.4 — Roles, Chat & Resources milestone*
*Researched: 2026-04-03*
