---
gsd_state_version: 1.0
milestone: v1.7
last_shipped: v1.6
milestone_name: Student Referral Links (Rebrandly Integration)
status: defining_requirements
stopped_at: v1.7 started — defining requirements
last_updated: "2026-04-15T22:00:00.000Z"
last_activity: 2026-04-15 -- v1.7 milestone kicked off via /gsd-new-milestone
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-15)

**Core value:** Students can track their daily work, follow the roadmap, and submit daily reports that coaches review — the core accountability loop.
**Current focus:** v1.7 Student Referral Links — defining requirements → roadmap

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-15 — Milestone v1.7 started

## Performance Metrics

**v1.0 completed:** 2026-03-18 | 12 phases | 38 plans | 218 commits | 12,742 LOC
**v1.1 completed:** 2026-03-28 | 6 phases | 16 plans
**v1.2 completed:** 2026-03-31 | 6 phases | 18 plans
**v1.3 completed:** 2026-04-03 | 5 phases | 11 plans
**v1.4 completed:** 2026-04-07 | 14 phases (30-37, 40-43) | 30+ plans
**v1.5 completed:** 2026-04-15 | 10 phases (44-53) | 16 plans | 93 commits | 151 files
**v1.6 completed:** 2026-04-15 | 4 phases (54-57) | 14 plans | 35/35 reqs

## Accumulated Context

### Critical Constraints Carried Into v1.7

- **Hard Rules from CLAUDE.md** apply to every phase: `motion-safe:` on animations, `min-h-[44px]` touch targets, aria-label / htmlFor on inputs, admin client only in API routes, never-swallow errors, `response.ok` checks, `import { z } from "zod"` (not `"zod/v4"`), ima-* tokens only (never hardcoded hex/gray).
- **Proxy not middleware** — Next.js 16 route guard lives in `src/proxy.ts`.
- **Config is truth** — import roles/nav/roadmap from `src/lib/config.ts`; never hardcode.
- **Auth pattern** — `getSessionUser()` + `requireRole()` from `src/lib/session.ts` on every protected route.
- **Migration numbering** — next migration is `00031`.
- **Filter by user ID** in queries, never rely on RLS alone (defense in depth).

### v1.7-Specific Invariants

- **Idempotent API**: `POST /api/referral-link` must return the same `shortUrl` on every subsequent call — DB cache check before Rebrandly call is non-negotiable.
- **Rebrandly-only scope**: no custom domain, no webhook, no click tracking ingestion.
- **Role gate**: only `student` + `student_diy` can generate links. Owner/coach calling this endpoint returns 403.
- **Fail-soft**: missing `REBRANDLY_API_KEY` must return 500 with clear `console.error`, never crash the dashboard.

### Open Blockers Carried Into v1.7

- **D-06**: "Tech/Email Setup Finished" roadmap step pending stakeholder decision. NOTIF-01 stays behind `techSetupEnabled` feature flag. Not v1.7 scope.
- **AI chat iframe URL** (v1.0 carry-over; non-blocking).

### Tech Debt Carried Into v1.7

- No Nyquist VALIDATION.md for v1.5 phases 44-52.
- `student_activity_status('active')` branch lacks direct test coverage.
- Per-edit change-log for deal updates deferred (v1.5 D-17).
- Full email notifications pipeline (Resend) still out-of-scope.

## Session Continuity

Last session: 2026-04-15 — v1.6 audit passed, tag `v1.6` created locally
Stopped at: v1.7 requirements definition
Resume: after requirements + roadmap commit, `/gsd-discuss-phase 58` or `/gsd-plan-phase 58`
