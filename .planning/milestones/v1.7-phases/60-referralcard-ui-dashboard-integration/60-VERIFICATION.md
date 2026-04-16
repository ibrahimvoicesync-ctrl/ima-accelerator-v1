---
phase: 60-referralcard-ui-dashboard-integration
verified: 2026-04-16T00:00:00Z
status: human_needed
score: 5/6
overrides_applied: 0
human_verification:
  - test: "Log in as a student user, visit /student; scroll to bottom of page and confirm the Refer a Friend card renders below the Roadmap/Report grid with the $500 headline, professional one-sentence description, and 'Get My Link' button visible with correct ima-* token styling."
    expected: "Card appears at bottom of page inside mt-6 wrapper. Heading reads 'Refer a Friend — Earn $500'. Description is a single sentence ending with a period. Button is full-width, primary variant."
    why_human: "Visual layout and position relative to sibling grids cannot be verified without a running dev server. Static file analysis confirms correct JSX structure and insertion point but cannot confirm rendered position or visual token appearance."
  - test: "Click 'Get My Link'. Observe spinner in button. Wait for response. Confirm the short URL, Copy button, and Share button (mobile Chrome) or only Copy button (Firefox desktop) appear."
    expected: "Spinner shows during fetch. On success, URL row replaces the button with monospace shortUrl, Copy icon-button (44px), and Share icon-button (44px, only when navigator.share available)."
    why_human: "Multi-state interactive flow requires live browser execution."
  - test: "Click Copy. Confirm the button toggles to Check icon + 'Copied!' text in ima-success color for ~2 seconds, then reverts to the Copy icon."
    expected: "2-second Copied! toggle with Check icon and 'Copied!' label, then smooth revert."
    why_human: "Timer-based state transition requires live browser execution."
  - test: "Simulate a fetch failure (disable network in DevTools or test with a broken API key). Click 'Get My Link' and confirm an error toast appears and the button re-enables."
    expected: "Toast with title 'Could not generate your link' / 'Please try again.' appears. Spinner clears. Button returns to INITIAL state and is clickable again."
    why_human: "Error path requires simulating network or server failure in a live environment."
  - test: "Repeat all of the above for the /student_diy route."
    expected: "Identical card and behavior at the bottom of the student_diy dashboard."
    why_human: "Same reasons — live browser required."
---

# Phase 60: ReferralCard UI & Dashboard Integration Verification Report

**Phase Goal:** Students and student_diy users see a polished referral card at the bottom of their dashboard, can generate their link with one click, and can copy or share it from the same card — with all CLAUDE.md Hard Rules (touch targets, motion-safe animations, ima-* tokens, aria labels, response.ok, never-swallow errors) satisfied.
**Verified:** 2026-04-16T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `ReferralCard.tsx` is a `"use client"` component with no props; INITIAL state shows $500 headline + "Get My Link" button with `min-h-[44px]` and accessible label | VERIFIED | File exists at 156 lines. Line 1: `"use client";`. `export function ReferralCard()` (no props). Heading: `Refer a Friend — Earn $500`. Button: `aria-label="Get My Link"` with `size="md"` (44px via Button primitive). Description is one professional sentence, no emoji, no exclamation. |
| 2 | Clicking "Get My Link" shows `motion-safe:animate-spin` spinner, transitions to READY with short URL, Copy (2s toggle), Share (hidden when unavailable); all interactive elements meet 44px | VERIFIED (code) / ? HUMAN (interaction) | `loading={cardState === "loading"}` delegates to Button primitive which internally uses Spinner with `motion-safe:animate-spin`. READY row: `min-h-[44px] min-w-[44px]` on both Copy and Share buttons. `shareSupported` lazy-initialized with `detectShareSupport` fn; Share button conditionally rendered. `copiedTimerRef` drives 2s Copied! toggle with `clearTimeout` before reset. Actual click flow requires live browser. |
| 3 | Card shell `bg-ima-surface border border-ima-border rounded-xl p-6`; no hex/gray; decorative icons `aria-hidden="true"`; icon-only buttons have `aria-label` | VERIFIED | `bg-ima-surface border border-ima-border rounded-xl p-6` confirmed on line 104. No `#[0-9a-fA-F]{3,6}` matches. No `text/bg/border-gray-*` classes. 3x `aria-hidden="true"` (Copy, Check, Share2 icons). 3x `aria-label` (Get My Link, Copy referral link, Share referral link). All `transition-colors` use `motion-safe:transition-colors`. |
| 4 | Failing fetch surfaces toast + `console.error`; spinner clears, button re-enables; `response.ok` checked before JSON parse | VERIFIED | `if (!res.ok)` guard on line 41 before `res.json()`. Post-`res.ok`: runtime shape guard `!data?.shortUrl \|\| typeof data.shortUrl !== "string"` (commit b4e9348). Network-throw catch on lines 65–73. All three failure paths: `console.error("[ReferralCard]", err)` + `toastRef.current({...})` + `setCardState("initial")`. 5x `console.error` total. AbortError in Share silently ignored (correct — user-cancelled, not an error). |
| 5 | `<ReferralCard />` at bottom of both dashboard pages inside `mt-6` wrapper | VERIFIED (code) / ? HUMAN (visual position) | `import { ReferralCard } from "@/components/student/ReferralCard"` confirmed in both `student/page.tsx` (line 5) and `student_diy/page.tsx` (line 8). `<div className="mt-6"><ReferralCard /></div>` confirmed in both files. Positioned after last grid close, before outer wrapper close. 2 occurrences per file (import + JSX). Visual confirmation of rendered position requires live browser. |
| 6 | Post-phase build gate: `npm run lint && npx tsc --noEmit && npm run build` exits 0 | HUMAN NEEDED (runtime gate) | SUMMARY.md documents PASS for all three commands (lint 5s, tsc 2s, build 10s/59 routes). All 3 commits (f7c4f0a, bf4a231, b4e9348) verified in git log. The build gate result cannot be re-executed in this verification pass without a full dev environment. Accept SUMMARY claim as sufficient for code-verified phases per project memory; surface as human-checkable if fresh validation needed. |

