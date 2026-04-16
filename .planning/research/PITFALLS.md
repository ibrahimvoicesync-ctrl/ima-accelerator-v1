# Pitfalls Research — Milestone v1.8

**Domain:** Analytics Expansion (student re-split + owner coach leaderboards + window selectors), Owner Alerts pruning to `deal_closed`, Coach Alerts `tech_setup` activation as Step 4, Owner DIY Detail Page parity
**Researched:** 2026-04-16
**Confidence:** HIGH — grounded in this specific codebase: migration 00004 (alert_dismissals), 00022 (deals.logged_by), 00023 (get_student_analytics), 00027 (get_coach_milestones + backfill), 00028 (get_owner_analytics), 00029 (chat removal + dual-overload regression), 00032 (PGRST203 hotfix); current mutation routes `src/app/api/deals/route.ts`, `src/app/api/deals/[id]/route.ts`, `src/app/api/work-sessions/[id]/route.ts`, `src/app/api/reports/route.ts`, `src/app/api/alerts/dismiss/route.ts`; cache wrappers in `src/lib/rpc/owner-analytics.ts`, `student-analytics.ts`, `coach-milestones.ts`; config `src/lib/config.ts` (MILESTONE_CONFIG / MILESTONE_FEATURE_FLAGS); UI `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx`, `src/app/(dashboard)/owner/students/[studentId]/page.tsx`, `src/components/coach/alerts-types.ts` (MILESTONE_META).

Each pitfall maps to a feature block (F1..F6) plus cross-feature concerns, with a concrete grep / SQL / assertion to verify prevention.

---

## Cross-feature Pitfall X-0: RPC overload collision (PGRST203) — the 00027 vs 00029 trap will repeat

**What goes wrong:**
Migration 00027 (Phase 51) created `get_sidebar_badges(uuid, text, date, boolean)`. Migration 00029 (Phase 55) then called `CREATE OR REPLACE FUNCTION public.get_sidebar_badges(p_user_id uuid, p_role text)` — which Postgres treats as a NEW signature (overload identity is the full arg-type list), so instead of replacing the old one it created a second overload alongside. PostgREST then refused to dispatch named-arg calls with code `PGRST203` ("Could not choose the best candidate function between …"). The dashboard broke platform-wide until 00032 dropped the orphan.

**F1 hits this directly.** F1 renames two keys in `get_student_analytics` (total_emails → total_brand_outreach, total_influencers → total_influencer_outreach). The signature `get_student_analytics(uuid, text, int, int)` is unchanged, so `CREATE OR REPLACE` actually does replace — good — BUT the migration MUST NOT create a new overload with a different signature (e.g., by adding a new arg later). Any future extension (pagination cursor, range-v2 param) must DROP the old signature first.

**Prevention — required pattern for every RPC-touching migration in v1.8:**
```sql
DO $drop$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_student_analytics'
  LOOP
    EXECUTE format('DROP FUNCTION public.get_student_analytics(%s) CASCADE', r.args);
  END LOOP;
END $drop$;
```
This is the same defensive pattern already used in 00025 and 00028. Apply to any RPC touched in F1 or F2.

**Detection:**
Post-migration assert:
```sql
SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_student_analytics';
-- must equal 1
```

**Phase assignment:** F1 migration phase + F2 migration phase (the get_owner_analytics rewrite).

---

## Feature 1 — Student Analytics Re-split (`total_brand_outreach` / `total_influencer_outreach`)

### Pitfall 1-A: SSR crash on stale `unstable_cache` after breaking RPC shape

**What goes wrong:**
`src/app/(dashboard)/student/analytics/page.tsx:50` wraps the fetcher with `unstable_cache(..., ["student-analytics"], { tags: [studentAnalyticsTag(user.id)] })`. After migration 00032-analytics lands in production, any stale cache entry still holds the old payload with `total_emails` / `total_influencers`. The client component renders `data.totals.total_emails.toLocaleString()` (`AnalyticsClient.tsx:203, 208`) — if you rename the field in both RPC + type but the cache returns an old envelope, `.toLocaleString()` is called on `undefined` and SSR throws.

**Why it happens:**
Next.js `unstable_cache` identifies entries by the key array (`["student-analytics"]`) + the invocation args (studentId, range, page). A deploy changes the RPC shape but not the key. Existing entries (TTL 60s, plus on-disk .next/cache) survive across the swap for up to 60 seconds. More importantly, the tag `studentAnalyticsTag(user.id)` is only busted on user mutations — not on deploy. So a user who hasn't mutated in 60 minutes can hit a multi-minute-old cached entry.

**Prevention — required, two layers:**

1. **Bump the literal cache key** in the same commit as the migration:
   ```typescript
   // page.tsx BEFORE:
   ["student-analytics"]
   // page.tsx AFTER:
   ["student-analytics-v2"]  // OR ["student-analytics", "outreach-split-v2"]
   ```
   This is the authoritative invalidation — every key not matching the new literal is effectively orphaned. No single user's tag needs to bust.

2. **Also update `STUDENT_ANALYTICS_RANGES` neighbor** — actually unchanged here, but the idiom is: if the payload SHAPE changes, the key MUST change. The tag is for user-initiated invalidation; the key is for deploy-time invalidation.

**DO NOT rely on `revalidateTag` alone for a breaking shape change** — tags only invalidate on mutation or manual call. A user viewing `/student/analytics` without mutating will hit the stale cache for up to 60s even with new RPC deployed.

**Detection:**
Grep `"student-analytics"` (literal-key) after migration — must find exactly one call site in `page.tsx` with the bumped suffix:
```
rg -n '"student-analytics' src/
```

**Phase assignment:** Feature 1 page/types phase (same commit as the migration). Verify the build fails if the key is not bumped by adding a check in code review.

---

### Pitfall 1-B: Type drift — `any` casts silently swallow the field rename

**What goes wrong:**
TypeScript will catch most `total_emails` references because `StudentAnalyticsTotals` is a strict type in `student-analytics-types.ts:20-27`. BUT the RPC returns `jsonb`, and the fetcher does `return data as unknown as StudentAnalyticsPayload` (`student-analytics.ts:70`). Any consumer that does:
```typescript
const anyData = rpcResult as any;
anyData.totals.total_emails; // passes tsc, crashes at runtime
```
…or any `.jsonb` path that hits the same structure (reports, audit exports, admin tools) bypasses the type.

**Why it happens:**
`as unknown as T` is a one-way cast from Postgres. TypeScript trusts the cast and never re-validates the shape.

**Prevention — Grep audit + targeted types sweep:**

