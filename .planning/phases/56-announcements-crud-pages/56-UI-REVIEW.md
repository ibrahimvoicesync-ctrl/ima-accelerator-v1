# Phase 56 — UI Review

**Audited:** 2026-04-15
**Baseline:** `56-UI-SPEC.md` (approved 2026-04-15)
**Screenshots:** not captured — dev server on :3000 returns 307 (auth-gated redirects; OAuth-only, no anonymous session available to Playwright CLI). Audit is code-only: Tailwind-class audit, string audit, state-handling audit, role-gating audit against the spec.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every string in the UI-SPEC Copywriting Contract is reproduced verbatim in code |
| 2. Visuals | 3/4 | Clear focal point and header hierarchy; deleting-card dim state from spec not implemented |
| 3. Color | 3/4 | All ima-* tokens, zero hex literals, but avatar uses `bg-ima-primary` on every card — accent usage outside the spec's reserved-for list |
| 4. Typography | 4/4 | Three sizes (xs/sm/2xl) and three weights (medium/semibold/bold) — within spec limits |
| 5. Spacing | 4/4 | p-4/p-6/gap-4/py-6 match declared scale; 44px touch targets everywhere; `mb-3` is a valid 4-multiple used once |
| 6. Experience Design | 3/4 | Loading, error, empty, success all covered; card-level deleting state from spec missing; inline-panel animation swapped from `slideUp` to `fadeIn` without SPEC update |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Avatar circle uses `bg-ima-primary` (accent) on every card** (`src/components/announcements/AnnouncementCard.tsx:66`) — every announcement in the feed has a persistent accent-colored circle in its header, which competes with the "New Announcement" primary CTA for visual focus. UI-SPEC §Color explicitly restricts `ima-primary` to CTAs, focus rings, and the Owner role chip. **Fix:** change avatar background to `bg-ima-surface-light` with `text-ima-text` (neutral) OR derive from author role (blue for owner, green for coach) to match the already-shipped role chip and avoid adding a seventh accent surface.

2. **Inline create panel animates with `fadeIn`, not the spec's `slideUp`** (`src/components/announcements/AnnouncementsFeed.tsx:182`) — UI-SPEC §Motion declares `motion-safe:animate-slideUp` for the inline form panel expand; code uses `motion-safe:animate-fadeIn`. Summary claims "None in copy, layout, or interaction" deviations but this is one. **Fix:** change to `motion-safe:animate-slideUp` in `AnnouncementsFeed.tsx:182` (Tailwind config already exposes `slideUp` per UI-SPEC's "no custom keyframes introduced" note), OR amend UI-SPEC §Motion to document the `fadeIn` choice.

3. **Card "deleting" state not implemented** (`src/components/announcements/AnnouncementCard.tsx` + `DeleteAnnouncementDialog.tsx`) — UI-SPEC §Interaction States declares: "Deleting — Card dims (`opacity-60`), `aria-busy="true"`, pointer-events-none." Current code only shows the Modal submit spinner; the underlying card shows no visual feedback during the DELETE roundtrip. On a slow network the user could click Edit on a card that is already being deleted. **Fix:** lift `submitting` state from `DeleteAnnouncementDialog` into `AnnouncementCard` (or pass via a prop callback), and apply `className={deleting ? "opacity-60 pointer-events-none" : ""} aria-busy={deleting || undefined}` on the outer `<Card>` while the DELETE is in flight.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Verified verbatim against UI-SPEC §Copywriting Contract:

