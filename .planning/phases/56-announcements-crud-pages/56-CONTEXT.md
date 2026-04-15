# Phase 56: Announcements CRUD & Pages - Context

**Gathered:** 2026-04-15
**Status:** Ready for UI-SPEC and planning
**Mode:** Interactive (batch table, all 12 recommendations accepted)

<domain>
## Phase Boundary

Role-scoped `/announcements` pages for all four roles (owner, coach, student, student_diy) with role-gated CRUD controls, backed by three mutation API routes (`POST/PATCH/DELETE /api/announcements`) and one paginated read route (`GET /api/announcements`). All four pages render the same server component with role-aware UI gating. Built on top of the `announcements` table created in Phase 55.

</domain>

<decisions>
## Implementation Decisions

### Scope Reconciliation
- **Roadmap SC#2 says "title + content"; REQUIREMENTS.md ANNOUNCE-01 says content only.** REQUIREMENTS.md is canonical — **no title field**. Form captures `content` only (textarea, max 2000 chars). This avoids amending Phase 55's migration and keeps the schema minimal.

### D-56-01: Form fields — **content only**
- Single `<Textarea>` bound to the `content` field. Character counter renders live (e.g., "142 / 2000"). Submit disabled when empty or > 2000.
- No title, no subject, no tags.

### D-56-02: Pagination — **Load more button**
- 25 announcements per server render; "Load more" button at the bottom triggers `GET /api/announcements?page=N` and appends results to the list without page reload.
- Fewer click targets satisfies 44px touch-target rule; mobile-friendly; simpler state than numbered pagination.

### D-56-03: Create/Edit surface — **Inline panel**
- New Announcement: button at top of list expands an inline panel containing the form. Collapses on successful submit or Cancel.
- Edit: clicking Edit on a card replaces its content area with an inline editor (same Textarea + Save/Cancel). Content re-renders on success.
- No modal overlay for create/edit. Keeps context; better mobile UX.

### D-56-04: Delete confirmation — **Modal dialog**
- Reuse existing `src/components/ui/Modal.tsx`. Prompt: "Delete this announcement?" + destructive Button styling.
- Native `confirm()` rejected: blocked on iOS in some contexts; violates token rules; not themable.

### D-56-05: List item layout — **Card per announcement**
- Reuse `src/components/ui/Card.tsx`.
- Header row: avatar + author name + role Badge + relative timestamp + "(edited)" indicator if applicable.
- For owner/coach: Edit and Delete icon buttons aligned right in the header.
- Content: `<p className="whitespace-pre-wrap">` so line breaks render.
- Min-height and spacing per ima-* conventions.

### D-56-06: Role chip — **Existing Badge primitive**
- Use `src/components/ui/Badge.tsx`. Variants:
  - Owner → `variant="primary"` (ima-primary)
  - Coach → pick a visually distinct ima-* variant (planner decides — `accent` or `success`, whichever contrasts without looking alarming)
- Students/student_diy cannot author; no chip variant needed for them.

### D-56-07: "(edited)" indicator — **`(edited)` literal next to timestamp**
- Computed server-side by comparing `updated_at > created_at` (with a small millisecond tolerance to avoid false positives from trigger clock skew — planner decides exact threshold, e.g., 2 seconds).
- Renders as: `2h ago · (edited)` in muted ima-text-secondary.

### D-56-08: Empty state — **Reuse EmptyState primitive**
- For owner/coach: "No announcements yet. Create the first one." with a button that opens the inline form.
- For student/student_diy: "No announcements yet." plain text, no action.

### D-56-09: Route structure — **Role-prefixed**
- `/owner/announcements`, `/coach/announcements`, `/student/announcements`, `/student_diy/announcements`.
- Matches existing proxy-guard model (proxy enforces `/owner` for owner, etc.); matches sidebar-nav pattern where each role has its own NAV list.
- All four pages render the same server component (`AnnouncementsPage({ role })`). Role-specific UI branching handled by a prop passed from the outer route file.
- NAVIGATION entries added in `src/lib/config.ts` for each role.

### D-56-10: Data flow — **Server-first, client pagination**
- Server component: `requireRole(role)` → admin-client query for first page → passes data to client `<AnnouncementsFeed>`.
- Client component: manages "Load more" state, optimistic mutations, inline form state.
- After mutation: call API → `router.refresh()` to re-fetch server state.

### D-56-11: `GET /api/announcements` route — **Yes**
- Route: `GET /api/announcements?page=N&pageSize=25`
- Auth-gated (any authenticated user)
- No role check beyond auth (RLS handles read access — students + student_diy can SELECT per D-55-02 RLS policies)
- No rate limit (read-only)
- Returns: `{ items: Announcement[], hasMore: boolean, total: number }`
- Uses admin client per CLAUDE.md hard rule 4.

### D-56-12: Sidebar unread badge — **None**
- Per REQUIREMENTS.md explicit simplification. Sidebar NAV entry for "Announcements" is a plain link (no badge field).
- Matches D-55-01 — no `unread_announcements` surface in `get_sidebar_badges`.

