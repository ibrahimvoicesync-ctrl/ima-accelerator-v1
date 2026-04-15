---
phase: 56-announcements-crud-pages
plan: 02
status: complete
started: 2026-04-15
completed: 2026-04-15
requirements: [ANNOUNCE-02, ANNOUNCE-03, ANNOUNCE-04, ANNOUNCE-05, ANNOUNCE-06, ANNOUNCE-08, ANNOUNCE-12]
---

## What Was Built

Five React components + one shared types file that render the announcements
feed identically across all four roles, plus a small `formatRelativeTime`
helper needed for timestamps.

## key-files.created

- `src/components/announcements/announcement-types.ts`
- `src/components/announcements/AnnouncementsPage.tsx` (server component)
- `src/components/announcements/AnnouncementsFeed.tsx` (client)
- `src/components/announcements/AnnouncementCard.tsx` (client)
- `src/components/announcements/AnnouncementForm.tsx` (client)
- `src/components/announcements/DeleteAnnouncementDialog.tsx` (client)
- `src/lib/chat-utils.ts` — `formatRelativeTime(date: Date): string`

## Component Dependency Graph

```
AnnouncementsPage (server)
  └─ requireRole(role) + admin query (page 1, 25 items)
     └─ AnnouncementsFeed (client)
        ├─ AnnouncementForm mode="create" (inline, conditional)
        └─ AnnouncementCard[]
           ├─ AnnouncementForm mode="edit" (inline, conditional)
           └─ DeleteAnnouncementDialog (Modal wrapper)
```

## Fetch URLs per component

| Component | Method | URL |
|-----------|--------|-----|
| AnnouncementsFeed | GET | `/api/announcements?page=N+1` (Load more) |
| AnnouncementForm (create) | POST | `/api/announcements` |
| AnnouncementForm (edit) | PATCH | `/api/announcements/{id}` |
| DeleteAnnouncementDialog | DELETE | `/api/announcements/{id}` |

Every `fetch` checks `response.ok` before parsing JSON (Hard Rule 6).

## Deviations from UI-SPEC

None in copy, layout, or interaction.

One incidental gap closure: `src/lib/chat-utils.ts` was referenced by
Plan 02's Task 5 `read_first` list but did not exist on master (Phase 55
removed the chat feature entirely). Rather than refactor to a different
path, the minimal `formatRelativeTime` helper was re-introduced in a
new file at that exact path. This keeps the plan code verbatim and
preserves a clean import surface for any future reuse.

## Self-Check: PASSED

- [x] Task 1 — shared types (no `"use client"`, safe to import both sides)
- [x] Task 2 — server component, no `"use client"`, uses admin client
- [x] Task 3 — form with 2000 char counter, char turns `text-ima-error` over
- [x] Task 4 — delete dialog via Modal primitive, danger + ghost Buttons
- [x] Task 5 — card with read/edit modes + 44x44 icon buttons + aria-labels
- [x] Task 6 — feed with Load more (dedupe), role-aware empty state,
      `motion-safe:animate-fadeIn` on create-panel entry
- [x] `npx tsc --noEmit` → EXIT=0
- [x] `npm run lint` → EXIT=0 (0 errors, 4 pre-existing warnings)
- [x] `npm run build` → EXIT=0
- [x] No hex literals in any file
- [x] No raw `animate-*` without `motion-safe:` prefix
- [x] No empty `catch {}` — every catch logs via `console.error` or toasts
- [x] Every interactive element is `>=44px` (via Button primitive sizes)

## Requirements coverage

- ANNOUNCE-02 — "New Announcement" button gated to owner/coach
- ANNOUNCE-03 / 04 — Edit + Delete icon buttons render on every card for
  owner/coach; no ownership filter (can act on any)
- ANNOUNCE-05 / 06 — student + student_diy see read-only feed (gated by
  `canAuthor = role === "owner" || role === "coach"`)
- ANNOUNCE-08 — Load more paginates via `?page=N+1`; hides when hasMore===false
- ANNOUNCE-12 — `(edited)` literal renders when `is_edited === true`