1. Grep for every reference to the old field names across the entire `src/` tree — the file-names are important because a `types.ts` alias may shadow the domain name:
   ```
   rg -n "total_emails\b|total_influencers\b" src/
   ```
   Expected hits at research time:
   - `src/lib/rpc/student-analytics-types.ts:22-23` (the type itself — will be changed)
   - `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:203, 208` (consumers — must be renamed)
   - `src/lib/types.ts:728, 740, 752` — these are `total_influencers_contacted` on the daily_reports KPI summary, NOT the analytics payload. Verify they are unrelated (different table, different column). Do NOT rename.

2. Grep for `any` casts near the analytics payload:
   ```
   rg -n 'as unknown as StudentAnalyticsPayload|as any.*total_' src/
   ```

3. Optional hardening: introduce a Zod schema to `safeParse` the RPC payload in `fetchStudentAnalytics`. If the shape drifts in the future, it raises at runtime instead of crashing the consumer.

**Detection:**
Post-rename, the grep above must return ZERO hits in `/student/analytics/` and `/student_diy/analytics/`. One hit in `src/lib/types.ts` for `total_influencers_contacted` is allowed (different column, kpi_summaries).

**Phase assignment:** Feature 1 types + consumers phase.

---

### Pitfall 1-C: Backward-compat double-write in `daily_reports` masks aggregate error

**What goes wrong:**
`src/app/api/reports/route.ts:97, 145` writes `outreach_count: brands_contacted + influencers_contacted` as a backward-compat column. The new RPC reads `SUM(brands_contacted)` and `SUM(influencers_contacted)` independently. If a historical row has `brands_contacted = NULL` (before the v1.1 column rename in 00006 / 00007), the SUM will COALESCE to 0 for that row's brands — CORRECT — but the old `outreach_count` column is no longer the source of truth. Any consumer still reading `outreach_count` will diverge from the new totals.

**Prevention:**
After F1 lands, grep for `outreach_count` consumers:
```
rg -n "outreach_count" src/
```
If the only writers are in `api/reports/route.ts` (backward compat) and the only readers are gone, consider dropping `outreach_count` in a future migration. Out of scope for v1.8, but document as tech debt.

**Phase assignment:** None in v1.8 — add to `.planning/PROJECT.md` "Carry-overs" if confirmed.

---

## Feature 2 — Owner Analytics Coach Performance Leaderboards

### Pitfall 2-A: Coaches with assigned students but zero student activity return NULL instead of 0

**What goes wrong:**
Classic SQL NULL-aggregation pitfall. If the query is:
```sql
SELECT c.id, SUM(d.profit) AS total
FROM users c
LEFT JOIN users s ON s.coach_id = c.id
LEFT JOIN deals d ON d.student_id = s.id
WHERE c.role = 'coach' AND c.status = 'active'
GROUP BY c.id;
```
For a coach whose students exist but have no deals, `SUM(d.profit) = NULL`, not `0`. The requirement says "exclude coaches with zero assigned students" — but what about a coach with 5 students and zero deals? Requirement implies they should appear with `$0`, not be filtered out.

**Prevention:**
Always wrap aggregates in `COALESCE(SUM(x), 0)`:
```sql
COALESCE(SUM(d.profit), 0)::numeric AS total_revenue
```

This is exactly the pattern 00028:94-101 uses for the student leaderboards — REPLICATE it verbatim for coaches. Additionally, the `HAVING` clause in 00028 uses `HAVING COALESCE(SUM(d.profit), 0) > 0` to exclude zero-metric rows from the top-3 student list. For **coaches**, the requirement says "exclude coaches with zero assigned students" — NOT "exclude coaches with zero metric value". So the coach filter differs:

```sql
-- Coaches appear if they have ≥1 assigned active student, even if metric = 0.
-- Use INNER JOIN (or EXISTS) on the student count gate, then LEFT JOIN the metric.
WITH coach_students AS (
  SELECT c.id AS coach_id, c.name AS coach_name,
         array_agg(s.id) AS student_ids
  FROM users c
  JOIN users s ON s.coach_id = c.id
               AND s.role IN ('student', 'student_diy')
               AND s.status = 'active'
  WHERE c.role = 'coach' AND c.status = 'active'
  GROUP BY c.id, c.name
)
-- ... then LEFT JOIN deals / daily_reports against student_ids, COALESCE SUM → 0
```

Confirm this matches stakeholder intent in `/gsd-discuss-phase` before building. The ambiguity is currently unresolved (see PROJECT.md Ambiguity §1).

**Detection:**
SQL assertion post-migration:
```sql
-- Every coach with ≥1 student should appear in all three leaderboards' "all-time" slot.
-- (Position/rank doesn't matter — just presence.)
DO $$
DECLARE expected int; actual int;
BEGIN
  SELECT COUNT(DISTINCT c.id) INTO expected
  FROM users c JOIN users s ON s.coach_id = c.id
  WHERE c.role='coach' AND c.status='active'
    AND s.role IN ('student','student_diy') AND s.status='active';

  -- Run the RPC, count coaches in revenue_alltime leaderboard
  -- ...
  ASSERT actual = expected, format('coach count mismatch: expected %s got %s', expected, actual);
END $$;
```

**Phase assignment:** Feature 2 migration phase.

---

### Pitfall 2-B: Tie-break determinism — Phase 54 uses THREE tiebreakers, Phase 48 uses TWO

**What goes wrong:**
The requirement states "Same tie-break pattern as Phase 54". Phase 54 (migration 00028:106, 127, 148) uses three tiebreakers:
```sql
ORDER BY metric DESC, LOWER(student_name) ASC, student_id::text ASC
```

BUT the Phase 48 coach-analytics RPC (migration 00025:272, 294, 313) uses only two:
```sql
ORDER BY metric DESC, LOWER(u.name) ASC
```

A copy-paste from 00025 instead of 00028 will miss the `id::text` final tiebreaker. If two coaches have identical metric AND identical name (e.g., two "John Smith"), rank becomes non-deterministic — and worse, it changes between RPC invocations as Postgres picks different physical row orderings. The leaderboard will "flicker" on re-cache.

**Prevention:**
Explicitly copy the Phase 54 pattern. Verify the ORDER BY in every coach leaderboard CTE has all three:
```
ORDER BY <metric> DESC, LOWER(<name>) ASC, <id>::text ASC
```

Apply the `::text` cast because uuid comparison is defined but Postgres versions differ on collation behavior — the cast normalizes. Matches migration 00028 verbatim.

Additionally: the `ROW_NUMBER()` window function on the `_ranked` CTE must use the same ORDER BY. The outer `WHERE rank <= 3` only works correctly if the ranking was deterministic.