| Spec String | Location |
|-------------|----------|
| `Announcements` (H1) | `AnnouncementsPage.tsx:107` |
| Owner/coach subtitle | `AnnouncementsPage.tsx:111` |
| Student subtitle | `AnnouncementsPage.tsx:112` |
| `New Announcement` | `AnnouncementsFeed.tsx:129, 174` |
| `Share an update with your students…` | `AnnouncementForm.tsx:141` |
| `Post Announcement` | `AnnouncementForm.tsx:181` |
| `Save changes` | `AnnouncementForm.tsx:181` |
| `Cancel` | `AnnouncementForm.tsx:172` |
| `{count} / 2000` counter | `AnnouncementForm.tsx:160` |
| `Edit announcement` aria-label | `AnnouncementCard.tsx:92` |
| `Delete announcement` aria-label | `AnnouncementCard.tsx:102` |
| `Delete this announcement?` | `DeleteAnnouncementDialog.tsx:114` |
| `This cannot be undone…` body | `DeleteAnnouncementDialog.tsx:115` |
| `Delete Announcement` danger CTA | `DeleteAnnouncementDialog.tsx:145` |
| `Keep it` cancel | `DeleteAnnouncementDialog.tsx:135` |
| `Load more announcements` | `AnnouncementsFeed.tsx:222` |
| `Loading…` | `AnnouncementsFeed.tsx:219` |
| `(edited)` literal | `AnnouncementCard.tsx:81` |
| ` · ` middle-dot separator | `AnnouncementCard.tsx:80` |
| `No announcements yet` | `AnnouncementsFeed.tsx:137` |
| `Post the first update — your students will see it the moment you send it.` | `AnnouncementsFeed.tsx:140` |
| `When your coach posts an update, it will appear here.` | `AnnouncementsFeed.tsx:141` |
| `Create First Announcement` | `AnnouncementsFeed.tsx:151` |
| `Announcement posted.` toast | `AnnouncementForm.tsx:109` |
| `Announcement updated.` toast | `AnnouncementForm.tsx:109` |
| `Announcement deleted.` toast | `DeleteAnnouncementDialog.tsx:88` |
| `Could not load more announcements. Try again.` | `AnnouncementsFeed.tsx:82, 109` |
| `Could not delete the announcement. Try again.` | `DeleteAnnouncementDialog.tsx:60, 77, 97` |
| `Could not post the announcement. Try again.` | `AnnouncementForm.tsx:82, 96, 116` |
| `You are posting too fast. Please wait a minute.` | `AnnouncementForm.tsx:86` |
| `Announcements are limited to 2000 characters.` | `AnnouncementForm.tsx:147` |

