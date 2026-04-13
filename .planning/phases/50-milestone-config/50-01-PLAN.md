---
phase: 50-milestone-config
plan: 01
slug: milestone-config
name: Milestone Config Constants + Alert-Key Composer
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/config.ts
autonomous: true
requirements:
  - NOTIF-01
user_setup: []

must_haves:
  truths:
    - "Phase 51's RPC can reference MILESTONE_CONFIG.influencersClosedStep (= 11) instead of the literal 11"
    - "Phase 51's RPC can reference MILESTONE_CONFIG.brandResponseStep (= 13) instead of the literal 13"
    - "Phase 51's RPC can reference MILESTONE_CONFIG.techSetupStep (nullable placeholder) behind a feature flag until D-06 resolves"
    - "Phase 51's RPC and UI can compose idempotent alert_key values via a single named helper/constants (e.g. MILESTONES.closedDeal(studentId, dealId))"
    - "The closed-deal alert_key ALWAYS includes deal_id so a high performer's second deal fires a fresh notification (D-07)"
    - "MILESTONE_FEATURE_FLAGS.techSetupEnabled is false at ship time; code reading it short-circuits the Tech/Email Setup evaluation"
    - "SYNC comments in config.ts match the 00014/00021 style so the Phase 51 migration can cross-reference the config as the single source of truth"
    - "Post-phase gate passes: npm run lint && npx tsc --noEmit && npm run build with zero errors"
  artifacts:
    - path: "src/lib/config.ts"
      provides: "MILESTONE_CONFIG object, MILESTONES alert-key composer, MILESTONE_FEATURE_FLAGS object, exported types"
      contains: "export const MILESTONE_CONFIG"
    - path: "src/lib/config.ts"
      provides: "MILESTONES alert-key namespace with 4 composers"
      contains: "export const MILESTONES"
    - path: "src/lib/config.ts"
      provides: "MILESTONE_FEATURE_FLAGS feature flag object"
      contains: "export const MILESTONE_FEATURE_FLAGS"
  key_links:
    - from: "src/lib/config.ts (MILESTONE_CONFIG)"
      to: "future Phase 51 migration 00027 (milestone RPC)"
      via: "SYNC comment referencing MILESTONE_CONFIG field names + numeric values"
      pattern: "SYNC: must match MILESTONE_CONFIG"
    - from: "src/lib/config.ts (MILESTONES.closedDeal)"
      to: "alert_dismissals.alert_key LIKE 'milestone_closed_deal:%'"
      via: "template string `milestone_closed_deal:${studentId}:${dealId}`"
      pattern: "milestone_closed_deal:.*:.*"
    - from: "src/lib/config.ts (MILESTONE_FEATURE_FLAGS.techSetupEnabled)"
      to: "future Phase 51 RPC Tech/Email Setup evaluation branch"
      via: "early return / skip block gated on the flag"
      pattern: "techSetupEnabled"
---

<intent>
Land the config-only scaffolding for the 4 v1.5 milestone notifications so Phase 51's RPC + UI consume NAMED constants from src/lib/config.ts (not magic numbers). Produce:

1. `MILESTONE_CONFIG` — roadmap-step references per milestone type
2. `MILESTONES` — alert-key namespace constants + composer helpers (idempotency contract)
3. `MILESTONE_FEATURE_FLAGS` — feature flag gating Tech/Email Setup until D-06 resolves at the Monday stakeholder meeting
4. SYNC comments matching 00014/00021 style so the future migration 00027 can cross-reference this config

NO UI, NO API, NO DB, NO tests — pure config surface. Zero runtime behavior change (MILESTONE_FEATURE_FLAGS.techSetupEnabled = false means nothing evaluates the new keys yet; existing 100h_milestone path is untouched).

Purpose: Phase 51 was flagged as blocked on D-06. This phase ships the contract so Phase 51 can land unblocked portions (NOTIF-02/03/04) on Monday and flip `techSetupEnabled = true` once D-06 is confirmed — without needing another config migration.

