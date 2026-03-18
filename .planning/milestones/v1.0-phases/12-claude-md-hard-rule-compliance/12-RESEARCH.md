# Phase 12: CLAUDE.md Hard Rule Compliance - Research

**Researched:** 2026-03-18
**Domain:** Code quality / design-token hygiene / fetch error handling / touch targets / date utilities
**Confidence:** HIGH — all findings based on direct source inspection of the actual files, no library API ambiguity

---

## Summary

Phase 12 is a tech-debt sweep that corrects exactly 5 categories of CLAUDE.md hard-rule violations identified in the v1.0 milestone audit. Every violation is already located, the fix for each is deterministic, and no new libraries are needed. This is a mechanical edit phase with no architectural decisions.

The audit identified raw Tailwind color tokens in `WorkTrackerClient.tsx`, `CycleCard.tsx`, and three auth pages. It also identified one missing `response.ok` check in the stale-session abandon path, one missing touch-target class on `StudentCard`'s Link wrapper, and a UTC-vs-local-time bug in `getToday()`.

All 17 ima-* tokens are already defined in `tailwind.config.ts`. Every raw color has a direct ima-* semantic mapping. No new tokens need to be added.

**Primary recommendation:** Fix all 5 categories in two focused tasks — (1) token replacement across all 5 affected components, (2) `getToday()` UTC fix + stale-abandon `response.ok` + `StudentCard` touch-target. Each task is independently verifiable with `npm run lint && npx tsc --noEmit`.

---

## Violation Inventory (Complete)

Direct file inspection, confidence HIGH.

### Category A: Raw Tailwind Color Tokens

| File | Location | Raw Token | ima-* Replacement |
|------|----------|-----------|-------------------|
| `WorkTrackerClient.tsx` | line 202 | `bg-green-50` | `bg-ima-success/10` |
| `WorkTrackerClient.tsx` | line 202 | `border-green-200` | `border-ima-success/30` |
| `WorkTrackerClient.tsx` | line 203 | `text-green-800` | `text-ima-success` |
| `WorkTrackerClient.tsx` | line 204 | `text-green-700` | `text-ima-success` |
| `WorkTrackerClient.tsx` | line 207 | `text-green-600` | `text-ima-success` |
| `WorkTrackerClient.tsx` | line 235 | `bg-amber-100` | `bg-ima-warning/15` |
| `WorkTrackerClient.tsx` | line 235 | `text-amber-700` | `text-ima-warning` |
| `WorkTrackerClient.tsx` | line 235 | `hover:bg-amber-200` | `hover:bg-ima-warning/25` |
| `WorkTrackerClient.tsx` | line 242 | `bg-green-600` | `bg-ima-success` |
| `WorkTrackerClient.tsx` | line 242 | `hover:bg-green-700` | `hover:bg-ima-success` (add `/90` opacity) |
| `WorkTrackerClient.tsx` | line 249 | `text-red-600` | `text-ima-error` |
| `WorkTrackerClient.tsx` | line 249 | `hover:bg-red-50` | `hover:bg-ima-error/10` |
| `WorkTrackerClient.tsx` | line 257 | `bg-red-50` | `bg-ima-error/10` |
| `WorkTrackerClient.tsx` | line 257 | `text-red-700` | `text-ima-error` |
| `WorkTrackerClient.tsx` | line 262 | `bg-red-600` | `bg-ima-error` |
| `WorkTrackerClient.tsx` | line 262 | `hover:bg-red-700` | `hover:bg-ima-error` (add `/90`) |
| `WorkTrackerClient.tsx` | line 303 | `text-red-600` | `text-ima-error` |
| `WorkTrackerClient.tsx` | line 303 | `hover:bg-red-50` | `hover:bg-ima-error/10` |
| `WorkTrackerClient.tsx` | line 311 | `bg-red-50` | `bg-ima-error/10` |
| `WorkTrackerClient.tsx` | line 311 | `text-red-700` | `text-ima-error` |
| `WorkTrackerClient.tsx` | line 316 | `bg-red-600` | `bg-ima-error` |
| `WorkTrackerClient.tsx` | line 316 | `hover:bg-red-700` | `hover:bg-ima-error` (add `/90`) |
| `CycleCard.tsx` | line 17 | `text-green-600` | `text-ima-success` |
| `CycleCard.tsx` | line 19 | `text-amber-500` | `text-ima-warning` |
| `CycleCard.tsx` | line 20 | `text-red-500` | `text-ima-error` |
| `login/page.tsx` | line 86 | `bg-red-50` | `bg-ima-error/10` |
| `login/page.tsx` | line 86 | `border-red-200` | `border-ima-error/30` |
| `login/page.tsx` | line 86 | `text-red-700` | `text-ima-error` |
| `RegisterCard.tsx` | line 101 | `bg-red-50` | `bg-ima-error/10` |
| `RegisterCard.tsx` | line 101 | `border-red-200` | `border-ima-error/30` |
| `RegisterCard.tsx` | line 101 | `text-red-700` | `text-ima-error` |
| `MagicLinkCard.tsx` | line 94 | `bg-red-50` | `bg-ima-error/10` |
| `MagicLinkCard.tsx` | line 94 | `border-red-200` | `border-ima-error/30` |
| `MagicLinkCard.tsx` | line 94 | `text-red-700` | `text-ima-error` |
| `register/page.tsx` | line 16 | `text-red-500` | `text-ima-error` |
| `register/[code]/page.tsx` | line 16 | `text-red-500` | `text-ima-error` |

