---
phase: 09-owner-invites-assignments-alerts
plan: 01
subsystem: owner-invites
tags: [owner, invites, magic-links, api, ui]
dependency_graph:
  requires: []
  provides: [owner-invite-api, owner-invites-page]
  affects: [coach-invite-api, magic-links-api]
tech_stack:
  added: []
  patterns: [role-param-in-body, conditional-coach-id, optimistic-toggle]
key_files:
  created:
    - src/app/(dashboard)/owner/invites/page.tsx
    - src/components/owner/OwnerInvitesClient.tsx
  modified:
    - src/app/api/invites/route.ts
    - src/app/api/magic-links/route.ts
decisions:
  - "coach_id set to null when owner creates invite — owner invites are platform-level, not coach-assigned"
  - "Owner can toggle any magic link in PATCH (not just their own) — admin override pattern"
  - "Role selector defaults to student — safest default, prevents accidental coach invite creation"
  - "OwnerInvitesClient shows role column in invite history — distinguishes coach vs student invites visually"
metrics:
  duration: "3 min"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_changed: 4
---

# Phase 9 Plan 01: Owner Invites Page Summary

Owner can now generate email invites and magic links for both coach and student roles via a dedicated /owner/invites page with a role selector dropdown.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend invite and magic-link APIs for owner role | 959810d | src/app/api/invites/route.ts, src/app/api/magic-links/route.ts |
| 2 | Create owner invites page and OwnerInvitesClient | 2dededa | src/app/(dashboard)/owner/invites/page.tsx, src/components/owner/OwnerInvitesClient.tsx |

## What Was Built

**API extensions (Task 1):**
- POST /api/invites now accepts `role: "coach" | "student"` in body, allows owner role in addition to coach
- Coaches remain restricted to `role=student` only via post-validation guard
- `coach_id` set conditionally: `profile.id` when coach creates invite, `null` when owner creates invite
- POST /api/magic-links signature changed from `POST()` to `POST(request: NextRequest)` to parse optional role body
- POST /api/magic-links accepts `role: "coach" | "student"` with coach restriction enforced
- PATCH /api/magic-links now allows owner role and owner can toggle any link (not just their own)

**UI (Task 2):**
- `/owner/invites` server page with `requireRole("owner")` guard
- 4 stat cards: Total Invites, Used, Active Links, Expired/Inactive
- `OwnerInvitesClient` — role selector `<select>` (student/coach) above tabs
- Email invite tab with role-aware placeholder text and role passed in POST body
- Magic link tab with role passed in POST body
- Copy-to-clipboard for generated URLs
- Invite history shows role label per row
- Magic links history shows role label with optimistic activate/deactivate toggle

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit`: passes
- `npm run lint`: passes
- `npm run build`: passes — `/owner/invites` appears in route table as `ƒ (Dynamic)`

## Self-Check: PASSED

- src/app/(dashboard)/owner/invites/page.tsx: FOUND
- src/components/owner/OwnerInvitesClient.tsx: FOUND
- Commit 959810d: FOUND
- Commit 2dededa: FOUND
