---
phase: 56-announcements-crud-pages
plan: 03
status: complete
started: 2026-04-15
completed: 2026-04-15
requirements: [ANNOUNCE-05, ANNOUNCE-06, ANNOUNCE-07]
---

## What Was Built

Four thin role-scoped route files + sidebar NAV entries that make
`/announcements` discoverable from every role. Zero business logic —
each route is a 10-line delegation to Plan 02's shared
`<AnnouncementsPage />` server component.

## key-files.created

- `src/app/(dashboard)/owner/announcements/page.tsx`
- `src/app/(dashboard)/coach/announcements/page.tsx`
- `src/app/(dashboard)/student/announcements/page.tsx`
- `src/app/(dashboard)/student_diy/announcements/page.tsx`

## key-files.modified

- `src/lib/config.ts` — 4 new NavItems inserted into `NAVIGATION.owner`,
  `.coach`, `.student`, `.student_diy`
- `src/components/layout/Sidebar.tsx` — added `Megaphone` to the import
  list and the `ICON_MAP` literal (Case B — static icon map)

## NavItem entries added

| Role | Position | Entry |
|------|----------|-------|
| owner | between Alerts and Resources | `{ label: "Announcements", href: "/owner/announcements", icon: "Megaphone" }` |
| coach | between Alerts and Resources | `{ label: "Announcements", href: "/coach/announcements", icon: "Megaphone" }` |
| student | between Daily Report and Deals | `{ label: "Announcements", href: "/student/announcements", icon: "Megaphone" }` |
| student_diy | between Roadmap and Deals | `{ label: "Announcements", href: "/student_diy/announcements", icon: "Megaphone" }` |

None include a `badge` key (D-56-12).

## Sidebar icon wiring (Case B outcome)

The sidebar at `src/components/layout/Sidebar.tsx` uses a static
`ICON_MAP: Record<string, React.ComponentType>` keyed by icon-string.
The `Megaphone` icon was added to both:
1. The `lucide-react` named-import list at the top of the file
2. The `ICON_MAP` object literal below the imports

Without this change, the sidebar would have rendered nothing for the
new entries (ICON_MAP lookup returns undefined).

## Build manifest — new routes

```
├ ƒ /api/announcements           (from Plan 01)
├ ƒ /api/announcements/[id]      (from Plan 01)
├ ƒ /coach/announcements         (Plan 03)
├ ƒ /owner/announcements         (Plan 03)
├ ƒ /student_diy/announcements   (Plan 03)
├ ƒ /student/announcements       (Plan 03)
```

Six total new routes compiled into the production manifest.

## Self-Check: PASSED

- [x] Task 1 — 4 route files, each ≤ 15 lines, all importing
      `AnnouncementsPage` from `@/components/announcements/AnnouncementsPage`
- [x] Task 2 — 4 NavItems added, 0 badge keys on new entries
- [x] Task 3 — Case B sidebar update applied (`Megaphone` in ICON_MAP)
- [x] Task 4 — `npx tsc --noEmit` → EXIT=0
- [x] Task 4 — `npm run lint` → EXIT=0 (0 errors, 4 pre-existing warnings)
- [x] Task 4 — `npm run build` → EXIT=0 with all 6 new routes in manifest
- [x] HARD RULES sweep: no bare `animate-*`, no hex literals in new files,
      no `zod/v4`, no empty catches, every API `.from(` uses admin client,
      every client `fetch(` checks `response.ok`, icon buttons have aria-labels

## ANNOUNCE coverage

- [x] ANNOUNCE-05 — `/student/announcements` exists, serves read-only feed
- [x] ANNOUNCE-06 — `/student_diy/announcements` exists, equal read access
- [x] ANNOUNCE-07 — all four roles have a sidebar-accessible announcements page
