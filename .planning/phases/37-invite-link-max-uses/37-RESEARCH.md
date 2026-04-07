# Phase 37: Invite Link max_uses - Research

**Researched:** 2026-04-04
**Domain:** Magic link invite capacity — database migration, API Zod schema, UI number input, usage display
**Confidence:** HIGH

## Summary

This is a narrow, well-bounded feature: add a `max_uses` default and override to magic link creation, update the usage display on invite management cards, and verify the callback enforcement (already done). The critical constraint is that existing null-max_uses rows must be grandfathered as unlimited — the migration sets a DEFAULT on the column for future inserts but does NOT backfill existing rows.

The callback enforcement (INVITE-03) is already fully implemented at `src/app/api/auth/callback/route.ts:196-223`. It uses optimistic locking (`use_count` equality check) and redirects to `/register?magic=${magicCode}&error=magic_link_invalid` on exhausted links. The register page (`src/app/(auth)/register/page.tsx:83-84`) also already checks `use_count >= max_uses` and renders an error card. No changes needed for INVITE-03.

The two remaining requirements (INVITE-01, INVITE-02) touch three files: the POST handler in `api/magic-links/route.ts`, and the two client components `CoachInvitesClient.tsx` and `OwnerInvitesClient.tsx`. A single migration adds `DEFAULT 10` to the column.

**Primary recommendation:** One migration file (`00019_magic_links_default.sql`), one API change (POST route Zod schema + insert value), two UI component changes (number input + display format). No new dependencies.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Simple number input field with default value of 10 pre-filled, range 1-10,000
- **D-02:** Plain number input placed next to the "Generate Invite Link" button, labeled "Max uses"
- **D-03:** Default pre-filled so most users click generate without thinking about it — low friction
- **D-04:** No unlimited option for new links — every new link gets a cap (default 10)
- **D-05:** Existing links with null max_uses are grandfathered and display as "∞"
- **D-06:** Cannot create new unlimited links going forward — prevents accidental open-ended invite links
- **D-07:** Show "X / Y used" as text below each magic link card (e.g., "3 / 10 used")
- **D-08:** When exhausted (use_count >= max_uses), show in ima-danger color with "Exhausted" badge
- **D-09:** For grandfathered unlimited links, show "X / ∞ used" in normal color
- **D-10:** No progress bar — just text

### Claude's Discretion
- Migration strategy (ALTER DEFAULT vs application-only default)
- Zod schema shape for the max_uses field on POST /api/magic-links
- Exact placement/sizing of the number input in the form layout

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INVITE-01 | Magic link creation accepts an optional max_uses field, defaulting to 10 | POST /api/magic-links Zod schema change + insert value change; DB DEFAULT 10 migration |
| INVITE-02 | UI shows "X/Y used" on existing magic link cards | CoachInvitesClient + OwnerInvitesClient display lines 405-406 / 410-411 updated to new format |
| INVITE-03 | Registration via magic link is rejected when use_count >= max_uses | ALREADY DONE — callback route.ts:199 enforces this with optimistic lock; register page also checks |
</phase_requirements>

---

## Standard Stack

No new libraries required. All needs are met by the existing stack.

### Core (existing, no changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | installed | Schema validation for POST body | Project rule: Zod safeParse on all API inputs |
| Supabase admin client | installed | DB mutation in API routes | Project rule: admin client in API routes |
| CVA / Badge component | installed | "Exhausted" badge rendering | Existing design system primitive |
| Input component | installed | Number input for max_uses | CVA-based, already handles label + aria |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure
This phase touches existing files only. No new files required except one migration.

```
supabase/migrations/
└── 00019_magic_links_default.sql    # ADD DEFAULT 10 to max_uses column

src/app/api/magic-links/
└── route.ts                         # POST: Zod schema + insert change

src/components/coach/
└── CoachInvitesClient.tsx           # state, form, display updates

src/components/owner/
└── OwnerInvitesClient.tsx           # mirror of coach changes
```

### Pattern 1: Migration Strategy — ALTER COLUMN SET DEFAULT

**What:** Add a column-level DEFAULT of 10 to `magic_links.max_uses` so database-level inserts automatically get 10 when no value is supplied. Does NOT backfill existing null rows (grandfathering per D-05).

**When to use:** This is the correct approach. The application already handles null as unlimited in the display and callback. The migration is a one-liner with no data risk.

