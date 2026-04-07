# Phase 33: Coach Assignments - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Coaches can assign, reassign, and unassign students independently — same power as owner — via a /coach/assignments page. The existing owner assignments page and API remain unchanged.

</domain>

<decisions>
## Implementation Decisions

### Student visibility scope
- **D-01:** Coaches see ALL students — unassigned, their own, AND other coaches' students. Full visibility, same as owner. Required for reassignment across coaches (ASSIGN-03).

### student_diy filtering
- **D-02:** student_diy users are hidden entirely from the assignment list. Filter with `WHERE role = 'student'`. They cannot be assigned (D-04 from v1.4), so showing them as disabled is confusing.

### UI approach
- **D-03:** Simplified version of owner page — no coach capacity cards or stats counters. Just a searchable student list with a coach dropdown selector per student. Same functional power, lighter UI.

### API strategy
- **D-04:** Reuse the existing `/api/assignments` route — expand the role check from owner-only to owner+coach. No separate endpoint needed.

### Claude's Discretion
- Search/filter UX details (debounce timing, placeholder text)
- Exact layout and spacing of the student list
- Loading skeleton design
- Empty state messaging

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — ASSIGN-01 through ASSIGN-06 define all acceptance criteria

### Existing assignment code (mirror source)
- `src/app/(dashboard)/owner/assignments/page.tsx` — Owner server page pattern (data fetching, admin client usage)
- `src/components/owner/OwnerAssignmentsClient.tsx` — Client component with filter tabs, search, dropdown assignment, optimistic UI
- `src/app/api/assignments/route.ts` — PATCH endpoint (currently owner-only role check, CSRF, rate limiting, validation)

### Config and navigation
- `src/lib/config.ts` — NAVIGATION maps, ROUTES maps, COACH_CONFIG.maxStudentsPerCoach

### Database
- `supabase/migrations/00001_create_tables.sql` — users table schema (coach_id field, role CHECK constraint)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OwnerAssignmentsClient.tsx`: Reference for search, filter, dropdown assignment, and optimistic UI patterns — coach version will be a simplified adaptation
- `/api/assignments/route.ts`: Expand role check to include 'coach' — all validation logic (student exists, coach active, Zod schema) already correct
- `COACH_CONFIG.maxStudentsPerCoach`: Already exported, can be used in coach view too

### Established Patterns
- Server component page fetches data with admin client, passes to "use client" component
- Optimistic UI with local state update + revert-on-error (established in owner assignments)
- CSRF via `verifyOrigin()` + rate limiting via `checkRateLimit()` on all mutation routes
- Navigation added via `NAVIGATION` map in config.ts, routes via `ROUTES` map

### Integration Points
- `src/lib/config.ts`: Add `/coach/assignments` to NAVIGATION.coach and ROUTES.coach
- `src/proxy.ts`: Verify /coach/assignments is accessible to coach role (existing coach route pattern should cover it)
- `/api/assignments/route.ts`: Expand role guard from `role !== 'owner'` to `role !== 'owner' && role !== 'coach'`

</code_context>

<specifics>
## Specific Ideas

- "Same functional power, lighter UI" — coach page should feel like a focused tool, not an admin dashboard
- Student list with coach dropdown per row is the core interaction — keep it simple and fast

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-coach-assignments*
*Context gathered: 2026-04-03*
