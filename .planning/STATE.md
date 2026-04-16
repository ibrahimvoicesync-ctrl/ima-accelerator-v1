---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: Analytics Expansion, Notification Pruning & DIY Parity
status: defining_requirements
stopped_at: Milestone v1.8 opened — defining requirements
last_updated: "2026-04-16T00:00:00.000Z"
last_activity: 2026-04-16
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Students can track their daily work, follow the roadmap, and submit daily reports that coaches review — the core accountability loop.
**Current focus:** Milestone v1.8 — defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-16 — Milestone v1.8 started

## Performance Metrics

**v1.0 completed:** 2026-03-18 | 12 phases | 38 plans | 218 commits | 12,742 LOC
**v1.1 completed:** 2026-03-28 | 6 phases | 16 plans
**v1.2 completed:** 2026-03-31 | 6 phases | 18 plans
**v1.3 completed:** 2026-04-03 | 5 phases | 11 plans
**v1.4 completed:** 2026-04-07 | 14 phases (30-37, 40-43) | 30+ plans
**v1.5 completed:** 2026-04-15 | 10 phases (44-53) | 16 plans | 93 commits | 151 files
**v1.6 completed:** 2026-04-15 | 4 phases (54-57) | 14 plans | 35/35 reqs
**v1.7 completed:** 2026-04-16 | 3 phases (58-60) | 4 plans | 19/19 reqs
**v1.8 in progress:** opened 2026-04-16 — defining requirements

## Accumulated Context

### Critical Constraints Carried Into v1.8

- **Hard Rules from CLAUDE.md** apply to every phase: `motion-safe:` on animations, `min-h-[44px]` touch targets, aria-label / htmlFor on inputs, admin client only in API routes, never-swallow errors, `response.ok` checks, `import { z } from "zod"` (not `"zod/v4"`), ima-* tokens only (never hardcoded hex/gray).
- **Proxy not middleware** — Next.js 16 route guard lives in `src/proxy.ts`.
- **Config is truth** — import roles/nav/roadmap from `src/lib/config.ts`; never hardcode.
- **Auth pattern** — `getSessionUser()` + `requireRole()` from `src/lib/session.ts` on every protected route.
- **Migration numbering** — next migration is `00032` (00031_referral_links applied 2026-04-16 in Phase 58).
- **Filter by user ID** in queries, never rely on RLS alone (defense in depth).
- **Post-phase build gate** — `npm run lint && npx tsc --noEmit && npm run build` exits 0 at every phase boundary.

### v1.8 Feature Map (6 feature blocks — phasing TBD by roadmapper)

- **Feature 1 — Student Analytics Outreach KPI rename + re-split** (breaking RPC change on `get_student_analytics`; migration 00032)
- **Feature 2 — Owner Analytics Coach Performance leaderboards** (3 new coach leaderboards on `/owner/analytics`)
- **Feature 3 — Per-leaderboard time-window selector** (Weekly/Monthly/Yearly/All Time on all 6 leaderboards; single RPC pre-computes 24 slots)
- **Feature 4 — Owner Alerts prune to `deal_closed` only** (remove 4 alert types; reuse `alert_dismissals`)
- **Feature 5 — Coach Alerts `tech_setup` activation** (label → "Set Up Your Agency", step 4, flag on; internal key preserved)
- **Feature 6 — student_diy Owner Detail Page** (extend existing route; hide Reports tab; Calendar hours-only; owner-only scope)

### v1.8-Specific Invariants

- **Feature 1 is a breaking RPC change**: all `total_emails` / `total_influencers` consumers must be updated in the same milestone; bump `unstable_cache` key or SSR will crash on first post-deploy render.
- **Feature 3 caching**: a single `get_owner_analytics` call returns all 24 leaderboard slots (6 leaderboards × 4 windows); window selectors toggle client-side which slice renders — no re-fetch per selector change.
- **Feature 5 key preservation**: do NOT rename `tech_setup` internal `CoachAlertFeedType`, `techSetupStep`/`techSetupEnabled` config keys, or `milestone_tech_setup:%` dismissal key prefix. Label change is UI-only via `MILESTONE_META["tech_setup"].label`.
- **Feature 6 scope lock**: extend `/owner/students/[studentId]` to handle DIY via `.in("role", ["student","student_diy"])`. Do NOT create a parallel route tree. Coach route `(coach)/students/[studentId]` NOT touched (owner-only for this milestone).
- **Cache invalidation**: deal mutations already call `revalidateTag(ownerAnalyticsTag())` — verify with expanded payload. Owner alerts page: deal creation must trigger cache invalidation OR page stays dynamic.

### Open Ambiguities (resolve in `/gsd-discuss-phase`, not execution)

1. **F2 metric #2** — "avg email count" interpreted as "avg brand outreach per student per day in window". Confirm or propose alternative.
2. **F3 window semantics** — trailing 7/30/365 days vs calendar week/month/year. Trailing recommended (matches existing `created_at` indexes).
3. **F6 coach route scope** — DIY students appear in owner detail view only this milestone. Confirm coach route stays excluded.

### Open Blockers Carried Into v1.8

- **D-06**: NOTIF-01 Tech/Email Setup decision — Feature 5 supersedes this (activates with step 4, label "Set Up Your Agency").
- **AI chat iframe URL** (v1.0 carry-over; non-blocking).
- **IN-01 / IN-02** dashboard bugs (deferred from v1.7; not v1.8 scope).

### Tech Debt Carried Into v1.8

- No Nyquist VALIDATION.md for v1.5 phases 44-52 (carry-over).
- `student_activity_status('active')` branch lacks direct test coverage.
- Per-edit change-log for deal updates deferred (v1.5 D-17).
- Full email notifications pipeline (Resend) still out-of-scope.

## Session Continuity

Last session: 2026-04-16
Stopped at: Milestone v1.8 opened — defining requirements
Resume: `/gsd-plan-phase [N]` once roadmap is created
