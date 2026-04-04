# Phase 36: Resources Tab - Research

**Researched:** 2026-04-04
**Domain:** Next.js App Router CRUD pages, CSP headers, iframe embeds, Supabase admin client patterns
**Confidence:** HIGH

## Summary

Phase 36 builds a unified Resources page for owner, coach, and student roles. The database schema (migration 00015) is fully deployed with `resources` and `glossary_terms` tables including RLS policies. TypeScript types are in `src/lib/types.ts`. All UI primitives (Card, Modal, Input, Textarea, Button, EmptyState) exist and are production-ready.

The main implementation work spans five areas: (1) adding navigation entries to `NAVIGATION` in `config.ts`, (2) blocking `/student_diy/resources` in `proxy.ts`, (3) creating three identical page files (`/owner/resources`, `/coach/resources`, `/student/resources`) that share a single client component, (4) building two API routes (`/api/resources`, `/api/glossary`), and (5) adding a `frame-src` CSP header to `next.config.ts` before writing the Discord embed component.

One schema gap requires a migration: the `resources` table has no `is_pinned` boolean column, but CONTEXT.md decision D-02 requires pinned resources to float to the top. A migration adding `is_pinned boolean NOT NULL DEFAULT false` must be created before any page can implement pinning. The planner must schedule this migration as Wave 0 task.

**Primary recommendation:** Write the `is_pinned` migration first, add nav + proxy entries second, then implement API routes, then the page client component. The CSP header must precede the DiscordEmbed component in the same wave.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** One Card per resource link (default variant). Card shows: title (bold), URL (truncated, clickable, opens in new tab `target="_blank" rel="noopener noreferrer"`), comment text if present, poster name, timestamp.
- **D-02:** Pinned resources appear at top with a pin icon. Non-pinned resources follow in reverse-chronological order.
- **D-03:** Modal form for adding resources ("Add Resource" button top-right opens Modal with: title input, URL input, comment textarea optional). Consistent with existing CRUD modal patterns.
- **D-04:** Same modal pattern for glossary: term input + definition textarea.
- **D-05:** Delete via icon button on each card/term with a confirm dialog before removal.
- **D-06:** Discord embed fixed height 600px with rounded corners and ima-border. Not full viewport.
- **D-07:** Alphabetical definition list — term as bold heading with definition below. No accordion, no cards.
- **D-08:** Search/filter input at top that filters by term name as you type (case-insensitive client-side filter, RES-08).
- **D-09:** Group by first letter with letter headers (A, B, C...) when list grows large.
- **D-10:** React state controls active tab (Links | Community | Glossary) — not URL segments.
- **D-10 (v1.4):** Discord WidgetBot iframe embed — no npm package.
- **D-11 (v1.4):** Resources visible to owner, coach, student — NOT student_diy.
- **D-12 (v1.4):** Glossary managed by owner + coaches (both roles can CRUD).
- **D-01 (Phase 30):** `resources` and `glossary_terms` tables exist in migration 00015 with RLS.
- **D-04 (Phase 30):** RLS is defense-in-depth only; real enforcement is proxy + API role checks + admin client.
- **Pitfall:** CSP header (`frame-src 'self' https://e.widgetbot.io`) must be added to `next.config.ts` BEFORE writing DiscordEmbed component.

### Claude's Discretion