**Detection:**
```
rg -n "ORDER BY.*DESC, LOWER" supabase/migrations/00033*.sql
```
Every ORDER BY clause in the new migration must include `, ::text ASC` at the end.

**Phase assignment:** Feature 2 migration phase.

---

### Pitfall 2-C: "Avg brand outreach per student per day" — divisor semantics

**What goes wrong:**
Ambiguity §1 in PROJECT.md: "avg email count" interpreted as "avg brand outreach per student per day in window". The formula has three plausible interpretations, each giving different numbers:

| Formula | Semantics |
|---|---|
| `SUM(brands_contacted) / COUNT(DISTINCT student_id)` | avg per student (total, not daily) |
| `SUM(brands_contacted) / (COUNT(DISTINCT student_id) * window_days)` | avg per student per day (all days count) |
| `SUM(brands_contacted) / COUNT(DISTINCT (student_id, date WHERE report submitted))` | avg per student per day-reported (active days only) |

The third is most defensible ("what does an active student's day look like?"). The second over-counts skipped days as zero-outreach. The first ignores time entirely and is useless for the Weekly/Monthly/Yearly toggles.

**Prevention:**
Before building, confirm in `/gsd-discuss-phase`. If uncertain, default to formula 2 — it's the most intuitive ("average per student per day") and matches the window semantics. Document the chosen formula in a SQL comment in the migration so future readers understand.

Mind the divisor NULL/zero guard:
```sql
CASE WHEN divisor > 0 THEN dividend / divisor::numeric ELSE 0 END
```

**Phase assignment:** Ambiguity resolution + Feature 2 migration phase.

---

### Pitfall 2-D: Payload size — 6 leaderboards × 4 windows × 3 rows × ~5 fields = ~360 JSON fields

**What goes wrong:**
The single cached `get_owner_analytics()` RPC must now return 24 leaderboard slots (6 × 4). Each slot has up to 3 rows, each row has 4–5 fields (rank, id, name, metric, metric_display). Total: ~360 scalar values per payload, plus JSON overhead. Not huge (~10–20 KB), but:
- If the migration's SQL uses a JOIN to `users` for names in EACH of the 24 slots, the planner may not CSE the join, so `users` is scanned 24 times.
- Each leaderboard CTE uses its own GROUP BY on `users`. At 5k students the planner will hash-aggregate; fine. At 50k students this becomes noticeable.

**Prevention — materialize once, filter window in CTE:**

Build one `active_students` CTE at the top that does the user join once, then each leaderboard CTE filters the time window via `WHERE` on work_sessions / deals / daily_reports. The `users.name` join happens ONCE, not per-slot.

Pattern:
```sql
WITH
active_students AS (
  SELECT u.id AS student_id, u.name AS student_name, u.coach_id
  FROM users u
  WHERE u.role IN ('student', 'student_diy') AND u.status = 'active'
),
hours_7d AS (
  SELECT st.student_id, st.student_name,
         COALESCE(SUM(ws.duration_minutes), 0) AS minutes
  FROM active_students st
  LEFT JOIN work_sessions ws ON ws.student_id = st.student_id
    AND ws.status = 'completed'
    AND ws.date >= CURRENT_DATE - 6  -- trailing 7 days
  GROUP BY st.student_id, st.student_name
  HAVING COALESCE(SUM(ws.duration_minutes), 0) > 0
),
-- ... same pattern for hours_30d, hours_365d, hours_alltime
-- ... same for profit_*, deals_*, and coach_* variants
```

Active coaches CTE likewise — one lookup, six reuses.

**Detection — EXPLAIN ANALYZE before shipping:**
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.get_owner_analytics();
```
Verify total Execution Time < 200ms at current data volume. If a Seq Scan on `users` appears more than twice in the plan (once for students, once for coaches), refactor to CTE reuse.

**Phase assignment:** Feature 2 migration phase.

---

## Feature 3 — Per-leaderboard Window Selectors (Weekly / Monthly / Yearly / All Time)

### Pitfall 3-A: "Trailing 7 days" semantics — three plausible windows with subtly different counts

**What goes wrong:**
Three competing interpretations of "Weekly":

| Expression | Semantics | Behavior at 2am on Monday |
|---|---|---|
| `date >= CURRENT_DATE - 6` | trailing 7 calendar days (today + 6 prior) | Includes all of last Tuesday—today |
| `created_at >= now() - interval '7 days'` | trailing 168 hours (timestamptz) | Monday 2am Tuesday — Monday 2am today |
| `date_trunc('week', now()) <= date` | ISO calendar week | Starts 00:00 Monday this week |

The Phase 46 student analytics RPC (migration 00023:71) uses pattern 1: `v_today - 6` — trailing 7 calendar days. The sidebar badges RPC (00027) uses `date - 7`. PROJECT.md Ambiguity §2 recommends "trailing" semantics.

**Timezone subtlety (critical):** the Postgres server runs in UTC (see `.env` supabase config), but the student may be in UTC-8. A session ending at 23:30 local on Sunday is stored with `date = Monday UTC`. At 00:05 UTC Monday, a trailing-7-day query for "last week" excludes that session by one day. Most users won't notice, but owner analytics at the week boundary can flip rankings.

**Prevention:**
- Stick with pattern 1 (`date >= CURRENT_DATE - 6`). Matches existing student/coach analytics precedent. Predictable and boundary-behavior is documented.
- For "Monthly": `date >= CURRENT_DATE - 29`.
- For "Yearly": `date >= CURRENT_DATE - 364`.
- Document in SQL comment: "Trailing N calendar days in UTC. Student timezones are not adjusted in v1.8. A calendar-week alternative is deferred."
- Confirm in `/gsd-discuss-phase`.

**Detection:**
```
rg -n "CURRENT_DATE - \d+|v_today - \d+" supabase/migrations/00033*.sql
```
Every window filter uses `CURRENT_DATE - N` with N ∈ {6, 29, 364}. No `interval '7 days'` or `date_trunc('week', ...)`.

**Phase assignment:** Feature 3 migration phase.

---

### Pitfall 3-B: Client-side window toggle re-fetch — the "we accidentally re-fetched on toggle" trap

**What goes wrong:**
Requirement: "Toggles are pure client state (no re-fetch)." The single RPC returns ALL 24 slots. But a naive implementation of the toggle UI might:
```typescript
const [window, setWindow] = useState<Window>('alltime');
const data = await fetch(`/api/owner-analytics?window=${window}`); // WRONG
```
This re-fetches the single-envelope cached RPC each time. Worse, if the client calls a route that re-invokes `getOwnerAnalyticsCached()`, the Next.js cache hit is fast but still a round-trip.

**Prevention:**
The window selector must be a pure `useState<Window>` reading from `initialData.leaderboards.hours_weekly`, `hours_monthly`, `hours_yearly`, `hours_alltime` — all four pre-computed in the single SSR-delivered payload. NO client fetch. NO revalidatePath. The toggle just swaps which array is rendered.

Code pattern:
```typescript
const leaderboard = {
  weekly: data.leaderboards.hours_weekly,
  monthly: data.leaderboards.hours_monthly,
  yearly: data.leaderboards.hours_yearly,
  alltime: data.leaderboards.hours_alltime,
}[window];
```

**Detection:**
```
rg -n "fetch\(|useEffect" src/app/\(dashboard\)/owner/analytics/
```
No `fetch()` calls from `OwnerAnalyticsClient.tsx`. No `useEffect` dependency on `window` state that causes a re-render → re-fetch.

**Phase assignment:** Feature 3 client-component phase.

---

### Pitfall 3-C: Window toggle accessibility — `<fieldset>` vs `role="radiogroup"` — default "All Time" must be checked

**What goes wrong:**
PROJECT.md Constraint: "`<fieldset><legend>` or `role=\"radiogroup\"` accessibility". 44px touch targets. Default "All Time". A common failure:
- Button group with `onClick={setWindow}` — not keyboard-navigable with arrow keys, no radio group semantics.
- Multiple selectors on the page, each needing distinct group names (`hours-window-a`, `profit-window-b`, etc.) or they'll fight for focus.

