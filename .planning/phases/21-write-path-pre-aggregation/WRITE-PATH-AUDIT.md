# Write Path Audit -- Phase 21

**Requirement:** WRITE-03
**Audited:** 2026-03-30
**Auditor:** Agent executing 21-02-PLAN.md

* * *

## Route Clarification

D-11 in CONTEXT.md references `POST /api/sessions` as the work session completion path.
**That route does not exist.** There is no `src/app/api/sessions/route.ts` in the codebase.
The actual work session state transition route is `PATCH /api/work-sessions/[id]`
located at `src/app/api/work-sessions/[id]/route.ts`.
All audit findings below use the correct route path.

* * *

## Summary

| Route | DB Calls | Verdict |
|-------|----------|---------|
| POST /api/reports | 4 | Optimal |
| PATCH /api/work-sessions/[id] (non-abandon) | 4 | Optimal |
| PATCH /api/work-sessions/[id] (abandon) | 4 | Optimal |

Both paths follow the pattern: **auth → profile → fetch → mutate**.
No unnecessary round trips exist. No refactoring recommended.

* * *

## POST /api/reports

**File:** `src/app/api/reports/route.ts`

| # | Operation | Code | Necessary? |
|---|-----------|------|------------|
| 1 | Auth check | `supabase.auth.getUser()` (user client) | Yes — JWT validation; determines caller identity |
| 2 | Profile lookup | `admin.from("users").select("id, role").eq("auth_id", authUser.id).single()` | Yes — maps Supabase `auth.uid` to `users.id`; needed for `student_id` FK and role gate |
| 3 | Existing report check | `admin.from("daily_reports").select("id").eq("student_id", profile.id).eq("date", date).maybeSingle()` | Yes — determines whether to INSERT or UPDATE |
| 4a | Report insert (new) | `admin.from("daily_reports").insert({...}).select().single()` | Yes — the mutation itself |
| 4b | Report update (existing) | `admin.from("daily_reports").update({...}).eq("id", existing.id).select().single()` | Yes — the mutation itself |

**Note:** Only one of 4a or 4b executes per request. Total = 4 DB calls in either case.

**Note:** `revalidateTag("badges", "default")` is NOT a DB call — it invalidates Next.js cache tags in memory.

**Verdict:** 4 calls, all necessary. No unnecessary round trips.

* * *

## PATCH /api/work-sessions/[id]

**File:** `src/app/api/work-sessions/[id]/route.ts`

### Standard transitions (completed, paused, in_progress/resume)

| # | Operation | Code | Necessary? |
|---|-----------|------|------------|
| 1 | Auth check | `supabase.auth.getUser()` (user client) | Yes — JWT validation |
| 2 | Profile lookup | `admin.from("users").select("id, role").eq("auth_id", authUser.id).single()` | Yes — maps auth_id to `users.id`; needed for `student_id` ownership filter and role gate |
| 3 | Session fetch | `admin.from("work_sessions").select("*").eq("id", id).eq("student_id", profile.id).single()` | Yes — validates ownership AND current `status` to enforce state-machine transitions (e.g., cannot complete a paused session without resuming) |
| 4 | Session update | `admin.from("work_sessions").update(update).eq("id", id).eq("student_id", profile.id).select().single()` | Yes — the mutation itself |

**Total: 4 DB calls.**

### Abandon transition

The abandon branch still performs the session fetch (call 3) before the delete, because the state-machine validation code runs on the fetched `session.status` before branching. The delete replaces the update as the mutation.

| # | Operation | Code | Necessary? |
|---|-----------|------|------------|
| 1 | Auth check | `supabase.auth.getUser()` | Yes |
| 2 | Profile lookup | `admin.from("users").select("id, role")...` | Yes |
| 3 | Session fetch | `admin.from("work_sessions").select("*").eq("id", id)...single()` | Yes — state validation before delete |
| 4 | Session delete | `admin.from("work_sessions").delete().eq("id", id).eq("student_id", profile.id)` | Yes — the mutation; deletes row so the cycle slot is freed for retry |

**Total: 4 DB calls.** (Same as non-abandon paths — the fetch is required for state validation.)

**Note:** The abandon delete returns `{ deleted: true }` with no `.select()`, so no extra round trip.

* * *

## Conclusion

Both write paths are already optimal:

- **POST /api/reports:** 4 DB calls (auth + profile + existence-check + upsert). The existence check is required to route INSERT vs UPDATE.
- **PATCH /api/work-sessions/[id]:** 4 DB calls (auth + profile + session-fetch + mutate). The session fetch is required for state-machine validation regardless of transition type.

No refactoring recommended. Both paths follow the same auth → profile → validate → mutate structure consistent with the rest of the codebase.