- Tab styling (pill buttons vs underline tabs — follow whatever pattern looks best with existing UI)
- Pin/unpin mechanism for resources (whether to add a boolean column or use a separate approach)
- Exact truncation length for URLs on link cards
- Empty state copy for each tab
- Loading skeleton layout for each tab
- Whether glossary edit uses same modal or inline editing

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RES-01 | Owner, coach, and student see "Resources" in sidebar navigation | Add entries to `NAVIGATION` in `src/lib/config.ts` for owner, coach, student arrays |
| RES-02 | Student_DIY does NOT see Resources in sidebar | `student_diy` NAVIGATION array stays as-is; proxy blocks direct URL access |
| RES-03 | Resources page has three tabs: Links, Community (Discord), Glossary | React useState tab switch on shared `ResourcesClient` component; D-10 |
| RES-04 | Owner and coach can add resource links (URL + title + optional comment) and delete them | POST/DELETE `/api/resources`; role check allows owner+coach; admin client |
| RES-05 | Students can view resource links in read-only mode; links open in new tab | `target="_blank" rel="noopener noreferrer"` on anchor; no add/delete buttons when role=student |
| RES-06 | Community tab shows Discord WidgetBot iframe embed with configured server/channel | `NEXT_PUBLIC_DISCORD_GUILD_ID` + `NEXT_PUBLIC_DISCORD_CHANNEL_ID` env vars; CSP frame-src header in next.config.ts |
| RES-07 | Owner and coach can add, edit, and delete glossary terms (term + definition) | POST/PUT/DELETE `/api/glossary`; PUT requires `[id]` route segment |
| RES-08 | All eligible roles can search/filter glossary terms by name | Client-side `.filter()` on term string, `toLowerCase()` comparison |
| RES-09 | Glossary terms have case-insensitive unique constraint on term name | Already exists: `CREATE UNIQUE INDEX idx_glossary_terms_term_lower ON public.glossary_terms(lower(term))` in migration 00015; API must surface 23505 Postgres error code as user-facing message |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — zero new npm dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 (installed) | App Router page files, headers() config | Project standard |
| react | 19.2.3 (installed) | useState for tab state, client components | Project standard |
| zod | 4.3.6 (installed) | API input validation | CLAUDE.md hard rule |
| lucide-react | 0.576.0 (installed) | Icons: Pin, Trash2, ExternalLink, BookOpen, Link, Search | Project standard |
| @supabase/supabase-js | 2.99.2 (installed) | Admin client for all API route queries | Project standard |

**Installation:** No new packages needed. Phase 36 uses only existing dependencies.

**Version verification:** All versions confirmed from `package.json` on 2026-04-04.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── owner/resources/page.tsx        # requireRole("owner"), passes role prop
│   │   ├── coach/resources/page.tsx        # requireRole("coach"), passes role prop
│   │   └── student/resources/page.tsx      # requireRole("student"), passes role prop (read-only)
│   └── api/
│       ├── resources/route.ts              # GET, POST, DELETE (body: {id})
│       └── glossary/
│           ├── route.ts                    # GET, POST
│           └── [id]/route.ts               # PUT, DELETE
├── components/
│   └── resources/
│       ├── ResourcesClient.tsx             # "use client"; tab state, data fetching, full page
│       ├── ResourceLinkCard.tsx            # Card per link, pin icon, delete button
│       ├── AddResourceModal.tsx            # Modal form: title + url + comment
│       ├── DiscordEmbed.tsx                # iframe with env var check
│       ├── GlossaryList.tsx               # alphabetical list with letter headers
│       └── AddGlossaryModal.tsx            # Modal form: term + definition (add + edit)
└── next.config.ts                          # CSP frame-src header
```

### Pattern 1: Three-Page Single-Component (Role Prop)

**What:** Three minimal server page files each call `requireRole()` then render the same client component with a `role` prop. Follows the established "server component for auth + role; client component for interactivity" pattern.

**When to use:** When owner/coach/student share identical UI but differ only in edit permissions.

**Example:**
```typescript
// src/app/(dashboard)/student/resources/page.tsx
import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

export default async function StudentResourcesPage() {
  await requireRole("student");
  return <ResourcesClient role="student" />;
}
```

```typescript
// src/app/(dashboard)/coach/resources/page.tsx
import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

export default async function CoachResourcesPage() {
  await requireRole("coach");
  return <ResourcesClient role="coach" />;
}
```

### Pattern 2: Tab State with useState (D-10)

**What:** React `useState` drives which tab is active. Does NOT use URL params, so switching tabs preserves the Discord iframe (avoids iframe reload).

**Example:**
```typescript
// Source: D-10 from CONTEXT.md; mirrors existing chat page pattern
type Tab = "links" | "community" | "glossary";
const [activeTab, setActiveTab] = useState<Tab>("links");
```

### Pattern 3: API Route — resources (GET/POST/DELETE)

**What:** Single route at `/api/resources`. GET fetches all resources ordered by `is_pinned DESC, created_at DESC`. POST creates. DELETE accepts `{ id: string }` in body and enforces ownership (coach can only delete their own; owner can delete any).

**Example:**
```typescript
// DELETE body schema
const deleteResourceSchema = z.object({
  id: z.string().uuid(),
});

