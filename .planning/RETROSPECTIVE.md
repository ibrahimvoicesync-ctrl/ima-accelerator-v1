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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 218 | 12 | Full GSD workflow: research → plan → execute → verify → audit |

### Cumulative Quality

| Milestone | Requirements | Coverage | Tech Debt Items |
|-----------|-------------|----------|-----------------|
| v1.0 | 37/37 | 100% | 6 (non-blocking) |

### Top Lessons (Verified Across Milestones)

1. Audit before completion catches real gaps that code review misses
2. Dependency-driven phase ordering prevents data availability surprises