**Score:** 5/6 truths verified at code level (SC-6 is build gate — SUMMARY-documented only; SC-2 and SC-5 partial: code structure verified, interactive behavior human-only)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/student/ReferralCard.tsx` | "use client" component, named export `ReferralCard`, no props, 4-state machine, min 100 lines | VERIFIED | Exists, 156 lines, `"use client"` on line 1, `export function ReferralCard()`, INITIAL/LOADING/READY states + ERROR path. All three imports (`Button`, `useToast`, lucide icons) present. |
| `src/app/(dashboard)/student/page.tsx` | Imports and renders `<ReferralCard />` inside `mt-6` wrapper at bottom | VERIFIED | Import on line 5. `<ReferralCard />` rendered in `<div className="mt-6">` after the Roadmap/Report grid close, before outer `</div>`. Exactly 1 JSX instance. |
| `src/app/(dashboard)/student_diy/page.tsx` | Imports and renders `<ReferralCard />` inside `mt-6` wrapper at bottom | VERIFIED | Import on line 8. `<ReferralCard />` rendered in `<div className="mt-6">` after the Deals grid close, before outer `</div>`. Exactly 1 JSX instance. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/components/student/ReferralCard.tsx` | `/api/referral-link` | `fetch("/api/referral-link", { method: "POST", ... })` | WIRED | `fetch("/api/referral-link"` on line 36. POST method, `Content-Type: application/json` header, `body: JSON.stringify({})`. Response checked via `!res.ok` before `res.json()`. |
| `src/app/(dashboard)/student/page.tsx` | `src/components/student/ReferralCard.tsx` | `import { ReferralCard } from "@/components/student/ReferralCard"` + `<ReferralCard />` in mt-6 wrapper | WIRED | Import confirmed on line 5. JSX usage confirmed inside `<div className="mt-6">` near end of file. |
| `src/app/(dashboard)/student_diy/page.tsx` | `src/components/student/ReferralCard.tsx` | `import { ReferralCard } from "@/components/student/ReferralCard"` + `<ReferralCard />` in mt-6 wrapper | WIRED | Import confirmed on line 8. JSX usage confirmed inside `<div className="mt-6">` near end of file. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ReferralCard.tsx` | `shortUrl` (state) | `POST /api/referral-link` → `data.shortUrl` | Yes — API queries `public.users.referral_short_url` from DB; falls back to Rebrandly call on first generation | FLOWING |
| `/api/referral-link` | `referral_short_url` | Supabase admin client query on `public.users`; Rebrandly POST on cache miss | Yes — DB-backed with permanent cache after first call | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for interactive click flows — requires running dev server. Build gate (CFG-02) is documented as PASS in SUMMARY.md (lint/tsc/build all exit 0, 59 routes). Module structure is verifiable statically.

| Behavior | Method | Result | Status |
|----------|--------|--------|--------|
| `ReferralCard` exported from component file | `grep '^export function ReferralCard'` | Match found | PASS |
| `ReferralCard` imported in `student/page.tsx` | `grep 'import { ReferralCard }'` | Match found | PASS |
| `ReferralCard` imported in `student_diy/page.tsx` | `grep 'import { ReferralCard }'` | Match found | PASS |
| `fetch("/api/referral-link"` present | grep | Match found | PASS |
| `if (!res.ok)` guard before `res.json()` | grep | Match found | PASS |
| Runtime shape guard on API response (WR-01 fix, commit b4e9348) | grep `!data?.shortUrl \|\| typeof data.shortUrl !== "string"` | Match on line 53 | PASS |
| No hex colors in component | grep `#[0-9a-fA-F]{3,6}` | No match | PASS |
| No gray-* Tailwind classes | grep `(text\|bg\|border)-gray-` | No match | PASS |
| No raw `animate-spin` | grep `(^\|[^:])animate-spin` | No match | PASS |
| All transitions use `motion-safe:` | grep `motion-safe:transition-colors` | 2 matches (both icon buttons) | PASS |
| `aria-hidden="true"` on decorative icons | grep count | 3 (Copy, Check, Share2) | PASS |
| `aria-label` on all interactive elements | grep count | 3 (Get My Link, Copy, Share) | PASS |
| `min-h-[44px]` on icon-only buttons | grep count | 2 (Copy, Share icon buttons) | PASS |
| `console.error` on every failure path | grep count | 5 instances | PASS |
| toastRef pinning via `useLayoutEffect` | grep | `useLayoutEffect(() => { toastRef.current = toast; })` on lines 17–19 | PASS |
| SSR-safe `navigator.share` detection | grep `typeof navigator !== "undefined"` | Match in `detectShareSupport` fn | PASS |
| AbortError silently ignored in handleShare | grep | `if (err instanceof Error && err.name === "AbortError") return;` | PASS |
| `setTimeout` cleanup on unmount | grep | `useEffect` cleanup clears `copiedTimerRef.current` | PASS |
| Live click flow (Get My Link → spinner → URL → Copy → Share) | Requires dev server | Not run | HUMAN |
| Error path: network failure → toast + re-enable | Requires dev server | Not run | HUMAN |
| Build gate `npm run lint && npx tsc --noEmit && npm run build` exits 0 | Requires full build toolchain | Documented as PASS in SUMMARY.md; 3 commits confirmed in git log | HUMAN (re-run) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| UI-01 | 60-01-PLAN.md | `"use client"` component, no props, fetches POST /api/referral-link | SATISFIED | `"use client"` on line 1; `export function ReferralCard()` takes no props; `fetch("/api/referral-link"` with POST |
| UI-02 | 60-01-PLAN.md | INITIAL state: $500 heading, professional 1-sentence description, "Get My Link" button min-h-[44px] | SATISFIED | Heading exact copy verified. Description single sentence, no hype/emoji/exclamation. Button uses `size="md"` (h-11, 44px) with `aria-label="Get My Link"` |
| UI-03 | 60-01-PLAN.md | LOADING state: spinner via Button loading prop (`motion-safe:animate-spin`) | SATISFIED | `loading={cardState === "loading"}` delegates to Button → Spinner primitive which has `motion-safe:animate-spin` baked in. `{cardState === "loading" ? null : "Get My Link"}` suppresses text during loading. |
| UI-04 | 60-01-PLAN.md | READY state: short URL display, Copy 2s toggle, Share hidden when unavailable; 44px touch targets | SATISFIED (code) | READY row present with `min-h-[44px] min-w-[44px]` on both icon buttons. `copied` state drives 2s timer. `shareSupported` gates Share button. Interactive behavior requires human. |
| UI-05 | 60-01-PLAN.md | ima-* tokens only; `aria-hidden="true"` on decorative icons; `aria-label` on icon-only buttons; card shell class | SATISFIED | All color classes use `ima-*` tokens. 3x `aria-hidden="true"`. 3x `aria-label`. Card shell: `bg-ima-surface border border-ima-border rounded-xl p-6`. Zero hex/gray violations. |
| UI-06 | 60-01-PLAN.md | Fetch errors: toast + console.error; `response.ok` before JSON parse | SATISFIED | `if (!res.ok)` guard before `res.json()`. Runtime shape guard added (commit b4e9348). 3 failure paths each have `console.error("[ReferralCard]"...)` + `toastRef.current({type:"error",...})` + `setCardState("initial")`. AbortError correctly excepted. |
| INT-01 | 60-01-PLAN.md | `<ReferralCard />` at bottom of `student/page.tsx` in mt-6 wrapper | SATISFIED | Import on line 5. `<div className="mt-6"><ReferralCard /></div>` positioned after Roadmap/Report grid, before outer wrapper close. |
| INT-02 | 60-01-PLAN.md | `<ReferralCard />` at bottom of `student_diy/page.tsx` in mt-6 wrapper | SATISFIED | Import on line 8. `<div className="mt-6"><ReferralCard /></div>` positioned after Deals grid, before outer wrapper close. |
| CFG-02 | 60-01-PLAN.md | `npm run lint && npx tsc --noEmit && npm run build` exits 0 | SATISFIED (per SUMMARY) | SUMMARY documents PASS (lint 5s, tsc 2s, build 10s/59 routes). All 3 implementation commits exist in git. Build gate re-run is a human check. |

**Coverage:** 9/9 requirement IDs from PLAN frontmatter accounted for. No orphaned requirements — REQUIREMENTS.md maps UI-01..06, INT-01, INT-02, CFG-02 to Phase 60 exactly.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | — |

Zero anti-patterns found. No TODO/FIXME/PLACEHOLDER comments, no empty catch blocks, no hardcoded empty arrays/objects that flow to rendered output, no hex colors, no gray-* classes, no raw `animate-spin`, no `dangerouslySetInnerHTML`.

### Human Verification Required

The following 5 items require a running dev server and cannot be verified programmatically. Per project memory, these are batched at milestone end UAT.

#### 1. Student dashboard layout — card appears at bottom

**Test:** Log in as a student user, visit `/student`. Scroll to the bottom of the page.
**Expected:** Refer a Friend card appears below the Roadmap/Report 2-column grid. Card shows: heading "Refer a Friend — Earn $500", one-sentence description ending with a period, full-width "Get My Link" button in primary blue style.
**Why human:** Rendered position and visual styling require a live browser.

#### 2. Click flow: INITIAL → LOADING → READY

**Test:** Click "Get My Link". Observe loading state. Wait for API response.
**Expected:** Spinner appears inside the button during fetch (button disabled). On success: URL row replaces button with monospace short URL, Copy icon-button, and Share icon-button (mobile Chrome only).
**Why human:** Multi-state interactive transition requires live browser execution against the real API.

#### 3. Copy toggle: 2-second Copied! revert

**Test:** In READY state, click the Copy button.
**Expected:** Button label changes to Check icon + "Copied!" text in success color for approximately 2 seconds, then reverts to Copy icon.
**Why human:** Timer-based state transition requires live browser.

#### 4. Error path: network failure → toast + re-enable

**Test:** Disable network in DevTools (or simulate 500 response), then click "Get My Link".
**Expected:** Error toast appears with "Could not generate your link" / "Please try again." Spinner clears. "Get My Link" button returns and is clickable again.
**Why human:** Error path requires simulating network failure in a live environment.

#### 5. Repeat all for /student_diy

**Test:** Log in as a student_diy user, visit `/student_diy`. Repeat checks 1–4.
**Expected:** Identical card and behavior on the student_diy dashboard.
**Why human:** Same — live browser required.

---

### Gaps Summary

No code-level gaps found. All 9 requirement IDs are satisfied at the implementation level:
- `ReferralCard.tsx` is substantive (156 lines), correctly structured, and wired to the live `/api/referral-link` endpoint.
- All CLAUDE.md Hard Rules verified: `motion-safe:` prefixes, 44px touch targets, `aria-label` on all interactive elements, `aria-hidden` on decorative icons, `response.ok` gated before JSON parse, all failure paths toast + `console.error`, ima-* tokens only, no hex, no gray-* classes, no raw `animate-spin`.
- Post-review fix (commit b4e9348) correctly adds a runtime shape guard preventing the blank-card regression identified in WR-01.
- Both dashboard integrations are correctly positioned with `mt-6` wrappers, importing the component and rendering it exactly once per page.
- Status is `human_needed` because 5 interactive/visual behaviors cannot be verified without a running dev server. These are batched at milestone-end UAT per project memory.

---

_Verified: 2026-04-16T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
