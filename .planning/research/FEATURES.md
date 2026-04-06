# Feature Research

**Domain:** Student deal tracking — revenue + profit per closed brand deal in a coaching/mentorship platform
**Researched:** 2026-04-06
**Confidence:** HIGH (existing codebase read in full; PROJECT.md decisions locked; patterns cross-checked against sales dashboard UX research and coaching platform analysis)

---

## Scope

This document covers only the NEW features in v1.5. Everything already shipped (work tracker,
roadmap, daily reports, coach review, chat, resources, skip tracker, student_diy role, etc.)
is out of scope here.

New feature group: **Student Deals** — closed brand deal logging with revenue and profit per deal,
visible to all four roles with appropriate CRUD permissions.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the platform feels incomplete without if a "deal tracking" milestone is shipped.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add a deal (revenue + profit) | Core action — without it the entire feature set is null | LOW | Form: deal_number (auto), revenue (decimal), profit (decimal), closed_at (date), optional notes; student and student_diy both get this |
| Deals Closed count on dashboard | Any sales-adjacent tool shows a headline count; missing it makes the dashboard feel like it doesn't know about deals | LOW | Integer count from `deals` table; pull alongside existing work session query in dashboard page |
| Total Revenue on dashboard | Revenue is the primary outcome metric for an influencer marketing student; no revenue display = no accountability signal | LOW | SUM(revenue_amount) per student; same query as closed count |
| Total Profit on dashboard | Revenue alone doesn't reflect the student's earnings; profit is what they actually keep | LOW | SUM(profit_amount) per student |
| Deal history list (student view) | Students expect to scroll their deal history — the add-only flow without a history list leaves them unable to verify or edit past entries | LOW | Chronological table/list; most recent first; show deal_number, revenue, profit, date |
| Edit a deal | Students enter wrong numbers; no edit = frustrated students emailing coaches to fix entries manually | MEDIUM | PATCH /api/deals/[id]; only the owning student can edit their own deal |
| Delete a deal (student self-delete) | Mistakes happen; students expect basic CRUD over their own data | LOW | DELETE /api/deals/[id]; student can delete own; soft-delete vs hard-delete — PROJECT.md pattern is hard delete (no soft-delete pattern exists in codebase) |
| Coach Deals tab on student detail page | Coaches already have Calendar and Roadmap tabs; a Deals tab follows the established pattern and is required for coach oversight | MEDIUM | New TabKey "deals" in StudentDetailTabs; summary stats + paginated list 25/page |
| Owner Deals tab on student detail page | Owner has the same student detail page structure as coach; must have deals visibility parity | MEDIUM | Mirror of coach deals tab; OwnerStudentDetailClient gets the same tab extension |
| Coach can delete student deals | Coaches manage their students' data; ability to remove erroneous entries is standard in coaching tools | LOW | Role check: coach AND student.coach_id = coach user id; hard delete via admin client |
| Owner can delete any deal | Owner has platform-wide authority; same power as coach but unrestricted by assignment | LOW | Role check: owner only; no coach_id scoping needed |
| Paginated deal list for coach/owner (25/page) | Coaches with active students may see dozens of deals; pagination prevents layout collapse | MEDIUM | Cursor or offset pagination; 25/page matches stated requirement; existing reports pagination pattern exists |
| Auto-incremented deal_number per student | Students track "my 3rd deal", "my 10th deal"; a global UUID is meaningless; per-student sequence feels natural | MEDIUM | Postgres sequence per student is complex; simpler: COUNT(deals WHERE student_id = X) + 1 at insert time, stored on the row; race condition risk — needs FOR UPDATE lock or SERIALIZABLE isolation |
| Both student and student_diy get Deals page | PROJECT.md explicitly: "Both student and student_diy roles get the Deals page" — parity is a stated requirement | MEDIUM | student_diy currently has dashboard, work, roadmap, resources; Deals adds a 4th student_diy page |
| Rate limiting on deal mutations | All mutation routes in v1.x have rate limiting; missing it here would violate the platform-wide security posture | LOW | checkRateLimit() + verifyOrigin() wrappers already exist; apply to POST/PATCH/DELETE /api/deals |
| RLS on deals table | All tables have RLS; deals must not be readable across student boundaries | LOW | Student can read/write own rows; coach reads own students' rows; owner reads all; use SECURITY DEFINER RPC pattern consistent with existing tables |

