# Phase 32: Skip Tracker - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "X days skipped this week" badge to coach and owner student views. Skip count is computed by a Postgres RPC function using UTC-safe date math, covering the current Mon-Sun ISO week. Only applies to `role = 'student'` (not student_diy).

</domain>

<decisions>
## Implementation Decisions

### Skip Day Definition
- **D-01:** All 7 days Mon-Sun count (ISO week), not just weekdays. A skip = zero completed work sessions AND no submitted daily report for that date.
- **D-02:** Today counts as skipped ONLY if it's past the report deadline hour (`DAILY_REPORT.deadlineHour`, currently 23 / 11 PM UTC). Before that hour, today is excluded from the count. Past days in the current ISO week always count.
- **D-03:** Skip count resets to 0 on Monday (new ISO week begins).

### Badge Appearance
- **D-04:** Show "X skipped" as a `ima-warning`-colored Badge in the top-right of StudentCard, alongside/replacing the existing New/At Risk badge. Only show when X > 0. Zero skips = no badge shown.

### Owner View Placement
- **D-05:** Add a "Skipped" column to the owner's student table. Same skip count logic. Highlight in `ima-warning` color when > 0.

### Student_DIY Exclusion
- **D-06:** Student_DIY users do NOT show skip counts. No coach, no reports, no accountability tracking. Skip tracker only applies to `role = 'student'`.

### Claude's Discretion
- RPC function name and exact SQL implementation (likely `get_weekly_skip_counts` or similar batch function)
- Whether to use a single batch RPC call for all students or per-student calls (batch preferred for N+1 avoidance)
- Badge positioning when both "At Risk" and "X skipped" apply to the same student
- Exact column styling in owner student table

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Student Card & Coach Dashboard
- `src/components/coach/StudentCard.tsx` -- Current card with New/At Risk badges, info rows (last active, today's report, roadmap step)
- `src/app/(dashboard)/coach/page.tsx` -- Coach dashboard that enriches students and passes to StudentCard; parallel fetch pattern for sessions/reports/roadmap

### Owner Student Views
- `src/app/(dashboard)/owner/students/page.tsx` -- Paginated student table (not StudentCard); add "Skipped" column here
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` -- Student detail page using `get_student_detail` RPC

### Config & Utilities
- `src/lib/config.ts` -- `DAILY_REPORT.deadlineHour` (23) used to determine if today counts as skipped
- `src/lib/utils.ts` -- `getTodayUTC()` must be passed as `p_today` to the RPC (never use CURRENT_DATE in Postgres)

### Existing RPC Patterns
- `supabase/migrations/00010_query_consolidation.sql` -- Existing RPC functions (get_owner_dashboard_stats, get_student_detail) as pattern reference
- `supabase/migrations/00011_write_path.sql` -- student_kpi_summaries and RPC pattern

### Badge Component
- `src/components/ui/Badge.tsx` -- CVA-based Badge with `variant` (info, error, warning, success) and `size` props

### Requirements
- `.planning/REQUIREMENTS.md` section Skip Tracker -- SKIP-01 through SKIP-05

### Phase Success Criteria
- `.planning/ROADMAP.md` section Phase 32 -- 5 success criteria for badge display, reset behavior, today handling, owner views, and RPC design

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Badge` component with `variant="warning"` — exact match for skip badge styling
- `StudentCard` component — add `skippedDays` prop to interface, render Badge conditionally
- `getTodayUTC()` — UTC date helper, pass to RPC as `p_today`
- `DAILY_REPORT.deadlineHour` — config value (23) for today-skip threshold

### Established Patterns
- Coach dashboard parallel fetches sessions/reports/roadmap, builds lookup maps, enriches student objects — skip count can follow same enrichment pattern (or be returned by a batch RPC)
- RPC functions accept explicit date parameters, never rely on CURRENT_DATE
- Admin client used for all server-side queries
- Badge in top-right of StudentCard via flex justify-between in top row

### Integration Points
- `StudentCard` interface needs `skippedDays?: number` prop
- Coach `page.tsx` needs to fetch skip counts and pass to StudentCard
- Owner `students/page.tsx` needs skip count column
- New migration for RPC function (next migration number after existing ones)
- Owner student detail page may optionally show skip count

</code_context>

<specifics>
## Specific Ideas

- Today-as-skip uses `DAILY_REPORT.deadlineHour` (23) as the cutoff — the RPC should accept both `p_today` date and `p_current_hour` integer (or the application passes a flag/adjusted date based on the hour check)
- The "X skipped" badge text format: "1 skipped", "2 skipped", etc. (not "1 day skipped")

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 32-skip-tracker*
*Context gathered: 2026-04-03*
