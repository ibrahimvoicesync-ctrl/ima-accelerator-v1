# Phase 31: Student_DIY Role - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the 4th role (`student_diy`) across all integration points — proxy, config, routes, navigation, auth callback, and page files — so users can register with a student_diy invite, be routed to `/student_diy/dashboard`, and access only Dashboard, Work Tracker, and Roadmap. DB schema and types already updated in Phase 30.

</domain>

<decisions>
## Implementation Decisions

### Page Architecture
- **D-01:** Own route group `/student_diy/` with separate page files under `src/app/(dashboard)/student_diy/`. Do NOT share `/student/` pages — keeps proxy routing clean and avoids conditional rendering complexity.
- **D-02:** Reuse student components (WorkTrackerClient, RoadmapClient) via imports in the new page.tsx files, but each page.tsx is separate with `requireRole("student_diy")`.

### Dashboard Content
- **D-03:** Stripped-down student dashboard. Show work progress card + roadmap progress card only. No daily report card, no coach info, no KPI outreach cards (student_diy doesn't submit reports).

### Invite Creation UX
- **D-04:** Add "Student DIY" to the existing role dropdown on both coach and owner invite forms. No separate invite flow.

### Blocked Route Behavior
- **D-05:** Silent redirect to `/student_diy` dashboard — same pattern as existing proxy behavior. No toast needed.

### Claude's Discretion
- Dashboard card layout and spacing for the reduced 2-card layout
- Exact requireRole helper pattern (reuse existing or create shared)
- Order of config.ts changes (ROLES, ROLE_HIERARCHY, ROUTES, ROLE_REDIRECTS, NAVIGATION)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Role Integration Points (8 locations)
- `src/lib/config.ts` — ROLES, ROLE_HIERARCHY, ROLE_REDIRECTS, ROUTES, NAVIGATION (5 config maps to expand)
- `src/proxy.ts` — DEFAULT_ROUTES, ROLE_ROUTE_ACCESS (2 route maps to expand)
- `src/app/api/auth/callback/route.ts` — validRoles array must include 'student_diy'

### Existing Student Pages (reuse components)
- `src/app/(dashboard)/student/page.tsx` — Student dashboard (reference for stripped-down version)
- `src/app/(dashboard)/student/work/page.tsx` — Work tracker page (component to import)
- `src/app/(dashboard)/student/roadmap/page.tsx` — Roadmap page (component to import)

### Sidebar (config-driven, no changes needed)
- `src/components/layout/Sidebar.tsx` — Reads `NAVIGATION[role]` dynamically; adding student_diy to NAVIGATION auto-wires sidebar

### Types (already done in Phase 30)
- `src/lib/types.ts` — Role union already includes 'student_diy'
- `supabase/migrations/00015_v1_4_schema.sql` — Role CHECK constraints already include 'student_diy'

### Invite Forms (add role option)
- `src/app/(dashboard)/owner/invites/page.tsx` — Owner invite form with role dropdown
- `src/app/(dashboard)/coach/invites/page.tsx` — Coach invite form with role dropdown

### Requirements
- `.planning/REQUIREMENTS.md` §Student_DIY Role — ROLE-01 through ROLE-07

### Phase Success Criteria
- `.planning/ROADMAP.md` §Phase 31 — 6 success criteria for registration, routing, sidebar, functionality, blocked routes, and invite creation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkTrackerClient` component: Import directly into `/student_diy/work/page.tsx`
- `RoadmapClient` component: Import directly into `/student_diy/roadmap/page.tsx`
- `Sidebar` component: Reads `NAVIGATION[role]` — adding student_diy nav items auto-wires the sidebar
- Student dashboard cards: Reference for building stripped-down version

### Established Patterns
- Role config is the single source of truth — all routing, navigation, and access control reads from `config.ts`
- Proxy uses prefix matching: `ROLE_ROUTE_ACCESS["student_diy"] = ["/student_diy"]`
- Auth callback creates users with `invite.role` — no code change needed beyond validRoles array
- `requireRole()` or equivalent server-side check on each page.tsx

### Integration Points
- `config.ts` ROLES constant → type system expands
- `config.ts` NAVIGATION → sidebar renders student_diy nav (3 items: Dashboard, Work Tracker, Roadmap)
- `proxy.ts` → route guard allows `/student_diy/*` for student_diy role
- Auth callback → validRoles check must include 'student_diy'
- `src/app/(dashboard)/layout.tsx` → may need to pass role to Sidebar (verify it already handles dynamic roles)
- Owner + coach invite forms → role dropdown gains "Student DIY" option

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The 8-location atomic update pattern is well-defined by the existing config-driven architecture.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-student-diy-role*
*Context gathered: 2026-04-03*
