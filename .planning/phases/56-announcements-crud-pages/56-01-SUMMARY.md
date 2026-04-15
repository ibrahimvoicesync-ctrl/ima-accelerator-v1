---
phase: 56-announcements-crud-pages
plan: 01
status: complete
started: 2026-04-15
completed: 2026-04-15
requirements: [ANNOUNCE-02, ANNOUNCE-03, ANNOUNCE-04, ANNOUNCE-08, ANNOUNCE-11, ANNOUNCE-12]
---

## What Was Built

Four HTTP endpoints that back the announcements UI, following the gate chain
locked by D-56-12 and CLAUDE.md:

| Method | Path | Access | Gates |
|--------|------|--------|-------|
| POST | `/api/announcements` | owner, coach | CSRF → Auth → Profile → Role → RateLimit (30/min) → Zod (1..2000) → insert |
| GET | `/api/announcements?page=N` | any authenticated user | Auth → Profile → paginate 25/page, `created_at DESC`, joined author, computed `is_edited` |
| PATCH | `/api/announcements/[id]` | owner, coach (ANY row) | UUID → CSRF → Auth → Profile → Role → RateLimit → Zod → update |
| DELETE | `/api/announcements/[id]` | owner, coach (ANY row) | UUID → CSRF → Auth → Profile → Role → RateLimit → existence check → delete |

## key-files.created

- `src/app/api/announcements/route.ts` — POST + GET
- `src/app/api/announcements/[id]/route.ts` — PATCH + DELETE

## Response envelopes

```typescript
// POST 201
{ announcement: Announcement }
// PATCH 200
{ announcement: Announcement }
// DELETE 200
{ success: true }
// GET 200
{ items: Announcement[], hasMore: boolean, total: number }
// Errors (400 | 401 | 403 | 404 | 429 | 500)
{ error: string }
```

`Announcement` includes computed `is_edited: boolean` (tolerance 2000ms per
D-56-07) and a joined `author: { id, name, role }` resolved via
`author:users!announcements_author_id_fkey(id, name, role)`.

## Rate-limit keys

- `/api/announcements` (POST) — default 30 req / 60s per user
- `/api/announcements/[id]` (PATCH, DELETE) — default 30 req / 60s per user

## Reference curl for Plan 02 consumers

```bash
curl -X POST http://localhost:3000/api/announcements \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "Cookie: <session cookie>" \
  --data '{"content":"Welcome to IMA Accelerator — new cohort starting Monday."}'
# → 201 { "announcement": { "id": "...", "content": "...", "is_edited": false,
#                            "author": { "id": "...", "name": "...", "role": "owner" },
#                            "created_at": "...", "updated_at": "..." } }
```

## Self-Check: PASSED

- [x] Task 1 committed (`8973f82`) — POST + GET handlers
- [x] Task 2 committed (`f2dea8c`) — PATCH + DELETE handlers
- [x] `npx tsc --noEmit` → EXIT=0
- [x] `npm run lint` → EXIT=0 (4 pre-existing warnings, 0 errors; none in announcements)
- [x] `npm run build` → EXIT=0
- [x] No `zod/v4` import
- [x] All queries use `createAdminClient()` (CLAUDE.md Hard Rule 4)
- [x] No empty `catch {}` blocks (CLAUDE.md Hard Rule 5)
- [x] Zod import path correct (CLAUDE.md Hard Rule 7)
- [x] Incidental: added `.claude/worktrees/**` to eslint globalIgnore to stop
      orphan worktree copies from polluting lint output (committed `24ca885`)

## Requirements coverage

- ANNOUNCE-02 — POST owner/coach create
- ANNOUNCE-03 — PATCH any (no ownership filter)
- ANNOUNCE-04 — DELETE any (no ownership filter)
- ANNOUNCE-08 — 25/page pagination with `hasMore` + `total`
- ANNOUNCE-11 — auth + role + CSRF + 30/min rate limit on all mutations
- ANNOUNCE-12 — `is_edited` computed with 2000ms tolerance on every
  row returned by GET and PATCH
