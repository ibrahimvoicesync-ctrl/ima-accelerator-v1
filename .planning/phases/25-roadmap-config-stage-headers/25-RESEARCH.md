# Phase 25: Roadmap Config & Stage Headers - Research

**Researched:** 2026-03-31
**Domain:** Next.js config-driven UI, React component grouping, Tailwind CSS design tokens
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Append exact parenthetical strings to steps 1-8 descriptions:
  - Step 1: "(time asap)"
  - Step 2: "(2 hrs)"
  - Step 3: "(1hr - don't overthink it)"
  - Step 4: "(begin on day 1 - finish by day 2)"
  - Step 5: "(Day 3)"
  - Step 6: "(Day 6)"
  - Step 7: "(volume is key here)"
  - Step 8: "(Day 14)"
- **D-02:** Step 5 `unlock_url` set to: `https://www.skool.com/the-ima-accelerator-9388/ultimate-influencer-brand-crm-organize-your-contacts`
- **D-03:** Step 6 `unlock_url` set to `null` (remove existing classroom URL)
- **D-04:** Step 6 description: "Build 100 Influencer Lead List, and Watch 3 Influencer Roast My Email"
- **D-05:** Step 7 description: updated to drafting emails only (remove "Watch 3 Roast My Email Calls" from title and description)
- **D-06:** Step 8 `target_days` set to `14` (currently `null`)

### Claude's Discretion

- Stage header visual design (ROAD-05, ROAD-06) — user did not select this for discussion. Claude has flexibility to choose the visual style for stage headers in student timeline and coach/owner list views. The `stage` (1/2/3) and `stageName` fields already exist on each step in config.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROAD-01 | Step descriptions 1-8 have parenthetical text appended | Edit `ROADMAP_STEPS` in config.ts — append to existing `description` strings. The `as const` export means descriptions are TypeScript literal types; editing the string values is safe. |
| ROAD-02 | Step 5 unlock_url set to skool CRM link; step 6 unlock_url removed | Edit `ROADMAP_STEPS` config entries for steps 5 and 6 directly. Step 6 currently has `"https://www.skool.com/ima-accelerator/classroom"` — set to `null`. |
| ROAD-03 | Step 6 description updated; step 7 updated to drafting only | Edit `title` and `description` of steps 6 and 7 in config.ts. Step 7 current title is "Watch 3 Roast My Email Calls + Draft First Outreach Emails" — needs new title focused on drafting. |
| ROAD-04 | Step 8 target_days set to 14 | Edit `target_days` from `null` to `14` for step 8 in config.ts. `getDeadlineStatus()` already handles numeric `target_days` correctly; no util changes required. |
| ROAD-05 | Student roadmap view groups steps by stage with visible stage headers | `RoadmapClient.tsx` currently flat-maps `ROADMAP_STEPS`. Group by `stage` field (1/2/3) using `stageName` values. Wrap stage groups in header elements inside the existing timeline div. |
| ROAD-06 | Coach and owner roadmap tab shows stage headers matching student view | `RoadmapTab.tsx` currently flat-maps `ROADMAP_STEPS`. Apply the same grouping logic. Stage grouping is purely presentational — no DB changes needed. |

</phase_requirements>

---

## Summary

Phase 25 is a pure config-and-UI-rendering change with zero database impact, zero new dependencies, and zero new API routes. The work divides into two clear tasks: (1) updating the `ROADMAP_STEPS` array in `src/lib/config.ts` with the exact text and value changes dictated by D-01 through D-06, and (2) adding stage header markup to two components — `RoadmapClient.tsx` (student view) and `RoadmapTab.tsx` (coach/owner view).

The `ROADMAP_STEPS` array already carries `stage` (1/2/3) and `stageName` ("Setup & Preparation", "Influencer Outreach", "Brand Outreach") on every step. Stage 1 = steps 1-7, Stage 2 = steps 8-11, Stage 3 = steps 12-15. No new fields are needed. Grouping can be achieved by computing unique stages from the array and iterating groups, or by checking `step.stage !== prevStep.stage` during the map to insert header dividers.

The `getDeadlineStatus()` utility in `roadmap-utils.ts` already handles `target_days: 14` correctly — the step 8 deadline chip will render as "on-track", "due-soon", or "overdue" automatically once the config is updated. No utility changes needed.

**Primary recommendation:** Edit config.ts first (one task), then update both view components for stage headers (one task each). The config edit is the dependency; the view edits are independent of each other.

