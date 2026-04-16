# Project Research Summary

**Project:** IMA Accelerator V1 — Milestone v1.8 (Analytics Expansion, Notification Pruning & DIY Parity)
**Domain:** Subsequent milestone on a shipped Next.js 16 + Supabase student performance platform
**Researched:** 2026-04-16
**Confidence:** HIGH

## Executive Summary

v1.8 is **six surgical feature blocks layered onto the v1.0–v1.7 platform** — no new runtime dependencies, no new domains, and no new third-party libraries. All six blocks sit directly adjacent to shipped code paths (Phase 46 student analytics, Phase 51 coach milestones, Phase 52 backfill pattern, Phase 54 owner leaderboards, migration 00029 owner-alerts logic). Every decision is constrained to a narrow design envelope by existing precedent, which is why confidence is HIGH across all four researchers.

The recommended approach is a **three-phase split**: (1) a low-risk mixed cleanup phase bundling F1 (student analytics re-split), F5 (tech_setup activation), and F6 (DIY owner detail); (2) a focused analytics-expansion phase bundling F2 (coach leaderboards) and F3 (window selectors) — these **MUST bundle** because they co-modify the single `get_owner_analytics` RPC and splitting them would require two breaking shape swaps; (3) an isolated subsystem phase for F4 (owner alerts prune). The biggest engineering risk is **breaking-RPC cache coordination** — every RPC shape change (F1, F2+F3) must ship with an `unstable_cache` key bump in the same commit or SSR crashes on the 60-second TTL rollover.

Key risks are well-characterized: (a) the migration numbering in PROJECT.md / MEMORY.md is stale — next migration is `00033`, not `00032` (consumed by the v1.7 PGRST203 hotfix at commit 0583d09); (b) F5 is NOT a config-only flag flip — migration 00027 line 130 hardcodes `step_number = 0` as a placeholder, so a backfill-and-RPC-rewrite migration is mandatory or coaches see a retroactive alert flood; (c) `reports/route.ts` currently does NOT invalidate `ownerAnalyticsTag()` — F2 breaks this invariant because coach leaderboard #2 is daily-report-driven; (d) F4 requires rewriting the OWNER branch of `get_sidebar_badges` (migration 00029 lines 115–183) or the sidebar badge diverges from the pruned alerts page. All four risks have concrete prevention patterns already documented in the research files.

## Key Findings

### Recommended Stack

**Zero new runtime dependencies.** Every v1.8 feature is buildable with what is already in `package.json`. The existing Next.js 16 + React 19 + Supabase + Tailwind 4 + CVA stack covers it. One new *internal* UI primitive is needed (a ~50 LOC `SegmentedControl.tsx`), but it is not a library — it mirrors the existing `StarRating.tsx` `role="radiogroup"` precedent (file lines 32–50) with zero new deps.

**Core technologies (all unchanged from v1.7):**
- **Next.js 16.1.6** — server components + `unstable_cache` + `revalidateTag` — v1.8 reuses Phase 54's cache pattern
- **React 19.2.3** — server components for data fetching; client boundary only for 6 window-selector state hooks
- **Supabase (supabase-js ^2.99.2, ssr ^0.9.0, CLI ^2.78.1)** — RPC/RLS/admin-client pattern unchanged; breaking RPC change in F1 is a standard `CREATE OR REPLACE FUNCTION`
- **TypeScript ^5 strict** — catches breaking RPC consumer drift at compile time
- **Tailwind 4 + CVA + ima-* tokens** — segmented control styled inline, no variant plugin

**New internal component (not a library):** `src/components/ui/SegmentedControl.tsx` — `role="radiogroup"` + `role="radio"` + `aria-checked`, arrow-key navigation, `min-h-[44px]` per button, `ima-*` token styling. ~50 LOC, zero deps.

**Rejected alternatives:** `@radix-ui/react-radio-group`, `@radix-ui/react-toggle-group`, `react-aria-components` — all overkill for a 4-button selector and would introduce style-system drift. Upgrading Supabase CLI mid-milestone is also rejected.

