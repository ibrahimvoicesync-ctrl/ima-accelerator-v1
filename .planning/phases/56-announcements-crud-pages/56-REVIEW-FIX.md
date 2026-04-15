---
phase: 56-announcements-crud-pages
fixed_at: 2026-04-15T00:00:00Z
review_path: .planning/phases/56-announcements-crud-pages/56-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 5
fixed: 5
skipped: 0
status: fixed
severity_counts:
  critical_in_scope: 0
  critical_fixed: 0
  warning_in_scope: 5
  warning_fixed: 5
  info_in_scope: 0
  info_fixed: 1  # IN-04 trivially co-located with WR-05
post_fix_checks:
  tsc: pass
  lint: pass  # 4 pre-existing warnings unrelated to Phase 56 (no new errors)
---

# Phase 56: Code Review Fix Report

**Fixed at:** 2026-04-15
**Source review:** `.planning/phases/56-announcements-crud-pages/56-REVIEW.md`
**Iteration:** 1
**Scope:** Critical + Warning (Info out of scope except when trivially co-located)

## Summary

- Findings in scope: 5 (all Warnings — 0 Critical)
- Fixed: 5
- Skipped: 0
- Bonus Info fix: 1 (IN-04 mode-agnostic 429 message rolled into WR-05)
- Status: **fixed** (all in-scope issues resolved)

## Fixes Applied

| ID | Severity | File(s) | Commit | Fix |
|----|----------|---------|--------|-----|
| WR-01 | Warning | `src/components/announcements/AnnouncementCard.tsx` | `ff68aaf` | Added explicit `min-h-[44px] min-w-[44px]` classes to both Edit and Delete icon buttons. The `size="icon"` variant already resolves to `h-11 w-11` (44x44px) per `Button.tsx`, but the explicit `min-*` classes satisfy Hard Rule 2 literally and guard against future variant changes. |
| WR-02 | Warning | `src/components/announcements/AnnouncementsFeed.tsx` | `49425e0` | Added `toastRef` pattern (matching the one in `AnnouncementForm` and `DeleteAnnouncementDialog`). Replaced `toast({...})` calls inside `handleLoadMore` with `toastRef.current({...})` and removed `toast` from the `useCallback` dependency array. Imports updated to pull in `useEffect` and `useRef`. |
| WR-03 | Warning | `src/app/api/announcements/route.ts`, `src/app/api/announcements/[id]/route.ts` | `fb0e26a` | Narrowed `row.author.role` at both API boundaries (collection + item routes) so the response payload can only contain `"owner"` or `"coach"` — unknown roles fall back to `"coach"`. This matches the defensive coercion already done in `AnnouncementsPage.tsx:82-85` and makes the declared `AnnouncementAuthor.role` invariant hold everywhere. |
| WR-04 | Warning | `src/components/announcements/AnnouncementForm.tsx` | `77b9a9b` | Added `maxLength={MAX_CONTENT_LENGTH}` to the `Textarea` so the browser hard-caps input at 2000 chars. Also changed `JSON.stringify({ content })` to `JSON.stringify({ content: content.trim() })` so the POST/PATCH body matches the server's `.trim()` behavior — eliminates the visible/stored mismatch. |
| WR-05 | Warning | `src/components/announcements/DeleteAnnouncementDialog.tsx` | `0478220` | Allowed Escape/backdrop close even while submitting (keyboard users are no longer trapped mid-delete). Added an `isMountedRef` guard so post-unmount paths (success toast, `onDeleted()`, `onClose()`, error toast, `setSubmitting(false)`) are no-ops if the user closed the modal mid-flight. Added a visible "Deleting..." `<p role="status" aria-live="polite">` so the active state is still communicated. Bonus: normalized the 429 message to "You are acting too fast..." (covers IN-04 for the delete path). |

## Skipped Findings

None.

## Info Findings (Out of Scope)

The following Info findings were NOT fixed (out of scope for this pass):

- IN-01: unused `currentUserId` prop in `AnnouncementsFeed` (documented intent — reserved for future ownership gating)
- IN-02: duplicated `EDITED_TOLERANCE_MS` / `PAGE_SIZE` / `toAnnouncementPayload` across three files (refactor for future phase)
- IN-03: `authorRole` fallback to "coach" mislabels null author (partially addressed by WR-03 — the API now guarantees the union, so the fallback in the card is essentially dead code unless `author === null`)
- IN-04 (delete path): partially addressed via WR-05 (delete dialog now says "acting too fast"). Create/edit form path in `AnnouncementForm.tsx:86` still says "posting too fast" — technically correct for the create path, slightly awkward for edit mode.
- IN-05: no upper bound on `page` query param in GET `/api/announcements`
- IN-06: `formatRelativeTime` returns empty string on NaN
- IN-07: non-null assertions in `getInitials`

## Post-Fix Verification

- `npx tsc --noEmit`: **PASS** (no errors).
- `npm run lint`: **PASS** for Phase 56 files. 4 pre-existing warnings outside Phase 56 scope (`student/loading.tsx`, `coach/CalendarTab.tsx`, `student/WorkTrackerClient.tsx`, `ui/Modal.tsx`) — none introduced by these fixes.

## Commits

```
0478220 fix(56): WR-05 allow Escape/backdrop close during delete with mount guard + Deleting status
77b9a9b fix(56): WR-04 add maxLength guard and trim content before POST in AnnouncementForm
fb0e26a fix(56): WR-03 narrow author.role to declared union at API boundary
49425e0 fix(56): WR-02 pin toast behind ref in AnnouncementsFeed handleLoadMore
ff68aaf fix(56): WR-01 add explicit min-h/min-w 44px to AnnouncementCard icon buttons
```

---

_Fixed: 2026-04-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