---

## Standard Stack

### Core (already installed — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router, Server + Client components | Project stack |
| React | 19.2.3 | Component rendering | Project stack |
| TypeScript | ^5 | Type safety | Project stack |
| Tailwind CSS | ^4 | Utility-first styling with ima-* tokens | Project stack |
| class-variance-authority | ^0.7.1 | CVA-based primitives | Project pattern for Badge etc |
| lucide-react | ^0.576.0 | Icons (Check, Lock, etc.) | Established in both components |

### No new packages needed

All changes are config edits and JSX rendering changes using existing utilities and components.

---

## Architecture Patterns

### Config-Driven Rendering (established pattern)

Both `RoadmapClient.tsx` and `RoadmapTab.tsx` iterate `ROADMAP_STEPS` from config and merge with DB progress data. Changing config values propagates everywhere automatically — no component needs to hardcode step content.

```typescript
// Current flat iteration pattern in RoadmapClient.tsx (lines 87-106)
{ROADMAP_STEPS.map((step, i) => {
  const stepProgress = progress.find((p) => p.step_number === step.step) ?? null;
  return <RoadmapStep key={step.step} ... />;
})}
```

### Stage Grouping Pattern (to be introduced)

**Approach: reduce to groups, then map groups.** Compute a `stages` array from `ROADMAP_STEPS` by extracting unique stage values in order, then render a header before each stage's steps.

```typescript
// Derive unique stages (preserves insertion order)
const stages = [
  ...new Map(ROADMAP_STEPS.map(s => [s.stage, s.stageName])).entries()
].map(([stage, stageName]) => ({ stage, stageName }));
// Result: [{stage:1, stageName:"Setup & Preparation"}, {stage:2,...}, {stage:3,...}]

// Render with headers
{stages.map(({ stage, stageName }) => (
  <div key={stage}>
    <StageHeader label={stageName} />
    {ROADMAP_STEPS
      .filter(s => s.stage === stage)
      .map((step, i, arr) => (
        <RoadmapStep key={step.step} ... isLast={i === arr.length - 1} />
      ))}
  </div>
))}
```

Note: The current `isLast` prop in `RoadmapStep` controls whether the connecting line is drawn. After grouping, `isLast` must be `true` for the last step within each stage (to stop the line at the stage boundary), not just the last step globally.

### Stage Header Visual Design

Claude's discretion per CONTEXT.md. The following pattern aligns with existing ima-* token patterns and the flat/coach list style of the app:

**Student timeline view** — a small horizontal rule with the stage name centered or left-aligned, using `text-ima-text-secondary` and `text-xs font-semibold uppercase tracking-wider`. This provides visual grouping without disrupting the vertical timeline flow.

```tsx
// Stage divider header for student timeline
<div className="flex items-center gap-3 py-2 pt-6 first:pt-0">
  <span className="text-xs font-semibold uppercase tracking-wider text-ima-text-muted">
    {stageName}
  </span>
  <div className="flex-1 h-px bg-ima-border" aria-hidden="true" />
</div>
```

**Coach/owner list view** — same pattern works. Placed above the first step of each group in the `space-y-4` list in `RoadmapTab.tsx`.

The `Badge` component could alternatively be used as a stage pill, but the rule+label pattern is simpler and avoids nesting a Badge inside a layout div.

### `as const` and TypeScript Literal Types

`ROADMAP_STEPS` is declared `as const`, which makes all string values readonly literal types. Editing the string values inline is safe — TypeScript infers the new literals. Do NOT cast types unnecessarily; just edit the strings directly.

The `target_days` field currently uses `null as number | null` type annotation. Changing step 8 from `null` to `14` requires changing `null as number | null` to `14 as number | null` (or simply `14`) — the explicit cast pattern used in the array is for TypeScript to infer the union type, not for runtime behavior.

### Anti-Patterns to Avoid

- **Hardcoding stage names in component JSX:** Stage names must come from `ROADMAP_STEPS[n].stageName`, not from string literals in the component — config is truth.
- **Breaking the connecting line:** The `isLast` prop stops the timeline connector line. After grouping, `isLast` must be `true` for each stage's final step to avoid drawing a connector into the stage header.
- **Changing `getDeadlineStatus` for step 8:** The utility already handles `target_days: 14` via the numeric deadline branch. No changes needed.
- **Applying `motion-safe:animate-*` without `motion-safe:` prefix:** CLAUDE.md hard rule — every animate-* must use `motion-safe:animate-*`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stage grouping from array | Custom grouping utility | `new Map` + `filter` inline in JSX | No abstraction needed; ROADMAP_STEPS is static |
| Stage header styling | New component | Inline Tailwind + `aria-hidden` rule | Minimal markup; no reuse surface |
| Deadline chip for step 8 | New chip logic | Existing `getDeadlineStatus()` with `target_days: 14` | Already handles all numeric cases |
| Step description with parenthetical | Runtime string concatenation | Config value with text already appended | Config is source of truth; never build at runtime |