Output:
- `src/lib/config.ts` gains section "16. MILESTONE CONFIG (v1.5)" appended before DEFAULT EXPORT, with ~60-80 new LOC
- Default-export `config` object extended with `milestones` key pointing at `MILESTONE_CONFIG`
- `npm run lint && npx tsc --noEmit && npm run build` green
</intent>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/50-milestone-config/50-CONTEXT.md
@CLAUDE.md
@src/lib/config.ts
@supabase/migrations/00014_coach_alert_dismissals.sql

<interfaces>
<!-- Extracted from src/lib/config.ts — existing patterns the new section MUST follow. -->

Existing COACH_CONFIG shape (section 8, the 100h milestone pattern this extends):

```typescript
export const COACH_CONFIG = {
  atRiskInactiveDays: 3,
  atRiskRatingThreshold: 2,
  maxStudentsPerCoach: 50,
  reportInboxDays: 7,
  milestoneMinutesThreshold: 6000,  // 100 hours in minutes
  milestoneDaysWindow: 45,          // days since joined_at
} as const;
```

Existing ACTIVITY section (15) showing canonical SYNC comment style:

```typescript
// ---------------------------------------------------------------------------
// 15. ACTIVITY — student active/inactive threshold (D-14)
//     SYNC: mirrors public.student_activity_status in
//           supabase/migrations/00021_analytics_foundation.sql
//           Changing inactiveAfterDays REQUIRES updating the SQL helper's
//           `v_cutoff := p_today - (inactiveAfterDays - 1)` expression and
//           creating a new migration to redefine student_activity_status.
// ---------------------------------------------------------------------------
export const ACTIVITY = {
  inactiveAfterDays: 7, // D-14 locked: ...
} as const;
```

Existing ROADMAP_STEPS step numbers the new config references (section 6):
- Step 11 = "Close 5 Influencers" (stage 2) → `influencersClosedStep`
- Step 13 = "Get Brand Response" (stage 3) → `brandResponseStep`
- Step 4/5/6 region = Tech/Email Setup candidates (D-06 pending) → `techSetupStep` nullable placeholder

Existing default-export pattern (section 16) — new MILESTONE_CONFIG must be registered:

```typescript
const config = {
  app: APP_CONFIG,
  // ...
  activity: ACTIVITY,
  // ...
} as const;
```

Existing 100h_milestone alert_key composition (from coach/alerts/page.tsx:78):

```typescript
const key = `100h_milestone:${student.id}`;
```

The new composers follow the IDENTICAL `{namespace}:{ids...}` template-string pattern.

Existing SYNC comment style to match (from 00014_coach_alert_dismissals.sql:11):

```
-- SYNC: milestone thresholds must match COACH_CONFIG in src/lib/config.ts
--   milestoneMinutesThreshold: 6000 (100 hours)
--   milestoneDaysWindow: 45 (days since joined_at)
```

The config-side SYNC comment (added in this plan) mirrors this in the `//` TS comment style and names the expected future migration (`00027_*` — the Phase 51 milestone RPC migration).
</interfaces>
</context>

<files_modified>
- `src/lib/config.ts` — append new section, extend default-export object
</files_modified>

<approach>
Append ONE new section "16. MILESTONE CONFIG" to `src/lib/config.ts` immediately after section 15 (ACTIVITY) and before section 16 (now renumbered to 17) DEFAULT EXPORT. Wire the new constants into the `config` default-export object. Do not touch unrelated sections. No refactors. No reformatting.

Shape of the new section:

