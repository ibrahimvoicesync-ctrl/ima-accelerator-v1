# v1.8 Requirements — Analytics Expansion, Notification Pruning & DIY Parity

**Milestone:** v1.8
**Opened:** 2026-04-16
**Previous milestone last phase:** 60 → v1.8 starts at **Phase 61**
**Next migration number:** `00033` (continues after v1.7's `00032_drop_get_sidebar_badges_legacy_4arg.sql` hotfix)

> All 8 CLAUDE.md Hard Rules apply to every phase. Post-phase gate: `npm run lint && npx tsc --noEmit && npm run build` exits 0.

---

## v1.8 Requirements

### Student Analytics — Outreach KPI Re-split (Feature 1)

- [ ] **SA-01**: Student analytics `/student/analytics` page shows a KPI card labeled "Total Brand Outreach" whose value equals `SUM(COALESCE(brands_contacted, 0))` across the student's `daily_reports` rows
- [ ] **SA-02**: Student analytics page shows a KPI card labeled "Total Influencer Outreach" whose value equals `SUM(COALESCE(influencers_contacted, 0))` across the student's `daily_reports` rows
- [ ] **SA-03**: Migration `00033_fix_student_analytics_outreach_split.sql` drops + recreates `get_student_analytics` with `total_brand_outreach` and `total_influencer_outreach` in the `totals` payload and removes `total_emails` + `total_influencers` keys (breaking jsonb shape change); uses the defensive `DROP FUNCTION … (identity_args)` pattern to prevent PGRST203 overload collisions
- [ ] **SA-04**: `StudentAnalyticsTotals` type in `src/lib/rpc/student-analytics-types.ts` replaces `total_emails` / `total_influencers` with `total_brand_outreach` / `total_influencer_outreach`; `npx tsc --noEmit` catches every stale consumer
- [ ] **SA-05**: `unstable_cache` key in `src/app/(dashboard)/student/analytics/page.tsx` is bumped from `["student-analytics"]` to `["student-analytics-v2"]` (or equivalent version suffix) in the SAME commit as the migration to prevent 60s TTL rollover SSR crashes on the new consumer
- [ ] **SA-06**: `unstable_cache` key in `src/app/(dashboard)/student_diy/analytics/page.tsx` is bumped identically in the same commit
- [ ] **SA-07**: DIY KPI-card visibility decision is resolved in `/gsd-discuss-phase` — `AnalyticsClient.tsx:198` currently hides brand/influencer KPIs for `viewerRole === "student_diy"`; v1.8 phase must explicitly confirm whether DIY now renders the new cards or keeps hiding (default: show)
- [ ] **SA-08**: Outreach trend chart is NOT modified (already splits by brand/influencer)
- [ ] **SA-09**: Daily report form is NOT modified (still collects brands_contacted + influencers_contacted as separate integers)

### Owner Analytics — Coach Performance Leaderboards (Feature 2)

- [ ] **OA-01**: Owner analytics `/owner/analytics` page renders a "Coach Performance" section directly beneath the existing student leaderboards
- [ ] **OA-02**: Coach Performance section contains three top-3 leaderboards: (a) **Total Revenue** = `SUM(deals.revenue)` across coach's assigned students, (b) **Avg Total Outreach per student per day** in window = `SUM(COALESCE(brands_contacted, 0) + COALESCE(influencers_contacted, 0)) / (COUNT(distinct assigned students with role IN ('student','student_diy')) × window_days)`, (c) **Total Deals** = `COUNT(deals.id)` across coach's assigned students
- [ ] **OA-03**: Each coach leaderboard only includes rows where `users.role = 'coach'` AND `users.status = 'active'` AND the coach has at least one assigned student (`EXISTS (SELECT 1 FROM users s WHERE s.coach_id = c.id)`)
- [ ] **OA-04**: Every coach leaderboard CTE uses the Phase 54 three-tiebreaker pattern: `ORDER BY metric DESC, LOWER(name) ASC, id::text ASC`
- [ ] **OA-05**: Coach leaderboard rows render as non-linked `<li>` (no `/owner/coaches/[id]` route exists — `LeaderboardCard` supports `hrefPrefix: string | null`)
- [ ] **OA-06**: `OwnerAnalyticsPayload` in `src/lib/rpc/owner-analytics-types.ts` is extended to include three new coach leaderboard keys (naming: `coach_revenue`, `coach_avg_total_outreach`, `coach_deals`) nested under the 4-window envelope defined in Feature 3. The UI label for (b) is "Avg Total Outreach / student / day" (combined brands + influencers).
- [ ] **OA-07**: `OwnerAnalyticsTeaser` homepage component is NOT modified (stays student-only; preserves tight layout)
- [ ] **OA-08**: `src/app/api/reports/route.ts` adds `revalidateTag(ownerAnalyticsTag(), "default")` to BOTH the update-existing-row branch and the insert-new-row branch (fixes the currently-missing invalidation that F2 metric #2 requires)

### Owner Analytics — Per-Leaderboard Time-Window Selector (Feature 3)

- [ ] **WS-01**: Each of the 6 leaderboards (3 student + 3 coach) has an independent Weekly / Monthly / Yearly / All Time toggle rendered above its card
- [ ] **WS-02**: Window semantics — Weekly = trailing 7 days (`created_at >= now() - interval '7 days'`), Monthly = trailing 30 days, Yearly = trailing 365 days, All Time = no date filter (matches the shipped `get_student_analytics` trailing-N-days precedent in migration 00023)
- [ ] **WS-03**: Migration `00035_expand_owner_analytics_leaderboards.sql` (or single-phase combined with OA changes) expands `get_owner_analytics` to return all 24 pre-computed slots (6 leaderboards × 4 windows) in one jsonb payload; uses the defensive `DROP FUNCTION … (identity_args)` pattern
- [ ] **WS-04**: `OwnerAnalyticsPayload` type nests by window: `leaderboards.students.hours.{weekly, monthly, yearly, alltime}` (and analogous for profit, deals, coach_revenue, coach_avg_total_outreach, coach_deals)
- [ ] **WS-05**: Window selectors are pure client-side `useState` — toggling one does NOT trigger a `fetch()`; it switches which pre-computed slice renders from the SSR-delivered payload
- [ ] **WS-06**: Default selection on initial load is "All Time" for every leaderboard (preserves current visible state parity with Phase 54)
- [ ] **WS-07**: Window selector uses `role="radiogroup"` + `role="radio"` + `aria-checked` (matches `StarRating.tsx:32-50` precedent), with arrow-key navigation; each option meets Hard Rule 2 (`min-h-[44px]`) and has an accessible label
- [ ] **WS-08**: New internal primitive `src/components/ui/SegmentedControl.tsx` (≤ ~60 LOC, zero new runtime deps, exported from `ui/index.ts`) provides the 4-way toggle pattern; re-used by every window selector
- [ ] **WS-09**: New client component `src/components/owner/analytics/OwnerAnalyticsClient.tsx` owns the 6 `useState` hooks and receives the full 24-slot payload as props from the server-component page
- [ ] **WS-10**: `unstable_cache` key for `get_owner_analytics` is bumped (e.g. `["owner-analytics"]` → `["owner-analytics-v2"]`) in the same commit as the migration (prevents SSR crash during 60s TTL rollover on the new payload shape)

### Owner Alerts — Prune to Deal-Closed Only (Feature 4)

- [ ] **OAL-01**: `/owner/alerts` page generates a new alert per `deals` row with `type: "deal_closed"`, `title: student.name`, `message: "Closed a $X,XXX deal"` (revenue formatted with `toLocaleString`), `severity: "info"` (OR new `"success"` variant if `AlertItem` supports it), `subjectId: student_id` (links to `/owner/students/${student_id}`), `triggeredAt: deals.created_at`, `key: "deal_closed:${deal_id}"`
- [ ] **OAL-02**: `/owner/alerts` page no longer generates `student_inactive`, `student_dropoff`, `unreviewed_reports`, or `coach_underperforming` alerts (silent removal — no tombstone UI)
- [ ] **OAL-03**: `AlertItem.type` union in `src/components/owner/OwnerAlertsClient.tsx` adds `"deal_closed"` and removes the four legacy values; `TYPE_CONFIG` map updates (DollarSign icon, `text-ima-success` / `bg-ima-success/10`)
- [ ] **OAL-04**: `alert_dismissals` table, `/api/alerts/dismiss` route, and dismissal-key uniqueness contract are NOT modified — dismissal infrastructure is reused verbatim; orphan rows from the 4 removed alert types are preserved for forensic history
- [ ] **OAL-05**: New deal creation (by any role via `/api/deals` POST) produces exactly one `deal_closed` alert on the owner feed within the page's dynamic rendering window; existing `revalidateTag("badges")` on deal-create stays in place
- [ ] **OAL-06**: Dismissed `deal_closed` alerts stay dismissed across page reloads (reuses existing `alert_dismissals` query join)
- [ ] **OAL-07**: Migration `00036_prune_owner_alerts_to_deal_closed.sql` rewrites the OWNER branch of `get_sidebar_badges` (migration 00029 lines 115–183) to count `deals - dismissed_deal_keys` so the sidebar badge stays in sync with the pruned feed; uses the defensive `DROP FUNCTION … (identity_args)` pattern
- [ ] **OAL-08**: Coach alerts feed is NOT modified (coaches still receive `100h_milestone`, `5_influencers`, `brand_response`, `closed_deal`, `tech_setup`)
- [ ] **OAL-09**: `deal_closed` feed TTL / pagination decision is locked in `/gsd-discuss-phase` — default: unbounded feed (one-shot-forever) OR add 30-day trailing filter (PITFALLS.md 4-B)

### Coach Alerts — `tech_setup` Activation as "Set Up Your Agency" / Step 4 (Feature 5)

- [ ] **CA-01**: `MILESTONE_CONFIG.techSetupStep` in `src/lib/config.ts` is `4` (was `null`)
- [ ] **CA-02**: `MILESTONE_FEATURE_FLAGS.techSetupEnabled` in `src/lib/config.ts` is `true` (was `false`)
- [ ] **CA-03**: `MILESTONE_META["tech_setup"].label` in `src/components/coach/alerts-types.ts` is `"Set Up Your Agency"` (was `"Setup Complete"`); internal type key `tech_setup` is NOT renamed (preserved across `CoachAlertFeedType` union, RPC, `milestone_tech_setup:%` dismissal-key prefix, `techSetupStep`/`techSetupEnabled` config keys). Decision documented in a code comment at the `tech_setup` meta entry.
- [ ] **CA-04**: Migration `00034_activate_tech_setup.sql` (OR combined with `00033`) rewrites the `tech_setup` CTE in `get_coach_milestones` to read `rp.step_number = 4` (was hardcoded `= 0` placeholder in migration 00027 line 130); uses the defensive `DROP FUNCTION … (identity_args)` pattern
- [ ] **CA-05**: Same migration pre-dismisses `alert_dismissals` for every historical `roadmap_progress` row with `step_number = 4 AND status = 'completed'` × the student's current `users.coach_id` (mirrors the Phase 52 backfill pattern from migration 00027 lines 409–420); post-assert: `get_coach_milestones` returns zero `tech_setup` rows for previously-dismissed completions
- [ ] **CA-06**: Icon remains `CheckCircle` (no icon change)
- [ ] **CA-07**: A new student completing roadmap step 4 (post-deploy) generates exactly one coach-facing `tech_setup` alert with label "Set Up Your Agency" visible on the coach's `/coach/alerts` feed; the alert is dismissible and its dismissal-key prefix `milestone_tech_setup:%` is unchanged

### student_diy Owner Detail Page (Feature 6)

- [ ] **DIY-01**: `src/app/(dashboard)/owner/students/[studentId]/page.tsx` line 35 changes `.eq("role", "student")` → `.in("role", ["student", "student_diy"])`; 404 is no longer returned for DIY students
- [ ] **DIY-02**: `src/app/(dashboard)/owner/students/page.tsx` line 30 applies the same filter broadening so DIY students appear in the owner's list
- [ ] **DIY-03**: Owner student-list row for a DIY student renders a visible `Badge` with text "DIY" (ima-* token styling), without shifting the existing column layout
- [ ] **DIY-04**: `student.role` is threaded into `OwnerStudentDetailClient`, `StudentDetailTabs`, and `CalendarTab` as a typed prop so downstream components can branch on it
- [ ] **DIY-05**: "Reports tab hiding" interpretation is locked in `/gsd-discuss-phase` — `StudentDetailTabs.TabKey` is currently `"calendar" | "roadmap" | "deals"` (no top-level Reports tab). Default v1.8 intent: suppress daily-report-derived content INSIDE `CalendarTab`'s day-detail panel AND any daily-report rows in `StudentKpiSummary` when `student.role === "student_diy"`
- [ ] **DIY-06**: `CalendarTab` for DIY students renders only the hours-worked activity (no daily-report indicator dots/markers); session-completed activity continues to render; no crash when `dailyReports === undefined` (defensive)
- [ ] **DIY-07**: Regular student (`role = "student"`) detail page behavior is unchanged
- [ ] **DIY-08**: Coach route `/coach/students/[studentId]` is NOT modified (owner-only scope for this milestone; confirm in `/gsd-discuss-phase`)
- [ ] **DIY-09**: No parallel `/owner/students_diy/[studentId]` route is created; no per-role sub-component `OwnerStudentDetailClientDIY.tsx` is added
- [ ] **DIY-10**: `get_student_detail` RPC (or equivalent) is audited — if it hardcodes a role check, it is updated to accept `student_diy`; if it is already role-agnostic (architecture research confirmed), no migration change is required

---

## Future Requirements

<!-- Deferred to v1.9+ -->

- **URL-param persistence of window selector selections** — deferred (F3 differentiator; not v1.8 scope)
- **Custom date range picker on leaderboards** — deferred (F3 differentiator; not v1.8 scope)
- **Coach detail page `/owner/coaches/[id]`** — deferred (F2 rows would link to it; kept non-linked for v1.8)
- **Badge chip showing deal count per student on alerts feed** — deferred (F4 differentiator)
- **Nyquist VALIDATION.md backfill for v1.5 phases 44–52** — carry-over from v1.5 tech debt; not v1.8 scope
- **Full per-edit change-log for deal updates (v1.5 D-17 deferral)** — carry-over; not v1.8 scope
- **Full email notifications pipeline (Resend)** — carry-over; V2+
- **IN-01 / IN-02 dashboard bugs** — carry-over from v1.7; not v1.8 scope

## Out of Scope

<!-- Explicit exclusions with reasoning. Prevents re-adding. -->

- **Compat alias for old `total_emails` / `total_influencers` keys** — breaking change in SA-03 is intentional; all consumers update in the same milestone (keeping the aliases would silently preserve the double-count bug)
- **Parallel `/owner/students_diy/[studentId]` route tree** — extend existing route via DIY-01 (one route tree, conditional rendering; avoids drift)
- **Per-role sub-component `OwnerStudentDetailClientDIY.tsx`** — DIY-04 conditional rendering inside existing component (only ~3 of ~10 UI blocks differ; duplicate component would drift)
- **Tombstone message in alerts feed about pruning the 4 legacy types** — silent removal per OAL-02 (tombstones age badly)
- **Renaming `tech_setup` internal type key / dismissal-key prefix / config keys** — only the UI label changes in CA-03 (internal rename would ripple through RPC, dismissal keys, and in-flight dismissals)
- **Custom Rebrandly domain / owner–coach referral management pages** — v1.7 scope carryover note; stays out
- **localStorage persistence of window selector** — WS-05/06 is reset-on-visit (deliberate; URL-param is the v1.9+ upgrade path if needed)
- **Coach route extension for DIY students** — owner-only for v1.8 per DIY-08
- **Email / push / in-app notification extensions beyond the existing owner alerts feed and coach alerts feed** — "notified" in v1.8 means "sees in feed"
- **Changes to daily report form, student analytics trend charts, hours chart, or deals table** — explicitly out of scope
- **Changes to `ROADMAP_STEPS` themselves** — Step 4 "Set Up Your Agency" already exists (F5 just points the milestone at it)
- **`/owner/coaches/[id]` coach detail page** — not adding in v1.8 (F2 rows stay non-linked)

---

## Traceability

<!-- To be populated by roadmapper when ROADMAP.md is created. -->

| REQ-ID | Phase | Plan(s) | Status |
|--------|-------|---------|--------|
| SA-01 – SA-09 | 61 (F1) | TBD | Pending |
| CA-01 – CA-07 | 62 (F5) | TBD | Pending |
| DIY-01 – DIY-10 | 63 (F6) | TBD | Pending |
| OA-01 – OA-08 | 64 (F2) | TBD | Pending |
| WS-01 – WS-10 | 64 (F3) | TBD | Pending |
| OAL-01 – OAL-09 | 65 (F4) | TBD | Pending |

**Coverage:** 53 / 53 v1.8 requirements mapped to exactly one phase. Phase 61 = 9 reqs (SA), Phase 62 = 7 reqs (CA), Phase 63 = 10 reqs (DIY), Phase 64 = 18 reqs (OA + WS), Phase 65 = 9 reqs (OAL).

---

## Ambiguities (resolve in `/gsd-discuss-phase`, not execution)

1. **SA-07 / F1 DIY KPI visibility** — `AnalyticsClient.tsx:198` currently hides brand/influencer KPIs for `student_diy`. Default v1.8 intent: show the renamed cards to DIY. Confirm in Phase 1 discussion.
2. **WS-02 / F3 window semantics** — trailing 7/30/365 days vs calendar week/month/year. Recommend trailing (matches existing `created_at` indexes and migration 00023:71 precedent).
3. **OAL-09 / F4 feed TTL** — unbounded deal_closed feed vs 30-day trailing filter. Confirm in Phase 3 discussion.
4. **DIY-05 / F6 "Reports tab" wording** — spec says "hide Reports tab" but no such top-level tab exists. Interpret as suppressing daily-report indicators inside CalendarTab + StudentKpiSummary for DIY students. Confirm in Phase 1 discussion.
5. **DIY-08 / F6 coach route scope** — owner-only for v1.8. Confirm coach route stays unchanged.

**Resolved:**
- F2 metric #2 (OA-02 / OA-06 / WS-04) locked as **avg TOTAL outreach** (`brands_contacted + influencers_contacted`) per student per day in window, on the owner analytics coach leaderboard — user confirmed 2026-04-16.

---

*Requirements authored: 2026-04-16. Total: 53 REQ-IDs across 6 categories.*
