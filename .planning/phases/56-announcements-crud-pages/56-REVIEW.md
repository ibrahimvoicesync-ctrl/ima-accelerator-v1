---
phase: 56-announcements-crud-pages
reviewed: 2026-04-15T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - eslint.config.mjs
  - src/app/(dashboard)/coach/announcements/page.tsx
  - src/app/(dashboard)/owner/announcements/page.tsx
  - src/app/(dashboard)/student/announcements/page.tsx
  - src/app/(dashboard)/student_diy/announcements/page.tsx
  - src/app/api/announcements/[id]/route.ts
  - src/app/api/announcements/route.ts
  - src/components/announcements/AnnouncementCard.tsx
  - src/components/announcements/AnnouncementForm.tsx
  - src/components/announcements/AnnouncementsFeed.tsx
  - src/components/announcements/AnnouncementsPage.tsx
  - src/components/announcements/DeleteAnnouncementDialog.tsx
  - src/components/announcements/announcement-types.ts
  - src/components/layout/Sidebar.tsx
  - src/lib/chat-utils.ts
  - src/lib/config.ts
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 56: Code Review Report

**Reviewed:** 2026-04-15
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 56 delivers the announcements CRUD feature — four role-scoped pages, a
shared server component that SSRs the first page, two API route handlers
(collection + item), and the supporting client components (form, card, feed,
delete dialog). Overall quality is strong: CSRF + auth + role + rate-limit +
Zod gates are applied consistently on both route files; the admin client is
used for every `.from()` call (Hard Rule 4 passes); `catch` blocks all
`console.error` and/or toast (Hard Rule 5 passes); every `fetch()` checks
`response.ok` before parsing JSON (Hard Rule 6 passes); Zod is imported from
`"zod"` (Hard Rule 7 passes); no hardcoded hex colors — only ima-* tokens
(Hard Rule 8 passes); inputs have proper labels/aria-label (Hard Rule 3
passes); the one `animate-*` class (`motion-safe:animate-fadeIn` on line 176
of `AnnouncementsFeed.tsx`) is correctly gated (Hard Rule 1 passes).

The issues below are primarily **warnings around touch-target compliance**
(Hard Rule 2), **a stale-closure risk in AnnouncementsFeed**, **a type
inconsistency between `announcement-types.ts` and server payloads**, and
**small quality nits** (unused prop, inconsistent toast copy, missing
`maxLength` on the Textarea). No critical bugs or security issues.

## Warnings

### WR-01: Icon buttons in AnnouncementCard header may miss 44px touch target

**File:** `src/components/announcements/AnnouncementCard.tsx:85-106`
**Issue:** The Edit and Delete buttons use `<Button variant="ghost" size="icon">`.
Hard Rule 2 requires every interactive element to be at least 44×44px. The
review cannot confirm from the `Button` primitive alone that `size="icon"`
resolves to `min-h-[44px] min-w-[44px]` — in many CVA setups `size="icon"`
defaults to 36×36 or 40×40 (e.g., `h-9 w-9` / `h-10 w-10`). These are
owner/coach mutation controls that must be thumb-friendly on mobile.
**Fix:** Verify that `size="icon"` in `src/components/ui/Button.tsx`
resolves to `min-h-[44px] min-w-[44px]`. If not, either add that size
variant or pass an explicit class:
```tsx
<Button
  type="button"
  variant="ghost"
  size="icon"
  className="min-h-[44px] min-w-[44px]"
  aria-label="Edit announcement"
  onClick={() => setEditing(true)}
>
  <Pencil className="h-4 w-4" aria-hidden="true" />
</Button>
```

### WR-02: `handleLoadMore` stale-closure — `toast` rebinds trigger unnecessary rebinds, but `page` is the real issue is benign; however `toast` is not stable

