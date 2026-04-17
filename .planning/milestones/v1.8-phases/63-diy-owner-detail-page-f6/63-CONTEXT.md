# Phase 63: DIY Owner Detail Page (F6) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

An owner navigating to `/owner/students/[studentId]` for a `student_diy` user lands on a working detail page instead of a 404 — achieved by role-filter broadening on the detail route and the owner student list, with daily-report-derived UI suppressed for DIY users (Calendar tab shows hours-only; no daily-report indicator dots or rows), all delivered via inline conditional rendering in the existing components (no parallel route tree, no per-role sub-components).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from STATE.md and CLAUDE.md:
- Requirements: DIY-01..10 (10 reqs). Zero migrations, zero RPC changes — pure routing + UI.
- Post-phase build gate: `npm run lint && npx tsc --noEmit && npm run build` must exit 0.
- CLAUDE.md Hard Rules: motion-safe, 44px touch targets, aria labels, admin client in API routes, never swallow errors, response.ok checks, `import { z } from "zod"`, ima-* tokens.
- Next migration would be 00035 (but this phase has zero migrations).

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

Relevant files to inspect during planning:
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — owner student detail route (role filter to broaden)
- `src/app/(dashboard)/owner/students/page.tsx` — owner student list (role filter to broaden)
- `src/components/student/CalendarTab.tsx` (or equivalent) — Calendar tab with daily-report indicator dots
- `src/components/student/StudentKpiSummary.tsx` (or equivalent) — summary component with report-derived rows
- `src/components/student/StudentDetailTabs.tsx` — tab definitions (`TabKey = "calendar" | "roadmap" | "deals"`)
- `src/lib/config.ts` — role definitions for `student_diy`

</code_context>

<specifics>
## Specific Ideas

Ambiguities resolved in STATE.md (include verbatim):

- **DIY-05** — "Reports tab" wording interprets as CalendarTab report-dot suppression + StudentKpiSummary report-row suppression (there is no top-level Reports tab — `StudentDetailTabs.TabKey` is `"calendar" | "roadmap" | "deals"`).
- **DIY-08** — Coach route `/coach/students/[studentId]` stays unchanged (owner-only scope for v1.8).

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
</content>
