# Project Research Summary

**Project:** IMA Accelerator v1.3
**Domain:** Student performance & coaching platform — halal influencer marketing mentorship
**Researched:** 2026-03-31
**Confidence:** HIGH

## Executive Summary

IMA Accelerator v1.3 adds four feature groups to an already-shipped, production platform: roadmap content updates, a coach/owner roadmap undo capability, a daily session planner with a 4-hour work cap, and a post-plan motivational completion card with ad-hoc session access. All research was conducted against the live codebase, and the central finding is that every v1.3 feature can be built with zero new npm dependencies — the existing stack (Next.js 16, React 19, Supabase, Zod, motion, date-fns, lru-cache) covers every requirement. Two new database tables are required (`daily_plans`, `roadmap_undo_log`), two new API routes, and incremental changes to four existing files.

The recommended approach follows the platform's established patterns without deviation: Server Page + Thin Client for data loading, the CSRF → Auth → Role → RateLimit → Zod → DB mutation chain for all API routes, admin client for every `.from()` query in route handlers, and `src/lib/config.ts` as the single source of truth. The daily session planner is the most complex feature and must be built last because it integrates with `WorkTrackerClient`, depends on the `daily_plans` schema, and its plan-mode UI must not break the existing session state machine. Roadmap config updates and stage headers carry near-zero risk and should be deployed first.

The key risks are all implementation-level, not architectural. The top three: (1) the WorkTracker phase-reset `useEffect` guard must be updated atomically when introducing plan-mode state or the planner UI silently disappears on page refresh; (2) the undo endpoint must cascade and re-lock step N+1 atomically — a single-row UPDATE leaves two concurrent active steps and breaks sequential progression; (3) the 4h cap must be enforced server-side in `POST /api/work-sessions`, not only client-side, or the cap can be bypassed via API. All pitfalls are avoidable with disciplined adherence to existing codebase patterns.

---

## Key Findings

### Recommended Stack

The v1.3 features require no new packages. The entire feature set is covered by libraries already installed. The two new database tables (`daily_plans` with a JSONB `plan_json` column, and `roadmap_undo_log` as an append-only audit table) are pure Supabase/Postgres additions delivered via a single migration file. The `motion` library already installed at ^12.37.0 handles the motivational card entrance animation. Arabic text rendering requires only a `dir="rtl"` attribute — no i18n library.

**Core technologies used in v1.3:**
- `next` 16.1.6: Two new route handlers (`POST/GET /api/daily-plans`, `PATCH /api/roadmap/undo`) using the existing App Router mutation pattern
- `@supabase/supabase-js` ^2.99.2: New table queries via existing admin client; no API changes needed
- `zod` ^4.3.6: Zod `safeParse` on `plan_json` at every read (never TypeScript cast); cap validation in API schema. Import as `import { z } from "zod"` — never `"zod/v4"`
- `motion` ^12.37.0: `AnimatePresence` + `motion.div` for motivational card entrance; `motion-safe:` prefix applies only to CSS `animate-*` classes, not motion prop values
- `lru-cache` ^11.0.0: New routes call existing `checkRateLimit()` unchanged — no changes to the rate limiter itself

**Critical version note:** `lucide-react` ^0.576.0 — icons `CalendarPlus`, `Undo2`, `CheckCircle2` confirmed present in this version for planner and undo UI.

### Expected Features

