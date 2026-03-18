# Phase 4: Student Roadmap - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Students can view their 10-step program roadmap with locked/active/completed states and advance through it sequentially by marking the active step complete. Step 1 auto-completes on signup. This phase does NOT include: gamification, streaks, tier progression, or any coach/owner views of roadmap data (those are Phase 6+).

</domain>

<decisions>
## Implementation Decisions

### Step visual layout
- Vertical timeline with circle indicators and connecting line between steps (same pattern as reference-old)
- Completed step: green circle with checkmark, green connecting line
- Active step: blue circle with step number, pulsing ring, blue primary styling
- Locked step: gray circle with lock icon, muted text, gray connecting line
- All steps show title AND description (locked steps show muted description text for anticipation)
- Completed steps show completion date in a "Completed" badge (e.g., "Completed Mar 10")

### Progress summary card
- Summary card at top of roadmap page showing "X of 10 steps completed" with percentage and progress bar
- Same pattern as reference-old progress overview card
- All-complete state: celebration card with congratulations message

### Dashboard roadmap card
- Replace placeholder card with live data: current active step name, X/10 progress count, mini progress bar with percentage
- Adaptive CTA matching the Work Progress card pattern:
  - Active step exists: "Continue Step N" (links to /student/roadmap)
  - All 10 complete: "Roadmap Complete!" with celebration styling (green accent)
- Dashboard card fetches roadmap_progress data server-side

### Mark complete flow
- Claude's discretion on confirmation UX (reference-old uses modal — can keep or simplify)

### Step 1 auto-complete
- Claude's discretion on timing (auth callback vs lazy page-load seeding — reference-old does lazy seeding)

### Claude's Discretion
- Confirmation modal vs inline confirm vs direct action with toast for "Mark Complete"
- Step 1 auto-complete timing (signup callback vs first roadmap page visit)
- Timeline animation details (staggered entrance, slide-up)
- Loading skeleton design for roadmap page
- Toast messages for step completion
- All-complete celebration card design on roadmap page (reference-old has one)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap requirements
- `.planning/REQUIREMENTS.md` — ROAD-01, ROAD-02, ROAD-03 define the 3 acceptance criteria
- `.planning/ROADMAP.md` — Phase 4 success criteria (Step 1 auto-complete, locked/active/completed states, mark complete, sequential unlock)
- `.planning/PROJECT.md` — Roadmap steps (10 steps from "Join the Course" to "Close Your First Brand Deal")

### Configuration
- `src/lib/config.ts` — ROADMAP_STEPS array (10 steps with step number, title, description, autoComplete flag)
- `src/lib/config.ts` — ROUTES.student.roadmap ("/student/roadmap"), NAVIGATION for student role

### Reference implementation
- `reference-old/src/components/student/RoadmapClient.tsx` — Client component with confirmation modal, PATCH API call, router.refresh()
- `reference-old/src/components/student/RoadmapStep.tsx` — Step component with circle indicator, connecting line, status-based styling
- `reference-old/src/app/(dashboard)/student/roadmap/page.tsx` — Server component with lazy seeding, progress overview card, all-complete celebration
- `reference-old/src/app/api/roadmap/route.ts` — PATCH API route: auth check, Zod validation, mark complete + unlock next step

### Database schema
- `supabase/migrations/00001_create_tables.sql` — roadmap_progress table (id, student_id, step_number, step_name, status, completed_at, timestamps)

### Auth & session
- `src/lib/session.ts` — requireRole() helper for server components
- `src/lib/supabase/admin.ts` — createAdminClient() for server-side queries

### Dashboard integration
- `src/app/(dashboard)/student/page.tsx` — Current dashboard with placeholder Roadmap card (replace with live data)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reference-old/src/components/student/RoadmapClient.tsx` — Complete client component with confirmation modal. Strip V2 features (none in this component — it's V1-ready).
- `reference-old/src/components/student/RoadmapStep.tsx` — Step component with circle indicators, connecting line, locked/active/completed states. V1-ready.
- `reference-old/src/app/api/roadmap/route.ts` — PATCH API with auth, Zod validation, sequential unlock. V1-ready.
- `reference-old/src/app/(dashboard)/student/roadmap/page.tsx` — Server component with lazy seeding logic, progress card. Uses ima-brand-gold and ima-border-warm tokens that may not exist in V1 — adapt to V1 ima-* tokens.
- `src/lib/config.ts` — ROADMAP_STEPS already defined with all 10 steps

### Established Patterns
- Server components for reads, "use client" only for interactivity (mark complete button needs client component)
- Admin client for all server queries, user ID filtering for defense-in-depth
- API routes at `/api/` with Zod validation, auth + role check before validation
- useRef for toast/router in client components (from Phase 3 pattern)
- motion-safe: prefix on all animations, 44px touch targets, ARIA labels

### Integration Points
- `src/app/(dashboard)/student/page.tsx` — Dashboard needs roadmap_progress query added, placeholder card replaced with live data card
- `src/app/(dashboard)/student/roadmap/` — New directory needed for roadmap page
- `src/app/api/roadmap/` — New API route for PATCH (mark step complete)
- Student nav already configured: "Roadmap" -> "/student/roadmap" with Map icon
- `src/lib/types.ts` — RoadmapProgress type should already exist from schema generation

</code_context>

<specifics>
## Specific Ideas

- Dashboard roadmap card should feel like a natural sibling of the Work Progress card — same visual weight, consistent card styling
- Adaptive CTA pattern proven in Work Progress card: context-aware label that tells the student exactly what to do next
- Reference-old roadmap page is nearly V1-ready — minimal adaptation needed (mostly token adjustments)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-student-roadmap*
*Context gathered: 2026-03-16*