See: `.planning/research/STACK.md`

### Expected Features

Six scoped feature blocks — all MVP per PROJECT.md. No "maybe ship" tier.

**Must have (table stakes):**
- **F1 Student Analytics re-split** — labels match what they count. Rename `total_emails` → `total_brand_outreach` (stop double-counting) and `total_influencers` → `total_influencer_outreach`. Breaking RPC change in migration 00033 + cache-key bump in both `/student/analytics/page.tsx:50` AND `/student_diy/analytics/page.tsx:50` in the same commit.
- **F2 Coach performance leaderboards** — 3 top-3 cards (revenue, avg brand-outreach-per-student-per-day, deals) beneath existing student leaderboards. Rows render as non-linked `<li>` (coach detail page does not exist). Exclude coaches with zero assigned students at SQL level via `EXISTS`.
- **F3 Per-leaderboard window selector** — independent Weekly/Monthly/Yearly/AllTime toggle per card. Single RPC pre-computes all 24 slots (6 × 4). Pure client-side state — no re-fetch, no URL params, no localStorage. Default "All Time".
- **F4 Owner alerts prune to `deal_closed`** — remove 4 old types (`student_inactive`, `student_dropoff`, `unreviewed_reports`, `coach_underperforming`), replace with one info/success alert per closed deal. Silent removal, no tombstone. Orphaned `alert_dismissals` preserved.
- **F5 Coach alert `tech_setup` activation** — flip feature flag, relabel "Setup Complete" → "Set Up Your Agency", keep internal key `tech_setup`. **Requires a migration** to change RPC placeholder `step_number = 0` → `4` AND backfill historical completions.
- **F6 student_diy owner detail page** — extend `.eq("role", "student")` to `.in("role", ["student","student_diy"])`, hide coach-assignment dropdown and report indicators for DIY, add "DIY" badge on list page. Coach route NOT touched (owner-only scope).

**Should have (differentiators — build inline where cheap):**
- Tooltip on each KPI card explaining what's counted (F1)
- Distinct empty-state copy for zero-coach case (F2)
- Window-specific empty-state text (F3)
- DIY role badge on student detail header (F6)

**Defer (v2+):**
- URL-param persistence of window selections (F3)
- Custom date range picker (F3)
- Badge chip showing deal count per student (F4)
- Coach detail page (F2 rows would link to it)
- Revenue summary line at top of alerts feed (F4 nice-to-have)

**Anti-features (explicit NOT-doing):**
- Keeping old `total_emails` as compat alias (F1)
- Parallel `/owner/students_diy/[id]` route tree (F6)
- Tombstone message in alerts feed about pruning (F4)
- Per-role sub-component `OwnerStudentDetailClientDIY.tsx` (F6)
- Renaming `tech_setup` internal key (F5)
- localStorage persistence of window selector (F3)

See: `.planning/research/FEATURES.md`

### Architecture Approach

v1.8 is **pure integration against the existing architecture** — no new infrastructure, no new cache tags. The stack invariants (proxy.ts route guards, server components for reads, `createAdminClient()` + `"server-only"` for RPCs, 60s `unstable_cache` with `revalidateTag` mutations) all carry forward verbatim. The v1.8 work is concentrated in five subsystems, each with a clear primary file plus cascade.

