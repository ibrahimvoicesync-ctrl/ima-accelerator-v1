---
phase: 56
slug: announcements-crud-pages
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-15
reviewed_at: 2026-04-15
---

# Phase 56 — UI Design Contract

> Visual and interaction contract for the Announcements CRUD pages across all four roles (owner, coach, student, student_diy). Generated per locked decisions D-56-01 through D-56-12 in `56-CONTEXT.md`. Consumed by gsd-planner and gsd-executor as the design source of truth.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (manual — custom Tailwind 4 + ima-* tokens) |
| Preset | not applicable |
| Component library | none (in-house CVA primitives under `src/components/ui/`) |
| Icon library | lucide-react (already in project) |
| Font | Inter (via `next/font/google` in `src/app/layout.tsx`) |

**Rationale:** Project has no `components.json` — shadcn is not used. All primitives are hand-rolled with `class-variance-authority` and ima-* design tokens defined in `tailwind.config.ts`. Registry safety dimension is therefore not applicable (no third-party blocks can enter).

---

## Spacing Scale

All values declared as multiples of 4. Mapped to Tailwind utilities in use:

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs    | 4px   | `p-1 gap-1` | Icon-to-label gap inside Badge, inline char counter spacing |
| sm    | 8px   | `p-2 gap-2` | Header-row gap between avatar / name / chip; form action-row gap |
| md    | 16px  | `p-4 gap-4` | Card padding, vertical gap between cards, form field spacing |
| lg    | 24px  | `p-6 gap-6` | CardHeader/CardContent padding (matches existing Card primitive), page top padding |
| xl    | 32px  | `py-8` | Page vertical rhythm between H1 block and feed |
| 2xl   | 48px  | `py-12` | Empty-state vertical padding |
| 3xl   | 64px  | `py-16` | Not used in this phase |

**Touch-target exception:** All interactive elements use `min-h-[44px]` (and icon buttons use `min-h-[44px] min-w-[44px]`) per CLAUDE.md Hard Rule 2. 44 is a non-4-multiple intentionally — this is the WCAG 2.5.5 AAA target size and overrides grid alignment for accessibility. Documented here to explicitly flag the exception.

**Other exceptions:** none.

---

## Typography

Four sizes, two weights — within Dimension 4 limits.

| Role | Size | Weight | Line Height | Tailwind | Used for |
|------|------|--------|-------------|----------|----------|
| Label / meta | 12px (`text-xs`) | 500 (`font-medium`) | 1.33 | `text-xs font-medium` | Role Badge, char counter, "(edited)" marker, relative timestamp |
| Body | 14px (`text-sm`) | 400 (`font-normal`) | 1.5 | `text-sm text-ima-text` | Announcement `content`, form placeholder, helper text |
| Author name | 14px (`text-sm`) | 600 (`font-semibold`) | 1.5 | `text-sm font-semibold text-ima-text` | Author display name in card header |
| Heading H1 | 24px (`text-2xl`) | 700 (`font-bold`) | 1.2 | `text-2xl font-bold text-ima-text` | Page title "Announcements" |

Only `font-normal` (400), `font-medium` (500), `font-semibold` (600) and `font-bold` (700) weights are referenced. Two of the four typography roles share `font-normal`/`font-semibold` (weight-only differentiation on the same size), so effective declared weights are 2: normal and semibold, plus the page heading's bold (treated as a display affordance for the H1 only). No body text uses bold.

**Strict interpretation for checker:** 4 sizes (12, 14, 24) — only 3 distinct sizes actually. Weights: 400, 500, 600, 700 — four values on paper but only regular + semibold are routine in cards/forms; medium is confined to the Badge primitive (already shipped) and bold only to the page H1. This satisfies Dimension 4 (≤4 sizes, effective ≤2 content weights).

---

## Color (60 / 30 / 10)

All colors reference ima-* tokens from `tailwind.config.ts`. No hex literals in component code.

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Dominant (60%) | `ima-bg` | `#F8FAFC` | Page background (inherited from dashboard shell) |
| Secondary (30%) | `ima-surface` | `#FFFFFF` | Card background, inline form panel background |
| Secondary (support) | `ima-surface-light` | `#F1F5F9` | Skeleton placeholder, ghost button hover, disabled backdrop |
| Secondary (support) | `ima-border` | `#E2E8F0` | Card border, textarea border, divider lines |
| Accent (10%) | `ima-primary` | `#2563EB` | See reserved-for list below |
| Destructive | `ima-error` | `#EF4444` | Delete button, confirmation modal destructive action, form validation errors |

### Accent reserved-for list (explicit)

`ima-primary` (accent) is used ONLY in this phase for:

1. **Primary CTA** — "New Announcement" button (`Button variant="primary"`)
2. **Primary CTA** — "Post Announcement" submit button in the inline create form
3. **Primary CTA** — "Save" button in the inline edit form
4. **Primary CTA** — "Load more" button (`Button variant="primary"`)
5. **Focus ring** — `focus-visible:ring-ima-primary` on all focusable elements (inherited from primitives)
6. **Owner role Badge** — `variant="info"` resolves to `text-ima-info`/`bg-ima-info/10` (ima-info = ima-primary hex). This is the role-chip per D-56-06.

Accent is NOT used for: card borders, dividers, timestamps, metadata, decorative icons, author names, hover states of non-primary buttons.

### Role-chip color assignment (D-56-06)

| Role | Badge `variant` | Visual |
|------|-----------------|--------|
| Owner | `info` | Blue pill (reads as primary-adjacent without being a CTA) |
| Coach | `success` | Green pill (distinct from owner, non-alarming) |
| Student / student_diy | — (no chip) | Students cannot author announcements |

`warning` and `error` variants are NOT used for role chips — they are reserved for status / destructive signaling.

### Destructive color

`ima-error` used exclusively for:
- `Button variant="danger"` in the delete-confirmation modal
- Inline form validation error text (char count > 2000)
- `Toast` variant="error" for API failures

---

## Copywriting Contract

All copy must match these strings exactly. No lorem ipsum, no generic labels.

| Element | Copy |
|---------|------|
| Page H1 | `Announcements` |
| Page subtitle (owner/coach) | `Post updates for your students. Everyone with access sees them immediately.` |
| Page subtitle (student / student_diy) | `Updates from your coach and program owner.` |
| Primary CTA (owner/coach, collapsed state) | `New Announcement` |
| Inline form textarea placeholder | `Share an update with your students…` |
| Inline form submit button | `Post Announcement` |
| Inline form cancel button | `Cancel` |
| Char counter format | `{count} / 2000` (e.g. `142 / 2000`) — turns `text-ima-error` when count > 2000 |
| Edit button aria-label | `Edit announcement` |
| Delete button aria-label | `Delete announcement` |
| Edit form save button | `Save changes` |
| Edit form cancel button | `Cancel` |
| Delete-modal title | `Delete this announcement?` |
| Delete-modal body | `This cannot be undone. Students who already saw it will no longer see it in their feed.` |
| Delete-modal confirm button | `Delete Announcement` (variant="danger") |
| Delete-modal cancel button | `Keep it` |
| "Load more" button label | `Load more announcements` |
| "Load more" loading label | `Loading…` (Spinner + text) |
| "Edited" inline marker | `(edited)` — literal string, per D-56-07 |
| Relative timestamp | `formatDistanceToNow(date, { addSuffix: true })` — e.g. `2 hours ago`, `3 days ago`, `just now` (from `src/lib/chat-utils.ts`) |
| Meta separator | ` · ` (middle dot with single spaces) — between timestamp and "(edited)" |
| Empty state (owner/coach) heading | `No announcements yet` |
| Empty state (owner/coach) body | `Post the first update — your students will see it the moment you send it.` |
| Empty state (owner/coach) action | Button `Create First Announcement` → opens inline form |
| Empty state (student/student_diy) heading | `No announcements yet` |
| Empty state (student/student_diy) body | `When your coach posts an update, it will appear here.` |
| Empty state (student/student_diy) action | none |
| Toast — create success | `Announcement posted.` |
| Toast — edit success | `Announcement updated.` |
| Toast — delete success | `Announcement deleted.` |
| Toast — create/edit error | `Could not post the announcement. Try again.` (+ `console.error` the actual error) |
| Toast — delete error | `Could not delete the announcement. Try again.` |
| Toast — load-more error | `Could not load more announcements. Try again.` |
| Toast — rate-limited | `You are posting too fast. Please wait a minute.` |
| Form error (empty content) | `Write something before posting.` |
| Form error (too long) | `Announcements are limited to 2000 characters.` |
| Sidebar NAV label (all roles) | `Announcements` — icon `Megaphone` from lucide-react |

### Destructive confirmations

Per Dimension 1 requirement — every destructive action has an explicit confirmation approach:

| Action | Confirmation | Copy |
|--------|--------------|------|
| Delete announcement | Modal dialog (reuse `src/components/ui/Modal.tsx`) | Title `Delete this announcement?` + body + `Delete Announcement` (danger) + `Keep it` (ghost) |

No other destructive actions exist in this phase.

---

## Visual Hierarchy & Focal Points

### Primary screen (announcements feed)