### Mutation Route Contracts (locked by SC#5 + ANNOUNCE-11)
- `POST /api/announcements` — auth + role in {owner, coach} + `verifyOrigin()` + `checkRateLimit({ limit: 30, window: "1m" })` + Zod validate `{ content: string().min(1).max(2000) }`
- `PATCH /api/announcements/[id]` — same gates + Zod validate `{ content: string().min(1).max(2000) }`
- `DELETE /api/announcements/[id]` — same gates, no body
- All return `{ announcement?: Announcement, error?: string }` with appropriate HTTP status.

### Claude's Discretion
- Exact file paths under `src/components/announcements/` (list, card, form, page wrapper — planner decides component boundary)
- Exact "(edited)" tolerance threshold (recommend 2000ms)
- Optimistic update pattern vs `router.refresh()` fallback
- Whether `AnnouncementsFeed` accepts `role` as prop or derives from context
- Per-role color for the coach Badge variant
- Loading skeletons between "Load more" clicks
- Error boundary / toast error copy
- Exact pagination cursor format (offset/page-number — recommend page-number since results aren't heavily mutable)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/Modal.tsx` — used for delete confirmation
- `src/components/ui/PaginationControls.tsx` — NOT used here (D-56-02 chose Load more), but confirms paginated UI patterns exist
- `src/components/ui/Badge.tsx` — role chip rendering
- `src/components/ui/Textarea.tsx` — form input
- `src/components/ui/Button.tsx` — all action buttons
- `src/components/ui/Card.tsx` — list item container
- `src/components/ui/EmptyState.tsx` — empty state
- `src/components/ui/Spinner.tsx` — loading state in "Load more"
- `src/components/ui/Toast.tsx` — success/error feedback
- `src/lib/csrf.ts` — `verifyOrigin()` helper
- `src/lib/rate-limit.ts` — `checkRateLimit()` helper
- `src/lib/session.ts` — `requireRole()` guard for route files
- `src/lib/supabase/admin.ts` — admin client for API routes

### Established Patterns
- Server component fetches → passes to client component pattern (see `/coach/analytics/page.tsx`)
- `requireRole(role)` at top of every dashboard route file
- `router.refresh()` after mutations for revalidation (see deals routes)
- Zod safeParse on all API inputs (CLAUDE.md hard rule)
- `try/catch` on `request.json()` (CLAUDE.md hard rule)
- Relative time formatting pattern exists somewhere in the codebase (check `utils.ts` / similar; planner verifies)
- NAVIGATION config is source of truth for sidebar rendering

### Integration Points
- `src/lib/config.ts` — add "Announcements" entry to all 4 NAV arrays (owner, coach, student, student_diy)
- `src/lib/types.ts` — regenerate after Phase 55 migration runs to get `announcements` table type
- `src/lib/rpc/types.ts` — no change (no RPC for announcements CRUD)
- `src/proxy.ts` — role guards already cover `/[role]/*` prefixes, so new routes inherit protection automatically
- `src/app/(dashboard)/layout.tsx` — NO change to badge mapping (D-56-12 no unread badge)

</code_context>

<specifics>
## Specific Ideas

- Pattern to follow for role-scoped server page: `src/app/(dashboard)/coach/analytics/page.tsx` (phase 48)
- Announcements list component filename proposal: `src/components/announcements/AnnouncementsFeed.tsx` (client)
- Inline form filename proposal: `src/components/announcements/AnnouncementForm.tsx` (client)
- Card filename proposal: `src/components/announcements/AnnouncementCard.tsx` (client)
- Server page wrapper (shared across all 4 routes): `src/components/announcements/AnnouncementsPage.tsx` (server, accepts `role` prop)
- Route files (thin): `src/app/(dashboard)/[role]/announcements/page.tsx` (4 files, each calls `<AnnouncementsPage role="..." />`)
- Relative timestamps: use same helper pattern as existing time rendering across the app (planner locates)

</specifics>

<deferred>
## Deferred Ideas

- Sidebar badge for unread announcements — deferred per REQUIREMENTS.md
- Rich-text editor / markdown — plain textarea only (REQUIREMENTS.md)
- Announcement pinning, reactions, read receipts, student replies, expiry — all v2+
- Email notifications for new announcements (Resend pipeline) — v2+
- Real-time push (Supabase Realtime) — explicitly excluded (500-conn cap issue)
- Title field — rejected per D-56-01 (would require Phase 55 amendment)

</deferred>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 56 section
- `.planning/REQUIREMENTS.md` — lines 33-45 (ANNOUNCE-01 through ANNOUNCE-12) — canonical spec
- `.planning/REQUIREMENTS.md` — lines 75-89 (explicit simplifications / out-of-scope)
- `.planning/phases/55-chat-removal-announcements-migration/55-CONTEXT.md` — upstream schema + RLS decisions
- `.planning/STATE.md` — §Critical Constraints for v1.6
- `src/lib/csrf.ts` — `verifyOrigin()`
- `src/lib/rate-limit.ts` — `checkRateLimit()`
- `src/lib/session.ts` — `requireRole()`
- `src/components/ui/Modal.tsx`, `Textarea.tsx`, `Badge.tsx`, `Card.tsx`, `EmptyState.tsx`, `Button.tsx`
- `src/app/(dashboard)/coach/analytics/page.tsx` — pattern for role-scoped server component
- `CLAUDE.md` — hard rules

</canonical_refs>