**Major components touched:**
1. **Student analytics subsystem (F1)** — `get_student_analytics` RPC + `student-analytics-types.ts` + `AnalyticsClient.tsx` KPI strip + two page.tsx cache keys. Blast radius: 5 files + 1 migration.
2. **Owner analytics subsystem (F2+F3)** — `get_owner_analytics` RPC (single RPC expands from 3 slots to 24 slots + coach branch), `owner-analytics-types.ts`, new `OwnerAnalyticsClient.tsx` client wrapper, new `SegmentedControl.tsx` primitive, new `WindowSelector.tsx` component, `OwnerAnalyticsTeaser.tsx` payload path update, `LeaderboardCard.tsx` optional null-href support. Blast radius: ~8 files + 1 migration.
3. **Owner alerts subsystem (F4)** — rewrite `/owner/alerts/page.tsx` (delete 180 lines, add 30), update `OwnerAlertsClient.tsx` type union, update `get_sidebar_badges` OWNER branch in v1.8 migration. Blast radius: 3 files + 1 migration.
4. **Coach milestones subsystem (F5)** — 3 TS constants + 1 migration (RPC rewrite + backfill INSERT + post-assert). Blast radius: 3 edits + 1 migration.
5. **Owner student routing (F6)** — 5 file edits (list page, detail page, calendar API route, CalendarTab prop, OwnerStudentDetailClient conditional). Blast radius: 5 files, zero migrations, zero RPC changes (`get_student_detail` is role-agnostic).

**Data flow changes:** F1 simply stops summing two columns together. F2+F3 batch all 24 leaderboard slots into one RPC response (~3 KB jsonb) to preserve the "cache the whole page, invalidate on mutations" Phase 54 model. F4 swaps a 6-query classification for a 2-query direct read. F5 switches `step_number = 0 (placeholder)` → `4` and pre-dismisses historical completions. F6 simply broadens a role filter.

**Migration numbering correction:** PROJECT.md and MEMORY.md say "next migration 00032" — this is stale. `00032_drop_get_sidebar_badges_legacy_4arg.sql` already exists on master (v1.7 PGRST203 hotfix, commit 0583d09). **v1.8 first migration is `00033`.**

See: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **F1 stale `unstable_cache` SSR crash (BLOCKER)** — `AnalyticsClient.tsx:203/208` calls `.toLocaleString()` on the renamed field. Without a cache-key bump, stale 60s entries serve old-shape jsonb into the new consumer → crash. **Fix: bump `["student-analytics"]` → `["student-analytics-v2"]` in BOTH `/student/analytics/page.tsx:50` AND `/student_diy/analytics/page.tsx:50` in the same commit as the migration.**

2. **F5 config-flip-alone does nothing (BLOCKER)** — migration 00027 line 130 has `rp.step_number = 0` hardcoded as a placeholder. Flipping `techSetupEnabled = true` in TypeScript fires zero alerts because no Step-0 completions exist (CHECK constraint enforces 1–16). **Fix: new migration that (a) rewrites the `tech_setup` CTE to `step_number = 4`, (b) backfills `alert_dismissals` for every historical Step-4 completion × student's current coach (mirror Phase 52 pattern from 00027 lines 409–420), (c) post-asserts coach RPC returns zero tech_setup rows.**

3. **F2 `reports/route.ts` missing ownerAnalyticsTag invalidation (BLOCKER for F2)** — `src/app/api/reports/route.ts:157-178` currently invalidates badges, student analytics, coach dashboard, coach analytics, coach milestones — but NOT `ownerAnalyticsTag()`. Acceptable pre-v1.8 because owner leaderboards were hours/profit/deals only. **F2 breaks this invariant: coach leaderboard #2 is `SUM(brands_contacted) / (students × days)` — daily-report-driven.** Fix: add `revalidateTag(ownerAnalyticsTag(), "default")` to both the update-existing and insert-new branches in `reports/route.ts`.

4. **F4 `get_sidebar_badges` OWNER branch rewrite (HIGH)** — migration 00029 lines 115–183 currently counts the 4 legacy alert types for the sidebar badge. Without a rewrite to count `deals - dismissed_deal_keys`, the sidebar badge diverges from the `/owner/alerts` page content. Fix: rewrite in the same v1.8 migration that prunes the alerts logic.

