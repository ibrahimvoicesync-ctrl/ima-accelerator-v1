# Phase 36: Resources Tab - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Unified Resources page with three tabs (Links, Community, Glossary) accessible to owner, coach, and student roles. Student_DIY is excluded entirely. Owners and coaches can manage links and glossary terms; students view in read-only mode. Community tab embeds Discord via WidgetBot iframe with a "not configured" fallback when env vars are absent.

</domain>

<decisions>
## Implementation Decisions

### Link Presentation
- **D-01:** One Card per resource link using existing Card component. Each card shows: title (bold), URL (truncated, clickable, opens in new tab via `target="_blank" rel="noopener noreferrer"`), comment text below if present, posted by (coach/owner name), and timestamp.
- **D-02:** Pinned resources appear at top of the list with a pin icon. Non-pinned resources follow in reverse-chronological order.

### Add/Delete UX
- **D-03:** Modal form for adding resources — "Add Resource" button top-right opens Modal with: title input, URL input, comment textarea (optional). Consistent with existing CRUD modal patterns in the app.
- **D-04:** Same modal pattern for glossary: term input + definition textarea.
- **D-05:** Delete via icon button on each card/term with a confirm dialog before removal.

### Discord Embed Sizing
- **D-06:** Fixed height 600px with rounded corners and ima-border. Not full viewport — the page has three tabs so the embed shares space with the tab bar above it. 600px is enough to see channels + messages without overwhelming the page.

### Glossary Layout
- **D-07:** Alphabetical definition list — simple and scannable. Each term as a bold heading with definition text below. No accordion, no cards — terms should be scannable without clicking.
- **D-08:** Search/filter input at the top that filters by term name as you type (case-insensitive client-side filter per RES-08).
- **D-09:** Group by first letter with letter headers (A, B, C...) when the list grows large.

### Tab Navigation
- **D-10:** React state controls active tab (Links | Community | Glossary) — not URL segments. Switching tabs does not navigate away or break the Discord iframe.

### Carried Forward (locked in prior phases)
- **D-10 (v1.4):** Discord WidgetBot iframe embed — no npm package
- **D-11 (v1.4):** Resources visible to owner, coach, student — NOT student_diy
- **D-12 (v1.4):** Glossary managed by owner + coaches (both roles can CRUD)
- **D-01 (Phase 30):** `resources` and `glossary_terms` tables exist in migration 00015 with RLS
- **D-04 (Phase 30):** RLS is defense-in-depth only; real enforcement is proxy + API role checks + admin client
- **Pitfall:** CSP header (`frame-src 'self' https://e.widgetbot.io`) must be added to next.config.ts BEFORE writing DiscordEmbed component

### Claude's Discretion
- Tab styling (pill buttons vs underline tabs — follow whatever pattern looks best with existing UI)
- Pin/unpin mechanism for resources (whether to add a boolean column or use a separate approach)
- Exact truncation length for URLs on link cards
- Empty state copy for each tab
- Loading skeleton layout for each tab
- Whether glossary edit uses same modal or inline editing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `supabase/migrations/00015_v1_4_schema.sql` -- Resources and glossary_terms table definitions (columns, constraints, indexes, RLS policies)
- `supabase/migrations/00001_create_tables.sql` -- `get_user_id()` and `get_user_role()` helpers used in RLS policies

### Requirements
- `.planning/REQUIREMENTS.md` -- RES-01 through RES-09 (all Resources Tab requirements)

### Existing UI Patterns
- `src/components/ui/Card.tsx` -- Card component with 4 variants (default, warm, accent, bordered-left)
- `src/components/ui/Modal.tsx` -- Modal component for CRUD forms (used in other flows)
- `src/components/ui/Input.tsx` -- Input component with label and error support
- `src/components/ui/Textarea.tsx` -- Textarea component for longer text input
- `src/components/ui/EmptyState.tsx` -- EmptyState component (default + compact variants)
- `src/components/ui/Button.tsx` -- Button component with 44px touch targets

### Coming Soon Pattern (Discord fallback)
- `src/app/(dashboard)/student/ask/page.tsx` -- Existing "Coming Soon" card pattern (Card variant="warm" with icon + title + description)

### Role Routing
- `src/lib/config.ts` -- NAV_ITEMS, ROLES, role-based sidebar configuration
- `src/proxy.ts` -- Route guard (must block /student_diy/resources)

### TypeScript Types
- `src/lib/types.ts` -- Row/Insert/Update types for resources and glossary_terms tables

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Card component** (`src/components/ui/Card.tsx`): 4 variants — use `default` for resource link cards
- **Modal component** (`src/components/ui/Modal.tsx`): Full CRUD modal with focus trap, escape handling, portal — use for add/edit forms
- **Input/Textarea** (`src/components/ui/Input.tsx`, `Textarea.tsx`): Form inputs with label, error, ARIA support
- **EmptyState** (`src/components/ui/EmptyState.tsx`): Default + compact variants for empty lists
- **Coming Soon pattern** (`src/app/(dashboard)/student/ask/page.tsx`): Card warm variant with icon + title + description — reuse for Discord not-configured state

### Established Patterns
- **Server components for reads**: Pages are async server components that fetch data; client components only for interactivity
- **API route pattern**: POST/DELETE routes with Zod validation, auth + role check, admin client queries
- **CRUD pattern**: Modal form with Zod schema, fetch to API route, router.refresh() on success, toast feedback
- **Tab state**: React useState for tab switching (see chat page for state-driven view pattern)

### Integration Points
- **Sidebar nav**: Add "Resources" to NAV_ITEMS in config.ts for owner, coach, student (not student_diy)
- **Proxy guard**: Add /student_diy/resources to blocked routes in proxy.ts
- **New routes needed**: /owner/resources, /coach/resources, /student/resources page files
- **New API routes**: /api/resources (GET/POST/DELETE), /api/glossary (GET/POST/PUT/DELETE)
- **next.config.ts**: CSP frame-src header for WidgetBot
- **Environment variables**: NEXT_PUBLIC_DISCORD_GUILD_ID, NEXT_PUBLIC_DISCORD_CHANNEL_ID

</code_context>

<specifics>
## Specific Ideas

- Resource link cards show poster name and timestamp — gives context on when/who added it
- Pinned resources float to top — important links (like course materials) stay visible
- Letter headers in glossary (A, B, C...) — visual structure for scanning when list is large
- 600px Discord embed height — balanced between usability and not dominating the page
- Confirm dialog on delete — prevent accidental removal of resources and glossary terms

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 36-resources-tab*
*Context gathered: 2026-04-04*