**Must have (table stakes):**
- Accurate roadmap step descriptions and correct `unlock_url` on step 5 — students read these daily; wrong content breaks guidance
- Stage grouping headers in roadmap views — 15 steps without visual grouping is unnavigable; `stageName` already exists on every config entry, grouping is purely presentational
- Coach/owner undo with confirmation dialog — correction power for coaches without manual DB edits; confirmation required per NN/G standards for irreversible operations; student cannot undo their own steps (accountability is the platform's core value)
- 4h work cap enforced at the API level — plan cap is a core program rule; client-side-only enforcement is bypassable via direct API calls or stale tabs
- Planned sessions executed via existing WorkTracker — no parallel timer UIs; plan stores intent, WorkTracker executes
- Post-plan motivational completion card — after 4h of planned work, the idle "Set Up Session" CTA is inappropriate; a distinct non-dismissable completion state is needed

**Should have (competitive differentiators):**
- Bilingual motivational card (Arabic + English) — Abu Lahya's community is Arabic-speaking; brand resonance and cultural identity
- Undo action audit log — coaches cannot silently revert progress; `roadmap_undo_log` table prevents misuse
- Alternating break types (short/long by session index) — reduces decision friction; matches existing `breakOptions` config
- Ad-hoc session picker after plan completion — blocking extra work is punitive for motivated students; uncapped, reuses existing WorkTracker

**Defer to v2+:**
- Student-editable plan durations — fixed plan is the intended v1.3 UX; mid-plan editing adds cap recalculation complexity
- Streak tracking tied to plan completion — gamification milestone; partial gamification creates a worse UX than none
- Push/in-app notifications for session reminders — no notification system in V1
- Coach visibility of student daily plan tab — useful at scale; defer until multiple students use the planner actively
- Drag-to-reorder sessions — V2+; v1.3 planner uses a fixed ordered list

### Architecture Approach

The platform's architecture is Server Page + Thin Client: async server components fetch all data at render time and pass typed props to a single `"use client"` component per interactive area. No client-side data loading on mount via `useEffect`. All mutations go through API route handlers following the fixed CSRF → Auth → Role → RateLimit → Zod → admin client → DB chain. The daily session planner introduces two new client components (`DailyPlannerClient`, `PlanCompletionCard`) and modifies `WorkTrackerClient` to accept an `initialPlan` prop that gates plan-mode behavior in the idle state. No new phase variants are added to the state machine; a `planMode` derived flag (from `initialPlan !== null`) controls which UI renders in the `idle` state.

**Major components and their v1.3 roles:**
1. `src/lib/config.ts` (modified) — Add `DAILY_PLAN` config block; update `ROADMAP_STEPS` text, `unlock_url`, `target_days`
2. `src/app/api/daily-plans/route.ts` (new) — `POST` create plan with 4h cap Zod validation; `GET` today's plan or null; idempotent POST (returns existing plan on 409 conflict)
3. `src/app/api/roadmap/undo/route.ts` (new) — `PATCH` coach/owner step undo with ownership assertion and N+1 cascade re-lock; inserts to `roadmap_undo_log`
4. `DailyPlannerClient.tsx` (new) — Plan setup wizard; alternating break auto-generation; emits `onPlanCreated` callback triggering `router.refresh()`
5. `PlanCompletionCard.tsx` (new) — Post-plan motivational card; no auto-dismiss; ad-hoc session trigger that re-enters standard WorkTracker setup phase
6. `WorkTrackerClient.tsx` (modified) — Accepts `initialPlan` prop; plan-mode idle state; phase-reset guard updated to preserve plan state
7. `coach/RoadmapTab.tsx` (modified) — Embeds `UndoStepButton` per completed step; no architectural change to RoadmapTab itself
8. `supabase/migrations/00013_v1_3_schema.sql` (new) — `daily_plans` + `roadmap_undo_log` tables with RLS; `UNIQUE(student_id, date)` on daily_plans; UTC date default

### Critical Pitfalls

1. **WorkTracker phase-reset guard not updated for plan-mode** — The `useEffect` that resets phase to `idle` uses an allowlist guard (`phase.kind !== "setup" && phase.kind !== "break"`). Any new derived condition not explicitly exempted causes the planner UI to silently reset on page refresh. Fix: add the plan-aware guard update atomically with modifying `WorkTrackerClient`.

2. **Coach undo as single-row UPDATE leaves two active steps** — Undoing step N without re-locking step N+1 (if N+1 is currently `active` and not yet `completed`) creates two concurrent active steps, breaking the sequential progression invariant. Fix: read step N+1 status before writing step N, then conditionally re-lock N+1 in the same request.

3. **4h cap enforced client-side only** — `POST /api/work-sessions` does not currently check total minutes worked today. Fix: sum `session_minutes` for `(student_id, date)` in in-progress/completed sessions before allowing the insert; return 400 if cap exceeded.

4. **Date mismatch: client local time vs server UTC** — `getToday()` (local) and `getTodayUTC()` (UTC) already coexist in the codebase. Fix: use `getTodayUTC()` everywhere in the planner code path; migration default `DEFAULT CURRENT_DATE` on `daily_plans.date`; never pass client local date as plan identity.

5. **plan_json schema evolution silently breaks existing rows** — JSONB columns have no schema migration path. TypeScript cast gives false confidence; old-shaped rows fail silently at runtime. Fix: include a `version: 1` field in `plan_json`; always use Zod `safeParse` at the data layer; treat parse failure as "no plan today."

---

## Implications for Roadmap

Based on research, the build order is determined by dependency chains: schema and config must precede API routes, which must precede components, which must precede page integration. The ARCHITECTURE.md dependency graph (Phase A → B → C) is well-reasoned and directly translates to roadmap phases.

### Phase 1: Config and Content Updates

**Rationale:** Pure config changes in `src/lib/config.ts` carry near-zero risk and can be deployed standalone before any schema migration. Stage headers are purely presentational and depend only on config values that already exist. Zero database changes.
**Delivers:** Updated roadmap step descriptions, correct `unlock_url` on step 5, step 8 `target_days: 14`, stage grouping headers in both `RoadmapClient` and `RoadmapTab`
**Addresses:** Table-stakes features — accurate roadmap text, visual grouping of 15 steps
**Avoids:** Pitfall 8 — config text updates go live immediately for all students including those mid-step; this is intentional and acceptable, but step numbers must not be renumbered, only text fields updated

### Phase 2: Database Schema Foundation

**Rationale:** Both new tables (`daily_plans`, `roadmap_undo_log`) must exist before any API routes or components that reference them. Schema is independent of all application code and safe to run as a standalone migration.
**Delivers:** `daily_plans` table with `UNIQUE(student_id, date)` and UTC date default; `plan_json` JSONB column; `roadmap_undo_log` append-only audit table; RLS policies for both tables
**Addresses:** Pitfall 4 (UTC date default prevents midnight timezone mismatch), Pitfall 6 (UNIQUE constraint makes plan creation idempotent)
**Avoids:** Deploying API code against a non-existent schema

### Phase 3: Coach/Owner Roadmap Undo

**Rationale:** Self-contained feature with no dependency on the session planner. Depends only on the schema from Phase 2 and the existing `roadmap_progress` table. Building and validating it independently before the higher-complexity planner work provides a clean test of the new API pattern and audit log.
**Delivers:** `PATCH /api/roadmap/undo` route with ownership assertion, N+1 cascade re-lock, and `roadmap_undo_log` insert; `UndoStepButton` component embedded in `RoadmapTab`; confirmation modal reusing existing Modal primitive
**Addresses:** Coach correction power (P1 feature), audit trail for undo actions (differentiator)
**Avoids:** Pitfall 2 (single-row undo leaving two active steps); security mistake (coach undoing steps for unassigned students via `coach_id` ownership check)

### Phase 4: Daily Session Planner — API Layer

**Rationale:** The API (`POST /api/daily-plans`, `GET /api/daily-plans`) must exist before the client components that call it. Server-side cap enforcement in `POST /api/work-sessions` is added here to close the security gap before any UI exposes the planner to students.
**Delivers:** Plan creation API with Zod schema validating `total_work_minutes <= 240`; idempotent POST returning existing plan on 409 conflict; server-side 4h cap enforcement added to existing work sessions endpoint; `DAILY_PLAN` config block in `config.ts`
**Addresses:** P1 features — daily session planner core, 4h cap; Pitfall 3 (server-side cap enforcement)
**Avoids:** Pitfall 5 (Zod `safeParse` on `plan_json` at read time, never TypeScript cast; `version: 1` field in schema)

### Phase 5: Daily Session Planner — Client Integration

**Rationale:** Client components depend on the API being available. `WorkTrackerClient` modification is the highest-risk change in v1.3 — it modifies an existing production state machine. `DailyPlannerClient` and `PlanCompletionCard` are new isolated files and lower risk. The `work/page.tsx` change is additive (one extra parallel fetch).
**Delivers:** `DailyPlannerClient` plan setup wizard with alternating break generation; modified `WorkTrackerClient` with `initialPlan` prop and plan-mode idle state; `PlanCompletionCard` with Arabic/English motivational card (no auto-dismiss) and ad-hoc session trigger; `work/page.tsx` parallel plan fetch via `Promise.all`
**Addresses:** All session planner table-stakes features; post-plan motivational card (differentiator); ad-hoc session access
**Avoids:** Pitfall 1 (phase-reset guard updated atomically with `WorkTrackerClient` changes); Pitfall 7 (Arabic text wrapped in `dir="rtl" lang="ar"` element, not just `text-right`)

### Phase Ordering Rationale

- Config changes deploy with zero risk and deliver immediate user-visible value (correct roadmap text, stage headers) without touching the database.
- Schema migration is a prerequisite for both the undo API and the planner API — running it second keeps the critical path short and the migration isolated.
- Coach undo is isolated from the session planner. Building it third validates the new API pattern, the ownership check, and the audit log before the more complex planner work begins.
- The planner API is split from the client integration because API validation (especially the 4h cap server-side enforcement) is independently testable via curl/Postman before any UI exists.
- Client integration comes last because it carries the highest regression risk (modifying `WorkTrackerClient`, a live production state machine) and must be the final integration step.

### Research Flags

Phases with standard patterns (no additional research needed):
- **Phase 1 (Config):** Pure config edit — established pattern, no unknowns
- **Phase 2 (Schema):** Standard Supabase migration with JSONB and UNIQUE constraint — documented patterns from existing migrations
- **Phase 3 (Undo):** Follows existing mutation chain exactly; only novel element is the N+1 cascade logic, which is completely specified in ARCHITECTURE.md and PITFALLS.md

Phases that benefit from pre-build review before implementation:
- **Phase 4 (Planner API):** The 4h cap enforcement modifies `POST /api/work-sessions`, a route already in production. The Zod schema for `plan_json` (including the `version` field and `safeParse` pattern) should be finalized before writing the API to avoid schema evolution pitfalls later. Confirm the ad-hoc vs planned session cap scoping (see Gaps section).
- **Phase 5 (Client Integration):** The `WorkTrackerClient` phase-reset `useEffect` guard requires careful inspection of the existing dependency array before editing. The `DailyPlannerClient` → `router.refresh()` → server re-render → `WorkTrackerClient` receiving `initialPlan` data flow should be traced through the code before starting implementation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions verified against npm. Zero new dependencies confirmed — all capabilities present in installed versions. Zod v4 import rule verified against official changelog. `lucide-react` icon availability confirmed at 0.576.0. |
| Features | HIGH | Table-stakes and differentiators derive directly from existing platform requirements and Abu Lahya's program spec. Alternating break algorithm is MEDIUM — Pomodoro literature supports it but the specific even/odd index S/L pattern is a reasonable inference, not a documented standard. |
| Architecture | HIGH | Derived from direct codebase inspection of all affected files. Build order validated against actual dependency graph. Anti-patterns name specific existing code paths, not hypothetical scenarios. |
| Pitfalls | HIGH | All 8 critical pitfalls sourced from direct codebase audit of `WorkTrackerClient.tsx`, API route files, and migration history. Specific code paths, fix patterns, and "looks done but isn't" verification steps are documented. |

**Overall confidence:** HIGH

### Gaps to Address

- **Alternating break algorithm confirmation:** The even-index = short, odd-index = long break pattern is inferred from Pomodoro literature and the existing `breakOptions` config. During Phase 5 implementation, confirm with Abu Lahya whether this is the intended pattern or whether the long break should occur at a specific session boundary (e.g., always after session 2 of 4) rather than by parity index.

- **Motivational card content:** The Arabic quote and English translation for `PlanCompletionCard` are not specified in any research file. They must be provided by Abu Lahya before `PlanCompletionCard.tsx` can be finalized. The architecture (static content, `dir="rtl"` span, `lang="ar"`, `AnimatePresence` entrance) is confirmed; only the text content is missing.

- **plan_json version field:** PITFALLS.md recommends a `version: 1` field in `plan_json` for schema evolution safety. ARCHITECTURE.md's schema example omits it. During Phase 2, decide whether to include the version field in the migration and API Zod schema, and document the decision.

- **Ad-hoc session cap scoping:** PITFALLS.md security section states ad-hoc sessions should bypass the 4h plan cap (they are explicitly uncapped per FEATURES.md). However, the server-side cap enforcement added to `POST /api/work-sessions` in Phase 4 applies to all session creation. Resolve before Phase 4: either the cap check is only enforced when a plan exists for the day, or ad-hoc sessions require a distinct request flag that bypasses the cap server-side.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/components/student/WorkTrackerClient.tsx` — phase state machine and guard logic
- Direct codebase inspection: `src/app/api/roadmap/route.ts` — complete/unlock cascade pattern to invert for undo
- Direct codebase inspection: `src/app/api/work-sessions/route.ts` and `[id]/route.ts` — existing mutation chain and cap/state transition patterns
- Direct codebase inspection: `src/lib/config.ts` — WORK_TRACKER, ROADMAP_STEPS, config-as-truth pattern
- Direct codebase inspection: `supabase/migrations/00012_rate_limit_log.sql` — append-only audit table precedent
- Direct codebase inspection: `supabase/migrations/00011_write_path.sql` — JSONB/RPC pattern precedent
- [Zod v4 changelog](https://zod.dev/v4/changelog) — `import { z } from "zod"` confirmed for v4; `"zod/v4"` is a transitional shim only
- [Supabase JSONB docs](https://supabase.com/docs/guides/database/json) — JSONB for variable-length structured data; GIN index not needed for single-row by PK access
- [Motion React docs](https://motion.dev/docs/react) — AnimatePresence, motion.div, React 19 compatibility confirmed at motion 12.x
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — PATCH route handler pattern confirmed

### Secondary (MEDIUM confidence)
- [Confirmation Dialogs — NN/G](https://www.nngroup.com/articles/confirmation-dialog/) — destructive action confirmation requirement
- [Tailwind CSS RTL support](https://ryanschiang.com/tailwindcss-direction-rtl) — `rtl:` variants and `dir` attribute requirement; `text-right` does not set bidi direction
- [Pomodoro Technique — Todoist](https://www.todoist.com/productivity-methods/pomodoro-technique) — alternating break structure basis
- [Goal-Gradient Effect — UI Patterns](https://ui-patterns.com/patterns/Completion) — post-goal motivation drop; motivational card as countermeasure

### Tertiary (LOW confidence — needs validation)
- Alternating break S/L/S pattern for 4-session plans — inferred from Pomodoro literature, needs Abu Lahya confirmation before Phase 5 implementation
- Arabic bilingual card pattern in SaaS products — inferred from common Middle Eastern product practice; specific example not sourced

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
