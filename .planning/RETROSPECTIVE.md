# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — IMA Accelerator V1

**Shipped:** 2026-03-18
**Phases:** 12 | **Plans:** 38 | **Commits:** 218

### What Was Built
- Three-role coaching platform (owner, coach, student) with full accountability loop
- Student work tracker (45-min cycles), 10-step roadmap, daily reports with auto-filled hours
- Coach dashboard with student views, report review inbox, invites, and analytics
- Owner stats dashboard, people management, invite system, assignments, and alert system
- Full UI polish: skeletons, error boundaries, empty states, mobile responsive, 44px touch targets
- Quality pass: whitelist invite model, ima-* token compliance, response.ok checks, UTC date fix

### What Worked
- **Dependency-driven phase order** — building student features first (data producers), then coach (data consumers), then owner (aggregators) meant each phase had real data to work with
- **Clean rebuild approach** — starting fresh from reference-old/ rather than migrating avoided inherited complexity; 3-day build for entire platform
- **Server components by default** — async pages with createAdminClient() kept client bundles small and data fetching simple
- **Config as truth (lib/config.ts)** — single source for roles, nav, roadmap steps, thresholds eliminated hardcoding across 298 files
- **UAT gap closure plans** — phases 7-04, 8-04, 9-04, 9-05 caught real issues (filter tab state, missing email, false-positive alerts) that wouldn't surface in unit tests
- **Milestone audit before completion** — caught the invite URL architecture gap that became Phase 11 and raw token debt that became Phase 12

### What Was Inefficient
- **ROADMAP.md checkbox drift** — some phase checkboxes (Phase 2, 5) not checked in roadmap despite being complete; required manual fixes
- **SUMMARY frontmatter incomplete** — 22/37 requirements not recorded in SUMMARY.md frontmatter requirements_completed field; metadata-only gap but caused audit noise
- **Phase 10 scope creep** — UI polish touched 63 files across 4 plans; could have been scoped tighter per-role

### Patterns Established
- **Email whitelist invite model** — invites are email whitelists, not link generators; auth callback auto-registers
- **ima-* design tokens** — all colors via CSS custom properties, no raw Tailwind colors
- **Defense-in-depth auth** — proxy.ts → layout.tsx → page.tsx → API route, each layer checks independently
- **Server-side user ID filtering** — never rely on RLS alone; always filter by user_id in queries
- **motion-safe: prefix** — all animate-* classes wrapped in motion-safe: for accessibility
- **Time-windowed alert keys** — dismissed alerts re-trigger in new windows (daily/weekly/monthly)

### Key Lessons
1. **Audit before milestone completion** — the v1.0 audit caught 2 critical gaps (invite URLs, raw tokens) that became dedicated fix phases. Without the audit, v1.0 would have shipped with broken invite flows.
2. **Whitelist model > link generation** — generating registration URLs creates a fragile coupling between API responses and frontend routes. Whitelist + auto-registration is simpler and more robust.
3. **UAT on every phase with UI** — conversational UAT caught issues (filter tab stale state, missing email display, false-positive alerts) that code review alone missed.
4. **Reference codebase accelerates rebuild** — having reference-old/ for visual patterns and component structure made UI development 2-3x faster than from scratch.

### Cost Observations
- Model mix: ~80% sonnet (execution), ~15% opus (planning/verification), ~5% haiku (research)
- Sessions: ~15 across 3 days
- Notable: Parallel plan execution within phases significantly reduced wall-clock time

---

## Milestone: v1.5 — Analytics Pages, Coach Dashboard & Deal Logging

**Shipped:** 2026-04-15
**Phases:** 10 (44-53) | **Plans:** 16 | **Commits:** 93 | **Files:** 151

### What Was Built
- Analytics RPC foundation: `week_start()` / `student_activity_status()` helpers, three hot-path indexes, `ACTIVITY` config (Phase 44)
- Student Analytics page (`/student/analytics` + `/student_diy/analytics`) with 6 KPI cards, Recharts trends, roadmap deadline list, paginated deal history — one `get_student_analytics` batch RPC behind `unstable_cache` (Phase 46)
- Coach Dashboard Homepage (`/coach`): 4 KPI cards, recent submissions, top-3 weekly hours leaderboard — one `get_coach_dashboard` batch RPC (Phase 47)
- Full Coach Analytics (`/coach/analytics`): leaderboards, 12-week deal trend, active/inactive split, paginated searchable student list, rate-limited CSV export (Phases 48 + 53-02)
- `deals.logged_by` dual-layer authorization (route handler + RLS) with `deals_set_audit` trigger + Add Deal UI on coach and owner tabs with attribution chip (Phases 45, 49)
- Milestone notifications: `MILESTONES` / `MILESTONE_CONFIG` constants, `get_coach_milestones` RPC, historical backfill pre-dismissal, `/coach/alerts` grouped feed with bulk-dismiss and 9+ badge cap (Phases 50-52)
- v1.5 gap closure (Phase 53): work-sessions PATCH coach-tag cache bust, CSV rate limit, orphaned tag cleanup, REQUIREMENTS.md traceability backfill, clean `lint && tsc && build` gate