**Note on opacity modifiers:** Tailwind CSS 4 supports `bg-ima-error/10` and `border-ima-error/30` as opacity variants for any color token defined in the theme. This is the correct pattern for "light background" and "subtle border" states.

### Category B: Missing `response.ok` check

| File | Location | Issue |
|------|----------|-------|
| `WorkTrackerClient.tsx` | lines 42-53 (`abandonStale`) | `Promise.all(staleSessions.map(s => fetch(...)))` — the individual fetch results are never checked for `response.ok`. The stale-abandon path intentionally runs silently on mount, but must still confirm success before calling `router.refresh()`. |

**Fix pattern:**
```typescript
const abandonStale = async () => {
  const results = await Promise.all(
    staleSessions.map((s) =>
      fetch(`/api/work-sessions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "abandoned" }),
      })
    )
  );
  const allOk = results.every((r) => r.ok);
  if (!allOk) {
    console.error("[WorkTrackerClient] Some stale sessions failed to abandon");
  }
  router.refresh();
};
```

**Why `router.refresh()` unconditionally after check:** The stale-abandon is a best-effort silent cleanup. Even if one fails, refresh so UI shows current server state. We log the error (satisfying "never swallow errors") but don't block the user.

### Category C: `StudentCard` Link touch target

| File | Location | Issue |
|------|----------|-------|
| `StudentCard.tsx` | line 30 | `<Link href=...>` has no `min-h-[44px]` class. The card's inner `CardContent` is tall enough visually, but the CLAUDE.md hard rule requires the **interactive element itself** to carry the explicit class. |

**Fix:** Add `className="block min-h-[44px]"` to the Link element. Using `block` ensures the Link fills the Card's full bounding box so the entire card face is the touch target, matching the visual affordance.

```typescript
<Link
  href={`${basePath}/${student.id}`}
  aria-label={student.name}
  className="block min-h-[44px]"