---

## Common Pitfalls

### Pitfall 1: `isLast` prop breaks line rendering when grouping

**What goes wrong:** After stage grouping, `isLast` is computed as `i === ROADMAP_STEPS.length - 1` (global last). This draws a connecting line from the last step of Stage 1 into the Stage 2 header, producing a visual artifact.

**Why it happens:** The original `RoadmapStep` was built for a flat list. `isLast` terminates the line. Grouping creates new "last step per stage" boundaries that the original calculation misses.

**How to avoid:** Pass `isLast={i === stageSteps.length - 1}` where `stageSteps` is the filtered array for each stage, not the global array. Each stage's final step should have `isLast={true}`.

**Warning signs:** A vertical line extends from the last step of "Setup & Preparation" into the "Influencer Outreach" header.

---

### Pitfall 2: Step 7 title still references "Roast My Email"

**What goes wrong:** Only the `description` is updated but the `title` is left as "Watch 3 Roast My Email Calls + Draft First Outreach Emails". CONTEXT.md explicitly states step 7 title should reflect drafting only.

**Why it happens:** The CONTEXT.md says "update title/description to focus on drafting only". Both the `title` and `description` fields need editing.

**How to avoid:** Update both `title` and `description` for step 7. A suitable title: "Draft Your First Outreach Emails". Description should focus on drafting, not watching calls.

**Warning signs:** Step 7 still shows "Roast" in the student roadmap card header.

---

### Pitfall 3: Step 6 unlock_url not fully removed

**What goes wrong:** Step 6 `unlock_url` is set to `null` in config, but the unlock modal trigger in `RoadmapClient.tsx` uses `currentStep?.unlock_url` — this will correctly evaluate to falsy and skip the modal. However, the persistent video link in `RoadmapStep.tsx` renders when `step.unlock_url && status === "completed"`. Setting to `null` in config correctly disables both.

**Why it happens:** Two places render the unlock URL — the completion modal and the persistent link. Both guard on `step.unlock_url` truthiness.

**How to avoid:** Set `unlock_url: null` in config only. No component changes needed for this requirement.

**Warning signs:** If the config line still has the old skool classroom string, the link will appear on completed step 6.

---

### Pitfall 4: Stage grouping in `RoadmapTab.tsx` conflicts with `space-y-4`

**What goes wrong:** `RoadmapTab.tsx` wraps the step list in `<div className="space-y-4">`. Inserting stage header divs inside this container means headers also get `space-y-4` top margin, which may be too little or too much for the visual weight of a section header.

**Why it happens:** `space-y-4` applies margin to all direct children uniformly.

**How to avoid:** Wrap each stage group (header + steps) in a `<div className="space-y-4">` and use `pt-6` on the header (except the first) rather than relying on the parent `space-y-4`. Or keep the parent `space-y-4` and use `mt-6` on non-first headers within the group wrapper.

---

### Pitfall 5: `zod` import path

**What goes wrong:** If any Zod schema is written during this phase (unlikely — no API changes), using `"zod/v4"` instead of `"zod"`.

**How to avoid:** Always `import { z } from "zod"` per CLAUDE.md hard rule. This phase has no Zod usage but the rule applies to all files touched.

---

## Code Examples

### Config edit pattern for step descriptions (ROAD-01)

```typescript
// src/lib/config.ts — current step 1
{ step: 1, ..., description: "Complete your onboarding and set up your profile", ... }

// After D-01
{ step: 1, ..., description: "Complete your onboarding and set up your profile (time asap)", ... }
```

### Config edit for step 5 unlock_url (ROAD-02)

```typescript
// Before
{ step: 5, ..., unlock_url: null as string | null }

// After
{ step: 5, ..., unlock_url: "https://www.skool.com/the-ima-accelerator-9388/ultimate-influencer-brand-crm-organize-your-contacts" as string | null }
```

### Config edit for step 6 unlock_url removal (ROAD-02/D-03)