**Prevention:**
```tsx
<fieldset className="flex gap-2">
  <legend className="sr-only">Hours leaderboard time window</legend>
  {['weekly', 'monthly', 'yearly', 'alltime'].map(w => (
    <label key={w} className="relative">
      <input
        type="radio"
        name={`hours-${leaderboardId}-window`}  // UNIQUE per leaderboard
        value={w}
        checked={window === w}
        onChange={() => setWindow(w)}
        className="sr-only peer"
      />
      <span className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-md
                       peer-checked:bg-ima-primary peer-checked:text-white
                       peer-focus-visible:ring-2 peer-focus-visible:ring-ima-primary
                       cursor-pointer">
        {LABEL[w]}
      </span>
    </label>
  ))}
</fieldset>
```
Each of 6 selectors uses a unique `name` attribute (e.g., `hours-student-window`, `profit-student-window`, `revenue-coach-window`). Default-check "alltime" via `checked={window === 'alltime'}` with `useState('alltime')`.

**Detection:**
```
rg -n 'name="hours-window"' src/app/\(dashboard\)/owner/analytics/
```
Must find 6 unique `name` attributes across all 6 leaderboards.

**Phase assignment:** Feature 3 client-component phase.

---

## Feature 4 — Owner Alerts Prune to `deal_closed`

### Pitfall 4-A: Orphan dismissals after deal deletion

**What goes wrong:**
`alert_dismissals` stores `alert_key = 'deal_closed:${deal_id}'`. When a deal is deleted (`DELETE /api/deals/[id]`), the deal row is removed but the dismissal row lingers forever. If a later deal happens to reuse the same UUID — not possible in practice (gen_random_uuid collision space) — the old dismissal would silently suppress the new alert. Not a correctness issue today, but it pollutes the table.

More immediately: after v1.7, `alert_dismissals` already contains dismissals for `student_dropoff:*`, `student_inactive:*`, `unreviewed_reports:*`, `coach_underperform:*`, `milestone_*:*`. F4 says "No `alert_dismissals` table deletion (orphaned rows preserved for history)" — so the pruned alert types' dismissals stay but are ignored. Fine.

**Prevention:**
- For deal-deletion orphans: accept as-is. UUID collision probability is negligible. Document as "known leak, volume is bounded by number of deals ever deleted".
- For the pruned-type dismissals: grep confirms the new owner alerts page no longer surfaces any `student_*`, `coach_underperform`, or `unreviewed_reports` alerts, so their dismissals are dormant. No cleanup needed.
- Optional future housekeeping: a nightly pg_cron job that deletes rows from `alert_dismissals` with no matching `deals` row and an age > 90 days. Out of scope for v1.8.

**Detection:**
```sql
SELECT COUNT(*) FROM alert_dismissals ad
LEFT JOIN deals d ON ad.alert_key = 'deal_closed:' || d.id::text
WHERE ad.alert_key LIKE 'deal_closed:%' AND d.id IS NULL;
```
If this returns 0 after running, orphans are rare. If it ever grows past 1000 in production, consider adding a cleanup job.

**Phase assignment:** F4 + note in PROJECT.md Carry-overs.

---

### Pitfall 4-B: `deal_closed` alerts have no TTL — the feed grows forever

**What goes wrong:**
Every `deal_closed` alert is one-shot per deal (alert_key = `deal_closed:${deal_id}`). A deal that's closed and never dismissed stays in the owner's alert feed forever. Over 3 years of closed deals, the owner page shows hundreds of old alerts.

Compare to `student_inactive:${student_id}:${today}` (daily-scoped) or `student_dropoff:${student_id}:${isoWeek}` (weekly-scoped) — those keys naturally expire and re-trigger in new windows (the `alert_dismissals with time-windowed keys` pattern in PROJECT.md Key Decisions). The pruned alerts had this behavior. The new `deal_closed:${deal_id}` does NOT.

**Prevention — confirm intent with stakeholder, then implement one of:**

| Option | Behavior | Implementation |
|---|---|---|
| **A. One-shot, never expires** | Owner can dismiss; stays visible until dismissed; survives forever if never dismissed | Current spec — accept the unbounded feed growth |
| **B. Auto-dismiss after N days** | Alert appears in feed only for first N days after deal creation | Filter query: `WHERE d.created_at >= now() - interval 'N days'` in owner/alerts page |
| **C. One-shot, dismissed by default after N days** | Backfill dismissal after N days via pg_cron | Requires cron + cleanup logic |

Spec says "one info alert per closed deal…reuses `alert_dismissals`" — that's Option A. Pagination (25 per page, as existing convention) makes an unbounded feed tolerable. But owner's UX at year 3 with 500 closed-deal alerts will be bad.

Recommend **Option B** with N=30 days. Simple WHERE clause, no cron, no migration. Document in Ambiguity §.

**Detection:**
Test that a deal closed 31 days ago + never dismissed does NOT appear in the alert feed:
```typescript
// In owner alerts page query:
.gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
```

**Phase assignment:** Ambiguity resolution → Feature 4 page phase. If Option A is confirmed, add pagination to the alerts page (currently the page renders all alerts; at 500+ this will be noticeable).