>
```

### Category D: `getToday()` UTC bug

| File | Location | Issue |
|------|----------|-------|
| `src/lib/utils.ts` | line 10 | `new Date().toISOString()` returns UTC. In UTC+X timezones (Gulf, Asia, EU) a user past midnight local time but before midnight UTC will get yesterday's date. For a UAE-based cohort (UTC+4), this affects sessions started between 00:00 and 03:59 local time. |

**Current code:**
```typescript
export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}
```

**Fix — local date via padded parts:**
```typescript
export function getToday(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

**Why this is safe:** `getFullYear()`, `getMonth()`, `getDate()` all return local-time values based on the runtime's timezone. In a browser context that's the user's local timezone. In a Node.js server context (SSR), it's the server's TZ env. Since `getToday()` is called exclusively from client components (`WorkTrackerClient.tsx`) and the student-facing page server component, the client call is what matters for date assignment — and the browser will use the student's local clock.

**Callsites of `getToday()`:** Only 2 locations:
1. `WorkTrackerClient.tsx` — stale-session filter (line 34) and `handleStart` date param (line 77). Both are client-side, browser timezone applies.
2. No server-side callsites found.

---

## Token Mapping Reference

Available ima-* tokens from `tailwind.config.ts` (verified by direct read):

| Token | Hex Value | Semantic Use |
|-------|-----------|--------------|
| `ima-primary` | `#2563EB` | Primary actions (blue) |
| `ima-primary-hover` | `#1D4ED8` | Primary hover |
| `ima-success` | `#10B981` | Success states (green) |
| `ima-warning` | `#F59E0B` | Warning states (amber) |
| `ima-error` | `#EF4444` | Error/destructive states (red) |
| `ima-bg` | `#F8FAFC` | Page background |
| `ima-surface` | `#FFFFFF` | Card/panel surface |
| `ima-surface-light` | `#F1F5F9` | Subtle surface |
| `ima-surface-accent` | `#EFF6FF` | Accent surface |
| `ima-border` | `#E2E8F0` | Default borders |
| `ima-text` | `#1E293B` | Primary text |
| `ima-text-secondary` | `#64748B` | Secondary text |
| `ima-text-muted` | `#94A3B8` | Muted/placeholder text |

**There is no `ima-success-hover` or `ima-error-hover` token.** For hover darkening of `ima-success` and `ima-error`, use Tailwind's opacity modifier: `hover:bg-ima-success/90` (slightly dimmer = darker-feeling on colored backgrounds). This is the correct Tailwind CSS 4 pattern.

---

## Architecture Patterns

### Pattern 1: Opacity Modifier for Light/Subtle States

When raw Tailwind used `bg-green-50` (very light green background) or `bg-red-50` (very light red), the ima-* equivalent is `bg-ima-success/10` or `bg-ima-error/10`. Tailwind CSS 4 supports opacity suffixes on any color, including custom tokens.

```tsx
// Before (raw Tailwind):
<div className="bg-red-50 border border-red-200 text-red-700">

// After (ima-* tokens):
<div className="bg-ima-error/10 border border-ima-error/30 text-ima-error">
```

### Pattern 2: Hover Darkening Without Separate Token

```tsx
// Before:
className="bg-green-600 hover:bg-green-700"

// After (opacity modifier for hover):
className="bg-ima-success hover:bg-ima-success/90"
```

### Pattern 3: response.ok in Promise.all context

```typescript
const results = await Promise.all(items.map(item => fetch(...)));
const failed = results.filter(r => !r.ok);
if (failed.length > 0) {
  console.error("[Component] N requests failed");
}
// continue with side effects regardless (best-effort pattern)
```

### Pattern 4: Local-time date string

```typescript
// UTC (wrong for UTC+ users):
new Date().toISOString().split("T")[0]

// Local time (correct):
const d = new Date();
`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark hover variant of ima-* color | A new `ima-success-dark` token | `hover:bg-ima-success/90` | Tailwind CSS 4 opacity modifiers cover this; adding tokens bloats the config |
| Light background variant | A new `ima-error-light` token | `bg-ima-error/10` | Same — opacity modifier is the correct Tailwind 4 pattern |
| UTC-safe date formatting | A third-party date library | `getFullYear()/getMonth()/getDate()` | date-fns is already in deps but unnecessary here — built-in Date methods are sufficient for a simple YYYY-MM-DD string |

---

## Common Pitfalls

### Pitfall 1: Using `text-white` on ima-* semantic backgrounds
**What goes wrong:** `bg-ima-success` is a medium-saturation green; `text-white` on it is fine. But `bg-ima-error/10` (very light red background) with `text-white` would be invisible.
**Prevention:** On tinted/light backgrounds (`/10`, `/15`, `/30` opacity variants), use `text-ima-error` (dark text). Only use `text-white` on full-opacity colored backgrounds like `bg-ima-success`, `bg-ima-error`, `bg-ima-primary`.

### Pitfall 2: Forgetting duplicate abandon-confirm blocks
**What goes wrong:** `WorkTrackerClient.tsx` has TWO `showAbandonConfirm` blocks — one for the active state (lines 256-274) and one for the paused state (lines 310-328). Both contain the same raw-token classes. Both must be updated.
**Prevention:** The line numbers in the violation inventory above cover both blocks. Verify all occurrences are replaced before closing.

### Pitfall 3: `ima-success/90` vs `ima-success` — visual regression
**What goes wrong:** `bg-ima-success` (`#10B981`, 100% opacity) on a white surface reads as a medium-green button. `hover:bg-ima-success/90` is 90% opacity of the same green — visually near-identical and provides adequate hover feedback without a separate token.
**Prevention:** The visual difference is intentional and subtle. This is the accepted pattern per CLAUDE.md Code Quality section.

### Pitfall 4: `StudentCard` - `block` vs `inline-flex`
**What goes wrong:** Adding `min-h-[44px]` to a Link without `block`/`flex` means the Link remains inline and the height constraint does nothing — block-level containers ignore min-height on inline elements.
**Prevention:** Use `className="block min-h-[44px]"` so the Link becomes a block-level element that respects the min-height.

### Pitfall 5: getToday() server vs client context
**What goes wrong:** The fix uses `new Date()` local time. On a Node.js server with UTC timezone (typical deploy), this is still UTC. The key context is `getToday()` is called from `WorkTrackerClient.tsx` which is a client component — the browser provides local time. The fix is correct for client-side calls.
**Prevention:** The comment in utils.ts already says "local time". The fix aligns the implementation with the documented intent. No server-side callers exist.

---

## Code Examples

### Complete CycleCard.tsx after fix

```tsx
// Source: direct inspection of current file + ima-* token table
{status === "completed" && <Check className="h-5 w-5 text-ima-success" aria-hidden="true" />}
{status === "in_progress" && <Play className="h-5 w-5 text-ima-primary" aria-hidden="true" />}
{status === "paused" && <Pause className="h-5 w-5 text-ima-warning" aria-hidden="true" />}
{status === "abandoned" && <X className="h-5 w-5 text-ima-error" aria-hidden="true" />}
{status === "pending" && <Circle className="h-5 w-5 text-ima-text-muted" aria-hidden="true" />}
```

### All-complete celebration banner in WorkTrackerClient.tsx

```tsx
// Before:
<div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
  <h2 className="text-xl font-bold text-green-800">All 4 cycles complete!</h2>
  <p className="text-green-700 mt-1">...</p>
  <p className="text-sm text-green-600 mt-2">...</p>

// After:
<div className="bg-ima-success/10 border border-ima-success/30 rounded-xl p-6 text-center mb-6">
  <h2 className="text-xl font-bold text-ima-success">All 4 cycles complete!</h2>
  <p className="text-ima-success mt-1">...</p>
  <p className="text-sm text-ima-success mt-2">...</p>
```

### Auth error alert in login/page.tsx, RegisterCard.tsx, MagicLinkCard.tsx

```tsx
// Before:
<div role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">

// After:
<div role="alert" className="mt-4 rounded-lg bg-ima-error/10 border border-ima-error/30 p-3 text-sm text-ima-error">
```

### Error icon in register page ErrorCard components

```tsx
// Before:
<XCircle className="mx-auto h-12 w-12 text-red-500" aria-hidden="true" />

// After:
<XCircle className="mx-auto h-12 w-12 text-ima-error" aria-hidden="true" />
```

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`. No test framework is installed (no jest.config, no vitest.config, no test dependencies in package.json). All verification for this phase is build-tool validation.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — build-tool only |
| Config file | n/a |
| Quick run command | `npm run lint && npx tsc --noEmit` |
| Full suite command | `npm run build` |

### Phase Requirements → Verification Map

| Behavior | Verification Type | Command | Notes |
|----------|-------------------|---------|-------|
| No raw green/amber/red tokens | Grep scan | `grep -rn "bg-green-\|text-green-\|bg-red-\|text-red-\|bg-amber-\|text-amber-" src/` | Zero matches expected |
| TypeScript clean after token swap | TS check | `npx tsc --noEmit` | Tailwind classes are strings; TS doesn't validate them |
| response.ok check in abandonStale | Code review | Manual inspection of lines 42-53 in WorkTrackerClient.tsx | |
| StudentCard Link has min-h-[44px] | Grep scan | `grep "min-h-\[44px\]" src/components/coach/StudentCard.tsx` | Should match |
| getToday() returns local date | Unit inspection | Compare before/after in utils.ts | |
| Lint passes | ESLint | `npm run lint` | No new lint errors from changes |

### Sampling Rate
- **Per task commit:** `npm run lint && npx tsc --noEmit`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` passes with zero errors before `/gsd:verify-work`

### Wave 0 Gaps

None — this phase makes no new files. All changes are in-place edits to existing files. No test infrastructure needed; verification is grep + build tools.

---

## File Change Map

Complete list of files that must be edited in Phase 12:

| File | Path | Changes |
|------|------|---------|
| `WorkTrackerClient.tsx` | `src/components/student/WorkTrackerClient.tsx` | Replace all raw green/amber/red tokens; fix abandonStale response.ok |
| `CycleCard.tsx` | `src/components/student/CycleCard.tsx` | Replace text-green-600, text-amber-500, text-red-500 |
| `utils.ts` | `src/lib/utils.ts` | Fix getToday() to use local time |
| `StudentCard.tsx` | `src/components/coach/StudentCard.tsx` | Add `block min-h-[44px]` to Link |
| `login/page.tsx` | `src/app/(auth)/login/page.tsx` | Replace bg-red-50/border-red-200/text-red-700 on error alert |
| `RegisterCard.tsx` | `src/app/(auth)/register/[code]/RegisterCard.tsx` | Same error alert token replacement |
| `MagicLinkCard.tsx` | `src/app/(auth)/register/MagicLinkCard.tsx` | Same error alert token replacement |
| `register/page.tsx` | `src/app/(auth)/register/page.tsx` | Replace text-red-500 on XCircle icon |
| `register/[code]/page.tsx` | `src/app/(auth)/register/[code]/page.tsx` | Replace text-red-500 on XCircle icon |

**Total: 9 files, all in-place edits, no new files.**

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `src/components/student/WorkTrackerClient.tsx` — all violations enumerated by line
- Direct file read: `src/components/student/CycleCard.tsx` — all violations enumerated by line
- Direct file read: `src/components/coach/StudentCard.tsx` — confirmed no min-h-[44px] on Link
- Direct file read: `src/lib/utils.ts` — confirmed UTC bug in getToday()
- Direct file read: `src/app/(auth)/login/page.tsx`, `RegisterCard.tsx`, `MagicLinkCard.tsx`, `register/page.tsx`, `register/[code]/page.tsx` — all error-state raw tokens found
- Direct file read: `tailwind.config.ts` — confirmed all 17 ima-* tokens and their hex values; confirmed Tailwind CSS 4 (supports opacity modifiers)
- Direct file read: `.planning/v1.0-MILESTONE-AUDIT.md` — cross-verified violation list
- Direct file read: `CLAUDE.md` — definitive rule text for hard rules #2, #6, #8

### Secondary (MEDIUM confidence)
- Tailwind CSS 4 opacity modifier pattern (`bg-color/N`) — standard Tailwind feature, confirmed by presence of `/10` and `/30` patterns already used in codebase (e.g. `bg-ima-primary/10` in RegisterCard.tsx line 54)

---

## Metadata

**Confidence breakdown:**
- Violation inventory: HIGH — direct source inspection, every violation listed by file + line
- Token replacements: HIGH — all ima-* tokens confirmed from tailwind.config.ts; opacity modifier pattern confirmed from existing code
- `response.ok` fix: HIGH — fix pattern is straightforward, matches all other handlers in same file
- `getToday()` fix: HIGH — UTC vs local-time issue is definitively confirmed; fix uses standard JS Date methods
- Touch target fix: HIGH — exact class to add is unambiguous

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable tech debt — nothing will change unless files are edited)
