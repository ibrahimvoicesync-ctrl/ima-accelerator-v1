# Milestones

## v1.8 Analytics Expansion, Notification Pruning & DIY Parity (Shipped: 2026-04-17)

**Phases completed:** 5 phases (61-65), 14 plans
**Files modified:** 70 | **Commits:** 39 | **LOC Delta:** +10,274 / -2,322
**Timeline:** 2 days (2026-04-16 → 2026-04-17)
**Requirements:** 53/53 satisfied (audit status: `tech_debt` — 13 deferred UAT items batched per `feedback_batch_uat_end_of_milestone`)
**Migrations:** 00033 - 00036

**Key accomplishments:**

1. Student analytics outreach KPI re-split — migration 00033 replaces buggy combined `total_emails = SUM(brands + influencers)` with two independent aggregates `total_brand_outreach` and `total_influencer_outreach`; KPI cards relabeled on both `/student/analytics` and `/student_diy/analytics`; DIY hide-guard removed so DIY students see the new cards; `student-analytics-v2` cache-key bump atomic with the breaking RPC change (Phase 61)
2. Coach `tech_setup` alert activated at roadmap Step 4 "Set Up Your Agency" — migration 00034 rewrites `get_coach_milestones` CTE from placeholder `step_number=0` to `4`, backfills `alert_dismissals` for every historical Step-4 completion (zero retroactive flood, per-coach ASSERT verified), `techSetupEnabled=true` + `techSetupStep=4` + UI label flipped; internal type key `tech_setup` preserved across RPC, dismissal-key prefix, and config keys (Phase 62)
3. DIY students viewable on owner detail page — `/owner/students/[studentId]` and `/owner/students` role filter broadened from `.eq("role","student")` to `.in("role",["student","student_diy"])`; DIY badge added to list page (ima-info variant, no layout shift); `role` prop threaded through detail client + tabs + CalendarTab; daily-report indicators and KpiSummary report rows suppressed for DIY via inline conditional rendering; zero parallel route tree, zero per-role sub-component, zero migrations (Phase 63)
4. Owner analytics expansion — 3 new coach leaderboards (revenue, avg total outreach/student/day, deals) plus per-leaderboard Weekly/Monthly/Yearly/All Time window selectors on all 6 leaderboards (3 student + 3 coach); migration 00035 expands `get_owner_analytics` to 24 pre-computed slots in one jsonb payload; new `SegmentedControl` UI primitive (radiogroup + radio + arrow-key nav + 44px + ima-* tokens); `OwnerAnalyticsClient` swaps pre-computed slices on toggle with zero client re-fetch; `owner-analytics-v2` cache-key bump atomic with migration (Phase 64)
5. Owner alerts pruned to `deal_closed` only — `/owner/alerts` rewritten to emit one info alert per deal (title=student name, message=`Closed a $X,XXX deal`, key=`deal_closed:{deal_id}`, 30-day trailing window, links to `/owner/students/{id}`); 4 legacy alert types (`student_inactive`, `student_dropoff`, `unreviewed_reports`, `coach_underperforming`) silently removed; migration 00036 rewrites OWNER branch of `get_sidebar_badges` so sidebar badge stays in sync; COACH + STUDENT branches preserved byte-for-byte; `sidebar-badges-v2` cache-key bump atomic with migration; `/api/alerts/dismiss` and `alert_dismissals` table reused verbatim (Phase 65)
6. Closed v1.6 deferred `ownerAnalyticsTag()` invariant — `/api/reports` now calls `revalidateTag(ownerAnalyticsTag(), "default")` on both update-existing and insert-new branches (fixed the 60s-staleness on coach leaderboard #2 after report submission)

**Tech Debt (non-blocking):**

- 13 live-environment UAT smoke checks across phases 61, 62, 63, 65 — policy-accepted via `feedback_batch_uat_end_of_milestone`
- Nyquist VALIDATION.md: 0 compliant, 1 partial (Phase 61 draft), 4 missing (62, 63, 64, 65); also backfill for v1.5 phases 44-52 still carry-over
- Four pre-existing lint warnings remain across the codebase (not introduced in v1.8)
- NOTIF-01 Tech/Email Setup activation is closed by Phase 62; other v1.7 carry-overs (IN-01/IN-02, AI chat iframe URL) remain

**Archives:**

- [v1.8 Roadmap](milestones/v1.8-ROADMAP.md)
- [v1.8 Requirements](milestones/v1.8-REQUIREMENTS.md)
- [v1.8 Audit](milestones/v1.8-MILESTONE-AUDIT.md)

---

## v1.7 Student Referral Links (Rebrandly Integration) (Shipped: 2026-04-16)

**Phases completed:** 3 phases, 4 plans, 8 tasks

**Key accomplishments:**

- Additive Postgres migration (00031) adds `referral_code varchar(12)` + `referral_short_url text` to `public.users`, backfills every existing student/student_diy row with a deterministic 8-char upper-hex code via `upper(substr(md5(id::text), 1, 8))`, enforces uniqueness via a partial UNIQUE index, and documents `REBRANDLY_API_KEY=` onboarding for Phase 59.
- Migration 00031 applied to the linked remote Supabase project (uzfzoxfakxmsbttelhnr); all 7 in-DB ASSERTs passed, Q1/Q2/Q3 verification queries returned expected shape (5 student + 2 student_diy backfilled, 4 owner + 10 coach untouched, 7/7 unique codes), and the combined CFG-02 gate `npm run lint && npx tsc --noEmit && npm run build` exits 0 after a single Rule 3 auto-fix to the eslint ignore list.
- Idempotent POST /api/referral-link route (8-step pipeline + Rebrandly v1 integration) + 9-case CommonJS smoke runner; CFG-02 combined build gate green with /api/referral-link registered as a dynamic App Router route handler. At-most-one Rebrandly call per user for life via referral_short_url cache-hit + compare-and-swap persist.

---

## v1.5 Analytics Pages, Coach Dashboard & Deal Logging (Shipped: 2026-04-15)

**Phases completed:** 10 phases (44-53), 16 plans
**Files modified:** 151 | **Commits:** 93
**Timeline:** 3 days (2026-04-13 → 2026-04-15)
**Requirements:** 53/54 satisfied (NOTIF-01 deferred pending D-06 stakeholder decision)

**Key accomplishments:**

1. Analytics RPC foundation — `week_start()` and `student_activity_status()` helpers, three hot-path indexes (deals by student+created, work_sessions completed by student+date, roadmap_progress by student+status), and the shared `ACTIVITY` config (Phase 44)
2. Student Analytics page at `/student/analytics` + `/student_diy/analytics` — six KPI cards, Outreach + Hours Recharts line/bar charts, roadmap deadline status, paginated deal history, all served by a single `get_student_analytics` batch RPC with 60s `unstable_cache` (Phase 46)
3. Coach homepage stats — four KPI cards (deals, revenue, avg roadmap step, emails), recent submissions card, top-3 weekly hours leaderboard, all powered by one `get_coach_dashboard` batch RPC (Phase 47)
4. Full Coach Analytics page — leaderboards, 12-week deal trend chart, active/inactive student split, paginated searchable student list, and rate-limited CSV export (Phases 48 + 53-02)
5. Coach & Owner deal logging — `deals.logged_by` migration with dual-layer authorization (route handler + RLS), `deals_set_audit` trigger, Add Deal modal on both coach and owner deals tabs with attribution chip in student view (Phases 45 + 49)
6. Milestone notifications system — `MILESTONES` / `MILESTONE_CONFIG` constants with `tech_setup` feature flag, `get_coach_milestones` RPC for 4 new alert types, backfill migration pre-dismissing historical qualifying events, and the `/coach/alerts` grouped feed with single + bulk dismiss and 9+ sidebar badge cap (Phases 50, 51, 52)
7. v1.5 gap closure — work-sessions PATCH now invalidates coach dashboard + analytics tags on completion (fixes 60s leaderboard staleness), coach CSV export gated at 30 req/min, orphaned deal tag cleanup, and REQUIREMENTS.md traceability backfill with clean `lint && tsc && build` gate (Phase 53)

**Tech Debt (non-blocking):**

- NOTIF-01 "Tech/Email Setup Finished" pending D-06 Monday stakeholder meeting — config shipped behind `techSetupEnabled` feature flag (Phase 50), must forward `p_tech_setup_enabled=true` to `get_sidebar_badges` on activation
- No Nyquist `VALIDATION.md` for any of the 9 shipped phases (44-52) — test-coverage audit deferred to v1.6; `workflow.nyquist_validation: true` was set but never executed
- `student_activity_status('active')` branch not exercised in automated tests (exercised transitively by Phase 46+, but needs real seed data for direct coverage)
- Dual-layer HTTP+RLS E2E tests for Phase 45 documented as recipes, not automated (requires multi-user JWT test harness)
- Live `/student/analytics` + `/student_diy/analytics` smoke tests pending deployment
- Abu Lahya AI chat iframe URL still outstanding (carried from v1.0)

**Archives:**

- [v1.5 Roadmap](milestones/v1.5-ROADMAP.md)
- [v1.5 Requirements](milestones/v1.5-REQUIREMENTS.md)
- [v1.5 Audit](milestones/v1.5-MILESTONE-AUDIT.md)

---

## v1.0 IMA Accelerator V1 (Shipped: 2026-03-18)

**Phases completed:** 12 phases, 38 plans
**Files modified:** 298 | **Lines of code:** 12,742 TypeScript
**Timeline:** 3 days (2026-03-16 → 2026-03-18) | **Commits:** 218
**Requirements:** 37/37 satisfied

**Key accomplishments:**

1. Next.js 16 + Supabase foundation with 6-table schema, RLS policies, Google OAuth, invite-only registration with magic links, and role-based routing via proxy.ts
2. Student work tracker (45-min cycles with pause/resume/abandon), 10-step sequential roadmap with auto-seeding, daily reports with auto-filled hours, AI chat embed (Coming Soon)
3. Coach dashboard with student overview and at-risk flagging, student detail tabs, report review inbox, student invite system, and cohort analytics
4. Owner platform-wide stats, searchable student/coach management, invite system for both roles, coach-student assignments page, and 4-type alert system with dismiss
5. Full UI polish: loading skeletons, error boundaries, empty states, mobile responsive at 375px, 44px touch targets, ima-* design tokens
6. Quality pass: invite architecture rewritten to whitelist model, raw Tailwind tokens replaced with ima-* tokens, response.ok checks added, UTC date bug fixed

**Tech Debt (non-blocking):**

- `types.ts` hand-crafted placeholder (regenerate when Docker running)
- `AI_CONFIG.iframeUrl` empty (awaiting external URL from Abu Lahya)
- Owner stat card labels hardcoded (should source from OWNER_CONFIG)
- No `(dashboard)/loading.tsx` skeleton for layout shell
- `POST /api/auth/signout` dead code (Sidebar uses client SDK)
- 22/37 SUMMARY frontmatter requirements_completed fields incomplete (metadata only)

**Archives:**

- [v1.0 Roadmap](milestones/v1.0-ROADMAP.md)
- [v1.0 Requirements](milestones/v1.0-REQUIREMENTS.md)
- [v1.0 Audit](milestones/v1.0-MILESTONE-AUDIT.md)

---