```typescript
// ---------------------------------------------------------------------------
// 16. MILESTONE CONFIG (v1.5 — coach notifications for 4 new student milestones)
//     SYNC: roadmap-step references and alert-key namespaces consumed by the
//           Phase 51 milestone RPC (future migration 00027_*). Changing any
//           numeric step reference or alert-key namespace REQUIRES a new
//           migration that rewrites the RPC. Namespaces are also used by the
//           /coach/alerts page UI and the get_sidebar_badges RPC coach branch.
//
//     Feature flag: techSetupEnabled defaults to false — the Tech/Email Setup
//     trigger does NOT fire until D-06 resolves at the Monday stakeholder
//     meeting. Code paths that evaluate this milestone must short-circuit on
//     the flag. Flip to `true` in the same commit that confirms D-06.
// ---------------------------------------------------------------------------
export type MilestoneType =
  | "tech_setup"
  | "5_influencers"
  | "brand_response"
  | "closed_deal";

export const MILESTONE_CONFIG = {
  // D-06 placeholder — nullable until Abu Lahya confirms at Monday meeting.
  // Current best-guess is step 4, 5, or 6 in "Setup & Preparation" stage.
  // Paired with MILESTONE_FEATURE_FLAGS.techSetupEnabled = false.
  techSetupStep: null as number | null,

  // Locked: Roadmap step 11 = "Close 5 Influencers" (stage 2).
  // SYNC: ROADMAP_STEPS[10].step === 11.
  influencersClosedStep: 11,

  // Locked: Roadmap step 13 = "Get Brand Response" (stage 3).
  // SYNC: ROADMAP_STEPS[12].step === 13.
  brandResponseStep: 13,
} as const;

export const MILESTONE_FEATURE_FLAGS = {
  // Disabled until D-06 resolves. When true, the Phase 51 RPC's Tech/Email
  // Setup branch evaluates MILESTONE_CONFIG.techSetupStep and fires alerts
  // keyed MILESTONES.techSetup(studentId). When false (default), that branch
  // is skipped entirely — no notifications, no sidebar badge contribution.
  techSetupEnabled: false,
} as const;

// Alert-key namespace constants + composers.
// SYNC: alert_dismissals.alert_key shape for coach_milestone_alerts.
// Mirrors the existing "100h_milestone:{student_id}" convention from
// supabase/migrations/00014_coach_alert_dismissals.sql (260401-cwd pattern).
//
// Idempotency contract (NOTIF-05):
//   - techSetup / fiveInfluencers / brandResponse : ONE-SHOT per student
//       key shape: "milestone_{type}:{student_id}"
//       → second Step 11 completion for same student = no new notification
//   - closedDeal : PER-DEAL (D-07) — fires on EVERY deal
//       key shape: "milestone_closed_deal:{student_id}:{deal_id}"
//       → second deal by same student = new notification (different deal_id)
export const MILESTONES = {
  techSetup: (studentId: string) =>
    `milestone_tech_setup:${studentId}` as const,

  fiveInfluencers: (studentId: string) =>
    `milestone_5_influencers:${studentId}` as const,

  brandResponse: (studentId: string) =>
    `milestone_brand_response:${studentId}` as const,

  closedDeal: (studentId: string, dealId: string) =>
    `milestone_closed_deal:${studentId}:${dealId}` as const,
} as const;

// LIKE patterns for alert_dismissals queries (Phase 51 RPC + /coach/alerts UI).
// Kept as named constants so the RPC SYNC comment can reference them by name.
export const MILESTONE_KEY_PATTERNS = {
  techSetup: "milestone_tech_setup:%",
  fiveInfluencers: "milestone_5_influencers:%",
  brandResponse: "milestone_brand_response:%",
  closedDeal: "milestone_closed_deal:%",
  // Matches ALL v1.5 milestone keys (but NOT legacy "100h_milestone:%").
  allV15Milestones: "milestone_%",
} as const;
```

Then extend the default-export:

```typescript
const config = {
  // ...existing fields...
  activity: ACTIVITY,
  milestones: MILESTONE_CONFIG,
  milestoneFlags: MILESTONE_FEATURE_FLAGS,
  milestoneKeys: MILESTONES,
  // ...
} as const;
```

