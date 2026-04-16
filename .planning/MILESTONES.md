# Milestones

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
