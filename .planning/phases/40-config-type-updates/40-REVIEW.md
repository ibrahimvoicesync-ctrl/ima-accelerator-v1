---
phase: 40-config-type-updates
reviewed: 2026-04-07T12:30:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/lib/config.ts
  - src/app/api/deals/route.ts
  - src/app/api/deals/[id]/route.ts
  - src/lib/types.ts
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-04-07T12:30:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the config file (`config.ts`), both deals API route handlers (`route.ts` and `[id]/route.ts`), and the Supabase type definitions (`types.ts`). The route handlers are well-structured with proper auth, CSRF, rate limiting, Zod validation, and ownership-scoped mutations. The most significant finding is an authorization gap in the GET endpoint where coaches can view any student's deals without verifying assignment -- a pattern that the DELETE endpoint in the same codebase correctly handles. There is also a type mismatch between the DB type definitions and the Zod validation schemas for `revenue`/`profit`, and a stale documentation comment that contradicts the navigation code.

## Critical Issues

### CR-01: GET /api/deals allows coaches to view any student's deals without assignment check

**File:** `src/app/api/deals/route.ts:155-191`
**Issue:** The GET endpoint checks that the caller is a `coach` or `owner` (line 156) but does not verify that a coach is actually assigned to the requested student. Any authenticated coach can pass any `student_id` query parameter and retrieve that student's deals, even if the student is assigned to a different coach. This is an authorization bypass.

For comparison, the DELETE endpoint in `src/app/api/deals/[id]/route.ts:205-216` correctly checks coach assignment:
```typescript
// DELETE properly checks coach_id assignment
const { data: assignedStudent } = await admin
  .from("users")
  .select("id")
  .eq("id", deal.student_id)
  .eq("coach_id", profile.id)
  .single();
```

The GET endpoint has no equivalent check.

**Fix:** Add coach-scoped authorization between the `student_id` presence check (line 176) and the page parsing (line 180):
```typescript
// After line 176, add coach assignment check:
if (profile.role === "coach") {
  const { data: assignedStudent } = await admin
    .from("users")
    .select("id")
    .eq("id", studentId)
    .eq("coach_id", profile.id)
    .single();

  if (!assignedStudent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
// Owner passes through -- can view any student's deals
```

## Warnings

### WR-01: Type mismatch -- deals revenue/profit typed as `string | number` in DB types but validated as `number` in Zod

**File:** `src/lib/types.ts:668-669` (Row type), `src/app/api/deals/route.ts:15-16` (Zod schema)
**Issue:** The `deals` table in `types.ts` defines `revenue` and `profit` as `string | number` (lines 668-669), which is correct for Postgres `numeric` columns -- Supabase's PostgREST returns these as strings to avoid JavaScript floating-point precision loss. However, the Zod schemas in both route files validate these as `z.number()` only. This creates two problems:

1. **Insert path:** The route handlers insert `number` values, which Supabase accepts, but the DB type expects `string | number`. TypeScript may flag this depending on how the admin client is typed.
2. **Read path (GET):** When the GET endpoint returns deals on line 198, the `revenue` and `profit` fields in the response will be strings (from Supabase), not numbers. Any client consuming this response that performs arithmetic on these fields (e.g., summing revenue) will get string concatenation instead of addition.

**Fix:** Either:
- (A) Change the DB type to `number` if you have confirmed Supabase returns numbers for this column (unlikely for `numeric` type), or
- (B) Parse the response data before returning from GET to ensure consistent types:
```typescript
// Before returning on line 198, normalize numeric fields:
const normalized = (data ?? []).map((d) => ({
  ...d,
  revenue: Number(d.revenue),
  profit: Number(d.profit),
}));
return NextResponse.json({ data: normalized, total: count ?? 0, page });
```

### WR-02: Missing UUID validation on `student_id` query parameter in GET /api/deals

**File:** `src/app/api/deals/route.ts:171-176`
**Issue:** The `student_id` query parameter is checked for presence (line 175) but not validated as a UUID before being passed to the database query (line 188). The `[id]/route.ts` file correctly validates UUIDs with `UUID_RE` on line 45, but the collection route does not. While Supabase/Postgres will reject a malformed UUID with an error, it results in an unhandled 500 response path from line 193 instead of a clean 400 validation error.
**Fix:** Apply the same UUID validation used in the `[id]` route:
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// After line 176, add:
if (!UUID_RE.test(studentId)) {
  return NextResponse.json({ error: "Invalid student_id format" }, { status: 400 });
}
```
Ideally, extract `UUID_RE` to a shared module so both route files import from the same source.

### WR-03: Navigation comment contradicts code for student_diy

**File:** `src/lib/config.ts:273` vs `src/lib/config.ts:314-320`
**Issue:** The comment block on line 273 states `Student_DIY: Dashboard, Work Tracker, Roadmap (NO Resources per D-11)` but the actual `student_diy` navigation array on lines 314-320 includes both a "Deals" entry (line 318) and a "Resources" entry (line 319). The comment is stale -- it predates the addition of Deals and Resources to the student_diy nav. This creates confusion about the intended product behavior.
**Fix:** Update the comment on line 273 to reflect the current code:
```typescript
//   - Student_DIY: Dashboard, Work Tracker, Roadmap, Deals, Resources
```

## Info

### IN-01: Skipped step number in GET /api/deals comment sequence

**File:** `src/app/api/deals/route.ts:155-160`
**Issue:** The numbered comment steps in the GET handler jump from "3. Role check" (line 155) to "5. Rate limit" (line 160), skipping number 4. This minor readability issue may confuse developers during maintenance.
**Fix:** Renumber the comment steps sequentially from 4 onward (rate limit = 4, query params = 5, etc.).

---

_Reviewed: 2026-04-07T12:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