5. **F1/F2 RPC overload collision — PGRST203 trap repeats (BLOCKER pattern)** — v1.7 learned this the hard way in migration 00032. `CREATE OR REPLACE FUNCTION` only replaces if the full arg-type signature matches. Any signature change without a prior `DROP FUNCTION ... (old args)` creates a second overload → PostgREST dispatcher fails platform-wide. Fix: use the defensive `DO $drop$ ... pg_get_function_identity_arguments ...` block from migrations 00025 and 00028 in every v1.8 migration that touches an existing RPC.

6. **F1/DIY hidden ambiguity** — `AnalyticsClient.tsx:198` currently hides brand/influencer KPI cards for `viewerRole === "student_diy"`. Confirm whether DIY now shows the new renamed cards or keeps hiding. Not flagged in PROJECT.md. **Needs resolution in `/gsd-discuss-phase`.**

7. **F6 "Reports tab" language is imprecise** — `StudentDetailTabs.TabKey = "calendar" | "roadmap" | "deals"`. There is no top-level Reports tab. The v1.8 spec wording about "hiding Reports tab for DIY" actually refers to report-dot indicators INSIDE `CalendarTab`'s day-detail panel AND outreach/rating rows in `StudentKpiSummary`, not a separate tab. **Needs resolution in `/gsd-discuss-phase`** so implementer doesn't hunt for a non-existent tab.

8. **F3 window re-fetch trap** — a naive implementation does `fetch("/api/owner-analytics?window=" + window)` on each toggle, breaking the "pure client state" constraint. Fix: client component receives all 24 slots in one SSR-delivered payload; toggle is a `useState` that switches which pre-computed array renders.

9. **F2 tie-break determinism** — Phase 54 (migration 00028) uses THREE tiebreakers (`metric DESC, LOWER(name) ASC, id::text ASC`). Phase 48 uses TWO. Copy-paste from 00025 instead of 00028 yields non-deterministic rank flicker when two coaches share name + metric. Fix: explicitly copy the 3-tiebreaker pattern from 00028 into every new coach leaderboard CTE.

10. **F5 cache staleness on flag flip** — `coach-milestones.ts:52` passes the flag at call time, but `getCoachMilestonesCached` key does NOT include the flag. Existing 60s entries return `tech_setup: []` even after flip. The backfill in Pitfall 2 above makes this benign (empty remains correct), but is worth noting.

See: `.planning/research/PITFALLS.md` for the full catalog including cross-feature pitfalls X-0 through X-4.

## Implications for Roadmap

### Phase 1: Student Analytics + tech_setup + DIY Parity (F1 + F5 + F6)

**Rationale:** Three independent, small-scope features with narrow blast radii. Bundling produces a single low-risk shippable phase. F1 and F5 both have mandatory migrations (`00033` and `00034` respectively, OR bundled into a single migration if atomically deployable) — doing them together builds the "breaking RPC + cache-key bump + migration discipline" that Phase 2 will rely on. F6 has zero migrations and zero RPC changes — pure route-layer adjustment, safe companion to the migration work.

**Delivers:**
- Student analytics KPI strip correctly labeled and re-split
- Coaches see "Set Up Your Agency" alerts when students complete Step 4, with zero retroactive flood
- Owner can open `/owner/students/[studentId]` for DIY students without 404

**Addresses features:** F1, F5, F6

**Avoids pitfalls:** 1 (cache-key bump in both `page.tsx` files), 2 (tech_setup backfill migration), 5 (defensive DROP-then-CREATE for RPC overload), 6 + 7 (resolve DIY KPI + Reports-tab ambiguity in `/gsd-discuss-phase` before build)

**Migration(s):** `00033_fix_student_analytics_outreach_split.sql` + `00034_activate_tech_setup.sql` (or single combined migration)

### Phase 2: Owner Analytics Expansion (F2 + F3 — MUST bundle)

**Rationale:** F2 (coach leaderboards) and F3 (window selector) both modify the same `get_owner_analytics` RPC and the same payload shape. Splitting them requires two breaking RPC swaps in sequence, doubling the cache-coordination work and the SSR-crash risk window. Build together in one migration + one client-component ship. Biggest engineering block in v1.8.

