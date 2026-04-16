---
phase: 60
phase_name: ReferralCard UI & Dashboard Integration
milestone: v1.7
status: ready_for_planning
gathered: 2026-04-16
mode: auto-generated (discuss skipped via workflow.skip_discuss=true)
---

# Phase 60: ReferralCard UI & Dashboard Integration - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Students and student_diy users see a polished referral card at the bottom of their dashboard, can generate their link with one click, and can copy or share it from the same card — with all CLAUDE.md Hard Rules (touch targets, motion-safe animations, ima-* tokens, aria labels, response.ok, never-swallow errors) satisfied.

In scope:
- New client component `src/components/student/ReferralCard.tsx` (no props).
- Integration at the bottom of `src/app/(dashboard)/student/page.tsx` and `src/app/(dashboard)/student_diy/page.tsx`, inside an `mt-6` wrapper below the existing Deals stat cards grid.
- Initial load state, "Get My Link" button → spinner → ready state with short URL + Copy + Share.
- Copy button toggles to "Copied!" + check icon for 2 seconds.
- Share button uses `navigator.share` and is hidden when the API is unavailable (SSR-safe detection via effect + state).
- Fetch error path (network or non-2xx): visible toast or inline error + `console.error`; spinner clears, button re-enables; `response.ok` gate before JSON parse.
- All CLAUDE.md Hard Rules: `motion-safe:animate-*`, `min-h-[44px]`, `aria-label` on icon-only buttons, `aria-hidden="true"` on decorative icons, ima-* tokens only, `import { z } from "zod"` (if used).
- Post-phase build gate: `npm run lint && npx tsc --noEmit && npm run build` exits 0.

Out of scope:
- Custom Rebrandly domain or webhook.
- Click-tracking ingestion or analytics.
- Email invite composer.
- Any new API routes — `POST /api/referral-link` already exists from Phase 59 (idempotent JSON `{ shortUrl, referralCode }`).
- Non-student roles — card is only rendered on `student` and `student_diy` dashboards; no owner/coach path.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, CLAUDE.md Hard Rules, and existing codebase patterns (Deals stat cards, existing UI primitives, ima-* tokens, toast system) to guide decisions.

### Anchors from STATE.md Accumulated Context
- **Hard Rules apply**: motion-safe on animations, 44px touch targets, aria labels, ima-* tokens only, response.ok checks, never-swallow errors, `import { z } from "zod"`.
- **Auth pattern**: card is dashboard-rendered — already behind `getSessionUser()` + `requireRole(['student', 'student_diy'])` via proxy + page. No new auth work here.
- **Idempotent API** (Phase 59): every POST returns the same `shortUrl`; safe to call on every mount if desired, but a one-click explicit flow is the ROADMAP choice.
- **Rebrandly-only scope**: the component never talks to Rebrandly directly. It only talks to `/api/referral-link`.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research — pattern-mapper and phase-researcher will identify the existing Deals stat cards layout, toast component, icon set, and ima-* token conventions used on the student dashboard.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the ROADMAP success criteria — discuss phase skipped. Refer to Phase 60 ROADMAP entry for the 6 success criteria that must be TRUE.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