---

### Pitfall 4-C: Dismissals API invalidates the wrong tag

**What goes wrong:**
`src/app/api/alerts/dismiss/route.ts:80-81` currently does:
```typescript
revalidateTag("badges", "default");
revalidateTag(coachMilestonesTag(profile.id), "default");
```
When an owner dismisses a `deal_closed` alert, the second line invalidates `coach-milestones:${ownerId}` — which is a nonsense tag (the owner doesn't have a coach-milestones cache entry). Not a bug, just noise. BUT: F4 requires the dismiss path to refresh the owner alerts page. Since the page is a pure SSR component (no `unstable_cache` wrapper — it fetches `alert_dismissals` directly on every request — see `owner/alerts/page.tsx:40`), `revalidateTag("badges")` is sufficient IF the layout sidebar also uses the `"badges"` tag. That's confirmed via the existing convention.

BUT if F4 adds a cache layer (e.g., wrapping the alerts page data in `unstable_cache` for owner analytics consistency), you must ALSO invalidate the new owner-alerts-specific tag. Currently no such tag exists.

**Prevention:**
- Keep the owner alerts page as plain SSR (no `unstable_cache`). The page fetches `alert_dismissals` + `deals` directly — both are small tables, hot-path cached at the Postgres layer already.
- If caching is added later, create `ownerAlertsTag(ownerId)` and call `revalidateTag(ownerAlertsTag(ownerId))` in the dismiss route + every deal mutation (POST, PATCH, DELETE).
- The existing `revalidateTag("badges")` keeps the sidebar badge count fresh — no change needed for that.

**Detection:**
```
rg -n "unstable_cache" src/app/\(dashboard\)/owner/alerts/
```
Must return zero matches in v1.8. If anyone adds caching, the dismiss route needs a matching tag.

**Phase assignment:** F4 page phase — explicit decision to NOT cache.

---

## Feature 5 — Coach Alerts `tech_setup` Activation

### Pitfall 5-A: Flipping `techSetupEnabled: true` ALONE does nothing — the RPC hardcodes `step_number = 0`

**What goes wrong:** (CRITICAL)
The requirement in PROJECT.md lists three changes:
1. `MILESTONE_CONFIG.techSetupStep: 4`
2. `MILESTONE_FEATURE_FLAGS.techSetupEnabled: true`
3. `MILESTONE_META["tech_setup"].label: "Set Up Your Agency"`

These are ALL TypeScript/config changes. They will **not fire any alerts** because the RPC in migration 00027:130 has the step number HARDCODED:
```sql
AND rp.step_number = 0   -- PLACEHOLDER — replace when D-06 resolves
```
`MILESTONE_CONFIG.techSetupStep` is passed as a TS constant to nothing — it is not a parameter to the RPC. The RPC takes `(p_coach_id, p_today, p_tech_setup_enabled)` — no step number arg. Migration 00027 literally says in its header comment:

> "FUTURE WORK (RESEARCH Pitfall 6): When MILESTONE_FEATURE_FLAGS.techSetupEnabled flips to true after D-06 resolves, a SEPARATE migration MUST pre-dismiss every historical completion of MILESTONE_CONFIG.techSetupStep for assigned students — otherwise coaches will see a retroactive flood."

**F5 REQUIRES a migration, not just config flips.** The migration must:

1. Replace the hardcoded `step_number = 0` with `step_number = 4` in the `tech_setup` CTE.
2. Backfill `alert_dismissals` for every historical Step-4 completion × student's current coach — mirror the pattern in 00027:408-434 for `five_inf` / `brand_resp`.

**Prevention — required phase 5 migration skeleton:**

```sql
-- 00033_tech_setup_activation.sql
BEGIN;

-- 1. CREATE OR REPLACE FUNCTION public.get_coach_milestones (SAME signature)
--    with tech_setup CTE changed from step_number = 0 to step_number = 4.
--    Copy full function from 00027, edit line 130.
CREATE OR REPLACE FUNCTION public.get_coach_milestones(
  p_coach_id uuid, p_today date DEFAULT CURRENT_DATE, p_tech_setup_enabled boolean DEFAULT false
) RETURNS jsonb ...;

-- 2. Backfill historical Step-4 completions × current coach.
INSERT INTO alert_dismissals (owner_id, alert_key, dismissed_at)
SELECT DISTINCT u.coach_id,
       'milestone_tech_setup:' || rp.student_id::text,
       now()
FROM roadmap_progress rp
JOIN users u ON u.id = rp.student_id
WHERE rp.step_number = 4
  AND rp.status = 'completed'
  AND u.coach_id IS NOT NULL
  AND u.status = 'active'
  AND u.role IN ('student', 'student_diy')
ON CONFLICT (owner_id, alert_key) DO NOTHING;

-- 3. Assert: post-backfill, every coach's RPC returns ZERO tech_setup rows (flag=true).
DO $$ DECLARE v_coach uuid; v_payload jsonb; v_rows int := 0;
BEGIN
  FOR v_coach IN SELECT id FROM users WHERE role='coach' AND status='active' LOOP
    v_payload := public.get_coach_milestones(v_coach, CURRENT_DATE, true);
    SELECT COALESCE(count(*), 0) INTO v_rows
      FROM jsonb_array_elements(v_payload->'milestones') e
      WHERE e->>'milestone_type' = 'tech_setup';
    ASSERT v_rows = 0, format('ASSERT: tech_setup flood after enable; coach %s has %s rows', v_coach, v_rows);
  END LOOP;
END $$;

COMMIT;
```

ALSO: `MILESTONE_FEATURE_FLAGS.techSetupEnabled: true` must be set in the SAME commit that ships the migration — not before (flag is passed through `fetchCoachMilestones` → `p_tech_setup_enabled`, and with step=0 still in place this would harmlessly fire zero alerts, but the RPC body is consistent with the flag's purpose).

Order of commits:
1. Migration 00033 (DB: step 4 + backfill + assert).
2. TS commit (config flip + label change).
3. Deploy atomically (both commits in one deploy, no partial rollout).

**Detection:**
```
rg -n "rp.step_number = 0" supabase/migrations/
```
After F5 migration lands: zero hits. The hardcoded 0 must be replaced with 4. (Grep is necessary because `MILESTONE_CONFIG.techSetupStep` in TS is disconnected from the SQL hardcode.)

Additionally:
```sql
SELECT count(*) FROM alert_dismissals WHERE alert_key LIKE 'milestone_tech_setup:%';
```
Before migration: 0. After migration: equals the DISTINCT (coach_id, student_id) count where student completed Step 4.

**Phase assignment:** Feature 5 migration phase (new, not just config edit).

---

### Pitfall 5-B: UI label is decoupled from internal type key — verify no cross-reference

**What goes wrong:**
Requirement: "Internal type key `tech_setup` PRESERVED (do not rename — ripples through RPC, dismissal keys `milestone_tech_setup:%`, and any in-flight dismissals). Label change is UI-only."

The label lives in `src/components/coach/alerts-types.ts:120` (`MILESTONE_META["tech_setup"].label: "Setup Complete"`) — it's purely display. Changing "Setup Complete" → "Set Up Your Agency" is safe because:
- The RPC returns `milestone_type: 'tech_setup'` (string enum).
- The client indexes `MILESTONE_META[row.milestone_type]` (`CoachAlertsClient.tsx:312`).
- Dismissal keys use `milestone_tech_setup:${studentId}` — built from the namespace constant, not the UI label (`config.ts:428-429`).

**BUT:** verify no hardcoded "Setup Complete" string elsewhere (tests, snapshot files, route names, URLs).

**Prevention:**
```
rg -n "Setup Complete" src/
```
Expected hits post-rename: zero. If any remain in test snapshots, update them.

```
rg -n "Set Up Your Agency" src/
```
Expected hits post-rename: one (the `MILESTONE_META` label) + any new UI copy.

**Phase assignment:** Feature 5 config + alerts-types phase.

---

### Pitfall 5-C: Cache staleness — `fetchCoachMilestones` passes the flag at call time, not at cache time

**What goes wrong:**
`src/lib/rpc/coach-milestones.ts:52` passes `MILESTONE_FEATURE_FLAGS.techSetupEnabled` as the `p_tech_setup_enabled` parameter on each RPC call. `getCoachMilestonesCached` wraps it in `unstable_cache` keyed by `["coach-milestones", coachId, today]` — **the flag value is NOT in the key**. So when the flag flips from false → true:

- Existing cache entries (60s TTL) return `tech_setup: []` even after the flag flips.
- New cache entries (written after the flip) return the correct (empty, because backfilled) result.
- If backfill hasn't run, the flood would occur ~60s after deploy as cache entries expire.

**Prevention:**
- Follow the commit-order discipline in 5-A: migration (with backfill + assert) commits before or with the config flip. Backfill guarantees empty results regardless of cache state.
- Optionally: bump the cache key on the flip:
  ```typescript
  ["coach-milestones", coachId, today, String(MILESTONE_FEATURE_FLAGS.techSetupEnabled)]
  ```
  This forces a fresh cache entry immediately on deploy. BUT it also means the key changes on every deploy if someone toggles the flag, which is rare for a one-time feature activation. Acceptable.

**Detection:**
Manual test post-deploy: toggle flag, confirm `/coach/alerts` does NOT show any `tech_setup` rows for existing students. If it does, backfill is incomplete.

**Phase assignment:** Feature 5 migration + TS wrapper phase.

---

## Feature 6 — Owner Student Detail Extended to `student_diy`

### Pitfall 6-A: `.eq("role", "student")` → `.in("role", ["student", "student_diy"])` — check all 3 queries

**What goes wrong:**
`owner/students/[studentId]/page.tsx:35` filters `.eq("role", "student")`. Changing ONLY this line leaves:
- Line 38 (`students` query on the list page): `.eq("role", "student")` — list page misses DIY.
- `OwnerAlertsPage:38`: `.eq("role", "student")` — owner alerts query (will be pruned in F4 but still).
- Other pages (dashboard homepage stats, owner analytics) — verify each.

The auth context for the detail page is `requireRole("owner")` — owners are allowed to see all students regardless of role. No auth leak risk. BUT: if F6 also extends the COACH view (explicit out-of-scope per PROJECT.md Ambiguity §3), the `.eq("coach_id", coachId)` scope already filters correctly because DIY users have no coach_id. Coach route is safe to leave untouched.

**Prevention:**
Systematic grep:
```
rg -n 'eq\(\s*"role"\s*,\s*"student"\s*\)' src/app/\(dashboard\)/owner/
```

Expected hits that must change in F6:
- `owner/students/page.tsx` (list)
- `owner/students/[studentId]/page.tsx` (detail)

Expected hits that must NOT change (out of scope):
- `owner/alerts/page.tsx:38` — pruned in F4, but until F4 lands, this can keep `.eq("role", "student")`.
- `coach/students/page.tsx` and `coach/students/[studentId]/page.tsx` — not in v1.8 scope.

After F6: every hit in the owner tree must be `.in("role", ["student", "student_diy"])`.

**Detection:**
```
rg -n 'role.*student_diy' src/app/\(dashboard\)/owner/
```
Must return hits in both the list and detail pages. If either is missing, F6 is incomplete.

**Phase assignment:** Feature 6 page phase.

---

### Pitfall 6-B: DIY detail page — Reports tab & CalendarTab report markers

**What goes wrong:**
`OwnerStudentDetailClient.tsx:255-263` renders `<CalendarTab sessions={...} reports={calendarReports} ... />`. `CalendarTab.tsx:41` types `reports: CalendarReportRow[]` as REQUIRED, not optional. If F6 passes `reports={[]}` for DIY (DIY users don't submit reports), `CalendarTab` proceeds normally — the map `for (const r of displayReports)` is a no-op, and `reportByDate` is empty. Activity dots show only green (sessions), never amber (reports). That matches the spec.

**BUT** — potential crash: if someone simplifies F6 by doing `reports={isStudentDiy ? undefined : calendarReports}`, the client component crashes on `setDisplayReports(reports)` because `undefined` is not an array.

**Prevention:**
Pass `calendarReports = []` (empty array) for DIY, not `undefined`. The server query for DIY should skip the reports fetch entirely (DIY users have no reports table entries anyway, but the skip avoids a wasted DB call):

```typescript
// In page.tsx:
const isDiy = student.role === "student_diy";
const calendarReports = isDiy
  ? []
  : await fetchReports(...);
```

Additionally, the `CalendarTab` prop for DIY should either:
- (Option A) Accept reports=[] and render no amber markers. Activity = green-only. Trivial.
- (Option B) Add a `hideReportMarkers?: boolean` prop that short-circuits the amber state. Defensive, in case reports accidentally slip through.

Recommend Option A. Simpler, matches requirement "Calendar renders hours-only (no daily-report indicators)".

Verify StudentDetailTabs doesn't render "Reports" button for DIY:
```
rg -n "Reports" src/components/owner/OwnerStudentDetailClient.tsx src/components/coach/StudentDetailTabs.tsx
```
`StudentDetailTabs` probably renders a tab list — must be conditionally filtered for DIY role.

**Detection:**
Unit test or manual QA: navigate to `/owner/students/[diyStudentId]`, verify:
- No "Reports" tab visible.
- Calendar shows green dots for session days, never amber.
- No console errors about undefined `.map()` on reports.

**Phase assignment:** Feature 6 page + client phase.

---

### Pitfall 6-C: List page — adding DIY badge column risks layout shift

**What goes wrong:**
The list page uses a `grid-cols-1 md:grid-cols-2 gap-4` card layout, not a table. Each card has a right-side `flex flex-col items-end gap-1` stack that currently shows: skip-days badge (if any) + status badge. Adding a DIY badge to this stack is visually safe — badges stack vertically, no horizontal column shift. BUT:

- Three badges in the stack (DIY + skip + status) can overflow the card on narrow screens (375px viewport, an iPhone SE). Skip badge is already conditional, so worst case is 2 stacked badges — well within the card width.
- Badge order matters for scannability. Recommend: DIY badge at TOP (identifies role), then status, then skip.

**Prevention:**
Pass the role in the query select (`select("id, name, email, status, joined_at, coach_id, role")` — add `role`) and render:
```tsx
<div className="flex flex-col items-end gap-1">
  {s.role === "student_diy" && <Badge variant="info" size="sm">DIY</Badge>}
  {(skipCountMap.get(s.id) ?? 0) > 0 && <Badge variant="warning" size="sm">{skipCountMap.get(s.id)} skipped</Badge>}
  <Badge variant={statusVariant(s.status)} size="sm">{s.status}</Badge>
</div>
```

Test at 375px viewport width. If the name/email column truncates acceptably, ship. The existing `truncate` class on name/email is already there.

**Detection:**
Manual QA at 375px viewport — DIY badge visible, card height stable, no overflow.

**Phase assignment:** Feature 6 list page phase.

---

### Pitfall 6-D: Coach-id column for DIY students

**What goes wrong:**
DIY students have NO coach (v1.4 D-04: "NO coach assignment, fully independent"). `users.coach_id` is NULL for them. But the owner detail page (`page.tsx:99-104`) passes `currentCoachId={student.coach_id ?? null}` to the client, which renders a coach-reassignment UI. For DIY, this UI should be HIDDEN.

**Prevention:**
In the detail page, pass an `isDiy` flag or check `student.role === "student_diy"` in the client and short-circuit the coach-reassignment UI.

Additionally, `coachOptions` (line 100) is populated from `detail.coaches` — empty for DIY detail page? Verify `get_student_detail` RPC handles DIY correctly. If it doesn't and emits a crash when student.coach_id is NULL (e.g., a JOIN on coach), F6 needs an RPC patch.

**Detection:**
Test: call the RPC with a DIY student's ID. Verify it returns `coaches: []` (or at least does not crash) and `student_counts: {}`.

**Phase assignment:** Feature 6 page + RPC-compatibility check phase.

---

## Cross-Feature Pitfalls (spans multiple features)

### Pitfall X-1: `ownerAnalyticsTag()` must invalidate on DAILY REPORT mutations too (currently DOES NOT)

**What goes wrong (CRITICAL for F2):**
`src/app/api/reports/route.ts:157-178` (POST new report) and `108-131` (PATCH existing) invalidates:
- `"badges"` (sidebar)
- `studentAnalyticsTag(profile.id)` (student's own analytics)
- `coachDashboardTag(coach_id)` + `coachAnalyticsTag(coach_id)` + `coachMilestonesTag(coach_id)` (coach's caches)

**It does NOT call `revalidateTag(ownerAnalyticsTag())`.** This is a pre-existing gap, acceptable in v1.6 because the Phase 54 owner analytics was HOURS / PROFIT / DEALS only — none depend on daily reports.

**F2 breaks this invariant** — the new coach leaderboard #2 is "avg brand outreach per student per day" which is `SUM(brands_contacted) / (students × days)` — this IS daily-report-driven. After F2, every `POST /api/reports` must invalidate `ownerAnalyticsTag()` or the coach leaderboard goes stale for up to 60s (or longer if no other mutation lands).

**Prevention — required F2 change in `src/app/api/reports/route.ts`:**

Add to BOTH the update-existing and insert-new branches (after lines 131 and 178):
```typescript
// Phase F2: owner-analytics tag is global — every report mutation changes
// coach leaderboard #2 (avg brand outreach per student per day).
try {
  revalidateTag(ownerAnalyticsTag(), "default");
} catch (err) {
  console.error("[reports] failed to invalidate owner-analytics tag:", err);
}
```

And add the import: `import { ownerAnalyticsTag } from "@/lib/rpc/owner-analytics-types";`.

**Detection:**
```
rg -n "ownerAnalyticsTag" src/app/api/
```
Expected hits after F2:
- `deals/route.ts` (POST + retry path) — already present ✓
- `deals/[id]/route.ts` (PATCH + DELETE) — already present ✓
- `work-sessions/[id]/route.ts` (PATCH on completion) — already present ✓
- `reports/route.ts` (NEW — F2 must add this to both branches) ← MISSING TODAY

**Phase assignment:** Feature 2 route-wiring phase.

---

### Pitfall X-2: `PATCH /api/deals/[id]` is missing invalidation for student+coach tags (pre-existing gap)

**What goes wrong:**
`src/app/api/deals/[id]/route.ts:127-134` only invalidates:
- `` `deals-${profile.id}` `` (student's own deals cache — legacy Phase 43 tag)
- `ownerAnalyticsTag()` (global owner)

It does NOT invalidate `studentAnalyticsTag(deal.student_id)`, `coachDashboardTag(coach_id)`, `coachAnalyticsTag(coach_id)`, or `coachMilestonesTag(coach_id)`. So editing a deal's revenue/profit:
- Updates the row in DB ✓
- Invalidates owner analytics ✓
- Does NOT invalidate student's `/student/analytics` (which sums `total_revenue` / `total_profit`) — stale for up to 60s
- Does NOT invalidate coach dashboard — stale

**F1 expands this blast radius.** F1's new fields `total_brand_outreach` / `total_influencer_outreach` are NOT impacted by deal edits (deals don't have outreach numbers), so F1 doesn't need this fixed. BUT if stakeholder notices stale revenue on `/student/analytics` after editing a deal, they'll ask why.

**Prevention (recommended as v1.8 cleanup, not strictly required):**
Mirror the POST /api/deals cache invalidation block (lines 184-210) in the PATCH handler. Same pattern — look up `deal.student_id` → fetch `coach_id` → invalidate the four tags.

**Phase assignment:** Optional cleanup — add to PROJECT.md Carry-overs if out of scope.

---

### Pitfall X-3: Owner analytics RPC auth check rejects authenticated users — route handler MUST use admin client

**What goes wrong:**
`get_owner_analytics()` (migration 00028:76-78) raises `not_authorized` for any `auth.uid() IS NOT NULL` caller. The wrapper `getOwnerAnalyticsCached` uses `createAdminClient()` which sets auth.uid() to NULL (service_role). F2 extends this RPC — the auth guard stays. If F2 adds a second RPC (e.g., `get_owner_coach_performance`) and someone calls it from a client component via the regular `createClient()`, it will raise 42501.

**Prevention:**
Every new owner-analytics-adjacent RPC must:
1. Use the same `auth.uid() IS NOT NULL → raise` pattern.
2. Be invoked only from `src/lib/rpc/*.ts` via `createAdminClient()`.
3. Never be grep-findable in a client component (enforced by `import "server-only"` on the wrapper module — see `owner-analytics.ts:19`).

**Detection:**
```
rg -n "get_owner_analytics|get_owner_" src/
```
Every hit in a client component file (`"use client"`) is a bug. The wrapper must be server-only.

**Phase assignment:** F2 migration + wrapper phase.

---

### Pitfall X-4: `.gte("date", cutoff)` with CURRENT_DATE vs Postgres server timezone

**What goes wrong:**
Several F2/F3 queries will filter `WHERE dr.date >= CURRENT_DATE - 6`. `daily_reports.date` is type `date` (not `timestamptz`), stored as whatever date the student submitted — in the server's UTC timezone. CURRENT_DATE on a Supabase Pro Small Postgres instance is UTC. Student in UTC-8 who submits at 11:30pm local on Day N has `date = Day N+1 (UTC)` (if they submitted after 16:00 local) — off by one.

This already bites the v1.6 student analytics "7d" window but hasn't been flagged as a bug. v1.8 expands the blast radius: 4 windows × 6 leaderboards means more surface area for off-by-one at day boundaries.

**Prevention — match existing precedent:**
- Migration 00023 uses `v_today - 6`. Consistent.
- Document in SQL comment: "CURRENT_DATE is UTC. Students in non-UTC timezones may see trailing-window boundaries shift by one day. v1.8 accepts this; timezone localization is deferred."
- No code change needed — just consistency.

**Detection:**
Look for timestamptz → date casts. If any new F2/F3 query does `WHERE ws.created_at >= now() - interval '7 days'` instead of `WHERE ws.date >= CURRENT_DATE - 6`, flag as inconsistent with precedent.

**Phase assignment:** F2 + F3 migration phase review.

---

## Phase-Specific Warnings

| Feature | Most Likely Pitfall | Hardest to Detect | Mitigation Priority |
|---------|---------------------|-------------------|---------------------|
| F1 | **1-A** (stale cache crashes SSR) | 1-B (any cast bypasses tsc) | BLOCKER — bump key literal |
| F2 | **2-B** (tie-break missing id::text) | 2-A (NULL → 0 for coaches with zero deals) | HIGH — copy 00028 verbatim |
| F2 | **X-1** (reports route misses ownerAnalyticsTag) | X-1 (silent staleness, no error) | BLOCKER — forget this and leaderboard #2 is stale |
| F3 | 3-A (window semantics) | 3-A (ambiguous off-by-one) | HIGH — document in SQL comment |
| F3 | 3-B (client re-fetch on toggle) | 3-B (works but slow; easy to build wrong) | MEDIUM — static shape in SSR payload |
| F4 | **4-B** (deal_closed has no TTL) | 4-B (looks fine for 90 days, grows over years) | HIGH — confirm intent, add 30d filter |
| F5 | **5-A** (config flip alone does nothing) | 5-A (silent: zero alerts fire, looks "working") | BLOCKER — new migration required |
| F5 | 5-C (cache staleness on flag flip) | 5-C (ephemeral) | LOW — backfill makes it moot |
| F6 | 6-A (role filter missed in some query) | 6-B (undefined reports → crash) | MEDIUM — pass `[]` not undefined |
| Cross | **X-0** (RPC overload collision) | X-0 (deployed fine, breaks on next deploy) | BLOCKER — drop-then-recreate pattern |

---

## Sources

- `supabase/migrations/00004_alert_dismissals.sql` — dismissal table schema + owner/coach RLS
- `supabase/migrations/00023_get_student_analytics.sql:96-108` — current total_emails / total_influencers aggregation pattern
- `supabase/migrations/00027_get_coach_milestones_and_backfill.sql:118-132` — tech_setup CTE with hardcoded step_number = 0 + FUTURE WORK note about required backfill
- `supabase/migrations/00028_get_owner_analytics.sql:106, 127, 148` — canonical 3-tiebreaker pattern for F2
- `supabase/migrations/00029_chat_removal_announcements.sql` + `00032_drop_get_sidebar_badges_legacy_4arg.sql` — PGRST203 overload-collision postmortem
- `src/lib/rpc/coach-milestones.ts:52` — flag passed through to RPC, not in cache key
- `src/lib/rpc/student-analytics-types.ts:20-27` — StudentAnalyticsTotals (current shape; changes in F1)
- `src/lib/rpc/owner-analytics-types.ts:67-83` — ownerAnalyticsTag() global tag contract
- `src/app/api/reports/route.ts:157-178` — GAP: does NOT revalidate ownerAnalyticsTag (X-1 fix point)
- `src/app/api/deals/route.ts:184-210, 240-245` — CORRECT invalidation pattern for POST path (template for X-1)
- `src/app/api/deals/[id]/route.ts:127-134` — GAP: PATCH misses student+coach tags (pre-existing, X-2)
- `src/app/api/work-sessions/[id]/route.ts:165-172` — CORRECT ownerAnalyticsTag invalidation on session completion
- `src/app/api/alerts/dismiss/route.ts:80-81` — current dismissal invalidation (safe for F4 if no new cache added)
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx:35` — single-line change point for F6
- `src/app/(dashboard)/owner/students/page.tsx:30` — second single-line change point for F6
- `src/components/coach/CalendarTab.tsx:41` — reports is required (not optional) — F6 must pass []
- `src/components/coach/alerts-types.ts:119-125` — UI label "Setup Complete" (F5 changes to "Set Up Your Agency")
- `src/lib/config.ts:385-413` — MILESTONE_CONFIG + MILESTONE_FEATURE_FLAGS (F5 config changes)
- `.planning/PROJECT.md` v1.8 section — constraints, ambiguities, build order