**File:** `src/components/announcements/AnnouncementsFeed.tsx:65-108`
**Issue:** `handleLoadMore` lists `toast` in its dependency array. Per the
CLAUDE.md guidance ("Stable useCallback deps — use refs for toast/router"),
`toast` should be pinned behind a ref rather than captured as a dep. The
pattern is correctly applied in `AnnouncementForm.tsx` and
`DeleteAnnouncementDialog.tsx` (via `toastRef`), so this file is inconsistent
with the rest of Phase 56 and with the project convention. On every
`useToast()` identity change, `handleLoadMore` rebinds, which in turn causes
any memoized child that takes it as a prop to rerender.
**Fix:** Apply the same `toastRef` pattern used in the other two client
components:
```tsx
const toastRef = useRef(toast);
useEffect(() => { toastRef.current = toast; }, [toast]);

const handleLoadMore = useCallback(async () => {
  // ... replace `toast({...})` with `toastRef.current({...})`
}, [loadingMore, hasMore, page]); // drop `toast` from deps
```

### WR-03: `AnnouncementAuthor.role` type narrows to `"owner" | "coach"` but the API payload returns `string`

**File:** `src/components/announcements/announcement-types.ts:14-18`
**Cross-ref:** `src/app/api/announcements/route.ts:40,58-60` and
`src/app/api/announcements/[id]/route.ts:47,63`
**Issue:** The shared `AnnouncementAuthor.role` is typed `"owner" | "coach"`,
but both route handlers' `toAnnouncementPayload` assign `row.author.role`
directly without narrowing — so at runtime the payload can contain any string
(e.g., `"student"` if RLS/data ever slips). `AnnouncementsPage.tsx:82-85`
DOES defensively coerce unknown roles to `"coach"` before rendering, but the
API layer does not, meaning the client `fetch()` path (load-more and the
POST/PATCH responses) can return data that violates the declared type. This
is a type-lie that TypeScript won't catch at compile time because `as
AnnouncementRow` casts the row before the shape is narrowed.
**Fix:** Narrow at the API boundary so one invariant holds everywhere:
```ts
// in both route.ts and [id]/route.ts
author: row.author
  ? {
      id: row.author.id,
      name: row.author.name,
      role: (row.author.role === "owner" || row.author.role === "coach")
        ? row.author.role
        : "coach",
    }
  : null,
```
Alternatively, widen `AnnouncementAuthor.role` to `string` — but narrowing
is safer because the badge rendering in `AnnouncementCard.tsx:57-58`
assumes exactly the two values.

### WR-04: `Textarea` has no hard `maxLength` — the 2000-char limit is advisory only on the client

**File:** `src/components/announcements/AnnouncementForm.tsx:136-149`
**Issue:** The form shows an error state + disables Submit when
`content.length > MAX_CONTENT_LENGTH`, but the Textarea itself has no
`maxLength={2000}` attribute. A paste of a 10KB string will be accepted into
state and flow through `canSubmit` gating correctly, but there is no
browser-level guardrail and the counter can grow to very large numbers on
mobile before the user realizes. Also, **`content` is sent with non-trimmed
whitespace** — `canSubmit` uses `trimmedLength`, but the POST body sends
`content` (raw). The Zod schema does `.trim().min(1)`, which will save the
trimmed value, so the visual "submitted" content will be shorter than what
the user sees locally. This is only a UX quirk, not a data bug (DB stores
the server-trimmed value).
**Fix:** Add `maxLength` and send trimmed content:
```tsx
<Textarea
  id={`announcement-content-${mode}`}
  rows={5}
  value={content}
  onChange={(e) => setContent(e.target.value)}
  placeholder="Share an update with your students…"
  disabled={submitting}
  maxLength={MAX_CONTENT_LENGTH}
  aria-describedby={`announcement-counter-${mode}`}
  // ...
