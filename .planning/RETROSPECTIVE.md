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

## Milestone: v1.4 — Roles, Chat & Resources

**Shipped:** 2026-04-06
**Phases:** 8 (30-37) | **Plans:** 19 | **Commits:** 143

### What Was Built
- Student_DIY 4th role with reduced feature set, 8-location atomic wiring, dedicated route group
- Skip tracker via get_weekly_skip_counts RPC with warning badges on coach/owner dashboards
- Coach assignments page with full assignment power (same as owner)
- Report comments with upsert pattern, student read-only feedback view
- Polling-based chat system (5s interval) — 1:1 + broadcast, sidebar unread badges, cursor pagination
- Resources tab — Links + Discord WidgetBot iframe + searchable glossary with role-based CRUD
- Invite link max_uses with default 10, usage count display, exhausted badge

### What Worked
- **Wave-based parallel execution** — Phases 32+33+34+37 ran in parallel (Wave 2), and 35+36 in parallel (Wave 3), cutting wall-clock time significantly
- **Foundation-first phase ordering** — Phase 30 (DB migration) and Phase 31 (role wiring) as sequential Wave 1 meant all subsequent phases had the schema and role infrastructure ready
- **Reuse of existing patterns** — Coach assignments reused the owner /api/assignments route (expanded role check), report comments used the v1.2 Phase 23 two-step ownership pattern, chat polling avoided rate limiting on GET endpoints
- **CSS hidden pattern for Discord iframe** — prevented iframe remount on tab switch, preserving Discord session state

### What Was Inefficient
- **Traceability checkbox drift** — 6 of 48 requirements left as "Pending" despite phases completing. Transitions didn't consistently update REQUIREMENTS.md traceability
- **v1.1-v1.3 milestones never formally archived** — MILESTONES.md only had v1.0 entry; v1.1/v1.2/v1.3 stats exist only in PROJECT.md context
- **Phase Details section bloat** — ROADMAP.md grew to 400+ lines with full Phase Details for all milestones; should have been collapsed earlier

### Patterns Established
- **Polling over Realtime for chat** — 5s polling interval avoids Supabase 500 connection limit; adequate for this user count
- **Role expansion checklist** — 8 locations (proxy x2, config x6, DB CHECK) must be updated atomically when adding a role
- **WidgetBot iframe embed** — CSS hidden pattern + CSP frame-src header for Discord integration
- **Upsert for single-row constraints** — report_comments uses ON CONFLICT (report_id) DO UPDATE for single-comment-per-report

### Key Lessons
1. **Traceability needs automation** — manual checkbox updates drift. Phase transitions should auto-update REQUIREMENTS.md traceability status.
2. **Archive milestones promptly** — skipping /gsd-complete-milestone for v1.1-v1.3 created gaps in the historical record. The 2-minute cost of archival is worth the paper trail.
3. **Parallel waves work well for independent features** — 4 parallel phases in Wave 2 had zero conflicts because they touched different API routes and UI components.
4. **Foundation phases unblock everything** — investing in a clean migration (Phase 30) and role wiring (Phase 31) upfront meant zero schema conflicts in 6 downstream phases.

### Cost Observations
- Model mix: ~70% sonnet (execution), ~20% opus (planning/verification), ~10% haiku (research)
- Sessions: ~8 across 2 days
- Notable: Wave-based parallelization was the biggest time saver; chat system (Phase 35) was the most complex at 4 plans

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 218 | 12 | Full GSD workflow: research → plan → execute → verify → audit |
| v1.1 | — | 6 | Feature milestones with schema-first approach |
| v1.2 | — | 6 | Performance/security-focused milestone |
| v1.3 | — | 5 | Smaller focused milestone with config + planner features |
| v1.4 | 143 | 8 | Wave-based parallel execution, foundation-first ordering |

### Cumulative Quality

| Milestone | Requirements | Coverage | Tech Debt Items |
|-----------|-------------|----------|-----------------|
| v1.0 | 37/37 | 100% | 6 (non-blocking) |
| v1.4 | 42/48 | 88% | 6 bookkeeping gaps (features implemented, traceability not updated) |

### Top Lessons (Verified Across Milestones)

1. Audit before completion catches real gaps that code review misses
2. Dependency-driven phase ordering prevents data availability surprises
3. Wave-based parallelization cuts wall-clock time when phases are independent
4. Foundation phases (migration + wiring) unblock all downstream work — invest upfront
5. Archive milestones promptly — gaps in paper trail compound over time