```typescript
// Before
{ step: 6, ..., unlock_url: "https://www.skool.com/ima-accelerator/classroom" as string | null }

// After
{ step: 6, ..., unlock_url: null as string | null }
```

### Config edit for step 8 target_days (ROAD-04)

```typescript
// Before
{ step: 8, ..., target_days: null as number | null, ... }

// After
{ step: 8, ..., target_days: 14 as number | null, ... }
```

### Stage grouping in RoadmapClient.tsx (ROAD-05)

```tsx
// Derive stages once (stable, static config)
const stages = [...new Map(
  ROADMAP_STEPS.map(s => [s.stage, s.stageName])
).entries()].map(([stage, stageName]) => ({ stage, stageName }));

// In JSX — replace current flat ROADMAP_STEPS.map(...)
{stages.map(({ stage, stageName }, stageIdx) => {
  const stageSteps = ROADMAP_STEPS.filter(s => s.stage === stage);
  return (
    <div key={stage}>
      {/* Stage header */}
      <div className={cn(
        "flex items-center gap-3 pb-2",
        stageIdx > 0 && "pt-8"
      )}>
        <span className="text-xs font-semibold uppercase tracking-wider text-ima-text-muted">
          {stageName}
        </span>
        <div className="flex-1 h-px bg-ima-border" aria-hidden="true" />
      </div>
      {/* Stage steps */}
      {stageSteps.map((step, i) => {
        const stepProgress = progress.find((p) => p.step_number === step.step) ?? null;
        return (
          <RoadmapStep
            key={step.step}
            step={{ step_number: step.step, title: step.title, description: step.description, target_days: step.target_days, unlock_url: step.unlock_url }}
            progress={stepProgress}
            isLast={i === stageSteps.length - 1}  // per-stage isLast
            joinedAt={joinedAt}
            onComplete={(stepNumber) => setConfirmStep(stepNumber)}
          />
        );
      })}
    </div>
  );
})}
```

### Stage grouping in RoadmapTab.tsx (ROAD-06)

```tsx
// Replace current ROADMAP_STEPS.map inside <div className="space-y-4">
// Change outer div to remove space-y-4 (headers need different spacing)
<div className="space-y-6">
  {stages.map(({ stage, stageName }) => {
    const stageSteps = ROADMAP_STEPS.filter(s => s.stage === stage);
    return (
      <div key={stage} className="space-y-3">
        {/* Stage header */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ima-text-muted">
            {stageName}
          </span>
          <div className="flex-1 h-px bg-ima-border" aria-hidden="true" />
        </div>
        {/* Stage steps */}
        {stageSteps.map((step) => {
          const row = rowMap.get(step.step);
          const status = row?.status ?? "locked";
          const completedAt = row?.completed_at ?? null;
          const ds = getDeadlineStatus(step.target_days, joinedAt, status, completedAt);
          return (
            <div key={step.step} className="flex items-start gap-3">
              {/* ... existing step markup unchanged ... */}
            </div>
          );
        })}
      </div>
    );
  })}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat step list (no grouping) | Stage-grouped with headers | Phase 25 | Visual navigation; no logic change |
| Step 6 = Build Lead List + CRM link | Step 6 = Build Lead List + Watch Roast (no CRM link) | Phase 25 | Content accuracy |
| Step 7 = Watch Roast + Draft emails | Step 7 = Draft emails only | Phase 25 | Content accuracy |
| Step 8 = no deadline | Step 8 = 14-day deadline | Phase 25 | Deadline chip activates for step 8 |

---

## Open Questions

1. **Step 7 exact title text**
   - What we know: Current title is "Watch 3 Roast My Email Calls + Draft First Outreach Emails". CONTEXT.md says update to reflect "drafting only".
   - What's unclear: Exact replacement title string was not specified verbatim in CONTEXT.md (unlike step 6 which has exact text).
   - Recommendation: Use "Draft Your First Outreach Emails" as title; description "Draft your first outreach emails using the templates and frameworks from the course". This is clearly within Claude's discretion (step 6 exact text was locked; step 7 was not).

2. **Stage header spacing in student view with `animationDelay`**
   - What we know: The outer div in RoadmapClient currently has `motion-safe:animate-slideUp` with `animationDelay: "200ms"`. Grouping adds wrapper divs which may affect animation timing.
   - What's unclear: Whether each stage group should animate independently or the whole container should animate once.
   - Recommendation: Keep the single outer wrapper animation unchanged. Stage group divs are non-animated inner containers.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 25 has no external dependencies. All changes are config edits and JSX rendering changes within the existing Next.js project. No external tools, services, CLIs, or databases are affected.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed (no jest.config, vitest.config, or test scripts in package.json) |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` (build verification) |
