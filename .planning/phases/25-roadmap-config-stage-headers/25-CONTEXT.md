# Phase 25: Roadmap Config & Stage Headers - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Update `ROADMAP_STEPS` in `src/lib/config.ts` with corrected descriptions (parenthetical time guidance on steps 1-8), moved unlock URLs, and adjusted target_days. Add visible stage headers to all three roadmap views (student, coach, owner) grouping steps by their existing `stage`/`stageName` fields.

Requirements: ROAD-01, ROAD-02, ROAD-03, ROAD-04, ROAD-05, ROAD-06

</domain>

<decisions>
## Implementation Decisions

### Step Description Text (ROAD-01)
- **D-01:** Append these exact parenthetical strings to steps 1-8 descriptions:
  - Step 1: "(time asap)"
  - Step 2: "(2 hrs)"
  - Step 3: "(1hr - don't overthink it)"
  - Step 4: "(begin on day 1 - finish by day 2)"
  - Step 5: "(Day 3)"
  - Step 6: "(Day 6)"
  - Step 7: "(volume is key here)"
  - Step 8: "(Day 14)"

### Unlock URL Changes (ROAD-02)
- **D-02:** Step 5 `unlock_url` set to: `https://www.skool.com/the-ima-accelerator-9388/ultimate-influencer-brand-crm-organize-your-contacts`
- **D-03:** Step 6 `unlock_url` set to `null` (remove existing classroom URL)

### Step Description Rewrites (ROAD-03)
- **D-04:** Step 6 description: "Build 100 Influencer Lead List, and Watch 3 Influencer Roast My Email" (per ROAD-03, exact text from requirements)
- **D-05:** Step 7 description: reflects drafting emails only (per ROAD-03 — current description already says "draft your first outreach emails", update title/description to focus on drafting only, removing "Watch 3 Roast My Email" since that moved to step 6)

### Step 8 Target Days (ROAD-04)
- **D-06:** Step 8 `target_days` set to `14` (currently `null`)

### Claude's Discretion
- Stage header visual design (ROAD-05, ROAD-06) — user did not select this for discussion. Claude has flexibility to choose the visual style for stage headers in student timeline and coach/owner list views. The `stage` (1/2/3) and `stageName` fields already exist on each step in config.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Config & Data
- `src/lib/config.ts` — ROADMAP_STEPS array (lines 128-147), all step descriptions, unlock_urls, target_days, stage/stageName fields
- `.planning/REQUIREMENTS.md` — ROAD-01 through ROAD-06 acceptance criteria

### Student Roadmap View
- `src/app/(dashboard)/student/roadmap/page.tsx` — Server component, fetches progress, renders RoadmapClient
- `src/components/student/RoadmapClient.tsx` — Client component, iterates ROADMAP_STEPS, renders RoadmapStep per step (no stage grouping currently)
- `src/components/student/RoadmapStep.tsx` — Individual step card with timeline circles, descriptions, deadline chips, completion actions

### Coach/Owner Roadmap View
- `src/components/coach/RoadmapTab.tsx` — Shared by coach and owner student detail pages, iterates ROADMAP_STEPS as flat list (no stage grouping currently)

### Utilities
- `src/lib/roadmap-utils.ts` — getDeadlineStatus() utility used by both views for deadline chip rendering

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ROADMAP_STEPS` config already has `stage` (1/2/3) and `stageName` on every step — no schema changes needed for stage grouping
- `Badge` component (`src/components/ui/Badge.tsx`) — could be used for stage labels
- `cn()` utility for conditional Tailwind classes
- `getDeadlineStatus()` — deadline chip logic unchanged by this phase

### Established Patterns
- Config-driven rendering: both views iterate `ROADMAP_STEPS` and merge with DB progress data
- CVA-based UI primitives with ima-* design tokens
- Timeline pattern in student view (circles + connecting lines)
- Flat list pattern in coach/owner view (icons + text)

### Integration Points
- `RoadmapClient.tsx` maps over `ROADMAP_STEPS` — stage grouping needs to wrap/group this iteration
- `RoadmapTab.tsx` maps over `ROADMAP_STEPS` — same grouping needed here
- Step 7 title may need updating: currently "Watch 3 Roast My Email Calls + Draft First Outreach Emails" — that content moved to step 6, so step 7 title should reflect drafting only

</code_context>

<specifics>
## Specific Ideas

- The parenthetical text is time/deadline guidance for students (e.g., "(2 hrs)", "(Day 3)") — append with a space to existing description text
- The skool CRM URL for step 5 is specifically: `https://www.skool.com/the-ima-accelerator-9388/ultimate-influencer-brand-crm-organize-your-contacts`
- Step 6 currently has the skool classroom link — that must be removed (set to null), not just moved
- Step 7 title currently includes "Watch 3 Roast My Email Calls" which now belongs in step 6's description — step 7 should focus on drafting emails only

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-roadmap-config-stage-headers*
*Context gathered: 2026-03-31*