**Minor note:** `DeleteAnnouncementDialog.tsx:65` shows `"You are acting too fast. Please wait a minute."` for DELETE 429s — spec only declared the posting variant. The re-phrase is sensible (the word "posting" doesn't fit a delete flow), but it is a copy not blessed by the Copywriting Contract. Not enough to drop the score; flag for future contract update.

**Zero generic labels.** Grep for `Submit|Click Here|OK|Save` in `src/components/announcements` produces only variable names (`submitting`, `setSubmitting`, `onCancel`, `canSubmit`) and the legitimate `Save changes` / `Cancel` spec strings. No generic/placeholder copy slipped in.

### Pillar 2: Visuals (3/4)

**Hierarchy matches spec:**
- Page H1 (24px bold `text-2xl font-bold`) → subtitle (14px secondary) → action row (right-aligned primary button) → card list with 16px vertical gap (`flex flex-col gap-4`) → centered Load more.
- Role chip rendered via `<Badge variant={authorRole === "owner" ? "info" : "success"}>` (`AnnouncementCard.tsx:73`) — matches D-56-06 color assignment.
- Edit/Delete icon buttons are `size="icon"` with `aria-label` and `aria-hidden` on the lucide icons — satisfies Hard Rule 3.

**Gap against spec — deleting state:** `AnnouncementCard` never dims or sets `aria-busy` while the DELETE is in flight. The spec §Interaction States → `AnnouncementCard` → `Deleting` row is unfulfilled. See Priority Fix #3.

**Gap against spec — edit-mode header disabled interactions:** spec §Interaction States says "header retains author/timestamp (disabled interactions)" when the card is in edit mode. Code hides the Edit/Delete icon buttons when `editing === true` (`AnnouncementCard.tsx:85` → `!editing` guard), which is acceptable, but the disabled-state phrasing in the spec suggested the buttons should *remain visible but disabled*. Current code hides them outright — arguably cleaner UX, but a deviation. Low severity.

**Focal point:** The "New Announcement" button is the only accent CTA above the fold on the owner/coach view, as intended. On the student view no accent-colored element appears above the first card, making the first card the focal point as specified. **Caveat:** the new `bg-ima-primary` avatar circle on every card (Priority Fix #1) muddies this — each card header now carries an accent-colored surface, making the "only accent above the fold" rule no longer true on the owner/coach empty-feed-plus-collapsed-form state.

### Pillar 3: Color (3/4)

**Counts (within `src/components/announcements/`):**
- `ima-primary` usages: **1** direct use (`bg-ima-primary` on avatar circle, `AnnouncementCard.tsx:66`). Indirect uses via `<Button variant="primary">` are expected (CTAs). Indirect uses via `<Badge variant="info">` resolve to ima-info (which, per spec, equals ima-primary hex).
- `ima-text`, `ima-text-secondary`, `ima-error`: present and in spec-compliant roles.
- Hex literals: **zero** (`grep '#[0-9a-fA-F]{3,8}'` returned no matches).
- `rgb(`: zero.
- `text-white`: one instance on the avatar, legitimately on a colored background — but see avatar finding.

**Spec violation (avatar):** Spec §Color "Accent reserved-for list" enumerates 6 and only 6 accent uses. The avatar is neither a CTA, focus ring, nor role chip, yet it is a persistent accent-colored disc in every card header. This adds a 7th always-on accent surface and breaks the 60/30/10 promise at the feed level (every card contributes one accent patch).

**60/30/10 compliance at the feed level (visual estimation):** page bg (ima-bg) and card bg (ima-surface) dominate; ima-border on card edges, ima-text/ima-text-secondary on body copy; the recurring `bg-ima-primary` avatar + the single top-right CTA bring accent to an estimated ~12–15% of visible chroma on a 3-card screen — slightly over the 10% target specifically because of the avatar, not the CTA.

**Recommendation:** change avatar fill to `bg-ima-surface-light text-ima-text` (neutral chip) or to the role-coded color (`bg-ima-info/10 text-ima-info` for owner, `bg-ima-success/10 text-ima-success` for coach) to keep the role signal without an always-on accent surface.

### Pillar 4: Typography (4/4)

**Sizes in use** (from grep):
- `text-xs` (12px) — counter, "(edited)", timestamp, avatar initials
- `text-sm` (14px) — body, author name
- `text-2xl` (24px) — H1 only

Three distinct sizes. Spec allows up to four. **PASS.**

**Weights in use:**
- `font-medium` — counter, timestamp, "(edited)" marker (one location: `text-xs font-medium text-ima-text-secondary`)
- `font-semibold` — author name, avatar initials
- `font-bold` — H1 only
- Default `font-normal` — body paragraph (`text-sm text-ima-text whitespace-pre-wrap`)

Four weights on paper, but `font-bold` is confined to the H1 and `font-medium` to meta chrome — matches the spec's "effective 2 content weights" interpretation. **PASS.**

**Line-height:** body uses `leading-relaxed` (1.625) — spec declared 1.5 (`text-sm` default). This is a minor positive deviation (slightly airier reading) and not worth a deduction, but flag for contract alignment if strict typography discipline is desired.

### Pillar 5: Spacing (4/4)

**Classes in use** (from grep):
- `p-4`, `p-6` on CardContent (16px / 24px — both on spec scale)
- `px-4`, `py-6` on page wrapper (16 / 24 — on scale)
- `gap-1`, `gap-2`, `gap-4` (4 / 8 / 16 — on scale)
- `mt-1`, `mt-2`, `mb-3`, `mb-6`, `ml-2`, `ml-auto` — `mt-1` = 4px, `mt-2` = 8px, `mb-3` = 12px, `mb-6` = 24px, `ml-2` = 8px. All are 4-multiples; `mb-3` (12px) is not explicitly enumerated in the spec's spacing scale table but is a valid 4-multiple. The spec only enumerates xs/sm/md/lg/xl/2xl/3xl — 12px falls between sm (8) and md (16). Not a violation of the "multiple of 4" rule, but a hair off the enumerated stops.
- Touch targets: `min-h-[44px] min-w-[44px]` on Edit/Delete icon buttons (`AnnouncementCard.tsx:91, 101`). All other interactive elements use `<Button size="md">` or `<Button size="icon">` which inherit `h-11` / `h-11 w-11` from the primitive — satisfying Hard Rule 2.

**Arbitrary values:** only the two `min-h-[44px] min-w-[44px]` touch-target classes — these are documented exceptions in the spec.

**Responsive layout:** `px-4 py-6 max-w-3xl mx-auto` on the page wrapper matches the spec's md-breakpoint rules. Inline form action row uses `flex-col gap-2 sm:flex-row sm:justify-end` — matches spec §"Inline form on mobile" verbatim. **PASS.**

### Pillar 6: Experience Design (3/4)

**State coverage:**

| State | Implemented? | Evidence |
|-------|--------------|----------|
| Loading (Load more) | ✓ | `AnnouncementsFeed.tsx:212` `loading={loadingMore}`, `aria-busy={loadingMore \|\| undefined}`, Spinner + "Loading…" |
| Loading (form submit) | ✓ | `AnnouncementForm.tsx:179` `loading={submitting}`, `disabled={!canSubmit}` |
| Loading (delete) | ✓ (modal only) | `DeleteAnnouncementDialog.tsx:142` `loading={submitting}` — but missing card-level dim (spec gap) |
| Error (API) | ✓ | Every fetch has `if (!response.ok)` toast + console.error (Hard Rule 5 + 6 respected) |
| Empty (owner/coach) | ✓ | `AnnouncementsFeed.tsx:135–155` — icon + copy + action button |
| Empty (student) | ✓ | Same block, action undefined for non-authors |
| Disabled (submit) | ✓ | `canSubmit = !tooShort && !tooLong && !submitting` |
| Confirmation (destructive) | ✓ | Modal with explicit copy and danger variant |
| Rate-limit feedback | ✓ | 429 branch in both `AnnouncementForm.tsx:85` and `DeleteAnnouncementDialog.tsx:63` |
| Dedup on Load more | ✓ | `AnnouncementsFeed.tsx:95–101` set-based dedupe |
| Mount guard on in-flight delete | ✓ | `DeleteAnnouncementDialog.tsx:40, 74, 86, 94, 101` `isMountedRef` prevents post-unmount state updates |

**State gap — card deleting:** See Priority Fix #3. Spec declares card-level dim + `aria-busy` + `pointer-events-none` during DELETE; not implemented.

**State gap — inline form animation:** Spec declares `slideUp` for the create-panel expansion; code uses `fadeIn`. Functional equivalence is debatable (slideUp is a spatial hint that the panel came from the button's area; fadeIn is a softer, less informative animation). See Priority Fix #2.

**Positives worth noting:**
- The delete dialog's mount guard (`isMountedRef`) is defensive and thoughtful — it correctly prevents "setState on unmounted component" warnings if the user Escapes mid-delete.
- Dedupe-by-id on Load more (`AnnouncementsFeed.tsx:94–101`) handles the race where a new announcement is inserted between the first-page SSR fetch and the Load-more fetch — a subtle correctness win.
- Toast refs + router refs (`useRef`) satisfy CLAUDE.md "Stable useCallback deps" guideline.
- Every `fetch` checks `response.ok` before parsing (Hard Rule 6 — verified on all 3 fetch sites: Feed load-more, Form POST/PATCH, Dialog DELETE).
- Zero bare `animate-*` classes — single animation use is `motion-safe:animate-fadeIn` (Hard Rule 1 respected).
- Zero hex literals across the 6 new component files.

---

## Role-Gating Audit (against UI-SPEC §Role-Gated UI Rules)

| Row | Owner | Coach | Student | Student_diy | Implementation |
|-----|-------|-------|---------|-------------|----------------|
| View feed | ✓ | ✓ | ✓ | ✓ | 4 route files in `src/app/(dashboard)/{role}/announcements/page.tsx`, each passing explicit `role` prop |
| "New Announcement" button | ✓ | ✓ | ✗ | ✗ | `canAuthor = role === "owner" \|\| role === "coach"` gate at `AnnouncementsFeed.tsx:54` |
| Edit/Delete icons | ✓ | ✓ | ✗ | ✗ | `canMutate = viewerRole === "owner" \|\| viewerRole === "coach"` gate at `AnnouncementCard.tsx:54` |
| Empty-state action | ✓ | ✓ | ✗ | ✗ | `action={canAuthor ? <Button>… : undefined}` at `AnnouncementsFeed.tsx:143` |
| Role chip on own posts | owner=info (blue) | coach=success (green) | — | — | `AnnouncementCard.tsx:57–58` — correct per D-56-06 |
| Sidebar NAV | ✓ | ✓ | ✓ | ✓ | `src/lib/config.ts` has 4 new `Announcements` entries, `Megaphone` icon, no badge (D-56-12 respected) |

**Note:** UI-SPEC rows for "Edit any vs. Edit own" distinguish owner (any) vs. coach (own) — but D-56 CONTEXT and Plan 01 intentionally relaxed this to "any" for both roles (ANNOUNCE-03 / ANNOUNCE-04). Current code (`canMutate` with no author_id comparison) matches the relaxed policy and the API's server-side policy. The spec's truth table row "Edit own announcement: Coach ✓" vs. "Edit any: Coach ✗" is therefore inconsistent with the canonical CONTEXT/REQUIREMENTS.md and should be tightened in a future spec revision. Not a Phase 56 defect.

---

## Accessibility Audit

| Check | Result |
|-------|--------|
| Icon buttons have `aria-label` | ✓ Edit + Delete (`AnnouncementCard.tsx:92, 102`) |
| Decorative icons marked `aria-hidden` | ✓ All lucide icons (Plus, Megaphone, Pencil, Trash2) and the middle-dot separator |
| Textarea has accessible label | ✓ `<label htmlFor={id} className="sr-only">` + `aria-describedby={counterId}` |
| Dynamic counter announced to AT | ✓ `role="status" aria-live="polite"` on counter div |
| Form error announced to AT | ✓ via `error` prop on Textarea primitive (primitive owns `role="alert"`) |
| Inline form marked as region | ✓ `role="region" aria-label="New announcement form"` / "Edit announcement form" |
| Load more busy state | ✓ `aria-busy={loadingMore \|\| undefined}` |
| 44px touch targets | ✓ All interactive elements (verified: icon buttons use explicit `min-h-[44px] min-w-[44px]`; all other buttons use `Button size="md"` which the primitive sets to `h-11`) |
| Time element | ✓ `<time dateTime={created_at}>` wraps the relative timestamp — bonus for programmatic date access |
| Page has labelled section | ✓ `aria-labelledby="announcements-h1"` on outer `<section>` |

No accessibility gaps found. This is above the typical bar for a first-pass build.

---

## Hard-Rules Sweep (CLAUDE.md)

| Rule | Status | Evidence |
|------|--------|----------|
| 1. `motion-safe:` on all `animate-*` | PASS | Only one animate use, with prefix (`AnnouncementsFeed.tsx:182`) |
| 2. 44px touch targets | PASS | Explicit on icon buttons; inherited via `Button size="md"` primitive |
| 3. Accessible labels | PASS | Documented above |
| 4. Admin client in API routes | n/a for this audit (UI only) — verified in Plan 01 SUMMARY |
| 5. No empty catches | PASS | Every catch block toasts and/or `console.error`s |
| 6. Check `response.ok` before `.json()` | PASS | Verified on all 3 client fetch sites |
| 7. `import { z } from "zod"` | n/a (no zod in UI files) |
| 8. ima-* tokens only | PASS | Zero hex literals; all colors via `ima-*` tokens (caveat: `text-white` on colored avatar is spec-legal) |

---

## Registry Safety

Spec §Registry Safety declares this phase uses zero registries (`shadcn_initialized: false`, no third-party blocks). Confirmed: `components.json` does not exist; no `npx shadcn` usage; all primitives imported from `@/components/ui/*` (Card, Badge, Button, Textarea, EmptyState, Spinner, Modal, Toast — all committed in earlier phases). **Registry audit: skipped (not applicable to this project).**

---

## Files Audited

**Phase 56 new files (audited in full):**
- `src/components/announcements/AnnouncementsPage.tsx` (server, 124 lines)
- `src/components/announcements/AnnouncementsFeed.tsx` (client, 229 lines)
- `src/components/announcements/AnnouncementCard.tsx` (client, 139 lines)
- `src/components/announcements/AnnouncementForm.tsx` (client, 186 lines)
- `src/components/announcements/DeleteAnnouncementDialog.tsx` (client, 150 lines)
- `src/components/announcements/announcement-types.ts` (35 lines)
- `src/app/(dashboard)/owner/announcements/page.tsx` (10 lines)
- `src/app/(dashboard)/coach/announcements/page.tsx` (10 lines)
- `src/app/(dashboard)/student/announcements/page.tsx` (10 lines)
- `src/app/(dashboard)/student_diy/announcements/page.tsx` (10 lines)

**Phase 56 modified files (audited for config-only changes, not scored for visual pillars):**
- `src/lib/config.ts` — 4 new NAVIGATION entries (verified in Plan 03 SUMMARY)
- `src/components/layout/Sidebar.tsx` — `Megaphone` added to lucide import + ICON_MAP (verified in Plan 03 SUMMARY)

**API files (referenced but not UI-audited):**
- `src/app/api/announcements/route.ts` — POST + GET
- `src/app/api/announcements/[id]/route.ts` — PATCH + DELETE

---

## Summary

Phase 56 delivers a clean, spec-compliant announcements feed with exceptional accessibility discipline and zero Hard-Rule violations. The three remaining gaps are small:

1. An unreserved accent surface (avatar) that dilutes the 60/30/10 contract.
2. A motion deviation (`fadeIn` vs spec'd `slideUp`) undocumented in the Plan 02 SUMMARY's "no deviations" claim.
3. A missing card-level deleting state that would tighten the async-feedback story.

None are blockers. All three are 5-to-30-line fixes. Overall **21/24** — ship-quality with a short follow-up list.