/>
// and in handleSubmit:
body: JSON.stringify({ content: content.trim() }),
```

### WR-05: `DeleteAnnouncementDialog.onClose={submitting ? () => {} : onClose}` swallows Escape/backdrop close silently

**File:** `src/components/announcements/DeleteAnnouncementDialog.tsx:92`
**Issue:** While a DELETE is in flight, passing an empty function as
`onClose` disables the Modal's Escape/backdrop-click behavior. The intent
is correct (don't let the user close while the request is pending), but
this is a dead-end for keyboard users — no visible indication that Escape
was ignored, and the "Keep it" cancel button is also disabled. This is a
Warning because under slow networks or timeouts the user is trapped until
the fetch resolves (timeouts can be 30+ seconds). Better: leave `onClose`
intact so Escape still works but have the unmount guard block the success
toast path. Or render a spinner overlay with a clear "Deleting..." state.
**Fix:** Prefer allowing close and treating an in-flight response's
`onDeleted()` as a no-op after unmount, OR add an explicit "Deleting…"
status line so trapped users know it will release soon:
```tsx
<Modal
  open={open}
  onClose={onClose} // allow close even while submitting
  // ...
>
  {submitting && (
    <p role="status" aria-live="polite" className="text-xs text-ima-text-secondary">
      Deleting…
    </p>
  )}
  {/* ... */}
</Modal>
```
If you keep the current guard, add a visible "Deleting…" message so the
user knows why Escape does nothing.

## Info

### IN-01: Unused prop `currentUserId` in AnnouncementsFeed

**File:** `src/components/announcements/AnnouncementsFeed.tsx:29-34`
**Issue:** `currentUserId` is passed from `AnnouncementsPage.tsx:118`
(`user.id`) but is destructured-out of the props signature and never used
(the comment says "reserved for future ownership UI gating"). Dead prop =
noisy type surface and lint warnings if `@typescript-eslint/no-unused-vars`
is strict.
**Fix:** Either use it (e.g., to hide Edit/Delete on *other* people's rows
in case Hard Rule-4 ever flips to "edit-own-only"), or drop it until then.

### IN-02: Duplicated `EDITED_TOLERANCE_MS` / `PAGE_SIZE` / row-to-payload logic

**File:** `src/app/api/announcements/route.ts:13-63`, `src/app/api/announcements/[id]/route.ts:19-66`, `src/components/announcements/AnnouncementsPage.tsx:26-89`
**Issue:** `EDITED_TOLERANCE_MS = 2000` and `PAGE_SIZE = 25` are redeclared
in three files; the row-to-payload transform is also duplicated (inline in
the server component and as `toAnnouncementPayload` in both route files).
The comment in `[id]/route.ts:36-39` correctly notes that route files can't
export non-HTTP-verb symbols, but nothing prevents hoisting the constants
and transform to a shared helper (e.g., `src/lib/announcements.ts`) and
importing it everywhere. Drift risk: if D-56-07 is ever changed to 1000ms,
three places need to move in lockstep.
**Fix:** Extract to `src/lib/announcements.ts`:
```ts
export const PAGE_SIZE = 25;
export const EDITED_TOLERANCE_MS = 2000;
export type AnnouncementRow = { /* ... */ };
export function toAnnouncementPayload(row: AnnouncementRow) { /* ... */ }
```
Import from both route files and `AnnouncementsPage.tsx`.

### IN-03: `authorRole` fallback to `"coach"` silently mislabels unknown roles

**File:** `src/components/announcements/AnnouncementCard.tsx:56-58`
**Issue:** When `announcement.author?.role` is falsy, it defaults to
`"coach"` — meaning any orphaned/null author renders a green "Coach" badge.
If an owner's row ever ships with `author: null` (e.g., cascade-null from a
deleted users row), the UI will misattribute it. Consider `"Unknown"` or
suppressing the badge entirely when `author` is null.
**Fix:**
```tsx
const authorRole = announcement.author?.role; // may be undefined
const badgeVariant = authorRole === "owner" ? "info" : "success";
const badgeLabel =
  authorRole === "owner" ? "Owner" :
  authorRole === "coach" ? "Coach" : null;