| Full suite command | `npm run lint && npx tsc --noEmit && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROAD-01 | Descriptions 1-8 contain parenthetical text | manual-only | Visual inspection of student roadmap page | N/A |
| ROAD-02 | Step 5 shows skool CRM link; step 6 has no unlock link | manual-only | Visual inspection + TypeScript type check | N/A |
| ROAD-03 | Step 6 description matches exact text; step 7 drafting only | manual-only | Visual inspection of student roadmap page | N/A |
| ROAD-04 | Step 8 deadline chip responds to 14-day target | type-check | `npx tsc --noEmit` — ensures `target_days: 14` is `number \| null` | N/A |
| ROAD-05 | Student roadmap shows three stage headers | manual-only | Visual inspection of `/student/roadmap` | N/A |
| ROAD-06 | Coach roadmap tab shows three stage headers | manual-only | Visual inspection of coach student detail page | N/A |

Manual-only justification: No test framework is installed. All ROAD-* requirements are config value changes and JSX rendering changes — verifiable by TypeScript build success (`npx tsc --noEmit`) and visual inspection. A passing `npm run build` confirms no type errors in changed files.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm run lint && npx tsc --noEmit`
- **Phase gate:** `npm run build` green before `/gsd:verify-work`

### Wave 0 Gaps

None — no test framework exists and none is required for this phase. Build + type check is the validation gate.

---

## Project Constraints (from CLAUDE.md)

All constraints applicable to code changed in this phase:

| Constraint | Applies To | Enforcement |
|------------|------------|-------------|
| `motion-safe:animate-*` on every `animate-*` class | Any new animation classes in stage header JSX | No new animations planned — constraint satisfied |
| `min-h-[44px]` on interactive elements | No new interactive elements in this phase | N/A |
| `aria-label` or `<label htmlFor>` on inputs | No new inputs | N/A |
| Admin client only in server code | No API routes touched | N/A |
| `import { z } from "zod"` not `"zod/v4"` | No Zod usage in this phase | N/A |
| `ima-*` tokens only — no hardcoded hex/gray | Stage header text and line colors | Use `text-ima-text-muted`, `bg-ima-border` |
| Config is truth — import from `src/lib/config.ts` | Stage grouping derives from `ROADMAP_STEPS` | stageName/stage come from config, not hardcoded |
| `aria-hidden="true"` on decorative icons/dividers | `<div>` rule divider in stage header | Add `aria-hidden="true"` to the `<div className="h-px">` |
| `text-white` only on colored backgrounds | Stage header text | Use `text-ima-text-muted` (on white bg), not `text-white` |

---

## Sources

### Primary (HIGH confidence)

- Direct source code read: `src/lib/config.ts` — confirmed current ROADMAP_STEPS values, `as const` structure, existing stage/stageName fields
- Direct source code read: `src/components/student/RoadmapClient.tsx` — confirmed flat iteration, props passed to RoadmapStep, isLast usage
- Direct source code read: `src/components/student/RoadmapStep.tsx` — confirmed isLast controls connecting line render, unlock_url render conditions
- Direct source code read: `src/components/coach/RoadmapTab.tsx` — confirmed flat iteration, rowMap pattern
- Direct source code read: `src/lib/roadmap-utils.ts` — confirmed getDeadlineStatus handles numeric target_days
- Direct source code read: `tailwind.config.ts` — confirmed all ima-* token names
- Direct source code read: `src/components/ui/Badge.tsx` — confirmed variants available
- Direct source code read: `package.json` — confirmed no test framework installed

### Secondary (MEDIUM confidence)

- `.planning/phases/25-roadmap-config-stage-headers/25-CONTEXT.md` — locked decisions and canonical refs verified against actual code

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files read directly from source
- Architecture: HIGH — current patterns fully understood from source; grouping approach is standard React pattern
- Pitfalls: HIGH — identified from reading actual component logic (isLast, unlock_url render conditions, spacing classes)
- Config changes: HIGH — every current value confirmed by reading config.ts directly

**Research date:** 2026-03-31
**Valid until:** 2026-05-31 (stable codebase, no fast-moving dependencies in scope)