**Example:**
```sql
-- 00019_magic_links_default.sql
ALTER TABLE public.magic_links
  ALTER COLUMN max_uses SET DEFAULT 10;
```

**Why not application-only default:** If the DB column has no DEFAULT and the API code is bypassed (direct DB insert, future tools), new rows would get null (unlimited). The DB-level DEFAULT is the reliable enforcement layer. The Zod schema also sends an explicit value, so both layers agree.

### Pattern 2: Zod Schema for POST Body

**What:** Extend the POST handler's body parsing to accept an optional `max_uses` field, falling back to 10.

**When to use:** Whenever accepting user-supplied numeric input with a bounded range.

**Example:**
```typescript
// Source: existing project pattern in src/app/api/magic-links/route.ts
const postSchema = z.object({
  role: z.enum(["coach", "student", "student_diy"]).optional().default("student"),
  max_uses: z.number().int().min(1).max(10000).optional().default(10),
});
```

Then in the insert:
```typescript
const { data: link, error } = await admin
  .from("magic_links")
  .insert({
    code,
    role: magicRole,
    created_by: profile.id,
    expires_at: null,
    max_uses: parsed.data.max_uses,  // 10 by default, user-supplied otherwise
  })
  .select()
  .single();
```

**Current state of route.ts:** The POST handler parses role only with a try/catch on `request.json()`. The refactor should consolidate role + max_uses into a single Zod schema + safeParse block instead of the current try/catch approach, or keep the current structure and add max_uses alongside.

**Recommended approach:** Consolidate into one `postSchema` with both fields parsed in a single `safeParse`. This is cleaner and aligns with how PATCH uses `patchSchema`.

### Pattern 3: Usage Display Format

**What:** Replace the fragmented `{link.use_count} use{...}` + conditional `/ {link.max_uses}` with a single unified string rendering function and conditional color/badge.

**When to use:** Both CoachInvitesClient and OwnerInvitesClient magic link list items.

**Example (display logic):**
```typescript
// Helper function in component scope
function getUsageDisplay(link: MagicLinkItem): { text: string; exhausted: boolean } {
  const limit = link.max_uses === null ? "∞" : String(link.max_uses);
  const exhausted = link.max_uses !== null && link.use_count >= link.max_uses;
  return {
    text: `${link.use_count} / ${limit} used`,
    exhausted,
  };
}
```

**Rendering pattern (inside magic links map):**
```tsx
const { text: usageText, exhausted } = getUsageDisplay(link);

// In the card content:
<p className={`text-xs flex items-center gap-2 flex-wrap ${exhausted ? "text-ima-error" : "text-ima-text-secondary"}`}>
  <Clock className="h-3 w-3" aria-hidden="true" />
  Created {formatDate(link.created_at)}
  <span>&middot;</span>
  <span>{usageText}</span>
  {exhausted && (
    <Badge variant="error" size="sm">Exhausted</Badge>
  )}
</p>
```

### Pattern 4: Number Input for Max Uses

**What:** Add a number input with default 10, range 1-10000, next to the "Generate Invite Link" button. Uses controlled state with `useState<number>(10)`.

**When to use:** On the magic link tab panel in both coach and owner invite clients.

**Example (state + input):**
```typescript
const [maxUses, setMaxUses] = useState<number>(10);
```

```tsx
{/* Inside magic link tab CardContent, before the Button */}
<div className="flex flex-col sm:flex-row items-end gap-3">
  <div className="w-32">
    <Input
      type="number"
      label="Max uses"
      aria-label="Maximum number of uses for invite link"
      value={maxUses}
      onChange={(e) => setMaxUses(Math.max(1, Math.min(10000, Number(e.target.value))))}
      min={1}
      max={10000}
    />
  </div>
  <Button
    type="button"
    onClick={handleCreateMagicLink}
    loading={isSubmitting}
    disabled={isSubmitting}
    className="min-h-[44px]"
  >
    <Link2 className="h-4 w-4" aria-hidden="true" />
    Generate Invite Link
  </Button>
</div>
```

The `maxUses` state is then passed in the POST body:
```typescript
body: JSON.stringify({ role: selectedRole, max_uses: maxUses }),
```

### Anti-Patterns to Avoid