// ...
{badgeLabel && <Badge variant={badgeVariant}>{badgeLabel}</Badge>}
```

### IN-04: Toast copy mismatch between `title` and `description` in AnnouncementForm

**File:** `src/components/announcements/AnnouncementForm.tsx:93-99`
**Issue:** On error, the toast `title` says "Could not post the announcement.
Try again." (hardcoded, even in edit mode the title-vs-description branch
uses different copy), while `description` carries the server's actual error
message. For rate-limit 429, the description says "You are posting too fast.
Please wait a minute." — but the title still says "Could not post the
announcement" even in edit mode. There's a conditional for create-vs-edit
title, so this appears correct, but the **description for 429 says "posting"
even when editing**, which is minor UX cruft. Same issue in
`DeleteAnnouncementDialog.tsx:53` where the 429 message reads "You are
posting too fast" during a delete.
**Fix:** Make the 429 message mode-agnostic:
```tsx
message = "You are acting too fast. Please wait a minute.";
```

### IN-05: `parseInt(pageParam, 10) || 1` masks NaN vs genuine 0

**File:** `src/app/api/announcements/route.ts:208`
**Issue:** `parseInt("abc", 10)` is NaN, which is falsy → becomes 1 (fine).
But `parseInt("0", 10)` is 0, which is also falsy → becomes 1 (also fine,
because `Math.max(1, 1) === 1`). Net behavior is correct; just noting the
double-clamp is redundant. More importantly, **there is no upper bound** on
`page` — `?page=999999999` will issue an expensive range query returning
no rows. Consider clamping.
**Fix:**
```ts
const page = Math.min(10_000, Math.max(1, parseInt(pageParam, 10) || 1));
```

### IN-06: `formatRelativeTime` returns empty string on invalid dates

**File:** `src/lib/chat-utils.ts:18`
**Issue:** `if (Number.isNaN(diffSec)) return "";` — an empty `<time>`
element is accessibility-hostile (screen readers announce empty labels).
If the ISO string is malformed, the UI will render an empty span with no
indication why. Low risk because Postgres `timestamptz` always produces
valid ISO, but worth a fallback.
**Fix:**
```ts
if (Number.isNaN(diffSec)) return "unknown time";
```

### IN-07: `getInitials` uses non-null assertions on array access

**File:** `src/components/announcements/AnnouncementCard.tsx:41-42`
**Issue:** `parts[0]!.slice(0, 2)` and `parts[0]![0]! + parts[parts.length - 1]![0]!`
use the non-null assertion operator after guards — safe today, but
`parts[0]![0]!` assumes the first/last element has at least one character.
If `name = " "` (single space), `parts` after `split(/\s+/)` is `["", ""]`,
`parts[0]` is `""`, and `parts[0]![0]` is `undefined`. The `toUpperCase()`
call on `undefined` throws. Low probability (upstream schema blocks empty
names) but a real edge.
**Fix:** Filter empty parts:
```ts
const parts = name.trim().split(/\s+/).filter(Boolean);
if (parts.length === 0) return "?";
if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || "?";
const first = parts[0][0] ?? "";
const last = parts[parts.length - 1][0] ?? "";
return (first + last).toUpperCase() || "?";
```

---

## Hard Rules Checklist

| Rule | Status | Notes |
|------|--------|-------|
| 1. `motion-safe:` on every `animate-*` | PASS | Only one `animate-fadeIn` in scope (`AnnouncementsFeed.tsx:176`), correctly gated. |
| 2. 44px touch targets | WARN | WR-01 — icon buttons in `AnnouncementCard` need verification. Other buttons use `size="md"` which presumably is 44px; verify. |
| 3. Accessible labels | PASS | Textarea has `<label htmlFor>`; icon buttons have `aria-label`; decorative icons have `aria-hidden`. |
| 4. Admin client in API `.from()` | PASS | Both route files use `createAdminClient()` for every `.from()` call. `AnnouncementsPage.tsx` (server component) also uses `createAdminClient`. |
| 5. Never swallow errors | PASS | All `catch` blocks `console.error` and/or toast. |
| 6. Check `response.ok` before `JSON` parse | PASS | Both `AnnouncementForm` and `DeleteAnnouncementDialog` and `AnnouncementsFeed.handleLoadMore` check `response.ok`. |
| 7. Zod import from `"zod"` | PASS | Both route files use `import { z } from "zod";`. |
| 8. ima-* tokens only | PASS | No hardcoded hex/gray in any file; all colors use `text-ima-*`, `bg-ima-*`, `border-ima-*`. |

---

_Reviewed: 2026-04-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