**Delivers:**
- 6 leaderboards (3 student + 3 coach) rendered on `/owner/analytics`
- Each leaderboard has independent Weekly/Monthly/Yearly/AllTime selector
- Single RPC returns all 24 pre-computed slots; zero re-fetch on toggle
- New `SegmentedControl` primitive promoted to `src/components/ui/`

**Uses stack elements:** Next.js `unstable_cache` + `revalidateTag`, existing `ownerAnalyticsTag()` global tag, `LeaderboardCard` shipped in Phase 54, new `SegmentedControl.tsx` (≤50 LOC, zero deps)

**Implements architecture:** expanded owner-analytics subsystem, new `OwnerAnalyticsClient.tsx` client boundary (page.tsx stays pure server component fetching once)

**Avoids pitfalls:** 3 (add `ownerAnalyticsTag()` to reports/route.ts in same commit), 5 (defensive DROP for RPC overload), 8 (static 24-slot SSR payload, no client fetch), 9 (3-tiebreaker ORDER BY copied from 00028 verbatim)

**Migration:** `00035_expand_owner_analytics_leaderboards.sql` with active-students + active-coaches CTEs + 24 window-filtered leaderboard CTEs

**New files:** `src/components/ui/SegmentedControl.tsx`, `src/components/owner/analytics/OwnerAnalyticsClient.tsx`, `src/components/owner/analytics/WindowSelector.tsx`

### Phase 3: Owner Alerts Prune (F4)

**Rationale:** Isolated to the owner-alerts subsystem and `get_sidebar_badges` OWNER branch. Independent of all other v1.8 features. Ship last so the alerts rewrite and sidebar badge update can be UAT-tested against the stabilized F1/F2/F3/F5 data.

**Delivers:**
- `/owner/alerts` shows one info/success alert per closed deal
- Legacy 4 alert types (inactive/dropoff/unreviewed/coach-underperform) silently removed
- Sidebar badge count matches pruned feed (via `get_sidebar_badges` rewrite)
- `alert_dismissals` orphan rows preserved for forensic history

**Addresses features:** F4

**Avoids pitfalls:** 4 (rewrite OWNER branch in same migration), uses existing `revalidateTag("badges")` wiring in `/api/deals/route.ts` — no new invalidation logic needed

**Migration:** `00036_prune_owner_alerts_to_deal_closed.sql` (rewrites `get_sidebar_badges` OWNER branch only; alerts page reads `deals` directly, no new RPC)

### Phase Ordering Rationale

- **Dependencies:** F2 and F3 are fully coupled (same RPC, same payload) and must ship together. F1, F5, F6 are fully independent and can batch into one phase to reduce milestone overhead. F4 is independent of everything else.
- **Risk gradient (lowest → highest):** Phase 1 bundles three surgical changes with small blast radii. Phase 2 is the biggest engineering risk (24-slot RPC + new client component + new primitive + cache-key bump + cross-API invalidation fix). Phase 3 is simple deletion + one RPC-branch rewrite.
- **Pitfall concentration:** Phase 1 owns pitfalls 1, 2, 6, 7 (ambiguity resolution + cache discipline + backfill discipline). Phase 2 owns pitfalls 3, 8, 9 (cross-API invalidation + client state + tie-break). Phase 3 owns pitfall 4. Pitfall 5 (RPC overload collision) is cross-cutting — every phase must use the defensive `DROP FUNCTION ... (identity_args)` pattern.
- **Migration numbering:** `00033` (Phase 1 F1) → `00034` (Phase 1 F5) → `00035` (Phase 2) → `00036` (Phase 3). PROJECT.md's "starts at 00032" is stale and must be corrected to `00033`.
- **Parallelization opportunity:** Phases 1 and 3 are fully independent and could parallelize if two implementers are available. Phase 2 is on the critical path and should not be split across parallel workstreams.

### Research Flags

