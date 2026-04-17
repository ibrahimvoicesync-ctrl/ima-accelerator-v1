---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: Analytics Expansion, Notification Pruning & DIY Parity
status: executing
stopped_at: "Completed 61-02-typescript-totals-rename-PLAN.md — StudentAnalyticsTotals renamed in place; tsc intentionally fails at AnalyticsClient.tsx:203,208 for Plan 03 to resolve"
last_updated: "2026-04-17T04:52:50.677Z"
last_activity: 2026-04-17
progress:
  total_phases: 31
  completed_phases: 0
  total_plans: 4
  completed_plans: 2
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Students can track their daily work, follow the roadmap, and submit daily reports that coaches review — the core accountability loop.
**Current focus:** Phase 61 — Student Analytics Re-split (F1)

## Current Position

Phase: 61 (Student Analytics Re-split (F1)) — EXECUTING
Plan: 3 of 4
Status: Ready to execute
Last activity: 2026-04-17

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**v1.0 completed:** 2026-03-18 | 12 phases | 38 plans | 218 commits | 12,742 LOC
**v1.1 completed:** 2026-03-28 | 6 phases | 16 plans
**v1.2 completed:** 2026-03-31 | 6 phases | 18 plans
**v1.3 completed:** 2026-04-03 | 5 phases | 11 plans
**v1.4 completed:** 2026-04-07 | 14 phases (30-37, 40-43) | 30+ plans
**v1.5 completed:** 2026-04-15 | 10 phases (44-53) | 16 plans | 93 commits | 151 files
**v1.6 completed:** 2026-04-15 | 4 phases (54-57) | 14 plans | 35/35 reqs
**v1.7 completed:** 2026-04-16 | 3 phases (58-60) | 4 plans | 19/19 reqs
**v1.8 in progress:** opened 2026-04-16 — 5 phases (61-65) planned, 53 reqs, 4 migrations

## Accumulated Context

### Critical Constraints Carried Into v1.8

- **Hard Rules from CLAUDE.md** apply to every phase: `motion-safe:` on animations, `min-h-[44px]` touch targets, aria-label / htmlFor on inputs, admin client only in API routes, never-swallow errors, `response.ok` checks, `import { z } from "zod"`, ima-* tokens only.
- **Proxy not middleware** — Next.js 16 route guard lives in `src/proxy.ts`.
- **Config is truth** — import roles/nav/roadmap from `src/lib/config.ts`; never hardcode.
- **Migration numbering** — next migration is `00033`. `00032_drop_get_sidebar_badges_legacy_4arg.sql` already applied (v1.7 PGRST203 hotfix, commit 0583d09).
- **Post-phase build gate** — `npm run lint && npx tsc --noEmit && npm run build` exits 0 at every phase boundary.
- **RPC defensive drop pattern** — every migration touching an existing RPC must use `DO $drop$ … pg_get_function_identity_arguments … DROP FUNCTION … (identity_args)` to prevent PGRST203 overload collisions (v1.7 lesson).
- **Breaking RPC → cache-key bump** — every breaking RPC shape change must bump its corresponding `unstable_cache` key in the same commit (prevents 60s TTL rollover SSR crash).

### v1.8 Phase Map

- **Phase 61 — Student Analytics Re-split (F1 standalone)**: SA-01..09 → 9 reqs. Migration 00033 (breaking `get_student_analytics`). Ambiguity: SA-07 DIY KPI visibility (default: show).
- **Phase 62 — Coach Alert `tech_setup` Activation (F5 standalone)**: CA-01..07 → 7 reqs. Migration 00034 (rewrite RPC CTE from `step_number=0` placeholder to `4`, backfill `alert_dismissals` for historical completions). No open ambiguities.
- **Phase 63 — DIY Owner Detail Page (F6 standalone)**: DIY-01..10 → 10 reqs. Zero migrations, zero RPC changes — pure routing + UI. Ambiguities: DIY-05 Reports-tab wording (interpret as CalendarTab + StudentKpiSummary suppression), DIY-08 coach-route scope (owner-only).
- **Phase 64 — Owner Analytics Expansion (F2 + F3 MUST bundle)**: OA-01..08, WS-01..10 → 18 reqs. Migration 00035 (expand `get_owner_analytics` to 24 slots). New `SegmentedControl.tsx` primitive. Must add `ownerAnalyticsTag()` invalidation to `/api/reports`. Ambiguity: WS-02 trailing-N-days vs calendar window semantics (recommend trailing).
- **Phase 65 — Owner Alerts Prune to `deal_closed` Only (F4)**: OAL-01..09 → 9 reqs. Migration 00036 (rewrite `get_sidebar_badges` OWNER branch). Ambiguity: OAL-09 feed TTL (unbounded vs 30-day filter).

**F1/F5/F6 split rationale:** Each is ≤10 reqs with a narrow, self-contained blast radius (F1 = student analytics subsystem, F5 = coach alerts subsystem, F6 = owner-student-routing). Splitting them isolates failure domains in autonomous mode — a stuck or failing phase doesn't block the other two's shippability.

### Coverage

53 / 53 v1.8 requirements mapped. No orphans. No cross-phase duplicates.

### Open Ambiguities (resolve in `/gsd-discuss-phase`, not execution)

1. **SA-07 / F1 DIY KPI visibility** — `AnalyticsClient.tsx:198` currently hides brand/influencer KPIs for `student_diy`. Default v1.8 intent: show renamed cards to DIY. Resolve before Phase 61 build.
2. **DIY-05 / F6 "Reports tab" wording** — `StudentDetailTabs.TabKey` is `"calendar" | "roadmap" | "deals"` (no top-level Reports tab). Interpret as CalendarTab report-dot suppression + StudentKpiSummary report-row suppression. Resolve before Phase 61 build.
3. **DIY-08 / F6 coach route scope** — owner-only for v1.8. Confirm coach route `/coach/students/[studentId]` stays unchanged. Resolve before Phase 61 build.
4. **WS-02 / F3 window semantics** — trailing 7/30/365 days vs calendar week/month/year. Recommend trailing (matches migration 00023:71 precedent). Resolve before Phase 62 build.
5. **OAL-09 / F4 feed TTL** — unbounded deal_closed feed vs 30-day trailing filter. Resolve before Phase 63 build.

### Open Blockers Carried Into v1.8

- **AI chat iframe URL** (v1.0 carry-over; non-blocking).
- **IN-01 / IN-02** dashboard bugs (deferred from v1.7; not v1.8 scope).

### Tech Debt Carried Into v1.8

- No Nyquist VALIDATION.md for v1.5 phases 44-52 (carry-over).
- Per-edit change-log for deal updates deferred (v1.5 D-17).
- Full email notifications pipeline (Resend) still out-of-scope.

## Session Continuity

Last session: 2026-04-17T04:52:50.673Z
Stopped at: Completed 61-02-typescript-totals-rename-PLAN.md — StudentAnalyticsTotals renamed in place; tsc intentionally fails at AnalyticsClient.tsx:203,208 for Plan 03 to resolve
Resume: `/gsd-plan-phase 61`