- **Using `ima-danger` token for exhausted state:** There is no `ima-danger` token in the design system. The CONTEXT.md mentions it conceptually. The correct token is `ima-error` (Badge `variant="error"`, text class `text-ima-error`). Confirmed from `tailwind.config.ts`.
- **Backfilling existing rows in migration:** `ALTER TABLE ... ALTER COLUMN max_uses SET DEFAULT 10` only affects future inserts. Do NOT add `UPDATE magic_links SET max_uses = 10 WHERE max_uses IS NULL` — that breaks the grandfathering requirement (D-05).
- **Parsing max_uses from form input without bounding:** Raw `Number(e.target.value)` can produce NaN or out-of-range values. Always clamp: `Math.max(1, Math.min(10000, Number(e.target.value) || 10))`.
- **Keeping the try/catch body-parse in POST route:** The current POST handler uses a try/catch around `request.json()` and ignores parse failures. Per project hard rule "Never swallow errors", consolidate into a proper Zod schema with `.safeParse()`.
- **Separate Zod schemas for role and max_uses:** Don't parse them in separate steps. One postSchema parses both fields together.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Exhausted" visual indicator | Custom color CSS or inline style | `Badge variant="error"` + `text-ima-error` | Existing CVA primitive; stays in sync with design tokens |
| Input with label + ARIA | Raw `<input>` | `Input` component from `@/components/ui/Input` | Already wires `htmlFor`, `id`, `aria-invalid`, `aria-describedby` |
| Number clamping | Build custom numeric stepper | `Math.max/min` + HTML `min`/`max` attributes | Native browser validation + one-liner JS guard |

---

## Common Pitfalls

### Pitfall 1: ima-danger Does Not Exist
**What goes wrong:** Using `text-ima-danger` or `bg-ima-danger` produces no style — the class is silently ignored by Tailwind because the token is not defined.
**Why it happens:** CONTEXT.md D-08 says "ima-danger color" but the design token is `ima-error`.
**How to avoid:** Use `text-ima-error` and `Badge variant="error"`. Verified in `tailwind.config.ts` — `ima.error: "#EF4444"` exists; `ima.danger` does not.
**Warning signs:** Badge appears unstyled (default gray) when exhausted.

### Pitfall 2: Backfilling Breaks Grandfathering
**What goes wrong:** Adding an UPDATE statement in the migration converts existing unlimited links to 10-use links, violating D-05.
**Why it happens:** Desire to make all rows consistent.
**How to avoid:** The migration must only contain `ALTER COLUMN max_uses SET DEFAULT 10`. No UPDATE statements. Verified: the display code and callback code already handle `null` as unlimited correctly.
**Warning signs:** Links that were previously unlimited suddenly show "0 / 10 used" in exhausted state.

### Pitfall 3: NaN from Empty Number Input
**What goes wrong:** User clears the input field. `Number("")` returns `0`. Zod `z.number().min(1)` rejects 0 at the API layer, producing a 400 error with confusing UX.
**Why it happens:** `<input type="number">` emits empty string when cleared.
**How to avoid:** In the onChange handler, guard: `Math.max(1, Math.min(10000, Number(e.target.value) || 10))`. The `|| 10` fallback ensures the value stays valid when the field is transiently empty.
**Warning signs:** API returns 400 when user clears the max uses field before clicking generate.

### Pitfall 4: Forgetting to Pass max_uses in handleCreateMagicLink
**What goes wrong:** The API defaults to 10 via Zod schema default, but the UI state diverges — user types 5, clicks generate, link shows 10 in the card.
**Why it happens:** `handleCreateMagicLink` currently uses `useCallback` with `[isSubmitting, selectedRole]` deps. If `maxUses` is not in the closure, the stale closure sends the old default.
**How to avoid:** Either include `maxUses` in the `useCallback` dep array, or read it via a ref (consistent with the existing `routerRef`/`toastRef` pattern). Including in deps is simpler for a non-polling callback.
**Warning signs:** Created link always shows 10 even when a different value was entered.

### Pitfall 5: Missing max_uses in Optimistic State After Create
**What goes wrong:** After `handleCreateMagicLink` succeeds, `setLocalMagicLinks(prev => [data, ...prev])` adds the new link. If the server returns the inserted row (which it does via `.select().single()`), the `data` object already has `max_uses: 10`. No extra handling needed — but only if `MagicLinkItem` type in the component accepts the response shape.
**Why it happens:** If the type is wrong or the response shape changes.
**How to avoid:** The existing `MagicLinkItem` type already has `max_uses: number | null`. The API response includes the full inserted row. No change needed here, just verify.
**Warning signs:** Newly created link shows "0 / undefined used" in the card.

