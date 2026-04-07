---
phase: 37-invite-link-max-uses
verified: 2026-04-04T10:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
human_verification:
  - test: "Open /coach/invites or /owner/invites in a browser, switch to the Invite Link tab"
    expected: "A number input labeled 'Max uses' with default value 10 appears next to the Generate Invite Link button"
    why_human: "Cannot render React components to verify visual layout without a running browser"
  - test: "Generate a magic link, use it max_uses times, then attempt to register again with the same link"
    expected: "Final registration attempt redirects with error=magic_link_invalid"
    why_human: "Requires live Supabase DB and OAuth flow to exercise the optimistic-lock path"
---

# Phase 37: Invite Link max_uses Verification Report

**Phase Goal:** Magic link invites default to 10 uses and display a live usage count; registration via an exhausted link is rejected
**Verified:** 2026-04-04T10:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/magic-links without max_uses body creates a link with max_uses=10 | VERIFIED | postSchema has `max_uses: z.number()...optional().default(10)`; empty body falls back to `{}` with all-defaults path |
| 2 | POST /api/magic-links with max_uses=5 creates a link with max_uses=5 | VERIFIED | postSchema passes through any valid integer 1-10000; insert uses `max_uses: maxUses` |
| 3 | POST /api/magic-links with max_uses=0 returns 400 | VERIFIED | `.min(1)` in Zod schema; safeParse failure returns `{ status: 400 }` with Zod issue message |
| 4 | POST /api/magic-links with max_uses=10001 returns 400 | VERIFIED | `.max(10000)` in Zod schema; same safeParse 400 path |
| 5 | Existing null-max_uses rows are not backfilled (grandfathered as unlimited) | VERIFIED | Migration 00019 contains only `ALTER COLUMN max_uses SET DEFAULT 10` — no UPDATE statement confirmed by grep |
| 6 | Coach and owner invite pages show number input labeled "Max uses" with default 10 | VERIFIED | Both CoachInvitesClient.tsx and OwnerInvitesClient.tsx have `<Input type="number" label="Max uses" ... value={maxUses}` with `useState<number>(10)` |
| 7 | Creating a magic link sends max_uses in the POST body | VERIFIED | Both components: `body: JSON.stringify({ role: selectedRole, max_uses: maxUses })` |
| 8 | Magic link cards show "X / Y used" format; exhausted links show ima-error color with Exhausted badge; grandfathered (null) links show infinity symbol | VERIFIED | `getUsageDisplay` helper returns `"${use_count} / ${limit} used"` with `\u221E` for null; IIFE in JSX applies `text-ima-error` and `<Badge variant="error" size="sm">Exhausted</Badge>` when exhausted |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00019_magic_links_default.sql` | Column-level DEFAULT 10 on magic_links.max_uses | VERIFIED | File exists; contains `ALTER COLUMN max_uses SET DEFAULT 10`; no UPDATE statement |
| `src/app/api/magic-links/route.ts` | Consolidated Zod postSchema parsing role + max_uses | VERIFIED | `const postSchema = z.object({...})` at line 16; exports both POST and PATCH handlers |
| `src/components/coach/CoachInvitesClient.tsx` | Max uses input + usage display for coach invites | VERIFIED | 459 lines; contains `maxUses` state, Input, POST body update, getUsageDisplay helper, IIFE display |
| `src/components/owner/OwnerInvitesClient.tsx` | Max uses input + usage display for owner invites | VERIFIED | 465 lines; identical structure to coach; preserves `<span className="capitalize">{link.role}</span>` in magic link card |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/magic-links/route.ts` | `supabase magic_links table` | `admin.from('magic_links').insert` with `max_uses: maxUses` | VERIFIED | Line 92: `max_uses: maxUses,` in insert block; `maxUses` assigned from `parsed.data.max_uses` at line 76 |
| `src/components/coach/CoachInvitesClient.tsx` | `/api/magic-links` | fetch POST with `max_uses` in body | VERIFIED | Line 99: `body: JSON.stringify({ role: selectedRole, max_uses: maxUses })`; `maxUses` in useCallback deps array |
| `src/components/owner/OwnerInvitesClient.tsx` | `/api/magic-links` | fetch POST with `max_uses` in body | VERIFIED | Line 99: `body: JSON.stringify({ role: selectedRole, max_uses: maxUses })`; `maxUses` in useCallback deps array |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CoachInvitesClient.tsx` — usage display | `link.use_count`, `link.max_uses` | `magicLinks` prop fed from page server component via DB query | Yes — `MagicLinkItem` type matches live DB columns; optimistic update appends real API response | FLOWING |
| `OwnerInvitesClient.tsx` — usage display | `link.use_count`, `link.max_uses` | Same as coach | Yes — identical pattern | FLOWING |
| `route.ts` — POST insert | `maxUses` | `parsed.data.max_uses` from Zod safeParse of request body | Yes — Zod default 10 or user-supplied value; no static empty return | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Migration has no UPDATE statement | `grep UPDATE supabase/migrations/00019_magic_links_default.sql` | No output (no UPDATE found) | PASS |
| API route uses postSchema not old roleSchema | `grep roleSchema src/app/api/magic-links/route.ts` | No output (variable does not exist) | PASS |
| Insert uses maxUses variable not null literal | `grep "max_uses: null" src/app/api/magic-links/route.ts` | No output | PASS |
| CoachInvitesClient sends max_uses in POST body | `grep "max_uses: maxUses" CoachInvitesClient.tsx` | Line 99 matches | PASS |
| OwnerInvitesClient sends max_uses in POST body | `grep "max_uses: maxUses" OwnerInvitesClient.tsx` | Line 99 matches | PASS |
| Both files use text-ima-error (not text-ima-danger) | `grep "ima-danger" src/components/{coach,owner}/*.tsx` | No output | PASS |
| TypeScript clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| ESLint clean on modified files | `eslint route.ts CoachInvitesClient.tsx OwnerInvitesClient.tsx` | Exit 0, no output | PASS |
| Commits documented in SUMMARY exist in git | `git log --oneline 9847cca 74ed203 c36e0c8` | All 3 SHAs found | PASS |
| INVITE-03 (callback enforcement) — pre-existing | `grep "use_count >= max_uses" src/app/api/auth/callback/route.ts` | Line 199 matches; optimistic-lock claim at lines 216-223 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INVITE-01 | 37-01, 37-02 | Magic link creation accepts optional max_uses, defaulting to 10 | SATISFIED | Migration DEFAULT 10 + postSchema default 10 + frontend Input default 10 + max_uses in POST body |
| INVITE-02 | 37-02 | UI shows "X/Y used" on existing magic link cards | SATISFIED | `getUsageDisplay` renders `"${use_count} / ${limit} used"` in both coach and owner components |
| INVITE-03 | 37-01 (pre-existing) | Registration via magic link rejected when use_count >= max_uses | SATISFIED | `src/app/api/auth/callback/route.ts` line 199: `(magicLink.max_uses !== null && magicLink.use_count >= magicLink.max_uses)` triggers redirect with `error=magic_link_invalid`; plan notes this was already complete |

No orphaned requirements — all 3 IDs declared in plans are accounted for and satisfied. REQUIREMENTS.md marks all three as `[x]` under Phase 37.

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|-----------|
| None | — | — | No TODOs, FIXMEs, stub returns, hardcoded empty state, or `text-ima-danger` found in any phase 37 modified file |

**Notable:** `Button variant="danger"` appears in both invite components for the Deactivate button. This is the Button component's own CVA variant (`bg-ima-error text-white`) — distinct from the nonexistent `text-ima-danger` CSS token. Not a violation.

### Human Verification Required

#### 1. Max Uses Input Visual Layout

**Test:** Log in as coach or owner, navigate to /coach/invites or /owner/invites, click the "Invite Link" tab.
**Expected:** A compact number input (width ~128px) labeled "Max uses" appears inline with the Generate Invite Link button, with the value pre-set to 10.
**Why human:** Cannot render React components or verify Tailwind layout without a live browser.

#### 2. End-to-End Exhausted Link Rejection

**Test:** Create a magic link with max_uses=1. Register one account using the link. Attempt to open the registration URL again in a fresh browser session.
**Expected:** The second attempt is rejected and redirected to `/register?magic=...&error=magic_link_invalid`.
**Why human:** Requires a live Supabase DB, Google OAuth flow, and two browser sessions to complete the optimistic-lock path.

### Gaps Summary

No gaps found. All 8 observable truths are verified. All 4 required artifacts exist, are substantive (real implementation, not stubs), and are wired to their data sources. All 3 key links are confirmed. All 3 requirement IDs are satisfied. TypeScript and ESLint pass cleanly. Two items are flagged for human verification due to browser/OAuth requirements, but these are confirmatory tests of already-verified code paths, not blockers.

---

_Verified: 2026-04-04T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