**Why these exact names:**
- `MILESTONE_CONFIG` — matches plural-style `COACH_CONFIG` / `OWNER_CONFIG` convention
- `MILESTONES` — alert-key namespace (matches existing 100h_milestone namespace root; verb-free since they're identifiers, not actions)
- `MILESTONE_FEATURE_FLAGS` — plural because future milestones may add flags
- `MILESTONE_KEY_PATTERNS` — SQL LIKE patterns kept separate from the runtime composers so the Phase 51 migration can name them in SYNC comments without pulling in function bodies

**Why `as const` templates:** `as const` on the template literals preserves the literal return type (e.g. `\`milestone_tech_setup:${string}\``) so TypeScript can discriminate alert-key narrow types in the UI reducer downstream.

**Why no helper to DECOMPOSE keys:** Phase 51's RPC parses keys in SQL (LIKE prefix match); client code (/coach/alerts) only composes, never decomposes. YAGNI.

**Why 4 composers not a switch-based single function:** Tree-shakable imports in Phase 52's UI — importing `MILESTONES.closedDeal` pulls one arrow function, not a switch table. Also matches the "named values, not magic" phase goal.
</approach>

<execution_steps>

<tasks>

<task type="auto">
  <name>Task 1: Append MILESTONE_CONFIG, MILESTONES, MILESTONE_FEATURE_FLAGS, MILESTONE_KEY_PATTERNS to src/lib/config.ts</name>
  <files>src/lib/config.ts</files>
  <action>
Open `src/lib/config.ts`. Find section 15 (`// 15. ACTIVITY — student active/inactive threshold (D-14)`) and the existing section 16 (`// 16. DEFAULT EXPORT`).

Insert a new section between them numbered **16** and renumber the current DEFAULT EXPORT section to **17**.

The new section must contain, in this order:

1. A section banner comment (80-char `---` dividers, title line, and a SYNC paragraph that matches the style of section 15's ACTIVITY banner — multi-line `//` comments naming the target migration `supabase/migrations/00027_*` as the Phase 51 milestone RPC migration that will SYNC against this config). The SYNC paragraph MUST explicitly state: (a) that the numeric step references are consumed by the RPC, (b) that alert-key namespaces are also consumed by `/coach/alerts` UI and `get_sidebar_badges`, (c) that `techSetupEnabled` is false until D-06 resolves at the Monday stakeholder meeting, (d) that flipping any value requires a new migration.

2. `export type MilestoneType` — a string literal union of the 4 milestone types:
   ```typescript
   export type MilestoneType =
     | "tech_setup"
     | "5_influencers"
     | "brand_response"
     | "closed_deal";
   ```

3. `export const MILESTONE_CONFIG = { ... } as const` — object with exactly three fields:
   - `techSetupStep: null as number | null` (nullable placeholder, comment reference D-06 + Monday meeting + MILESTONE_FEATURE_FLAGS.techSetupEnabled pairing)
   - `influencersClosedStep: 11` (comment: `// SYNC: ROADMAP_STEPS[10].step === 11 ("Close 5 Influencers")`)
   - `brandResponseStep: 13` (comment: `// SYNC: ROADMAP_STEPS[12].step === 13 ("Get Brand Response")`)

4. `export const MILESTONE_FEATURE_FLAGS = { ... } as const` — object with exactly one field:
   - `techSetupEnabled: false` with a multi-line comment explaining: disabled until D-06, when true the Phase 51 RPC evaluates `MILESTONE_CONFIG.techSetupStep`, when false the branch is skipped entirely (no notification, no sidebar badge contribution).

5. `export const MILESTONES = { ... } as const` — object with exactly four arrow-function composer fields, each returning a template literal with `as const`:
   - `techSetup: (studentId: string) => \`milestone_tech_setup:${studentId}\` as const`
   - `fiveInfluencers: (studentId: string) => \`milestone_5_influencers:${studentId}\` as const`
   - `brandResponse: (studentId: string) => \`milestone_brand_response:${studentId}\` as const`
   - `closedDeal: (studentId: string, dealId: string) => \`milestone_closed_deal:${studentId}:${dealId}\` as const`

   A block comment ABOVE this object must explain the idempotency contract (NOTIF-05): one-shot keys for the first three (second qualification = no new notification), per-deal key for closedDeal (D-07: second deal = new notification via different deal_id). It must also reference the existing `100h_milestone:{student_id}` convention from `supabase/migrations/00014_coach_alert_dismissals.sql` as the pattern being extended.

6. `export const MILESTONE_KEY_PATTERNS = { ... } as const` — object with exactly five string fields for SQL LIKE matching:
   - `techSetup: "milestone_tech_setup:%"`
   - `fiveInfluencers: "milestone_5_influencers:%"`
   - `brandResponse: "milestone_brand_response:%"`
   - `closedDeal: "milestone_closed_deal:%"`
   - `allV15Milestones: "milestone_%"` (comment: `// Matches ALL v1.5 milestone keys but NOT legacy 100h_milestone:%`)

   Block comment above: "LIKE patterns for alert_dismissals queries (Phase 51 RPC + /coach/alerts UI). Kept as named constants so the migration SYNC comment can reference them by name."

7. Update the existing DEFAULT EXPORT `const config = { ... }` object (now section 17). Add four new keys immediately after `activity: ACTIVITY,` and before the closing `} as const;`:
   ```typescript
   activity: ACTIVITY,
   milestones: MILESTONE_CONFIG,
   milestoneFlags: MILESTONE_FEATURE_FLAGS,
   milestoneKeys: MILESTONES,
   milestoneKeyPatterns: MILESTONE_KEY_PATTERNS,
   ```

Renumber the DEFAULT EXPORT banner from `// 16. DEFAULT EXPORT` to `// 17. DEFAULT EXPORT — aggregate all V1 configs`.

**DO NOT:**
- Refactor or reformat any unrelated section
- Add Zod, new imports, new runtime dependencies — this file is pure data + arrow functions today
- Introduce a decomposer/parser for alert keys (YAGNI — consumers only compose)
- Wire this into any UI, API route, or component (that is Phase 51/52)
- Change `COACH_CONFIG.milestoneMinutesThreshold` or `COACH_CONFIG.milestoneDaysWindow` — those belong to the legacy 100h_milestone path and remain untouched per D-08

**MUST:**
- Use `as const` everywhere (matches the rest of the file)
- Use `ima-*` token-safe naming (all content is config, no color/UI concern here)
- Match the section-banner comment style EXACTLY (see section 15 for the canonical pattern)
- Keep the SYNC comment specific enough that a reader can locate both the config field AND the planned migration file name
  </action>
  <verify>
    <automated>cd C:/Users/ibrah/ima-accelerator-v1 && npx tsc --noEmit 2>&1 | tee /tmp/tsc-50-01.log && grep -q "^$\|error" /tmp/tsc-50-01.log || echo OK</automated>
    <automated>cd C:/Users/ibrah/ima-accelerator-v1 && node -e "const c = require('./src/lib/config.ts'); /* smoke — will fail in pure node, use npx tsx instead */" 2>/dev/null || npx tsx -e "import { MILESTONE_CONFIG, MILESTONES, MILESTONE_FEATURE_FLAGS, MILESTONE_KEY_PATTERNS } from './src/lib/config'; console.assert(MILESTONE_CONFIG.influencersClosedStep === 11, 'step 11'); console.assert(MILESTONE_CONFIG.brandResponseStep === 13, 'step 13'); console.assert(MILESTONE_CONFIG.techSetupStep === null, 'tech null'); console.assert(MILESTONE_FEATURE_FLAGS.techSetupEnabled === false, 'flag off'); console.assert(MILESTONES.closedDeal('s1','d1') === 'milestone_closed_deal:s1:d1', 'deal key'); console.assert(MILESTONES.techSetup('s1') === 'milestone_tech_setup:s1', 'tech key'); console.assert(MILESTONES.fiveInfluencers('s1') === 'milestone_5_influencers:s1', '5inf key'); console.assert(MILESTONES.brandResponse('s1') === 'milestone_brand_response:s1', 'brand key'); console.assert(MILESTONE_KEY_PATTERNS.closedDeal === 'milestone_closed_deal:%', 'pattern'); console.log('OK');"</automated>
  </verify>
  <done>
- `src/lib/config.ts` compiles clean under `npx tsc --noEmit` (zero errors)
- `MILESTONE_CONFIG`, `MILESTONES`, `MILESTONE_FEATURE_FLAGS`, `MILESTONE_KEY_PATTERNS` are all exported
- `MilestoneType` type union is exported
- All four success-criteria 1-4 artifacts are present and match their specified values
- Default-export `config` object exposes `.milestones`, `.milestoneFlags`, `.milestoneKeys`, `.milestoneKeyPatterns`
- No unrelated section of the file is modified
- SYNC comments reference migration `00027_*` (the planned Phase 51 RPC migration) and match the 00014/00021 banner style
  </done>
</task>

<task type="auto">
  <name>Task 2: Post-phase build gate — lint + typecheck + build</name>
  <files>(no files modified — verification only)</files>
  <action>
Run the mandated post-phase gate from D-12 / PERF-07 in this EXACT order (fail-fast with `&&`):

```bash
cd C:/Users/ibrah/ima-accelerator-v1
npm run lint && npx tsc --noEmit && npm run build
```

If lint reports warnings (not errors) on the new section, fix them in `src/lib/config.ts` without altering the contract shape (e.g. add trailing commas, adjust spacing). If lint reports an error on a LINE YOU DID NOT TOUCH (pre-existing), note it in the summary but do not fix — scope creep.

If `npx tsc --noEmit` reports an error inside the new section, fix in-place. Most likely causes:
- Missing `as const` on a template literal (return type widens to `string`)
- `MilestoneType` referenced before declaration (must be declared before use — it is not used internally here, but don't forget the `export`)
- Forgotten `export` keyword on any of the four top-level constants

If `npm run build` fails with a Next.js-specific error (e.g. module resolution, edge-runtime complaint), investigate whether the new section accidentally imported something (it should import NOTHING — pure data).

Do NOT:
- Run `npm run dev` (not needed for a config-only change)
- Run Playwright or any E2E tests (none exist for this path)
- Modify unrelated files to "clean up" — out of scope
  </action>
  <verify>
    <automated>cd C:/Users/ibrah/ima-accelerator-v1 && npm run lint && npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>
- `npm run lint` exits 0 with zero errors (warnings on untouched code are acceptable but should be noted)
- `npx tsc --noEmit` exits 0 with zero errors
- `npm run build` exits 0 — full Next.js 16 production build succeeds
- Success criterion 5 (post-phase gate) is demonstrably met for the phase SUMMARY
  </done>
</task>

</tasks>

</execution_steps>

<verification>

## Phase-level acceptance (all 5 ROADMAP success criteria)

1. **MILESTONE_CONFIG fields exist** — `grep -E "techSetupStep|influencersClosedStep: 11|brandResponseStep: 13" src/lib/config.ts` returns 3 matches; `MILESTONE_CONFIG.techSetupStep === null`, `.influencersClosedStep === 11`, `.brandResponseStep === 13`.

2. **MILESTONES alert-key namespaces exist** — `grep -E "milestone_tech_setup|milestone_5_influencers|milestone_brand_response|milestone_closed_deal" src/lib/config.ts` returns 4 matches (one per composer); `MILESTONES.closedDeal('s','d') === 'milestone_closed_deal:s:d'` (includes `deal_id` per D-07).

3. **SYNC comments match 00014 style** — new section has a top-banner `// SYNC: ...` paragraph mirroring section 15 (ACTIVITY) and the 00014 migration header; individual field comments name `ROADMAP_STEPS[10]` / `ROADMAP_STEPS[12]` as their source-of-truth pairs; the SYNC block names `supabase/migrations/00027_*` as the expected consuming migration.

4. **Feature flag disables tech_setup** — `MILESTONE_FEATURE_FLAGS.techSetupEnabled === false`; the code path is "wired" in the sense that the constant exists and is exported for Phase 51 to gate on, but nothing evaluates it yet (Phase 51's responsibility).

5. **Post-phase gate passes** — `npm run lint && npx tsc --noEmit && npm run build` exits 0 (Task 2 verify).

## NOTIF-01 placeholder satisfaction

NOTIF-01 requires "`MILESTONE_CONFIG` contains the roadmap step reference, placeholder until D-06 confirmed". Satisfied by `techSetupStep: null` + `MILESTONE_FEATURE_FLAGS.techSetupEnabled: false`. Full activation (flipping both) is Phase 51's job after the Monday meeting.

## Cross-cutting (PERF-07, PERF-08) — applicable

- **PERF-07**: Post-phase gate is Task 2.
- **PERF-08**: Not applicable to config-only phase (no UI, no ima-* tokens introduced, no animations, no touch targets, no inputs).

## Decision coverage matrix

| D-XX | Plan | Task | Coverage | Notes |
|------|------|------|----------|-------|
| D-06 | 01 | 1 | Full — placeholder | `techSetupStep: null` + `techSetupEnabled: false` gate |
| D-07 | 01 | 1 | Full | `MILESTONES.closedDeal(studentId, dealId)` includes `deal_id` |
| D-08 | 01 | 1 | Full | New keys extend the `100h_milestone:...` namespace pattern; legacy path untouched |
| D-12 | 01 | 2 | Full | Lint + typecheck + build gate |

No decision is "Partial". No split required.

</verification>

<threat_model>
## Trust Boundaries

Config-only phase — no new trust boundaries are introduced. The new exports are consumed entirely by server code (Phase 51 RPC) and internal trusted UI (Phase 52 `/coach/alerts` page). No user input flows through this code, no network boundary is crossed.

| Boundary | Description |
|----------|-------------|
| (none for this phase) | Phase 51/52 introduce boundaries (RPC input validation, `/coach/alerts` auth) — deferred to those phases |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-50-01 | Tampering | `MILESTONE_FEATURE_FLAGS.techSetupEnabled` | accept | Constant is a literal `false` in committed source; flipping requires a code change, PR review, and deploy — same trust model as every other config constant. No runtime mutation path exists (object is `as const`). |
| T-50-02 | Information Disclosure | `MILESTONES.closedDeal(studentId, dealId)` | accept | The composed alert_key contains `studentId` and `dealId` — both are UUIDs already exposed to the authenticated coach via the student detail page and deals table. No new PII is leaked. Alert_dismissals table is RLS-gated (00014 policies) — coach can only read their own rows. |
| T-50-03 | Repudiation | SYNC contract between config and future migration 00027 | mitigate | SYNC comment explicitly names the expected migration file and the exact fields that must match. Phase 51 executor cannot silently drift because the migration header will grep-reference back to this config. |
| T-50-04 | DoS | `MILESTONE_KEY_PATTERNS.allV15Milestones: "milestone_%"` | accept | LIKE prefix pattern on an indexed `alert_key` column (alert_dismissals) — Postgres uses the btree index for prefix matches. Phase 51 query perf is its own concern, not introduced by this phase. |
| T-50-05 | Elevation of Privilege | Null `techSetupStep` consumed before D-06 resolves | mitigate | `MILESTONE_FEATURE_FLAGS.techSetupEnabled: false` is the gate. Phase 51 MUST read the flag before dereferencing `techSetupStep`. If Phase 51's executor forgets the gate, TypeScript catches it: `techSetupStep: number \| null` forces a null check. Belt-and-braces: the flag AND the nullable type. |

Every threat is either accepted with rationale or mitigated by a concrete code/comment artifact in Task 1. No threats are deferred without disposition.

</threat_model>

<success_criteria>

1. `src/lib/config.ts` contains new section 16 with `MILESTONE_CONFIG`, `MILESTONES`, `MILESTONE_FEATURE_FLAGS`, `MILESTONE_KEY_PATTERNS`, `MilestoneType` — all exported.
2. `MILESTONE_CONFIG.techSetupStep === null`, `.influencersClosedStep === 11`, `.brandResponseStep === 13`.
3. `MILESTONES.closedDeal(studentId, dealId)` composes `milestone_closed_deal:{studentId}:{dealId}` (D-07 satisfied).
4. `MILESTONE_FEATURE_FLAGS.techSetupEnabled === false` (D-06 gate in place).
5. SYNC comments match the style of section 15 (ACTIVITY) and migration 00014 headers; future migration name `00027_*` is explicitly referenced.
6. Default-export `config` object exposes `.milestones`, `.milestoneFlags`, `.milestoneKeys`, `.milestoneKeyPatterns`.
7. `npm run lint && npx tsc --noEmit && npm run build` exits 0 (D-12 / PERF-07).
8. No unrelated file is modified; no new npm dependency is added; zero runtime behavior change (legacy 100h_milestone path and all v1.0–v1.4 code paths untouched).

</success_criteria>

<output>
After completion, create `.planning/phases/50-milestone-config/50-01-SUMMARY.md` per the standard summary template documenting:
- New constants added (names, values, types)
- Why `techSetupEnabled: false` (D-06 gate rationale)
- SYNC contract with future migration 00027
- Gate results (`lint + tsc + build` output)
- NOTIF-01 placeholder status (config landed; activation in Phase 51 after Monday D-06 resolution)
</output>
