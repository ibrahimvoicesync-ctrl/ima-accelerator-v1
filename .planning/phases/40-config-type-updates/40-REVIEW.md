---
phase: 40-config-type-updates
reviewed: 2026-04-07T07:13:56Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/lib/config.ts
  - src/app/api/deals/route.ts
  - src/app/api/deals/[id]/route.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-04-07T07:13:56Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed `src/lib/config.ts` (platform configuration), `src/app/api/deals/route.ts` (POST + GET endpoints), and `src/app/api/deals/[id]/route.ts` (PATCH + DELETE endpoints). The most significant finding is that the `deals` table is missing from the Supabase `Database` type definition in `src/lib/types.ts`, which causes all deals API route handlers to fail TypeScript compilation (5 type errors confirmed via `npx tsc --noEmit`). Both route files are otherwise well-structured with proper auth, CSRF, rate limiting, Zod validation, and ownership-scoped queries. The config file is clean with one documentation mismatch.

## Critical Issues

### CR-01: Missing `deals` table in Database type definition causes compile errors

**File:** `src/lib/types.ts` (root cause), affects `src/app/api/deals/route.ts:87-100` and `src/app/api/deals/[id]/route.ts:109-115,189-193`
**Issue:** The `Database` type in `src/lib/types.ts` does not include a `deals` table definition. Since the Supabase client is typed as `createClient<Database>`, all `.from("deals")` calls resolve the row/insert/update types to `never`. This causes 5 TypeScript compilation errors:
- `route.ts:89` -- insert payload `{ student_id, revenue, profit }` not assignable to `never`
- `route.ts:98` -- retry insert same error
- `[id]/route.ts:111` -- `Record<string, number>` update payload not assignable to `never`
- `[id]/route.ts:202,210,233` -- `student_id` property does not exist on `never`

The code is functionally correct at runtime (Supabase will accept the queries regardless of TS types), but the build will fail under `strict` TypeScript since the project uses `npx tsc --noEmit` as a quality gate.

**Fix:** Add the `deals` table definition to `src/lib/types.ts` inside `Tables`. Based on the route handler fields and the DB trigger that assigns `deal_number`:
```typescript
deals: {
  Row: {
    id: string;
    student_id: string;
    deal_number: number;
    revenue: number;
    profit: number;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    student_id: string;
    deal_number?: number; // assigned by DB trigger
    revenue: number;
    profit: number;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    student_id?: string;
    deal_number?: number;
    revenue?: number;
    profit?: number;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "deals_student_id_fkey";
      columns: ["student_id"];
      isOneToOne: false;
      referencedRelation: "users";
      referencedColumns: ["id"];
    }
  ];
};
```
Alternatively, regenerate types with `npx supabase gen types typescript --local > src/lib/types.ts` if the local Supabase instance has the deals migration applied.

## Warnings

### WR-01: Missing UUID validation on `student_id` query parameter in GET /api/deals

**File:** `src/app/api/deals/route.ts:171-176`
**Issue:** The `student_id` query parameter is checked for presence but not validated as a UUID before being passed to the database query on line 188. The `[id]` route correctly validates UUIDs with a regex on line 45, but the collection route does not. While Supabase/Postgres will reject a malformed UUID with an error (not a security vulnerability), it results in an unhandled 500 error path instead of a clean 400 validation response.
**Fix:** Apply the same UUID validation used in the `[id]` route:
```typescript
// After line 176, add:
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(studentId)) {
  return NextResponse.json({ error: "Invalid student_id format" }, { status: 400 });
}
```
Or better, extract the `UUID_RE` constant into a shared module so both route files can import it.

### WR-02: Navigation comment contradicts code for student_diy Resources

**File:** `src/lib/config.ts:273` vs `src/lib/config.ts:319`
**Issue:** The comment block on line 273 states `Student_DIY: Dashboard, Work Tracker, Roadmap (NO Resources per D-11)` but the actual navigation array on lines 314-320 includes a Resources entry: `{ label: "Resources", href: ROUTES.student_diy.resources, icon: "BookOpen" }`. Either the comment is stale (Resources was added after D-11 was updated) or the code is wrong and student_diy should not have a Resources nav item. This discrepancy creates confusion about the intended behavior.
**Fix:** Determine the current product decision:
- If student_diy SHOULD have Resources: update the comment on line 273 to remove `(NO Resources per D-11)`.
- If student_diy should NOT have Resources: remove the Resources entry from lines 319 and the `resources` route from `ROUTES.student_diy` (line 97).

## Info

### IN-01: Skipped step number in GET /api/deals comment sequence

**File:** `src/app/api/deals/route.ts:160`
**Issue:** The numbered comment sequence in the GET handler skips from step 3 (role check, line 156) to step 5 (rate limit, line 160), missing a step 4. This is a minor readability issue that could confuse developers during future maintenance.
**Fix:** Renumber the comments sequentially (4 through 10) starting from the rate limit check.

---

_Reviewed: 2026-04-07T07:13:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