---

## Code Examples

### Migration (00019_magic_links_default.sql)
```sql
-- Source: established migration pattern in supabase/migrations/
-- Sets DEFAULT 10 for future inserts; does NOT touch existing rows (grandfathering)
ALTER TABLE public.magic_links
  ALTER COLUMN max_uses SET DEFAULT 10;
```

### POST Route Refactor (consolidated Zod schema)
```typescript
// Source: project pattern — PATCH handler in same file already uses patchSchema + safeParse
const postSchema = z.object({
  role: z.enum(["coach", "student", "student_diy"]).optional().default("student"),
  max_uses: z.number().int().min(1).max(10000).optional().default(10),
});

// In POST handler — replace the existing try/catch role parse block:
let body: unknown;
try {
  body = await request.json();
} catch {
  body = {};  // empty body = all defaults
}

const parsed = postSchema.safeParse(body);
// parsed.success is always true here because all fields have .default()
const magicRole = parsed.success ? parsed.data.role : "student";
const maxUses = parsed.success ? parsed.data.max_uses : 10;

// Then in insert:
max_uses: maxUses,
```

### Usage Display Logic
```typescript
// Exhausted check — use_count and max_uses are both on MagicLinkItem
const isExhausted = (link: MagicLinkItem) =>
  link.max_uses !== null && link.use_count >= link.max_uses;

const usageLabel = (link: MagicLinkItem) =>
  `${link.use_count} / ${link.max_uses === null ? "∞" : link.max_uses} used`;
```

### Badge Variant for Exhausted State
```tsx
// Correct: use variant="error", not variant="danger" (does not exist)
{isExhausted(link) && (
  <Badge variant="error" size="sm">Exhausted</Badge>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `max_uses: null` hardcoded in POST handler | `max_uses: 10` default + optional body override | Phase 37 | New links get cap; old links remain unlimited |
| `{use_count} use(s) / {max_uses}` fragmented display | `"X / Y used"` unified string + Exhausted badge | Phase 37 | Consistent with D-07/D-08/D-09 |

**Nothing deprecated or outdated.** INVITE-03 enforcement in callback was already correct — no change needed.

---

## INVITE-03 Verification (Already Done)

The CONTEXT.md pending todo "Verify /api/auth/callback max_uses enforcement before writing Phase 37 migration" has been resolved by direct code inspection.

`src/app/api/auth/callback/route.ts:196-223`:
- Line 199: `(magicLink.max_uses !== null && magicLink.use_count >= magicLink.max_uses)` — rejects exhausted links before claiming a slot
- Line 216-222: Optimistic locking via `eq("use_count", magicLink.use_count)` — prevents race conditions
- Line 224-232: Rolls back use_count on claim failure
- Line 241-253: Rolls back use_count if existing email detected
- Line 292-302: Rolls back use_count if user insert fails

`src/app/(auth)/register/page.tsx:83-84`:
- Client-side early rejection renders an error card before Google OAuth flow starts

INVITE-03 is complete. No code changes needed for it.

---

## Open Questions

1. **Should `maxUses` state be a `string` or `number` in React?**
   - What we know: HTML `<input type="number">` always yields a string from `e.target.value`. Using `useState<number>` requires converting on change.
   - What's unclear: Whether to keep it as `number` state (convert on change) or `string` state (convert at submit time).
   - Recommendation: Keep as `number` state with conversion + clamping in onChange. Simpler type flow, no string-to-number conversion at submit.

2. **Does coach insert policy on magic_links allow `student_diy` role?**
   - What we know: `src/lib/types.ts:113` shows `magic_links.role` type includes `"student_diy"`. The callback handles it.
   - What's unclear: The original RLS policy at `00001_create_tables.sql:269-273` only allows `role = 'student'` for coach inserts.
   - Recommendation: Check if a later migration expanded this. If not, the coach_insert_magic_links policy may need updating — but this was pre-existing before Phase 37. Do not change it in this phase unless it directly blocks INVITE-01 testing. The CONTEXT.md doesn't mention this as a concern.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config changes only. No external CLI tools, services, or runtimes beyond the already-running Next.js dev server and Supabase project.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual UAT (no automated test framework detected) |
| Config file | none |
| Quick run command | `npm run build && npm run lint` |
| Full suite command | `npx tsc --noEmit && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INVITE-01 | POST /api/magic-links without max_uses body creates link with use_count=0, max_uses=10 | manual smoke | `npm run build` — confirms no type errors | N/A |
| INVITE-01 | POST /api/magic-links with `{ max_uses: 5 }` creates link with max_uses=5 | manual smoke | manual API test | N/A |
| INVITE-01 | POST /api/magic-links with `{ max_uses: 0 }` returns 400 | manual smoke | `npm run lint && npx tsc --noEmit` | N/A |
| INVITE-02 | Coach invite page shows "3 / 10 used" format | manual UAT | visual inspection | N/A |
| INVITE-02 | Exhausted link shows red text + "Exhausted" badge | manual UAT | visual inspection | N/A |
| INVITE-02 | Grandfathered link (null max_uses) shows "X / ∞ used" in normal color | manual UAT | visual inspection | N/A |
| INVITE-03 | Registration via exhausted link redirects to error page | manual UAT | pre-existing, verify unchanged | N/A |

