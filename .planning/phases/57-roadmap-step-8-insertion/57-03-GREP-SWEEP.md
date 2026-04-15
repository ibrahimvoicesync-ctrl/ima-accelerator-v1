# Phase 57 Grep Sweep — Hardcoded Step Literals in src/

**Run on:** 2026-04-15
**After:** Plans 57-01 (migration) and 57-02 (config.ts) committed
**Rule:** CLAUDE.md "Config is truth — import from src/lib/config.ts, never hardcode roles/nav/roadmap"

---

## Denominator literals

### `/15` (4 hits)

| File:Line | Hit | Classification | Reason |
|---|---|---|---|
| `src/lib/config.ts:353` | `// 15. ACTIVITY — student active/inactive threshold (D-14)` | IGNORE (numbered section comment) | Section heading "15." in config.ts, not a roadmap step reference |
| `src/components/student/WorkTrackerClient.tsx:484` | `bg-ima-primary/15 text-ima-primary` | IGNORE (tailwind opacity) | Tailwind `/15` opacity modifier, not a step denominator |
| `src/components/student/WorkTrackerClient.tsx:523` | `bg-ima-warning/15 ...` | IGNORE (tailwind opacity) | Tailwind opacity modifier |
| `src/components/student/PlannerUI.tsx:263` | `bg-ima-primary/15 ...` | IGNORE (tailwind opacity) | Tailwind opacity modifier |

### `/10` (≈ 70 hits, all Tailwind/section-comment/rounding)

All hits are one of:

- **Tailwind opacity modifiers** (`bg-ima-primary/10`, `bg-ima-success/10`, `bg-ima-warning/10`, `bg-ima-error/10`, `bg-ima-info/10`, `bg-ima-accent/10`, `bg-ima-text-muted/10`) — across `src/components/ui/Badge.tsx`, `src/components/ui/Button.tsx`, `src/components/coach/`, `src/components/owner/`, `src/components/student/`, `src/app/(auth)/`, `src/app/(dashboard)/coach/`, `src/app/(dashboard)/owner/`, `src/app/(dashboard)/student/`. **Classification: IGNORE (tailwind opacity).**
- **Section-number comments** (`// 10. INVITE CONFIG`, `// 10. Cache invalidation`, `// 10. Return paginated result`, `// 10. Handle 23505 unique violation`, `// 10. Handle not found`, `// 10. Return updated row`) in `src/lib/config.ts:225`, `src/app/api/glossary/[id]/route.ts:114`, `src/app/api/deals/route.ts:218,323`, `src/app/api/deals/[id]/route.ts:118,239`, `src/app/api/announcements/[id]/route.ts:184`. **Classification: IGNORE (section-number comment).**
- **Rounding math** in `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:700`: `const rounded = Math.round(hours * 10) / 10;` (decimal-place rounding, unrelated to roadmap). **Classification: IGNORE (decimal rounding).**

**Total `/10` denominator-suspect hits requiring fix: 0.**

---

## Phrase literals (`of 15`, `of 10`)

Zero hits. **Classification: N/A.**

---

## Step comparisons (`step_number === N` for N in 7..16)

Zero hits. **Classification: N/A.**

---

## Step comparisons (`step === N` for N in 7..16)

| File:Line | Hit | Classification | Reason |
|---|---|---|---|
| `src/lib/config.ts:393` | `// SYNC: ROADMAP_STEPS[11].step === 12. Shifted 11→12 in Phase 57 after` | IGNORE (Phase 57 SYNC comment) | This comment was written by Plan 57-02; documents the post-shift binding |
| `src/lib/config.ts:399` | `// SYNC: ROADMAP_STEPS[13].step === 14. Shifted 13→14 in Phase 57 after` | IGNORE (Phase 57 SYNC comment) | Same — Plan 57-02 documentation |

**Total `step === N` hits requiring fix: 0.**

---

## Possibly stale `ROADMAP_STEPS[N]` index references (N in 6..14)

| File:Line | Hit | Classification | Reason |
|---|---|---|---|
| `src/lib/config.ts:393` | (in SYNC comment) `ROADMAP_STEPS[11].step === 12` | IGNORE (Phase 57 SYNC comment) | Documentation of correct post-shift index |
| `src/lib/config.ts:399` | (in SYNC comment) `ROADMAP_STEPS[13].step === 14` | IGNORE (Phase 57 SYNC comment) | Documentation of correct post-shift index |

No live `ROADMAP_STEPS[N]` index access in any executable code path. All consumers use either `ROADMAP_STEPS.length`, `.map()/.filter()/.find()`, or the dynamic `MILESTONE_CONFIG.*Step` pointer.

**Total ROADMAP_STEPS index hits requiring fix: 0.**

---

## Classification summary

| Category | Hits | FIX | IGNORE | REVIEW |
|---|---|---|---|---|
| `/15` | 4 | 0 | 4 (1 section comment, 3 tailwind) | 0 |
| `/10` | ~70 | 0 | ~70 (tailwind, section comments, rounding) | 0 |
| `of 15` / `of 10` | 0 | 0 | 0 | 0 |
| `step_number === N` | 0 | 0 | 0 | 0 |
| `step === N` | 2 | 0 | 2 (Phase 57 SYNC comments) | 0 |
| `ROADMAP_STEPS[N]` (N=6..14) | 2 | 0 | 2 (Phase 57 SYNC comments) | 0 |

**FIX (denominator): 0** | **FIX (milestone-shift): 0** | **FIX (index-shift): 0** | **REVIEW (ambiguous): 0**

---

## Conclusion

The codebase is **already fully compliant with the "Config is truth" rule** for roadmap step numbers. Every step-number-related literal is either:

- Hidden behind `ROADMAP_STEPS.length` (denominators) — pattern established by Phase 25
- Hidden behind `MILESTONE_CONFIG.influencersClosedStep` / `brandResponseStep` (RPC-tied step references) — pattern established by Phase 51
- A Tailwind opacity class (false-positive grep match)
- A numbered section-header comment (false-positive grep match)
- A SYNC comment in config.ts intentionally documenting the post-Phase-57 indices

**Tasks 2, 3, 4, and 5 of plan 57-03 produce zero file modifications.** All FIX/REVIEW counts are 0. Plan 57-03 proceeds directly to Task 6 (build/lint/typecheck gate) and Task 7 (smoke script creation).