Phases likely needing deeper research during planning (`/gsd-research-phase` before execution):
- **Phase 2 (F2+F3):** largest SQL surface — 24 leaderboard CTEs with 4 window semantics. Before build, needs `EXPLAIN ANALYZE` validation at current data volume and stakeholder confirmation of the "avg brand outreach per student per day" divisor formula (three plausible interpretations per PITFALLS.md 2-C). Research flag: SQL performance + formula ambiguity.
- **Phase 3 (F4):** confirm stakeholder intent on the TTL question — `deal_closed` alerts have no natural expiry, feed grows forever. Options: (A) accept unbounded + paginate, (B) 30-day filter, (C) pg_cron auto-dismiss. Research flag: feed-growth UX decision.

Phases with standard patterns (skip `/gsd-research-phase`, go directly to `/gsd-discuss-phase`):
- **Phase 1 (F1+F5+F6):** all three follow shipped precedent (F1 mirrors F2 migration pattern, F5 mirrors Phase 52 backfill pattern, F6 is pure routing change). Research is already fully covered in `.planning/research/*`. **Flag two ambiguities for `/gsd-discuss-phase`:** (a) does `/student_diy/analytics` now show renamed brand/influencer cards or keep hiding them, (b) confirm "hide Reports tab" wording refers to CalendarTab report indicators + StudentKpiSummary rows, not a top-level tab that does not exist.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; every recommendation grounded in a direct file read and a specific line number. One new internal component (`SegmentedControl.tsx`) with exact precedent (`StarRating.tsx` L32–50). |
| Features | HIGH | Six feature blocks each sit adjacent to shipped code paths with clear precedent files and line numbers. Two flagged ambiguities (F1 DIY KPI behavior, F6 "Reports tab" wording) are explicit and scoped. |
| Architecture | HIGH | Integration map based entirely on direct codebase inspection. Every touched file is listed with line numbers. Cache tag directory verified in `src/lib/rpc/*-types.ts`. |
| Pitfalls | HIGH | All 10+ pitfalls grounded in specific migration file lines (00027:130, 00028:106/127/148, 00029:115-183, 00032) and specific route handler lines (reports/route.ts:157-178, deals/[id]/route.ts:127-134). Prevention patterns cite exact precedent migrations. |

**Overall confidence:** HIGH

### Gaps to Address

- **F1 DIY KPI visibility:** `AnalyticsClient.tsx:198` currently hides brand/influencer cards for `viewerRole === "student_diy"`. v1.8 decision not captured in PROJECT.md. **Resolve in `/gsd-discuss-phase` before Phase 1 execution.**
- **F6 "Reports tab" language:** No top-level Reports tab exists (`TabKey` is `calendar | roadmap | deals`). The spec likely means CalendarTab report-dot suppression + StudentKpiSummary row suppression. **Resolve in `/gsd-discuss-phase` before Phase 1 execution.**
- **F2 metric #2 formula:** "avg brand outreach per student per day in window" has three plausible interpretations (PITFALLS.md 2-C). Recommend formula 2 (`SUM / (students × window_days)`) as default; **confirm in `/gsd-discuss-phase` before Phase 2 execution.**
- **F3 window semantics:** Trailing-N-days (pattern 1, matches 00023:71 precedent) recommended over ISO-calendar-week. Document in SQL comment. No stakeholder confirmation required — precedent is clear.
- **F4 `deal_closed` feed growth:** One-shot alerts never expire. Recommend 30-day filter (Option B per PITFALLS.md 4-B). **Confirm with stakeholder in `/gsd-discuss-phase` before Phase 3 execution.**
- **F5 backfill scope:** Pre-dismiss every historical Step-4 completion × current coach assignment. Mirror Phase 52 pattern from 00027:409-420. Accept as default; no stakeholder discussion needed unless volume is surprisingly large.
- **Migration numbering:** PROJECT.md and MEMORY.md reference `00032` as next migration; actual next is `00033`. **Update PROJECT.md before Phase 1 execution.**

---
*Research completed: 2026-04-16*
*Ready for roadmap: yes*