### Sampling Rate
- **Per task commit:** `npm run lint && npx tsc --noEmit`
- **Per wave merge:** `npm run build`
- **Phase gate:** Full lint + type check + manual smoke of invite link creation before `/gsd:verify-work`

### Wave 0 Gaps
None — no test infrastructure setup needed. Project uses manual UAT, consistent with all prior phases.

---

## Project Constraints (from CLAUDE.md)

These directives apply to all code written in this phase:

| Directive | Application |
|-----------|-------------|
| `import { z } from "zod"` — never `"zod/v4"` | POST route Zod schema uses `import { z } from "zod"` |
| Admin client only in server code | admin client already used in route.ts; no client component imports admin |
| `motion-safe:` on animate-* classes | No animations added in this phase |
| 44px touch targets (`min-h-[44px]`) | Number input uses `Input` component (h-11 = 44px); Button already has `min-h-[44px]` |
| Accessible labels — every input needs `aria-label` or `<label>` with `htmlFor`+`id` | `Input` component auto-generates id + label; add `aria-label` for the number input |
| Never swallow errors — every `catch` block must toast or `console.error` | Current POST route try/catch swallows body-parse failure silently (empty catch); refactor replaces this with a `body = {}` fallback that surfaces via Zod defaults |
| Check `response.ok` — every `fetch()` must check before parsing JSON | Both client components already check `res.ok` before `res.json()` |
| `ima-*` tokens only — never hardcoded hex/gray | Use `text-ima-error`, `Badge variant="error"` — not `text-red-500` or hex |
| Auth + role check before validation on every API route | POST route checks auth + role before body parsing — maintain this order |
| Zod safeParse on all API inputs | Replace current try/catch role parse with unified postSchema.safeParse |

---

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `src/app/api/magic-links/route.ts` — confirmed current POST inserts `max_uses: null`
- Direct file inspection: `src/app/api/auth/callback/route.ts:196-223` — confirmed INVITE-03 is fully implemented
- Direct file inspection: `tailwind.config.ts` — confirmed `ima-error` exists, `ima-danger` does not exist
- Direct file inspection: `src/components/coach/CoachInvitesClient.tsx:405-406` — confirmed current display format
- Direct file inspection: `src/components/owner/OwnerInvitesClient.tsx:410-411` — confirmed current display format
- Direct file inspection: `src/components/ui/Badge.tsx` — confirmed `error` variant uses `ima-error` token
- Direct file inspection: `src/components/ui/Input.tsx` — confirmed component handles label, id, aria automatically
- Direct file inspection: `src/lib/types.ts:109-148` — confirmed `max_uses: number | null` already in Row type
- Direct file inspection: `supabase/migrations/00001_create_tables.sql:75` — confirmed `max_uses int` column exists with no DEFAULT

### Secondary (MEDIUM confidence)
- Established Supabase pattern: `ALTER COLUMN SET DEFAULT` is the standard way to add a default to an existing column without touching existing rows

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing libraries, no new dependencies
- Architecture: HIGH — direct code inspection of all affected files
- Pitfalls: HIGH — `ima-danger` token absence verified against tailwind.config.ts; INVITE-03 completeness verified against callback source
- Migration strategy: HIGH — ALTER DEFAULT is standard Postgres; grandfathering is guaranteed by not backfilling

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable codebase, no external API dependencies)
