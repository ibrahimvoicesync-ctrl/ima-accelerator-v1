---
status: diagnosed
trigger: "Roadmap always shows 'No roadmap progress yet' even when the student has roadmap progress data in the database"
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T00:00:00Z
---

## Current Focus

hypothesis: Code path is correct. Root cause is Database types mismatch causing the as-any workaround, which masks potential PostgREST function resolution issues OR migration not deployed.
test: Verified code path from SQL to RoadmapTab — all correct
expecting: N/A — diagnosis complete
next_action: Return structured diagnosis

## Symptoms

expected: Roadmap tab shows student's roadmap progress with step statuses
actual: Always shows "No roadmap progress yet" empty state (roadmap.length === 0)
errors: No error messages — data silently empty
reproduction: Visit owner/students/[studentId]?tab=roadmap for any student with roadmap_progress rows
started: After Phase 20 consolidation (moved from individual queries to single RPC)

## Eliminated

- hypothesis: SQL function does not query roadmap_progress correctly
  evidence: Lines 242-252 of 00010 correctly SELECT from roadmap_progress WHERE student_id = p_student_id with COALESCE to [] default
  timestamp: 2026-03-30T00:04:00Z

- hypothesis: TypeScript type mismatch between RPC result and component props
  evidence: StudentDetailResult.roadmap matches RoadmapTab's RoadmapProgressRow type (step_number, status, completed_at)
  timestamp: 2026-03-30T00:05:00Z

- hypothesis: supabase-js .rpc() wraps JSONB in array or returns string
  evidence: Read postgrest-js source (index.mjs lines 85-151) — body is JSON.parse'd directly, no wrapping for scalar returns
  timestamp: 2026-03-30T00:06:00Z

- hypothesis: Owner page maps roadmap data differently than coach page
  evidence: Both pages use identical code: detail.roadmap as Array<...>; both pass roadmap prop to RoadmapTab identically
  timestamp: 2026-03-30T00:07:00Z

- hypothesis: p_include_coach_mgmt=true flag corrupts roadmap in SQL result
  evidence: SQL builds v_result with v_roadmap BEFORE the coach_mgmt conditional; the || merge only adds coaches/student_counts keys
  timestamp: 2026-03-30T00:08:00Z

- hypothesis: RoadmapTab component has a rendering bug
  evidence: Component shows empty state only when roadmap.length === 0; otherwise renders correctly using ROADMAP_STEPS map
  timestamp: 2026-03-30T00:09:00Z

- hypothesis: Next.js RSC serialization loses the roadmap array
  evidence: roadmap contains only JSON-serializable types (number, string, string|null); no circular refs or functions
  timestamp: 2026-03-30T00:10:00Z

## Evidence

- timestamp: 2026-03-30T00:01:00Z
  checked: SQL RPC function get_student_detail (00010_query_consolidation.sql lines 242-252)
  found: RPC correctly queries roadmap_progress and returns it as 'roadmap' key in the JSONB result object
  implication: SQL side looks correct

- timestamp: 2026-03-30T00:02:00Z
  checked: Owner page (page.tsx) mapping of RPC result to component props
  found: Page casts detailData to StudentDetailResult, accesses detail.roadmap, passes to component
  implication: TypeScript mapping looks correct IF the data arrives as expected shape

- timestamp: 2026-03-30T00:03:00Z
  checked: RoadmapTab component
  found: Shows empty state when roadmap.length === 0 (line 18). The component itself is fine.
  implication: The issue is upstream — either RPC returns empty roadmap or data is lost in transit

## Resolution

root_cause: |
  After exhaustive code analysis (SQL function, TypeScript types, page data mapping, client
  component rendering, supabase-js runtime behavior), all code paths are logically correct.
  The data flow from RPC to RoadmapTab is sound.

  PRIMARY: The Database types in src/lib/types.ts define get_student_detail with only 2 Args
  (p_student_id, p_include_coach_mgmt) but the actual SQL function requires 4 parameters
  (p_student_id, p_month_start, p_month_end, p_include_coach_mgmt). This mismatch forced
  the use of `(admin as any).rpc(...)` which bypasses type checking but works at runtime.
  The types mismatch itself does not cause the bug but masks any potential issues.

  MOST LIKELY RUNTIME CAUSE: The migration 00010_query_consolidation.sql has not been applied
  to the remote Supabase database, OR PostgREST's schema cache hasn't refreshed after the
  migration was applied. If the function doesn't exist on the server, .rpc() returns an error,
  detailData is null, and the fallback on line 57 provides empty arrays for ALL data.

  This would explain why roadmap shows empty. However, it should also make sessions/reports
  empty. The coach page passing UAT (test 5) while owner fails (test 6) is unexplained by
  this theory unless the UAT pass was based on visual inspection without verifying roadmap data.

fix: |
  1. VERIFY migration applied: Run `supabase db push` or check Supabase dashboard SQL editor
     for the get_student_detail function
  2. FIX types mismatch: Update src/lib/types.ts to include all 4 parameters:
     get_student_detail: {
       Args: {
         p_student_id: string;
         p_month_start: string;
         p_month_end: string;
         p_include_coach_mgmt: boolean;
       };
       Returns: unknown;
     };
  3. REMOVE as-any cast: After fixing types, remove the (admin as any) cast in both pages
  4. ADD runtime logging: Add a console.log of detailData shape in the owner page to diagnose
     if this persists

verification: Cannot verify without access to the live Supabase database
files_changed:
  - src/lib/types.ts (types mismatch — missing p_month_start, p_month_end in Args)