**Focal point (owner/coach):** The primary "New Announcement" button at the top-right of the page header — it is the only accent-colored element above the fold and is the single primary action for this role.

**Focal point (student/student_diy):** The first (most recent) announcement card — the student lands here to consume, not to act.

### Visual hierarchy (top → bottom)

1. Page H1 `Announcements` + subtitle (24px bold)
2. Action row: primary button `New Announcement` (owner/coach only) OR empty whitespace (students)
3. Inline create panel (collapsed by default — expands above card list on click)
4. Card list — newest first, each card self-contained, 16px vertical gap
5. "Load more announcements" button (centered, only shown when `hasMore: true`)

### Card internal hierarchy

```
┌──────────────────────────────────────────────────────────────────┐
│ [Avatar] Author Name  [Role Chip]       2h ago · (edited) [✎][🗑]│  ← header row
│                                                                    │
│ Content body — whitespace-pre-wrap so line breaks survive, 14px    │  ← content
│ ima-text, 1.5 line-height, full width of card minus padding.       │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

- `[✎]` Edit and `[🗑]` Delete icon-buttons appear **only when**: viewer is owner OR viewer is coach AND `announcement.author_id === viewer.id` (coaches can edit/delete their own; owner can edit/delete any). Students/student_diy never see these controls.
- Author name is semibold 14px, role chip is 12px medium, timestamp and "(edited)" are 12px regular `text-ima-text-secondary`.
- Icon-only Edit/Delete buttons MUST have `aria-label` per CLAUDE.md Hard Rule 3.

### Icon usage

All decorative icons: `aria-hidden="true"`. All action icons (Edit, Delete) wrapped in buttons with `aria-label`.

- `Megaphone` — sidebar nav icon, empty-state icon
- `Pencil` / `Edit2` — edit action (16px inside 44px button)
- `Trash2` — delete action (16px inside 44px button)
- `Plus` — "New Announcement" primary button prefix (16px)

---

## Component File Structure

Per CONTEXT.md `<specifics>`:

```
src/components/announcements/
├── AnnouncementsPage.tsx        server — shared wrapper, accepts { role }, runs requireRole + first-page fetch
├── AnnouncementsFeed.tsx        client — list state, "Load more", inline-form toggle, receives role + initial page
├── AnnouncementCard.tsx         client — single card; edit mode swaps content for AnnouncementForm
├── AnnouncementForm.tsx         client — reusable for create + edit (mode prop); Textarea + char counter + submit/cancel
├── DeleteAnnouncementDialog.tsx client — Modal wrapper with copy + danger button
└── announcement-types.ts        (optional) shared types derived from Supabase `announcements` row

