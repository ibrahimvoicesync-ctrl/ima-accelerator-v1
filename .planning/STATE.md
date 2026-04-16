---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Student Referral Links (Rebrandly Integration)
status: executing
stopped_at: Completed 59-01-PLAN.md; Phase 59 executed; ready for verify-work + Phase 60
last_updated: "2026-04-16T05:09:31Z"
last_activity: 2026-04-16 -- Phase 59 Plan 01 executed (route + smoke runner + CFG-02 gate green)
progress:
  total_phases: 26
  completed_phases: 2
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-15)

**Core value:** Students can track their daily work, follow the roadmap, and submit daily reports that coaches review — the core accountability loop.
**Current focus:** Phase 59 executed — ready for /gsd-verify-work + Phase 60 (ReferralCard UI)

## Current Position

Phase: 59
Plan: 01 executed
Status: Ready for verify-work, then Phase 60
Last activity: 2026-04-16 -- Phase 59 Plan 01 executed (route + smoke runner + CFG-02 gate green in 26s)

## Performance Metrics

**v1.0 completed:** 2026-03-18 | 12 phases | 38 plans | 218 commits | 12,742 LOC
**v1.1 completed:** 2026-03-28 | 6 phases | 16 plans
**v1.2 completed:** 2026-03-31 | 6 phases | 18 plans
**v1.3 completed:** 2026-04-03 | 5 phases | 11 plans
**v1.4 completed:** 2026-04-07 | 14 phases (30-37, 40-43) | 30+ plans
**v1.5 completed:** 2026-04-15 | 10 phases (44-53) | 16 plans | 93 commits | 151 files
**v1.6 completed:** 2026-04-15 | 4 phases (54-57) | 14 plans | 35/35 reqs
**v1.7 in progress:** Phase 58 closed 2026-04-16 (2 plans); Phase 59 executed 2026-04-16 (1 plan, 3 commits c9288b1 + 20053ec + bd918f4, ~5min, CFG-02 gate 26s, 9/9 requirements API-01..08 + CFG-02 coded)

## Accumulated Context

### Critical Constraints Carried Into v1.7

- **Hard Rules from CLAUDE.md** apply to every phase: `motion-safe:` on animations, `min-h-[44px]` touch targets, aria-label / htmlFor on inputs, admin client only in API routes, never-swallow errors, `response.ok` checks, `import { z } from "zod"` (not `"zod/v4"`), ima-* tokens only (never hardcoded hex/gray).
- **Proxy not middleware** — Next.js 16 route guard lives in `src/proxy.ts`.
- **Config is truth** — import roles/nav/roadmap from `src/lib/config.ts`; never hardcode.
- **Auth pattern** — `getSessionUser()` + `requireRole()` from `src/lib/session.ts` on every protected route.
- **Migration numbering** — next migration is `00032` (00031_referral_links applied 2026-04-16 in Phase 58).
- **Filter by user ID** in queries, never rely on RLS alone (defense in depth).

### v1.7-Specific Invariants

- **Idempotent API**: `POST /api/referral-link` must return the same `shortUrl` on every subsequent call — DB cache check before Rebrandly call is non-negotiable.
- **Rebrandly-only scope**: no custom domain, no webhook, no click tracking ingestion.
- **Role gate**: only `student` + `student_diy` can generate links. Owner/coach calling this endpoint returns 403.
- **Fail-soft**: missing `REBRANDLY_API_KEY` must return 500 with clear `console.error`, never crash the dashboard.
- **Post-phase build gate (CFG-02)**: `npm run lint && npx tsc --noEmit && npm run build` exits 0 at every phase boundary.

### v1.7 Phase Map (3 phases)

- **Phase 58 — Schema & Backfill**: DB-01, DB-02, DB-03, CFG-01, CFG-02
- **Phase 59 — Referral API + Rebrandly**: API-01..08, CFG-02
- **Phase 60 — ReferralCard UI & Dashboard Integration**: UI-01..06, INT-01, INT-02, CFG-02

### Open Blockers Carried Into v1.7

- **D-06**: "Tech/Email Setup Finished" roadmap step pending stakeholder decision. NOTIF-01 stays behind `techSetupEnabled` feature flag. Not v1.7 scope.
- **AI chat iframe URL** (v1.0 carry-over; non-blocking).

### Tech Debt Carried Into v1.7

- No Nyquist VALIDATION.md for v1.5 phases 44-52.
- `student_activity_status('active')` branch lacks direct test coverage.
- Per-edit change-log for deal updates deferred (v1.5 D-17).
- Full email notifications pipeline (Resend) still out-of-scope.

## Session Continuity

Last session: 2026-04-16T05:09:31Z
Stopped at: Completed 59-01-PLAN.md; Phase 59 executed; CFG-02 gate green; ready for /gsd-verify-work + Phase 60
Resume: `/gsd-verify-work 59` or `/gsd-discuss-phase 60`
