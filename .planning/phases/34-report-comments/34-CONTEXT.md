# Phase 34: Report Comments - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Coaches and owner can leave a single text comment (max 1000 chars) on any student daily report via upsert; students see the feedback read-only on their report history. No deletion, no threading, no reactions.

</domain>

<decisions>
## Implementation Decisions

### Comment form surfaces
- **D-01:** Show the comment textarea on BOTH `/coach/reports` (inside expanded ReportRow `<details>`) AND CalendarTab on student detail. Same component, same behavior in both places.
- **D-02:** Owner sees the comment form on CalendarTab only (that's their only report access point).

### Student feedback display
- **D-03:** Show as a distinct card below the report on student's `/student/report/history` page. Light `ima-surface-accent` background, coach avatar (initials circle), coach name, timestamp, comment text. Visually distinct from the report itself but not overpowering. Read-only for students.

### Edit/update flow
- **D-04:** Pre-fill the textarea with the existing comment if one exists. Seamless replace on submit — no confirmation modal. The coach can see they're editing because the textarea already has text in it.

### Owner commenting path
- **D-05:** Identical to coach. Owner comments via CalendarTab textarea, same API endpoint, same upsert behavior. The API allows owner OR coach role.

### Claude's Discretion
- Exact textarea sizing and character counter UX
- Loading/saving state indicators on the comment form
- Empty state messaging details
- Initials circle color derivation for coach avatar

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — COMMENT-01 through COMMENT-05 define all acceptance criteria

### Database Schema
- `supabase/migrations/00015_v1_4_schema.sql` — Section 1 (report_comments table), Section 8 (RLS policies). UNIQUE index on report_id enables ON CONFLICT upsert.

### API Pattern (mirror source)
- `src/app/api/reports/[id]/review/route.ts` — Near-exact template: CSRF, auth, role check, two-step ownership check (fetch report → verify student.coach_id), admin client. Comment API follows this pattern.

### Coach Report Views (comment form locations)
- `src/components/coach/ReportRow.tsx` — Expandable `<details>` card with review toggle; comment form goes inside expanded section
- `src/components/coach/CalendarTab.tsx` — Day-click report detail panel; comment form goes below report data
- `src/components/coach/ReportsTab.tsx` — Reports tab using ReportRow (coach student detail)

### Owner Report Views
- `src/components/owner/OwnerStudentDetailClient.tsx` — Owner student detail page; uses CalendarTab for report viewing

### Student Report History (comment display location)
- `src/app/(dashboard)/student/report/history/page.tsx` — Server component rendering report cards; "Coach feedback" card goes below each report card

### Types
- `src/lib/types.ts` — `report_comments` Row/Insert/Update types already defined

### Phase Success Criteria
- `.planning/ROADMAP.md` §Phase 34 — 5 success criteria defining exact behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/api/reports/[id]/review/route.ts`: Near-identical API structure — CSRF, auth, role check, ownership check, admin client mutation. Comment route will mirror this with upsert instead of update.
- `ReportRow.tsx`: Already has `<details>` expansion with wins/improvements content — comment form slots in naturally below.
- `CalendarTab.tsx`: Already renders report details on day selection — comment form slots below report data.
- `Card`, `CardContent`, `Badge`, `Button` UI primitives: All available for comment form and feedback card.
- `checkRateLimit()`, `verifyOrigin()`: Standard mutation route helpers.

### Established Patterns
- Server component page fetches data with admin client, passes to "use client" component
- Zod safeParse on all API inputs (comment text validation)
- Upsert via Supabase `.upsert()` with `onConflict: 'report_id'`
- Optimistic UI not needed here — simple form submit with loading state

### Integration Points
- `ReportRow.tsx`: Add comment form inside expanded `<details>` section, below wins/improvements
- `CalendarTab.tsx`: Add comment form below report detail panel when a day with a report is selected
- `/student/report/history/page.tsx`: Join `report_comments` in query, render feedback card below each report
- New API route: `src/app/api/reports/[id]/comment/route.ts` (POST for upsert)
- Coach/owner report queries need to include existing comments (left join or separate fetch)

</code_context>

<specifics>
## Specific Ideas

- Coach feedback card on student history: light `ima-surface-accent` background, initials circle avatar, coach name, timestamp, comment text
- Same comment component reused in ReportRow and CalendarTab — single "use client" component with textarea, char counter, Save button
- Pre-fill textarea when comment exists, seamless overwrite on resubmit

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-report-comments*
*Context gathered: 2026-04-03*