// Ownership check pattern for coach delete
if (profile.role === "coach") {
  const { data: existing } = await admin
    .from("resources")
    .select("created_by")
    .eq("id", parsed.data.id)
    .single();
  if (!existing || existing.created_by !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
```

### Pattern 4: API Route — glossary (GET/POST + [id] PUT/DELETE)

**What:** `/api/glossary` for GET (all terms, `ORDER BY lower(term) ASC`) and POST. `/api/glossary/[id]` for PUT (edit term/definition) and DELETE. Both share same auth + role check. Surface 23505 Postgres unique violation as a user-facing duplicate error.

**Example:**
```typescript
// Handling RES-09 duplicate term error
const { error: insertError } = await admin.from("glossary_terms").insert({ ... });
if (insertError) {
  if (insertError.code === "23505") {
    return NextResponse.json({ error: "A term with this name already exists" }, { status: 409 });
  }
  return NextResponse.json({ error: insertError.message }, { status: 500 });
}
```

### Pattern 5: CSP Header in next.config.ts

**What:** Next.js `headers()` async function adds `Content-Security-Policy` header. Must be added BEFORE the DiscordEmbed component is written (project pitfall from STATE.md).

**Example:**
```typescript
// next.config.ts — MUST be done in Wave 0 before DiscordEmbed component
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' https://e.widgetbot.io",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Pattern 6: Discord WidgetBot iframe (D-06, D-10 v1.4)

**What:** Render a bare `<iframe>` using `NEXT_PUBLIC_DISCORD_GUILD_ID` and `NEXT_PUBLIC_DISCORD_CHANNEL_ID`. When either env var is absent, render the "Coming Soon" card (Card variant="warm" with icon + title + description), identical to the Ask Abu Lahya pattern in `src/app/(dashboard)/student/ask/page.tsx`.

**Example:**
```typescript
// src/components/resources/DiscordEmbed.tsx
"use client";

const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID;
const channelId = process.env.NEXT_PUBLIC_DISCORD_CHANNEL_ID;

if (!guildId || !channelId) {
  // Render Coming Soon card — see ask/page.tsx for exact markup
  return <DiscordNotConfiguredCard />;
}

return (
  <iframe
    src={`https://e.widgetbot.io/channels/${guildId}/${channelId}`}
    title="Discord Community"
    height="600"
    width="100%"
    className="rounded-xl border border-ima-border"
    aria-label="Discord community chat"
  />
);
```

### Pattern 7: Glossary Alphabetical Grouping (D-07, D-09)

**What:** Client-side group-by-first-letter on the filtered list. Renders a sticky letter header followed by term rows.

**Example:**
```typescript
// Group after client-side filter
const filtered = terms.filter(t =>
  t.term.toLowerCase().includes(search.toLowerCase())
);

const grouped = filtered.reduce<Record<string, GlossaryTerm[]>>((acc, term) => {
  const letter = term.term[0].toUpperCase();
  if (!acc[letter]) acc[letter] = [];
  acc[letter].push(term);
  return acc;
}, {});

const sortedLetters = Object.keys(grouped).sort();
```

### Pattern 8: Proxy Guard for student_diy/resources (RES-02)

**What:** `ROLE_ROUTE_ACCESS` in `proxy.ts` already limits `student_diy` to `["/student_diy"]`. Direct access to `/student_diy/resources` is automatically blocked because `isAllowed` returns false. No additional proxy code needed — the route simply doesn't exist as a page file.

**Verification:** The proxy's `ROLE_ROUTE_ACCESS` check at line 100 uses `path.startsWith(prefix)`. Since student_diy has only `["/student_diy"]` and the page `/student_diy/resources` would never be created, any navigation attempt redirects to `/student_diy`. No proxy modification needed beyond confirming no page file is created.

### Pattern 9: Pin Column Migration (SCHEMA GAP)

**What:** The `resources` table in migration 00015 has NO `is_pinned` column. CONTEXT.md D-02 requires pinned resources. A new migration must add this column before any page implementation.

**Migration content:**
```sql
-- supabase/migrations/00018_resources_pin.sql
ALTER TABLE public.resources
  ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;
```

### Anti-Patterns to Avoid

- **Tab switching via URL segments:** Using `useRouter` or URL params for tabs causes Discord iframe to remount on every switch. Use `useState` only (D-10).
- **CSP after iframe:** Writing the DiscordEmbed component before adding the `frame-src` CSP header causes a browser block that only appears in production. Add CSP first.
- **resources UPDATE policies:** The `resources` RLS has no UPDATE policy (add/delete only per RES-04). Do not write an edit endpoint for resources — only glossary_terms supports PUT.
- **Hardcoded colors:** Never use hex or Tailwind gray-* — all colors must use ima-* tokens per CLAUDE.md.
- **Rate limit on GET /api/resources and GET /api/glossary:** These are read endpoints; skip `checkRateLimit()` (same as `/api/messages` GET and `/api/calendar`).
- **Swallowing errors:** Every catch block must `console.error` or toast per CLAUDE.md hard rules.
- **Direct import of `"zod/v4"`:** Always `import { z } from "zod"` per CLAUDE.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal with focus trap + Escape | Custom dialog | `Modal` component (`src/components/ui/Modal.tsx`) | Already handles focus trap, Escape key, portal, inert background |
| Form inputs with ARIA | Custom input HTML | `Input` + `Textarea` components | Already include `aria-invalid`, `aria-describedby`, `htmlFor+id` pairing |
| Empty state layout | Custom centered div | `EmptyState` component (default + compact variants) | Standard layout with role="status" |
| Icon buttons with 44px targets | Custom button | `Button` variant="ghost" size="icon" (h-11 w-11) | Already enforces 44px touch target |
| Card layout | Custom div | `Card` + `CardHeader` + `CardContent` | CVA variants, consistent border/shadow |
| Toast notifications | Custom toast | `useToast` from `src/components/ui/Toast.tsx` | Project standard, stable ref pattern |
| Spinner during loads | Custom loader | `Spinner` component | Project standard |

**Key insight:** The entire UI primitive layer exists. Phase 36 only assembles these components — it does not build any new primitives.

---

## Runtime State Inventory

> This is a greenfield feature phase (new pages, new API routes). No rename/refactor involved.

**Nothing to inventory** — Phase 36 adds new routes and tables but does not rename, migrate, or restructure existing runtime state.

---

## Common Pitfalls

### Pitfall 1: CSP Missing Before iframe Renders
**What goes wrong:** DiscordEmbed iframe is blocked by browser with "Refused to display in a frame" error in production (Vercel enforces stricter CSP).
**Why it happens:** Next.js has no default `frame-src` CSP. Without explicit permission, `https://e.widgetbot.io` is blocked.
**How to avoid:** Add `frame-src 'self' https://e.widgetbot.io` to `next.config.ts` in Wave 0, before any DiscordEmbed component is written. This is a locked pitfall from STATE.md.
**Warning signs:** Community tab appears white/empty in production; console shows CSP violation.

### Pitfall 2: is_pinned Column Missing
**What goes wrong:** ResourceLinkCard tries to read `resource.is_pinned` but the column doesn't exist in the DB. TypeScript types don't match. API `ORDER BY is_pinned DESC` fails.
**Why it happens:** Migration 00015 does not include `is_pinned`. CONTEXT.md decision D-02 requires it but it was deferred from the schema phase.
**How to avoid:** Wave 0 must include migration `00018_resources_pin.sql` adding `is_pinned boolean NOT NULL DEFAULT false`. TypeScript types must be updated in `src/lib/types.ts` to add `is_pinned: boolean` to `resources.Row` and `resources.Insert/Update`.
**Warning signs:** `column resources.is_pinned does not exist` Supabase error at runtime.

### Pitfall 3: Duplicate Term 23505 Swallowed
**What goes wrong:** Owner/coach tries to add a term that already exists (different case). API returns 500 instead of a user-facing error. User sees "Internal server error" with no guidance.
**Why it happens:** `insertError.code === "23505"` must be checked explicitly before the generic error handler.
**How to avoid:** In `/api/glossary` POST and PUT handlers, check `if (insertError?.code === "23505")` and return `{ error: "A term with this name already exists" }` with status 409.
**Warning signs:** Adding "CPM" when "cpm" exists triggers a 500.

### Pitfall 4: Student_DIY Page File Accidentally Created
**What goes wrong:** If `src/app/(dashboard)/student_diy/resources/page.tsx` is created, student_diy can access it because the proxy only blocks non-student_diy paths, not student_diy-owned paths.
**Why it happens:** Misreading the proxy logic — the proxy blocks cross-role access, not access to routes within your own role prefix.
**How to avoid:** Never create a `/student_diy/resources` page file. The proxy guard for student_diy works by limiting access to `["/student_diy"]` prefix paths only — since the page doesn't exist, any access attempt results in a 404 or redirect.

### Pitfall 5: Tab Switch Causes iframe Reload
**What goes wrong:** Switching from Community tab to Links/Glossary and back causes Discord iframe to reset its scroll state and connection.
**Why it happens:** If the tab switch conditionally unmounts the iframe (e.g., `{activeTab === "community" && <DiscordEmbed />}`), React unmounts/remounts it.
**How to avoid:** Use CSS visibility or display none/block to hide tabs without unmounting:
```typescript
<div className={activeTab === "community" ? "block" : "hidden"}>
  <DiscordEmbed />
</div>
```
This keeps the iframe mounted at all times while only showing the active tab's content.

### Pitfall 6: Coach Delete of Other Coach's Resources
**What goes wrong:** Coach A deletes a resource created by Coach B.
**Why it happens:** DELETE endpoint only checks role="coach", not `created_by = profile.id`.
**How to avoid:** For coach role, fetch the resource first and verify `created_by === profile.id` before deleting. Owner can delete any resource. This mirrors the RLS policy in migration 00015.

### Pitfall 7: Navigation Item Missing ROUTES.ts Entry
**What goes wrong:** Build passes but nav items are hardcoded strings. Config-is-truth rule violated.
**Why it happens:** Forgetting to add resource routes to `ROUTES` object in `config.ts` while adding `NAVIGATION` entries.
**How to avoid:** Add `/owner/resources`, `/coach/resources`, `/student/resources` to `ROUTES` in `config.ts` before adding `NAVIGATION` entries. NAVIGATION entries must reference `ROUTES.owner.resources` etc., not inline strings.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Navigation Entry (config.ts pattern)
```typescript
// Add to ROUTES.owner, ROUTES.coach, ROUTES.student
resources: "/owner/resources",   // /coach/resources, /student/resources

// Add to NAVIGATION.owner, NAVIGATION.coach, NAVIGATION.student
// (after existing Alerts / Chat entries — use separator if appropriate)
{ label: "Resources", href: ROUTES.owner.resources, icon: "BookOpen" },
```

### API Route Auth Template (from existing /api/messages pattern)
```typescript
// GET /api/resources — no CSRF, no rate limit (read endpoint)
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users").select("id, role").eq("auth_id", authUser.id).single();
    if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    if (!["owner", "coach", "student"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin
      .from("resources")
      .select("*, created_by_user:users!resources_created_by_fkey(name)")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/resources]", error);
      return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
    }
    return NextResponse.json({ resources: data ?? [] });
  } catch (err) {
    console.error("[GET /api/resources] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Zod Schema Examples
```typescript
// Resources POST
const addResourceSchema = z.object({
  title: z.string().min(1).max(255),
  url: z.string().url().max(2048),
  comment: z.string().max(1000).optional(),
});

// Resources DELETE
const deleteResourceSchema = z.object({
  id: z.string().uuid(),
});

// Glossary POST
const addGlossarySchema = z.object({
  term: z.string().min(1).max(255),
  definition: z.string().min(1),
});

// Glossary PUT
const updateGlossarySchema = z.object({
  term: z.string().min(1).max(255).optional(),
  definition: z.string().min(1).optional(),
});
```

### Confirm Delete Pattern (using Modal)
```typescript
// No native confirm() — use Modal as confirm dialog per existing pattern
const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

// Delete icon button triggers modal
<Button
  variant="ghost"
  size="icon"
  onClick={() => setDeleteTarget(resource.id)}
  aria-label={`Delete ${resource.title}`}
  className="text-ima-error hover:text-ima-error"
>
  <Trash2 className="h-4 w-4" aria-hidden="true" />
</Button>

// Confirm modal
<Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Resource">
  <p className="text-sm text-ima-text-secondary">
    Are you sure you want to delete this resource? This cannot be undone.
  </p>
  <div className="flex gap-3 mt-4 justify-end">
    <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
    <Button variant="danger" loading={isDeleting} onClick={handleConfirmDelete}>Delete</Button>
  </div>
</Modal>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `window.confirm()` for delete | `Modal` as confirm dialog | Phase 34 (established) | Accessible, themed, consistent |
| `middleware.ts` route guard | `proxy.ts` route guard | Next.js 16 | CLAUDE.md: use proxy.ts, not middleware.ts |
| Hardcode nav hrefs | `ROUTES` const in config.ts | v1.0 foundation | Config-is-truth rule |
| Inline Tailwind colors | ima-* tokens | v1.0 foundation | CLAUDE.md hard rule |

---

## Open Questions

1. **ROUTES.ts entries for resources**
   - What we know: `ROUTES` in `config.ts` has per-role sub-objects for owner, coach, student, student_diy
   - What's unclear: Whether to add `resources` key to each role's ROUTES sub-object, or just add nav items with inline strings
   - Recommendation: Add `resources` to each role's ROUTES entries — config-is-truth rule requires it

2. **Pin/unpin toggle UI**
   - What we know: D-02 requires pinned resources to float to top; no `is_pinned` column exists yet
   - What's unclear: Should owner/coach see a pin toggle (interactive) or is pinning only done at creation time?
   - Recommendation: Add a pin icon button (toggle) on each resource card visible to owner/coach only; students see the pin icon as read-only indicator. This requires a PATCH endpoint on `/api/resources/[id]` for toggling — or include `is_pinned` in the POST body so items are pinned at creation. Simpler path: include `is_pinned` checkbox in the "Add Resource" modal; no PATCH endpoint needed for Wave 1.

3. **resources JOIN for poster name**
   - What we know: Resource link cards show "posted by (coach/owner name)" per D-01
   - What's unclear: The `resources` table has `created_by uuid` (FK to users). The GET query needs a join.
   - Recommendation: Use `select("*, created_by_user:users!resources_created_by_fkey(name)")` in the admin query — same foreign-key alias pattern used by messages.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | (project running) | — |
| Next.js | Page files, headers() | ✓ | 16.1.6 | — |
| Supabase (DB) | resources, glossary_terms tables | ✓ | migration 00015 deployed | — |
| `NEXT_PUBLIC_DISCORD_GUILD_ID` | DiscordEmbed iframe | ✗ (pending) | — | "Discord not configured" placeholder (Card warm pattern) |
| `NEXT_PUBLIC_DISCORD_CHANNEL_ID` | DiscordEmbed iframe | ✗ (pending) | — | Same placeholder |

**Missing dependencies with no fallback:** None blocking code implementation.

**Missing dependencies with fallback:**
- Discord env vars: Abu Lahya must supply before production launch. Code uses placeholder pattern from `ask/page.tsx`.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no jest, vitest, playwright, or test scripts in package.json |
| Config file | None |
| Quick run command | `npm run lint && npx tsc --noEmit` (lint + type check as proxy for unit tests) |
| Full suite command | `npm run build` (production build catches type errors + build errors) |

**Note:** This project has no automated test framework. Validation is performed via TypeScript strict mode, ESLint, and manual UAT per the `35-VERIFICATION.md` pattern.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RES-01 | Resources appears in owner/coach/student sidebar nav | manual-only | `npm run lint` (no runtime test) | ✗ Wave 0 N/A |
| RES-02 | Student_DIY sidebar has no Resources link; /student_diy/resources redirects | manual-only | — (proxy behavior, not unit testable) | N/A |
| RES-03 | Three tabs render; switching tabs does not navigate away | manual-only | `npx tsc --noEmit` (type check) | N/A |
| RES-04 | Owner/coach can add and delete resource links | manual-only | `npm run build` | N/A |
| RES-05 | Student sees links read-only; links open in new tab | manual-only | `npm run lint` | N/A |
| RES-06 | Community tab renders iframe; CSP header present | manual-only | `npm run build` (header in build output) | N/A |
| RES-07 | Owner/coach can add, edit, delete glossary terms | manual-only | `npm run build` | N/A |
| RES-08 | Search filters glossary terms case-insensitively | manual-only | `npx tsc --noEmit` | N/A |
| RES-09 | Duplicate term shows user-facing error | manual-only | — (DB constraint, integration test needed) | N/A |

### Sampling Rate

- **Per task commit:** `npm run lint && npx tsc --noEmit`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green + manual UAT checklist before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No automated test framework — all validation is manual UAT + type checking
- [ ] Migration `supabase/migrations/00018_resources_pin.sql` — adds `is_pinned` column (blocks all resource implementation)
- [ ] TypeScript types update — add `is_pinned: boolean` to `resources.Row/Insert/Update` in `src/lib/types.ts`
- [ ] CSP header in `next.config.ts` — must precede DiscordEmbed component creation

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 36 |
|-----------|-------------------|
| Config is truth — import from `src/lib/config.ts` | Add Resources to `ROUTES` AND `NAVIGATION` in config.ts; never hardcode hrefs |
| Admin client only in server code | All API routes use `createAdminClient()`; ResourcesClient is "use client" and must NOT import admin client |
| `src/proxy.ts` NOT `middleware.ts` | No changes to proxy needed (student_diy blocked by absent page file); verify proxy behavior in UAT |
| Google OAuth only | No auth changes needed |
| Light theme with blue accents — all UI uses ima-* tokens | All colors: ima-text, ima-border, ima-primary, ima-surface, ima-error, etc. Never hardcoded hex |
| `motion-safe:` on every animate-* class | Any loading animations or transitions must use `motion-safe:` prefix |
| 44px touch targets on every interactive element | Delete buttons: `min-h-[44px] min-w-[44px]`; tab buttons: `min-h-[44px]`; all Button sizes already comply |
| Accessible labels on every input | Modal form inputs use `Input` component (auto `htmlFor+id`); search box needs `aria-label="Search glossary terms"` |
| Admin client in API routes — every `.from()` uses admin client | All API queries use `createAdminClient()` result |
| Never swallow errors — every catch must toast or console.error | All catch blocks: `console.error("[route]", err)` |
| Check `response.ok` before parsing JSON | All `fetch()` calls in ResourcesClient: `if (!res.ok) { const json = await res.json().catch(...) }` |
| `import { z } from "zod"` — never `"zod/v4"` | All API route schemas use `from "zod"` |
| ima-* tokens only — never hardcoded hex/gray | No `gray-*`, no `#hex` in any new component |
| px-4 on all page wrappers for mobile | Each resources page: `<div className="px-4 space-y-5">` |
| Stable useCallback deps — use refs for toast/router | ResourcesClient: `const toastRef = useRef(toast); toastRef.current = toast;` |
| Auth + role check before validation on every API route | API routes: auth check → profile fetch → role check → rate limit (mutations only) → body parse → Zod |
| Filter by user ID in queries, never rely on RLS alone | resources DELETE: verify `created_by === profile.id` for coach before deleting |
| Zod safeParse on all API inputs, try-catch on request.json() | All mutation handlers: `try { body = await request.json() } catch { ... }` then `schema.safeParse(body)` |

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00015_v1_4_schema.sql` — complete resources and glossary_terms schema with RLS policies
- `src/lib/types.ts` — TypeScript Row/Insert/Update types confirming resources has no `is_pinned` column
- `src/lib/config.ts` — NAVIGATION and ROUTES structure; student_diy nav has 3 items, no Resources
- `src/proxy.ts` — ROLE_ROUTE_ACCESS structure confirming proxy behavior for student_diy
- `src/components/ui/Modal.tsx`, `Card.tsx`, `Button.tsx`, `Input.tsx`, `Textarea.tsx`, `EmptyState.tsx` — confirmed component APIs
- `src/app/(dashboard)/student/ask/page.tsx` — canonical "Coming Soon" card pattern (Card variant="warm")
- `src/app/api/messages/route.ts` — canonical API route pattern (auth, admin client, role check, Zod, error handling)
- `package.json` — confirmed no test framework; confirmed zero new npm dependencies needed

### Secondary (MEDIUM confidence)
- Next.js headers() API for CSP configuration — verified pattern from Next.js docs: async `headers()` in `next.config.ts` returns array with `Content-Security-Policy` key/value
- WidgetBot iframe URL pattern `https://e.widgetbot.io/channels/{guildId}/{channelId}` — from STATE.md locked decision D-10 v1.4

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed from package.json
- Architecture: HIGH — all patterns verified from existing codebase
- Pitfalls: HIGH — schema gap confirmed by direct migration inspection; CSP pitfall from STATE.md
- Validation: HIGH — absence of test framework confirmed from package.json

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable — no fast-moving dependencies)