### What Worked
- **Batch RPC pattern** — one `get_*_dashboard`/`get_*_analytics` RPC per page instead of N fan-out RPCs kept `.from()` calls out of server components and collapsed auth+aggregation into a single round-trip
- **Dual-layer authorization for deals** — route-handler coach-assignment check + RLS `WITH CHECK` made coach-logs-unassigned-student a hard 403 at two independent layers
- **Milestone audit surfaced the gap** — v1.5-MILESTONE-AUDIT.md flagged the work-sessions PATCH coach-tag miss before close; Phase 53 closed it cleanly as explicit gap-closure scope rather than drifting tech debt
- **Pre-dismissal backfill for notifications** — migration 00027 pre-dismissed all historical qualifying events, avoiding the "every coach floods with 100+ alerts on rollout" failure mode
- **`p_today date` parameter threading** — passing today as a parameter to every analytics RPC (vs. `CURRENT_DATE` in function body) eliminated timezone drift across week bucketing

### What Was Inefficient
- **Nyquist never ran** — `workflow.nyquist_validation: true` was enabled but `/gsd-validate-phase` was skipped on all 9 core phases (44-52); test-coverage gap visible only at milestone audit
- **ROADMAP checkboxes stale again** — phases 44-49 and 51 shipped without their roadmap checkboxes being ticked; same bookkeeping lag as v1.0 Phases 2 and 5
- **REQUIREMENTS.md traceability drift** — 44 requirements showed `[ ]` post-execution despite shipping; Phase 53-04 had to reconcile retroactively
- **Orphaned cache tag** — `revalidateTag("deals-${studentId}")` fired on deals POST but nothing consumed it (student deals pages direct-fetch); dead work for weeks until audit caught it
- **Stats extraction broken at milestone close** — `gsd-tools milestone complete` produced garbage accomplishments ("External services require manual configuration:", "Status:") because it searched for one-liners in non-standard positions; required manual rewrite

### Patterns Established
- **SECURITY DEFINER STABLE + `(SELECT auth.uid())` + `RAISE 'not_authorized'` first statement** — canonical RPC auth pattern for v1.5+, reused identically across `get_student_analytics`, `get_coach_dashboard`, `get_coach_analytics`
- **Cache-tag triple** on every page backed by an aggregation RPC: `unstable_cache` read + `revalidateTag` on every mutation route that touches the underlying tables + tag scoped to the user (`coachDashboardTag(coachId)`)
- **Audit-trigger GUC pattern** — `current_setting('app.current_user_id', true)` in BEFORE INSERT/UPDATE triggers for `updated_by` stamping; transaction-local, auto-reset, no session state leak
- **One-shot alert keys scoped correctly** — `milestone_closed_deal:{student_id}:{deal_id}` for per-deal fires, `(student, milestone)` not `(student, milestone, coach)` for one-shots (avoids double-fire on coach reassignment)
- **Post-phase build gate (D-12)** — `npm run lint && npx tsc --noEmit && npm run build` enforced every phase; caught 4 pre-existing lint errors during Phase 53-04 cleanup

### Key Lessons
1. **Run Nyquist validation as phases ship, not at milestone close.** Skipping `/gsd-validate-phase` on 9 phases left a test-coverage audit gap that became tech debt carrying into v1.6. Enable it as a gate, not a suggestion.
2. **Audit catches what verification misses.** Phase-level `VERIFICATION.md` passed 9/9 — the work-sessions PATCH coach-tag miss only surfaced at the cross-phase integration audit. Milestone audit is not redundant with phase verification.
3. **Revalidate tags only where they are consumed.** The orphaned `deals-${studentId}` tag was dead work. Pair every `revalidateTag` with a grep for the consumer (`unstable_cache({ tags: [...] })`); if nothing consumes it, delete the call.
4. **Batch RPC beats RPC fan-out at scale.** Four stat cards → four RPCs would hit each card's auth check four times. One `get_coach_dashboard` with a JSONB envelope kept server latency flat.
5. **Pre-dismiss historical notifications before any notification migration ships.** Without the backfill, every coach's first page-load on rollout would surface dozens of "new" alerts for events months in the past.

### Cost Observations
- Model mix: ~75% sonnet (execution + UAT), ~20% opus (planning + audit), ~5% haiku
- Sessions: ~12 across 3 days
- Notable: Phase 46-49 parallelism (waves 3-4) cut wall-clock in half vs sequential; Phase 53 as explicit gap-closure scope (rather than drifting) made the audit → fix → ship loop clean

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 218 | 12 | Full GSD workflow: research → plan → execute → verify → audit |
| v1.5 | 93 | 10 | Milestone-audit → gap-closure phase (53) as first-class artifact |

### Cumulative Quality

| Milestone | Requirements | Coverage | Tech Debt Items |
|-----------|-------------|----------|-----------------|
| v1.0 | 37/37 | 100% | 6 (non-blocking) |
| v1.5 | 53/54 | 98% (NOTIF-01 deferred on D-06) | 5 (non-blocking; Nyquist + E2E harness dominant) |

### Top Lessons (Verified Across Milestones)

1. Audit before completion catches real gaps that code review misses (v1.0: invite URLs, raw tokens → Phase 11/12; v1.5: work-sessions coach-tag miss → Phase 53)
2. Dependency-driven phase ordering prevents data availability surprises
3. ROADMAP/REQUIREMENTS checkbox drift is a recurring bookkeeping lag — automate or reconcile at milestone close
4. `gsd-tools milestone complete` accomplishment extraction is unreliable; always review and rewrite the generated MILESTONES.md entry
