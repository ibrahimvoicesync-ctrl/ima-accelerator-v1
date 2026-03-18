# Phase 9: Owner Invites, Assignments & Alerts - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

The owner can onboard coaches and students via invite links (with magic link option), assign or reassign any student to any coach, and see a computed alert list for at-risk situations. This phase delivers: owner invite page (/owner/invites), coach-student assignment on student detail page, alert list page (/owner/alerts), and supporting APIs. This phase does NOT include: notification system (V2), batch assignments page, chart visualizations, or cron-based alert computation.

</domain>

<decisions>
## Implementation Decisions

### Owner invite system
- Reuse existing invite/magic-link patterns from coach flow (Phase 7)
- Owner can invite both "coach" and "student" roles (per INVITE_CONFIG.inviteRules.owner)
- Extend existing POST /api/invites and POST /api/magic-links to accept owner role (currently coach-only)
- Same 72-hour expiry for invite codes, same magic link generation
- Copy-to-clipboard UX pattern from CoachInvitesClient

### Assignment UX
- Assignment lives on the owner student detail page (/owner/students/[studentId])
- Coach dropdown selector in student detail header area — shows "Coach Name (N students)" format
- Includes "Unassigned" option to remove a student from a coach (sets coach_id = null)
- Instant swap on save — no confirmation modal, no notification to coaches
- PATCH API to update student's coach_id
- No dedicated /owner/assignments page — student detail is the single assignment point

### Alert computation
- Alerts computed at query time (no cron, no stored alert rows) — per PROJECT.md constraint
- Small `alert_dismissals` table stores dismissed alert keys (e.g. "student_inactive:uuid:date-range")
- If condition resolves and re-triggers in a new time window, dismissed state doesn't carry over — appears as new alert
- 4 alert types from config: student inactive 3+ days, student dropoff 7+ days, unreviewed reports, coach underperformance (avg rating < 2.5 for 14+ days)

### Alert presentation
- Card-based list on /owner/alerts page
- Filter tabs: All / Active / Dismissed (matching reference-old AlertsClient pattern)
- Each alert card shows: severity icon, type label, subject name, triggered reason, time
- Alert cards link to the relevant person's detail page (student or coach)
- Unreviewed reports shown as one summary alert ("N reports pending review"), not per-report

### Acknowledge/dismiss behavior
- Single "Dismiss" action — no separate acknowledge
- Dismiss inserts a row in alert_dismissals table with the alert key
- Dismissed alerts hidden from active view but visible under "Dismissed" filter tab
- If the underlying condition resolves then re-triggers, new alert key generated — appears fresh

### Claude's Discretion
- Owner invite page layout (tabs vs sections for coach/student role selection)
- Invite history table design and pagination
- Alert card styling, severity color coding, icon choices
- Empty states for alerts page and invite history
- Loading skeletons for all new pages
- alert_dismissals table schema details (columns, indexes)
- Whether to show alert count badge on sidebar "Alerts" nav item

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Owner requirements
- `.planning/REQUIREMENTS.md` — OWNER-06 (invite codes), OWNER-07 (assign/reassign), OWNER-08 (alerts), OWNER-09 (acknowledge/dismiss)
- `.planning/ROADMAP.md` — Phase 9 success criteria (4 acceptance tests)
- `.planning/PROJECT.md` — Alert triggers, invite system rules, coach config thresholds

### Configuration
- `src/lib/config.ts` — OWNER_CONFIG.alertThresholds (studentInactiveDays: 3, studentDropoffDays: 7, coachUnderperformingRating: 2.5, coachUnderperformingWindowDays: 14)
- `src/lib/config.ts` — INVITE_CONFIG (codeExpiryHours: 72, inviteRules: owner can invite ["coach", "student"])
- `src/lib/config.ts` — ROUTES.owner (invites, assignments, alerts paths)
- `src/lib/config.ts` — NAVIGATION.owner (Invites, Assignments, Alerts nav items)

### Database schema
- `supabase/migrations/00001_create_tables.sql` — users table (coach_id column for assignment), invites table, magic_links table
- `supabase/migrations/00001_create_tables.sql` — RLS policies for owner access

### Existing invite APIs (extend for owner)
- `src/app/api/invites/route.ts` — POST coach-only invite generation (extend to accept owner role + role param)
- `src/app/api/magic-links/route.ts` — POST/PATCH coach-only magic link (extend to accept owner role + role param)

### Reference implementations
- `reference-old/src/components/owner/InvitesClient.tsx` — Owner invite page with email + magic link tabs
- `reference-old/src/components/owner/AssignmentsClient.tsx` — Assignment table with coach dropdowns
- `reference-old/src/components/owner/AlertsClient.tsx` — Alert list with filter tabs, acknowledge flow
- `reference-old/src/components/owner/ReassignCoachModal.tsx` — Reassignment modal pattern

### Prior phase context
- `.planning/phases/07-coach-report-review-invites-analytics/07-CONTEXT.md` — Coach invite flow decisions, copy-to-clipboard pattern
- `.planning/phases/08-owner-stats-people-management/08-CONTEXT.md` — Owner dashboard visual DNA, stat card patterns, StudentCard basePath

### Auth & session
- `src/lib/session.ts` — requireRole("owner") for server components
- `src/lib/supabase/admin.ts` — createAdminClient() for server-side queries

### Existing owner pages (integration points)
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — Student detail page (add assignment section here)
- `src/components/owner/OwnerStudentDetailClient.tsx` — Client component to extend with coach assignment dropdown

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/coach/CoachInvitesClient.tsx` — Email invite + magic link tabs, copy-to-clipboard, optimistic toggle. Pattern to adapt for owner invites (add role selection).
- `src/components/ui/Card.tsx`, `Badge.tsx`, `Button.tsx`, `Input.tsx`, `Skeleton.tsx` — All UI primitives exist.
- `src/components/owner/OwnerStudentDetailClient.tsx` — Extend with coach assignment dropdown section.
- `src/lib/config.ts` — INVITE_CONFIG and OWNER_CONFIG already define all thresholds and rules.
- `src/lib/utils.ts` — getGreeting(), getToday(), formatHours() helpers.

### Established Patterns
- Server component page with parallel data fetch + "use client" for interactivity
- Admin client for all queries, requireRole("owner") at top of every page
- Existing POST /api/invites and POST /api/magic-links follow auth + role check + Zod validation pattern
- Optimistic UI updates with automatic revert on error (CoachInvitesClient pattern)
- ima-* tokens only, motion-safe: on animations, 44px touch targets

### Integration Points
- `src/app/(dashboard)/owner/invites/page.tsx` — New page for owner invite generation
- `src/app/(dashboard)/owner/alerts/page.tsx` — New page for alert list
- `src/app/api/invites/route.ts` — Extend role check to allow owner, add role param to body schema
- `src/app/api/magic-links/route.ts` — Extend role check to allow owner, add role param
- `src/app/api/assignments/route.ts` — New PATCH API for updating student coach_id
- `supabase/migrations/` — New migration for alert_dismissals table
- Owner student detail page — Add coach assignment section
- Sidebar "Alerts" nav item — Optionally wire badge count

</code_context>

<specifics>
## Specific Ideas

- Assignment on student detail keeps the owner in context — they see the student's data while deciding which coach to assign
- Coach dropdown showing "(N students)" helps owner balance load without navigating away
- Instant swap keeps the flow fast — owner is the admin, no need for confirmation
- Summary alert for unreviewed reports prevents alert list flooding
- Computed alerts with dismissal table is the lightest approach that still meets OWNER-09

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-owner-invites-assignments-alerts*
*Context gathered: 2026-03-17*