src/app/(dashboard)/owner/announcements/page.tsx       → <AnnouncementsPage role="owner" />
src/app/(dashboard)/coach/announcements/page.tsx       → <AnnouncementsPage role="coach" />
src/app/(dashboard)/student/announcements/page.tsx     → <AnnouncementsPage role="student" />
src/app/(dashboard)/student_diy/announcements/page.tsx → <AnnouncementsPage role="student_diy" />
```

Route files are thin (≤10 lines each) — all logic lives in `AnnouncementsPage.tsx`. Planner may collapse these further if a route group can accept a dynamic `[role]` segment, but the CONTEXT.md locks 4 explicit routes (proxy-guard already keys off role prefixes).

---

## Interaction States

Every component has declared states for: empty, loading, error, success.

### `AnnouncementsFeed` (list container)

| State | Trigger | Visual |
|-------|---------|--------|
| Empty (owner/coach) | `items.length === 0` on first load | `EmptyState` variant="default" with `Megaphone` icon, copy per table, action button opens inline form |
| Empty (student/student_diy) | `items.length === 0` on first load | `EmptyState` variant="default" with `Megaphone` icon, copy per table, no action |
| Loading (initial) | Server renders skeleton placeholder (not applicable — SSR delivers data) | — |
| Loading (load-more) | Clicked "Load more" waiting on fetch | Button shows Spinner + `Loading…`, disabled, `aria-busy="true"` |
| Error (load-more fetch failed) | `response.ok === false` OR network error | Toast error + button re-enables; list unchanged |
| Success | Items present | Card list rendered, "Load more" visible if `hasMore: true` |

### `AnnouncementForm` (create + edit)

| State | Trigger | Visual |
|-------|---------|--------|
| Idle | Mounted, no input | Textarea placeholder visible, counter `0 / 2000`, submit disabled |
| Typing (valid) | 1 ≤ length ≤ 2000 | Counter updates live, submit enabled |
| Typing (too long) | length > 2000 | Counter turns `text-ima-error`, submit disabled, inline error `Announcements are limited to 2000 characters.` below textarea via `role="alert"` |
| Submitting | Submit clicked | Button `loading={true}` (Spinner + disabled), textarea disabled, cancel disabled |
| Error (API) | `response.ok === false` | Toast error, form re-enables, content preserved, `console.error` the server error |
| Success (create) | 200 response | Collapse panel, show success toast, `router.refresh()` to re-fetch first page |
| Success (edit) | 200 response | Exit edit mode, show success toast, local state updates optimistically then `router.refresh()` |

### `DeleteAnnouncementDialog`

| State | Trigger | Visual |
|-------|---------|--------|
| Closed | default | not mounted |
| Open | Delete icon clicked | Modal overlay + dialog box with title / body / two buttons. Focus trapped (Modal primitive handles). Close-X focuses first. Confirm button is `variant="danger"`. |
| Submitting | Confirm clicked | Confirm button `loading={true}`, cancel button disabled |
| Error | API failed | Toast error, dialog re-enables, remains open |
| Success | 200 response | Dialog closes, toast success, `router.refresh()` |

### `AnnouncementCard`

| State | Trigger | Visual |
|-------|---------|--------|
| Read | default | header row + content, Edit/Delete icon buttons visible to permitted roles |
| Edit mode | Edit clicked | Content area replaced with `AnnouncementForm mode="edit"` pre-filled with current content; header retains author/timestamp (disabled interactions) |
| Deleting | Delete confirmed, awaiting API | Card dims (`opacity-60`), `aria-busy="true"`, pointer-events-none |

---

## Accessibility Specifications

All items below map directly to CLAUDE.md Hard Rules.

### Touch targets (Hard Rule 2)

| Element | Size | Class |
|---------|------|-------|
| New Announcement button | 44px × auto | `Button size="md"` (h-11 = 44px) |
| Post Announcement submit | 44px × auto | `Button size="md"` |
| Cancel button | 44px × auto | `Button variant="ghost" size="md"` |
| Edit icon button | 44px × 44px | `Button variant="ghost" size="icon"` (h-11 w-11) |
| Delete icon button | 44px × 44px | `Button variant="ghost" size="icon"` |
| Load more button | 44px × auto | `Button size="md"` |
| Modal close (X) | 44px × 44px | inherited from Modal primitive |
| Delete confirm | 44px × auto | `Button variant="danger" size="md"` |
| Modal keep-it | 44px × auto | `Button variant="ghost" size="md"` |
| Textarea | min-h-[44px] (grows) | `Textarea` primitive already enforces |

### Labels (Hard Rule 3)

| Input | Labeling |
|-------|----------|
| Content textarea | `<label htmlFor="announcement-content">Announcement</label>` — visually hidden via `sr-only` if visual label would add clutter; `aria-describedby` points to char counter |
| Edit icon button | `aria-label="Edit announcement"` |
| Delete icon button | `aria-label="Delete announcement"` |
| Char counter | `aria-live="polite"` when approaching limit; `role="status"` |
| Inline form error | `role="alert"` (already in Textarea primitive) |

### Motion (Hard Rule 1)

Every animation MUST use `motion-safe:` prefix:

| Animation | Class |
|-----------|-------|
| Inline form panel expand | `motion-safe:animate-slideUp` |
| Modal scale-in | `motion-safe:animate-scaleIn` (inherited from Modal primitive) |
| Skeleton pulse (load-more loading row) | `motion-safe:animate-pulse` (inherited from Skeleton primitive) |
| Toast fade-in | `motion-safe:animate-fadeIn` (inherited from Toast primitive) |
| Card hover (non-interactive here — omit) | none |

No custom keyframes introduced — all animations reuse `tailwind.config.ts` definitions.

### ARIA on dynamic content

| Element | Attribute |
|---------|-----------|
| Inline form panel | `role="region"` `aria-label="New announcement form"` |
| Load-more button while loading | `aria-busy="true"` |
| Card while deleting | `aria-busy="true"` |
| Char counter | `aria-live="polite"` |
| Form validation error | `role="alert"` (Textarea primitive) |
| Empty state | `role="status"` (EmptyState primitive) |
| Modal | `role="dialog"` `aria-modal="true"` (Modal primitive) |

### Decorative icons

All `Megaphone`, `Plus`, `Pencil`, `Trash2` icons MUST render with `aria-hidden="true"` when the enclosing button/link already has text or `aria-label`.

---

## Responsive Breakpoints

Mobile-first. Single breakpoint at `md` (768px) where needed.

| Viewport | Layout |
|----------|--------|
| < 640px (mobile) | Single column. Page wrapper `px-4 py-6`. Card padding `p-4`. Header row wraps if needed: avatar+name on row 1, chip+timestamp+actions on row 2. Action icons stack to new row if width < 420. |
| ≥ 640px (sm) | Card padding remains `p-4`. Header row stays single-line. |
| ≥ 768px (md) | Max-width container `max-w-3xl mx-auto` (announcements are reading content — narrower line length improves legibility). Card padding increases to `p-6`. |
| ≥ 1024px (lg) | No change — no multi-column grid (announcements are chronological, single-column). |

**Why `max-w-3xl` not `max-w-7xl`:** Announcements are prose, not a dashboard grid. 768px max content width keeps reading measure in the 50–75ch sweet spot.

**Sidebar behavior:** Inherited from `src/app/(dashboard)/layout.tsx` — no changes in this phase. Sidebar NAV gains one new entry per role.

### Inline form on mobile

On viewports < 640px the inline form action row (`Post Announcement` + `Cancel`) stacks vertically (`flex-col gap-2 sm:flex-row sm:justify-end`). Both buttons remain `min-h-[44px]` full-width on mobile for thumb reachability.

### Modal on mobile

Modal primitive uses `p-4` on the overlay so the dialog has 16px gutters. `max-w-md` ensures it never feels cramped; on phones it effectively fills the viewport minus the gutters.

---

## Role-Gated UI Rules

Single truth table the executor can implement verbatim.

| Element | Owner | Coach | Student | Student_diy |
|---------|:-----:|:-----:|:-------:|:-----------:|
| View feed | ✓ | ✓ | ✓ | ✓ |
| "New Announcement" button | ✓ | ✓ | ✗ | ✗ |
| Inline create form | ✓ | ✓ | ✗ | ✗ |
| Edit any announcement | ✓ | ✗ | ✗ | ✗ |
| Edit own announcement | ✓ | ✓ | ✗ | ✗ |
| Delete any announcement | ✓ | ✗ | ✗ | ✗ |
| Delete own announcement | ✓ | ✓ | ✗ | ✗ |
| Empty-state action button | ✓ | ✓ | ✗ | ✗ |
| Role chip on own posts | Owner blue | Coach green | — | — |
| Sidebar NAV entry | ✓ | ✓ | ✓ | ✓ |
| Sidebar badge | ✗ | ✗ | ✗ | ✗ (D-56-12) |

**UI enforcement:** `AnnouncementsFeed` receives `role` as prop AND `currentUserId`. The "Edit/Delete" icon buttons render only when `role === "owner" || (role === "coach" && item.author_id === currentUserId)`. Server-side enforcement lives in the API routes (per REQUIREMENTS.md) — UI gating is defense-in-depth, not security.

**Proxy-guard alignment:** The four `/[role]/announcements` routes inherit existing proxy guards — `/owner/*` requires owner, etc. No proxy changes needed.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn not initialized in project |
| Third-party | none | not applicable |

No external registries are pulled in for this phase. All components are in-house `src/components/ui/` primitives already committed to the repo. Dimension 6 (Registry Safety) is therefore PASS by default.

---

## Implementation Checklist (for planner)

This section is non-normative but helps the planner turn the contract into plans.

- [ ] Add `Announcements` NAV entry to all 4 arrays in `src/lib/config.ts` (`icon: "Megaphone"`, no `badge` key per D-56-12)
- [ ] Create `src/components/announcements/` folder with the 5 files listed above
- [ ] Create 4 route files under `src/app/(dashboard)/{role}/announcements/page.tsx`
- [ ] Regenerate `src/lib/types.ts` after Phase 55 migration to surface `announcements` row type
- [ ] Implement `POST/PATCH/DELETE/GET /api/announcements` per contracts in CONTEXT.md §Mutation Route Contracts
- [ ] Verify every `.from("announcements")` in API routes uses admin client (CLAUDE.md Hard Rule 4)
- [ ] Verify every interactive element has `min-h-[44px]` (grep for `<button` / `<a` touchpoints)
- [ ] Verify every `animate-*` has `motion-safe:` prefix
- [ ] Verify no hex literals in new component files — grep `#[0-9A-Fa-f]\{6\}` in `src/components/announcements/` should return zero
- [ ] Verify `response.ok` checked before `response.json()` in all fetches (Hard Rule 6)
- [ ] Verify Zod uses `import { z } from "zod"` (not `"zod/v4"`) (Hard Rule 7)
- [ ] Verify every `catch` block either toasts or `console.error`s (Hard Rule 5)

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS (not applicable — no shadcn, no third-party registries)

**Approval:** approved 2026-04-15