### Differentiators (Competitive Advantage)

Features that add distinctive value beyond generic deal logging.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Deal number per student (not global) | "I closed my 5th deal" is a motivational milestone; a per-student sequence turns the list into a personal achievement tracker | MEDIUM | Store deal_number on row at insert time; display prominently in list and detail view |
| Dashboard stats card with all three metrics at a glance | Most coaching tools show one summary metric; displaying Deals Closed + Total Revenue + Total Profit as a three-card grouping mirrors the existing KPI outreach card pattern, making deals a first-class accountability metric alongside outreach | LOW | Three stat cards below the existing work progress and outreach cards; consistent card style using ima-* tokens |
| useOptimistic on deal add | Existing pattern from Phase 21 (report submission uses useOptimistic); applying it here gives instant UI feedback on deal add without waiting for the server round-trip | MEDIUM | Add optimistic deal row with a temporary ID; replace on server response; revert on error |
| Coach summary stats on Deals tab | Showing summary (count + totals) at the top of the deals tab before the list means coaches can parse performance at a glance without scrolling the full history | LOW | Header row: "3 deals — $12,400 revenue — $4,200 profit"; same pattern as KpiSummary component |
| Profit margin implied display | Revenue and profit together imply margin; displaying "(margin: 34%)" next to profit helps coaches instantly assess deal quality without mental math | LOW | `(profit / revenue * 100).toFixed(0) + '%'`; only show when revenue > 0 |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Deal pipeline / stage tracking | "Prospecting → Pitched → Negotiating → Closed" feels complete | Pipeline tracking is explicitly Out of Scope until V2 (PROJECT.md) — adds stage management UI, stage transition logic, and historical state complexity | Log only closed deals; pipeline is V2+ |
| Influencer tracking on deals | "Which influencer did I use for this deal?" is a natural next question | Influencer tracking pipeline is explicitly Out of Scope (PROJECT.md) | Notes field on deal allows free-text mention of influencer; structured FK is V2+ |
| Currency selection per deal | International students may work in different currencies | Multi-currency requires exchange rate logic, display formatting complexity, and aggregation across currencies | Single currency (assumed USD or student's local) in v1; do not add a currency column |
| Recurring revenue / MRR tracking | Influencer marketing deals can be retainer-based | Retainer tracking requires deal-type distinction, period fields, and aggregation logic | Log each payment as a separate closed deal; retainer modeling is V2+ |
| Deal approval workflow | "Coach must approve before deal counts" seems like accountability | Adds asynchronous state machine (pending → approved → rejected); students would be blocked from seeing their deal count while awaiting approval | All deals count immediately; coach oversight is read-only via the Deals tab; coach can delete erroneous entries |
| Leaderboard / rankings by revenue | "Top 5 students by revenue" is motivating | Gamification (leaderboard, tiers) is explicitly Out of Scope until V2 (PROJECT.md) | Dashboard shows self-stats only; no cross-student comparison in v1 |
| Soft delete (trash / restore) | "Undo delete" is convenient | Adds `deleted_at` column, filter on all queries, restore endpoint, and UI state — complexity for a rare recovery case | Hard delete; coach and owner can delete on behalf of students who made errors |
| File attachments on deals (contract PDFs) | "Attach the signed contract" links the deal to evidence | Requires Supabase Storage, CSP img-src/media-src, file size limits, virus surface area | Notes field allows free-text contract reference (e.g., Google Drive link) |
| Coach edit deals | Coaches want to fix student data without deleting and re-adding | Coaches already have delete power; letting coaches edit creates data ownership confusion ("did the student enter this or the coach?") | Coach deletes the incorrect deal; student re-enters correct values |
| KPI pre-aggregation for deals in nightly cron | Deals data should be pre-aggregated like outreach KPIs | The existing pg_cron job runs nightly; deal counts change in real time when students add deals; a nightly snapshot would show yesterday's count on the dashboard | Query deals directly at page load time; at v1 scale (hundreds of students, dozens of deals each) the query is cheap; add to pre-aggregation only if load testing shows it's needed |

---

## Feature Dependencies

```
[deals table — DB migration]
    └──required-by──> [student Deals page — add/edit/delete/history]
    └──required-by──> [student_diy Deals page — add/edit/delete/history]
    └──required-by──> [dashboard stats — deals closed, revenue, profit]
    └──required-by──> [coach Deals tab on student detail page]
    └──required-by──> [owner Deals tab on student detail page]
    └──required-by──> [/api/deals POST/PATCH/DELETE route handlers]

[/api/deals route handlers]
    └──requires──> [deals table migration — must exist first]
    └──requires──> [checkRateLimit() — already exists in src/lib/rate-limit.ts]
    └──requires──> [verifyOrigin() — already exists in src/lib/csrf.ts]
    └──requires──> [createAdminClient() — already exists]
    └──required-by──> [student Deals page client mutations]
    └──required-by──> [student_diy Deals page client mutations]

[student Deals page — /student/deals]
    └──requires──> [deals table migration]
    └──requires──> [/api/deals route]
    └──requires──> [student nav update — add Deals link in config.ts]
    └──requires──> [proxy.ts — add /student/deals to allowed routes]
    └──USES──> [useOptimistic (React 19, already used in report submission)]

[student_diy Deals page — /student_diy/deals]
    └──requires──> [deals table migration]
    └──requires──> [/api/deals route — same route, role check must accept student_diy]
    └──requires──> [student_diy nav update — add Deals link in config.ts]
    └──requires──> [proxy.ts — add /student_diy/deals to allowed routes]
    └──REUSES──> [student Deals page component — same UI, different role check at API layer]

[dashboard stats — student dashboard page.tsx]
    └──requires──> [deals table migration]
    └──adds-query-to──> [existing StudentDashboard page.tsx parallel Promise.all fetch]
    └──DOES NOT require──> [new API endpoint — server component reads directly via admin client]

[dashboard stats — student_diy dashboard page.tsx]
    └──requires──> [deals table migration]
    └──adds-query-to──> [existing StudentDiyDashboard page.tsx parallel Promise.all fetch]
    └──SAME pattern as student dashboard]

[coach Deals tab — StudentDetailClient.tsx + StudentDetailTabs.tsx]
    └──requires──> [deals table migration]
    └──requires──> [new TabKey "deals" added to StudentDetailTabs.tsx]
    └──requires──> [DealsTab component — new component in src/components/coach/]
    └──requires──> [/api/deals/[id] DELETE — role-scoped for coach]
    └──adds-prop-to──> [StudentDetailClient.tsx — initialDeals + studentId already available]
    └──adds-server-query-to──> [coach student detail page.tsx — fetch first page of deals]

[owner Deals tab — OwnerStudentDetailClient.tsx]
    └──requires──> [deals table migration]
    └──requires──> [DealsTab component — reusable between coach and owner]
    └──requires──> [/api/deals/[id] DELETE — role-scoped for owner]
    └──adds-server-query-to──> [owner student detail page.tsx — fetch first page of deals]
    └──REUSES──> [DealsTab component from coach; role prop controls delete button visibility]

[deal_number auto-increment per student]
    └──requires──> [deals table migration with deal_number column]
    └──requires──> [insert-time COUNT query with SELECT ... FOR UPDATE on student's deals]
    └──OR alternative──> [Postgres SERIAL per-student not possible; use application-level lock]
    └──NOTE──> [race condition risk if two deals inserted simultaneously; use row-level locking]
```

### Dependency Notes

- **The deals table migration is the single unblocking dependency.** Every downstream feature (pages, API routes, dashboard stats, tabs) requires the table to exist. Ship the migration first in the phase plan.
- **student and student_diy Deals pages can share a component.** The UI logic is identical — the role difference is enforced at the API layer (`/api/deals` checks role is `student` OR `student_diy`). Create one `DealsClient` component and mount it in both `/student/deals/page.tsx` and `/student_diy/deals/page.tsx`.
- **Dashboard stats require no new API endpoint.** The student and student_diy dashboard pages are Server Components that already do a `Promise.all` of DB queries. Add two more selects (COUNT and SUM) to the same parallel fetch. No round-trip cost relative to the existing page load.
- **Coach Deals tab pagination is a new pattern for student detail pages.** Calendar and Roadmap tabs load all data server-side (calendar is one month, roadmap is 15 rows). Deals lists could grow large. Load the first 25 server-side; client fetches subsequent pages via `/api/deals?student_id=&page=2`. Follow the existing server-side pagination pattern from Phase 20 (`get_student_detail` RPC).
- **deal_number race condition.** If two deals are inserted simultaneously for the same student, `MAX(deal_number) + 1` can produce duplicate deal numbers. Mitigate with a `SELECT COUNT(*) + 1 FROM deals WHERE student_id = $1 FOR UPDATE` inside a transaction in the POST handler. Alternatively, accept that deal_number is a display label (not a unique constraint), and allow gaps if a deal is deleted.
- **Owner Deals tab reuses the DealsTab component.** Pass a `canDelete: boolean` prop (true for both coach and owner, but coach requires `student.coach_id === coach_user_id` check server-side before allowing delete). The delete action itself is always server-validated — the prop only controls UI visibility.
- **student_diy has no coach_id.** Deal records for student_diy users will have no associated coach. Coach detail pages never show student_diy users. Only the owner can view student_diy deals via the owner student detail page.
- **Existing KPI pre-aggregation (student_kpi_summaries) does NOT need updating for v1.5.** The pg_cron job aggregates outreach and report metrics. Deal stats are queried directly at page load. Do not add deal columns to `student_kpi_summaries` unless load testing later proves it necessary.

---

## MVP Definition

### Launch With (v1.5 — all stated requirements)

- [ ] DB migration: `deals` table with student_id, deal_number, revenue_amount, profit_amount, closed_date, notes, created_at, updated_at; index on (student_id, deal_number); RLS
- [ ] `/api/deals` POST — student and student_diy can add own deals; rate limit + CSRF
- [ ] `/api/deals/[id]` PATCH — student and student_diy can edit own deals; rate limit + CSRF
- [ ] `/api/deals/[id]` DELETE — student/student_diy delete own; coach deletes assigned students'; owner deletes any; rate limit + CSRF
- [ ] `/api/deals` GET — paginated fetch for coach/owner tab (25/page, student_id param)
- [ ] Student Deals page (`/student/deals`) — add form, deal history list, edit inline or modal, delete with confirmation
- [ ] student_diy Deals page (`/student_diy/deals`) — same component as student
- [ ] Student dashboard stats — Deals Closed, Total Revenue, Total Profit stat cards
- [ ] student_diy dashboard stats — same three stat cards
- [ ] Coach Deals tab on student detail page — summary row + paginated list + delete button
- [ ] Owner Deals tab on student detail page — same as coach tab; owner can delete any

### Add After Validation (v1.x)

- [ ] KPI pre-aggregation for deals in pg_cron job — only if load testing shows dashboard query cost is material
- [ ] Profit margin % display alongside profit — quick enhancement once basic stats are confirmed working
- [ ] Deal count in student skip tracker badge area — "3 deals this month" chip alongside skip count

### Future Consideration (v2+)

- [ ] Deal pipeline tracking (prospecting → pitched → closed stages) — stated Out of Scope in PROJECT.md
- [ ] Influencer FK on deals ("this deal used influencer X") — Out of Scope per PROJECT.md
- [ ] Leaderboard by revenue — gamification is V2+
- [ ] Multi-currency support — Out of Scope for V1
- [ ] Retainer / recurring deal modeling — Out of Scope for V1

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Deals table DB migration | HIGH (unblocks everything) | LOW (one migration file) | P1 — ship first |
| /api/deals CRUD route handlers | HIGH (write path) | MEDIUM (POST + PATCH + DELETE with role scoping) | P1 |
| Student Deals page | HIGH (core student action) | MEDIUM (form + list + optimistic UI) | P1 |
| student_diy Deals page | HIGH (stated requirement) | LOW (reuse student Deals component) | P1 |
| Dashboard stats (student + student_diy) | HIGH (accountability signal on landing page) | LOW (add queries to existing parallel fetch) | P1 |
| Coach Deals tab | HIGH (coach oversight) | MEDIUM (new tab + pagination + delete) | P1 |
| Owner Deals tab | MEDIUM (mirrors coach) | LOW (reuse DealsTab component) | P1 |
| deal_number per student | MEDIUM (motivational context) | MEDIUM (race-condition-safe insert) | P1 — stated in requirements |
| Optimistic UI on deal add | MEDIUM (polish) | MEDIUM (useOptimistic already used in reports) | P2 |
| Profit margin % display | LOW (convenience) | LOW (one formula) | P2 |

**Priority key:**
- P1: Must have for v1.5 launch
- P2: Should have; add when possible
- P3: Nice to have, future consideration

---

## Behavioral Patterns — Research Findings

### Dashboard Stat Cards for Deals

Sales dashboard research (HubSpot deals dashboard, Monday.com templates, Klipfolio KPI dashboards)
consistently uses three headline stats at the top: count of closed deals, total revenue, and
optionally average deal size or profit. For a student coaching context:

- **Three cards:** "Deals Closed" (integer), "Total Revenue" (currency), "Total Profit" (currency)
- **Card style:** Match the existing KPI outreach card pattern in the student dashboard — `bg-ima-surface border border-ima-border rounded-xl p-4` with a bold number and a label below
- **Currency format:** `toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })` for whole-dollar display; suppress cents unless needed
- **Zero state:** When no deals exist yet, show "0" for count and "$0" for revenue/profit — do not hide the cards. The zero state reinforces that deal tracking is expected.
- **Placement:** Below the existing work progress card and outreach KPI cards. Deals are a less-frequent action (one per week vs. daily outreach) so below-the-fold is correct.

**Confidence:** MEDIUM — inferred from sales dashboard UX research and existing IMA student dashboard layout; no official spec for exact placement.

### Deal History List (Student View)

Standard deal log table UX from CRM and sales coaching platforms:

- **Sort:** Most recent first (`ORDER BY created_at DESC` or `ORDER BY deal_number DESC`). Students care most about their latest deal, not their first.
- **Columns:** Deal # | Date | Revenue | Profit | Notes (truncated to ~50 chars) | Actions (Edit / Delete)
- **Mobile:** On small screens, collapse to a card per deal: deal number prominent, revenue/profit as two-column row, date as subtext, action buttons at bottom of card
- **Empty state:** "No deals yet. Close your first brand deal and log it here." with the Add Deal button prominently placed
- **Edit interaction:** Inline edit (toggle row into edit mode) is simpler than a modal in this context; existing pattern in the codebase uses modals for mutations — follow the modal pattern for consistency
- **Delete confirmation:** Require a confirmation step (e.g., "Delete this deal? This cannot be undone.") before hard delete. Pattern consistent with other irreversible actions.
- **deal_number display:** Show as "#1", "#2", "#3" — the hash prefix makes it scan as an ordinal, not a raw number

**Confidence:** HIGH — consistent with established CRM and sales tool UX patterns; aligned with existing codebase component patterns.

### Coach/Owner Deals Tab

The existing student detail page has Calendar and Roadmap tabs (`StudentDetailTabs.tsx`). Adding a Deals tab extends this pattern:

- **Tab order:** Calendar | Roadmap | Deals (new) — deals goes last; it is a summary view, not a primary coaching workflow
- **Tab header stats:** "X deals — $Y revenue — $Z profit" as a compact summary row at the top of the tab panel, before the paginated list. This lets coaches assess performance before scrolling.
- **Paginated list (25/page):** Show deal #, date, revenue, profit, notes excerpt, and a Delete button (no Edit — coach cannot edit student data; coach deletes, student re-enters). Pagination controls: Previous / Next with "Page X of Y" or cursor-based.
- **Delete confirmation:** Modal confirmation before delete — same as student self-delete pattern.
- **Empty state on Deals tab:** "No deals recorded yet." — no CTA (coaches cannot add deals for students).
- **Pagination implementation:** Use offset-based pagination (`?page=2&student_id=abc`) for simplicity; cursor-based is only needed if the list grows into thousands of rows (unlikely in v1). The existing coach reports inbox (`/coach/reports`) uses offset pagination as a reference.

**Confidence:** HIGH — directly inferred from existing StudentDetailClient.tsx and StudentDetailTabs.tsx patterns in codebase.

### deal_number Concurrency Safety

The deal_number must be unique per student but not globally. Options:

1. **Application-level lock (recommended for v1):** In the POST /api/deals handler, inside an admin client transaction: `SELECT COUNT(*) + 1 FROM deals WHERE student_id = $1` and use the result as `deal_number`. If two concurrent inserts race, one will get the same count. Mitigation: add a UNIQUE constraint on `(student_id, deal_number)` — the second insert will fail with a 23505 conflict, which the route handler catches and retries once (one retry is sufficient for this unlikely scenario).
2. **Postgres sequence per student:** Not supported natively; would require a sequence-per-student pattern using dynamic SQL — too complex for v1.
3. **Accept gaps:** If a deal is deleted, its deal_number is retired. The next deal gets a new incremented number. This is correct behavior — deal_number is a monotonic label, not a contiguous sequence. Display as "#1", "#4", "#5" (gap after deletion of #2 and #3) is acceptable.

**Recommended:** Store deal_number computed at insert time using MAX(deal_number) + 1 (or 1 if no prior deals exist). Add UNIQUE constraint on (student_id, deal_number). Accept gaps after deletes. Handle 23505 conflict with a single retry in the POST handler.

**Confidence:** MEDIUM — standard pattern for per-entity auto-increment without Postgres sequences; race condition handling is well-understood but requires careful implementation.

### RLS Policy Design for Deals Table

Consistent with existing table RLS patterns in the codebase (uses `get_user_role()` and `get_user_id()` helper functions from migration 00001):

- **Student reads own rows:** `USING (student_id = get_user_id())`
- **Student writes own rows:** `WITH CHECK (student_id = get_user_id() AND get_user_role() IN ('student', 'student_diy'))`
- **Coach reads assigned students' rows:** `USING (get_user_role() = 'coach' AND student_id IN (SELECT id FROM users WHERE coach_id = get_user_id()))`
- **Owner reads all rows:** `USING (get_user_role() = 'owner')`
- **Note:** All mutation routes (POST/PATCH/DELETE) use the admin client via `createAdminClient()`, which bypasses RLS. RLS is a defense-in-depth layer; the route handlers enforce role scoping explicitly via `profile.role` checks and student ownership checks. This matches the existing pattern across all API routes.

**Confidence:** HIGH — directly follows established RLS pattern from migration 00001 and confirmed across all existing table policies.

### Rate Limiting and CSRF on Deal Routes

All mutation routes in v1.x apply:
1. `verifyOrigin(request)` — CSRF protection via Origin header check
2. `checkRateLimit(profile.id, '/api/deals')` — 30 req/min/user on the endpoint key

The existing `checkRateLimit` uses the endpoint path as the bucket key. Use `/api/deals` as the key for POST; use `/api/deals/:id` or a single `/api/deals` key for PATCH and DELETE — exact key format follows existing conventions in `/api/reports/[id]/review/route.ts`.

**Confidence:** HIGH — directly reuses existing helpers with no ambiguity.

---

## Existing Feature Interaction Summary

| Existing Feature | Interaction with v1.5 | Risk Level |
|------------------|-----------------------|------------|
| Student dashboard page.tsx | New parallel queries for deal count and totals; page already has 5 queries in Promise.all — add 1 more | LOW — additive; no existing query changes |
| student_diy dashboard page.tsx | Same pattern as student dashboard | LOW |
| StudentDetailTabs.tsx | Add "deals" to TabKey union type; add tab to tabs array | LOW — additive |
| StudentDetailClient.tsx | Add deals props (initialDeals, dealCount, dealRevenue, dealProfit) | MEDIUM — prop interface grows; must not break existing Calendar and Roadmap render paths |
| OwnerStudentDetailClient.tsx | Same tab extension as coach detail | MEDIUM |
| coach student detail page.tsx | Add parallel deals query for first 25 rows + summary stats | MEDIUM — adds DB round trip to page load |
| owner student detail page.tsx | Same | MEDIUM |
| proxy.ts | Add /student/deals and /student_diy/deals to route guard | LOW — additive; enumeration follows existing pattern |
| config.ts ROUTES | Add `deals: "/student/deals"` and `deals: "/student_diy/deals"` | LOW |
| config.ts NAV | Add Deals nav item for student and student_diy | LOW |
| checkRateLimit() | Add /api/deals as a new endpoint key | LOW — additive to rate_limit_log; no schema change needed |
| student_kpi_summaries + pg_cron job | No change — deals data is queried directly, not pre-aggregated | LOW — no interaction |
| RPC get_student_detail | No change — deals fetched separately from this RPC | LOW |
| types.ts (hand-crafted placeholder) | Add deals table Row/Insert/Update types manually | LOW — types.ts is already hand-crafted; follow same pattern |

---

## Sources

- [IMA Accelerator PROJECT.md](file://C:/Users/ibrah/ima-accelerator-v1/.planning/PROJECT.md) — v1.5 milestone target features and Out of Scope decisions
- [HubSpot Deals Dashboard — Bold BI](https://www.boldbi.com/resources/dashboard-examples/sales/hubspot-deals-dashboard/) — deal stat card design: count + revenue + avg deal size pattern
- [32 Sales KPI Dashboard Examples — Klipfolio](https://www.klipfolio.com/resources/dashboard-examples/sales/sales-kpi-dashboard) — closed deals, total revenue, profit as headline metrics
- [11 Sales Dashboard Templates — Monday.com](https://monday.com/blog/crm-and-sales/sales-dashboard-templates/) — dashboard stat card groupings and deal list table UX
- [Top AI-Driven Sales Coaching Platforms — Momentum.io](https://www.momentum.io/blog/top-ai-driven-sales-coaching-platforms-2025-buyers-guide-for-gtm-teams) — how coaching platforms surface deal performance per rep
- [Top Sales Coaching Platforms — Scratchpad](https://www.scratchpad.com/blog/sales-coaching-platform) — coach-facing deal visibility and accountability patterns
- [Existing codebase: src/app/(dashboard)/student/page.tsx] — dashboard parallel query pattern, stat card component style
- [Existing codebase: src/components/coach/StudentDetailTabs.tsx] — tab extension pattern
- [Existing codebase: src/components/coach/StudentDetailClient.tsx] — prop interface pattern for coach student detail
- [Existing codebase: src/lib/rate-limit.ts + src/lib/csrf.ts] — mutation protection helpers

---

*Feature research for: IMA Accelerator v1.5 — student deal tracking (revenue + profit per closed brand deal)*
*Researched: 2026-04-06*
