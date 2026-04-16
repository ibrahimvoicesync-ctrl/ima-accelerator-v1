# Phase 60: ReferralCard UI & Dashboard Integration — Research

**Researched:** 2026-04-16
**Domain:** React client component, dashboard integration, Web APIs (clipboard, navigator.share)
**Confidence:** HIGH — all findings verified against codebase source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, CLAUDE.md Hard Rules, and existing codebase patterns (Deals stat cards, existing UI primitives, ima-* tokens, toast system) to guide decisions.

### Claude's Discretion
All implementation choices.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped. Custom Rebrandly domain, webhook, click-tracking, email invite composer, new API routes, non-student roles are all out of scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | `src/components/student/ReferralCard.tsx` is a `"use client"` component that takes no props and fetches from `POST /api/referral-link` | API shape confirmed; `"use client"` + no-props pattern matches WorkTrackerClient/DealsClient; integration architecture verified |
| UI-02 | Initial state shows card with $500 headline/description and "Get My Link" button with `min-h-[44px]` | Copy, Button primitive shape, and 44px guarantee confirmed |
| UI-03 | Loading state uses spinner inside button, `motion-safe:animate-spin` | Button's `loading` prop renders `<Spinner size="sm" />` which already uses `motion-safe:animate-spin` — no custom code needed |
| UI-04 | Ready state: short URL, Copy toggle (2s "Copied!"), Share button hidden when `navigator.share` unavailable | SSR-safe pattern documented; `Copy`, `Check`, `Share2` icons confirmed in lucide-react; clipboard pattern exists in OwnerInvitesClient |
| UI-05 | Card style `bg-ima-surface border border-ima-border rounded-xl p-6`; ima-* tokens only; aria-hidden on decorative icons; aria-label on icon-only buttons | All tokens confirmed in tailwind.config.ts; exact class pattern observed in both dashboard pages |
| UI-06 | Fetch errors: toast + `console.error`, never swallowed; `response.ok` before JSON parse | `useToast()` import path + call signature confirmed; pattern directly mirrors DealsClient and OwnerInvitesClient |
| INT-01 | `<ReferralCard />` at bottom of `student/page.tsx` in `mt-6` wrapper below Deals grid | **Exact insertion point: after closing `</div>` of Deals Stat Cards grid (line 271) and before the existing Roadmap/Report 2-col grid starts (line 273)**. Note: there IS a second grid after Deals (Roadmap + Daily Report 2-col grid, lines 273-357). Insertion point is after line 357 (final `</div>` before outer `</div>`) |
| INT-02 | `<ReferralCard />` at bottom of `student_diy/page.tsx` in `mt-6` wrapper below Deals grid | **Exact insertion point: after closing `</div>` of Deals Stat Cards grid (line 225) and before the outer `</div>` close (line 226)** — student_diy has no second grid after deals |
| CFG-02 | Build gate `npm run lint && npx tsc --noEmit && npm run build` exits 0 | No new deps; existing primitives; "use client" pattern well-established in project |
</phase_requirements>

---

## Summary

Phase 60 is a self-contained React client component (`ReferralCard.tsx`) with three state transitions (INITIAL → LOADING → READY, error resets to INITIAL) that integrates at the bottom of two server-component pages. All required primitives (`Button` with `loading` prop, `Spinner`, `useToast`) are already implemented and verified. No new dependencies are required — lucide-react is installed and `Copy`, `Check`, `Share2` icons are confirmed present. The API contract (`POST /api/referral-link` returning `{ shortUrl, referralCode }`) is live from Phase 59.

The two integration pages have different structures. `student/page.tsx` has a second grid (Roadmap + Daily Report) after the Deals Stat Cards; insertion is after the final `</div>` before the outer `</div>` wrapper (after line 357). `student_diy/page.tsx` ends immediately after Deals; insertion is after line 225's closing `</div>` before the outer `</div>` at line 226.

The existing `OwnerInvitesClient` / `CoachInvitesClient` provide a direct reference for the clipboard copy pattern (including error toast on failure), and `DealsClient` provides the reference pattern for `useRef`-pinned `toastRef` + `routerRef` to prevent dependency churn. `WorkTrackerClient` demonstrates the `navigator` / `localStorage` SSR-safe access pattern via `typeof window !== "undefined"` and `useEffect`.

**Primary recommendation:** Build `ReferralCard.tsx` mirroring DealsClient's ref-pinning pattern and OwnerInvitesClient's clipboard pattern. Detect `navigator.share` in `useEffect` only (never in render), default `shareSupported` to `false`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| State machine (INITIAL/LOADING/READY/ERROR) | Browser / Client | — | `"use client"` component, pure React state |
| Fetch to `/api/referral-link` | Browser / Client | API / Backend | Client initiates; API handles auth, DB, Rebrandly |
| Clipboard write | Browser / Client | — | `navigator.clipboard.writeText` is browser API |
| Web Share | Browser / Client | — | `navigator.share` is browser API; SSR-unsafe |
| Toast on error | Browser / Client | — | `useToast()` context, client-only |
| Auth/role enforcement | API / Backend | — | Already done in Phase 59 route handler |
| Supabase reads/writes | API / Backend | — | Route handler only; component never touches DB |
| Dashboard layout | Frontend Server (SSR) | — | Pages are `async` server components |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | Component + hooks | Project-wide [VERIFIED: package.json] |
| lucide-react | 0.576.0 | Icons (Copy, Check, Share2) | Already installed; used in 15+ files [VERIFIED: package.json + node check] |
| TypeScript | ^5 | Strict mode types | Project-wide [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | 0.7.1 | Not needed — no new variant component | Only if extracting reusable variant-based primitive |
| Tailwind CSS | ^4 | All styling via ima-* tokens | All styling decisions in this component [VERIFIED: tailwind.config.ts] |

**Installation:** None. No new dependencies.

---

## Integration Anchor — Exact Insertion Points

### student/page.tsx (INT-01)

[VERIFIED: src/app/(dashboard)/student/page.tsx, lines 112-360]

The page structure (inside `<div className="px-4">`):
1. Lines 113-118: Greeting
2. Lines 121-150: Work Progress Card
3. Lines 153-234: KPI Outreach Cards grid (`mt-6`)
4. Lines 237-271: **Deals Stat Cards grid** — closes with `</div>` at line 271
5. Lines 274-357: Roadmap + Daily Report 2-col grid (`mt-6`)
6. Line 358: `</div>` closes the outer `px-4` wrapper
7. Line 359: closes the `return (` fragment

**Insertion point:** After line 357 (close of the Roadmap/Report grid `</div>`), before line 358 (outer wrapper close). The `<div className="mt-6">` wrapper + `<ReferralCard />` inserts here so the card appears below the full page, last item before the page wrapper closes.

```tsx
      {/* Referral Card */}
      <div className="mt-6">
        <ReferralCard />
      </div>
    </div>   {/* ← line 358: outer px-4 wrapper close */}
  );           {/* ← line 359 */}
}
```

The UI-SPEC says "below the Deals Stat Cards grid" — but it also says "after the closing `</div>` of the Roadmap/Report 2-col grid" for student/page. The Roadmap/Report grid is the LAST grid, so insertion after it (line 357) is correct.

### student_diy/page.tsx (INT-02)

[VERIFIED: src/app/(dashboard)/student_diy/page.tsx, lines 89-228]

The page structure (inside `<div className="px-4">`):
1. Lines 90-95: Greeting
2. Lines 98-188: 2-col grid: Work Progress + Roadmap Progress
3. Lines 191-225: **Deals Stat Cards grid** — closes with `</div>` at line 225
4. Line 226: `</div>` closes the outer `px-4` wrapper
5. Line 227: closes the `return (` fragment

**Insertion point:** After line 225 (close of Deals grid), before line 226 (outer wrapper close).

```tsx
      {/* Referral Card */}
      <div className="mt-6">
        <ReferralCard />
      </div>
    </div>   {/* ← line 226: outer px-4 wrapper close */}
  );           {/* ← line 227 */}
}
```

**Key difference:** student_diy has NO second grid after Deals. Insertion is directly before the final outer `</div>`. This matches the UI-SPEC which says "append after the closing `</div>` of the Deals Stat Cards grid (the last grid on the student_diy page)."

---

## Button Primitive Shape

[VERIFIED: src/components/ui/Button.tsx]

```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}
```

- **`loading` prop:** YES — renders `<Spinner size="sm" />` before `{children}`, sets `disabled={disabled || loading}`, sets `aria-busy={loading || undefined}`
- **`children` when loading:** NOT hidden automatically — text still renders beside spinner. If you want spinner-only appearance in loading state, pass empty string or omit label, OR set children to match (the UI-SPEC says "Button label text hidden by loading state" — to achieve this, use empty/no children when `loading={true}`)
- **Variants:** `primary`, `secondary`, `ghost`, `danger`, `outline`
- **Sizes:**
  - `sm`: `min-h-[44px] px-3 text-xs rounded-md gap-1.5`
  - `md`: `h-11 px-4 text-sm rounded-lg gap-2` — h-11 = 44px, satisfies touch target
  - `lg`: `h-12 px-6 text-base rounded-lg gap-2`
  - `icon`: `h-11 w-11 rounded-lg` — square 44px button
- **Icon slotting:** Icons are placed as children, e.g., `<Button><Plus className="h-4 w-4" aria-hidden="true" />Add Deal</Button>`. No `leftIcon`/`rightIcon` props — children-only.
- **Full-width:** Use `className="w-full"` to override default inline sizing.

**Loading behavior detail:** `Button` renders `{loading && <Spinner size="sm" />}` then `{children}`. The "Get My Link" label will show beside the spinner unless children are omitted when loading. To match UI-SPEC (spinner only in loading), use: `<Button loading={isLoading}>{isLoading ? null : "Get My Link"}</Button>` or conditionally pass children.

---

## Toast System

[VERIFIED: src/components/ui/Toast.tsx]

**Import path:**
```typescript
import { useToast } from "@/components/ui/Toast";
```

**Call signature:**
```typescript
const { toast } = useToast();
toast({ type: "error", title: "Could not generate your link", description: "Please try again." });
```

**Types available:** `"success" | "error" | "warning" | "info"`

**Provider:** Already mounted in the app layout (confirmed by usage across 10+ components without re-wrapping). No additional wrapper needed.

**Error recovery pattern (from DealsClient):** Use `useRef` to hold a stable reference:
```typescript
const toastRef = useRef(toast);
toastRef.current = toast;
// In callbacks: toastRef.current({ type: "error", title: "..." });
```
This avoids stale closure issues when callbacks are memoized with `useCallback`.

---

## Spinner Primitive

[VERIFIED: src/components/ui/Spinner.tsx]

- **`motion-safe:animate-spin` is baked in** — the SVG already has `className="motion-safe:animate-spin text-ima-primary"`. CLAUDE.md Hard Rule 1 satisfied automatically.
- **Sizes:** `sm` (h-4 w-4), `md` (h-6 w-6, default), `lg` (h-8 w-8)
- **Accessibility:** Has `role="status"` on wrapper span and `<span className="sr-only">Loading</span>` — screen reader friendly.
- **SVG:** `aria-hidden="true"` on the SVG itself (sr-only span handles the label).
- **Button integration:** `Button`'s `loading` prop renders `<Spinner size="sm" />` automatically. **No manual `<Spinner>` needed inside the button** — just use `<Button loading={true}>`.

---

## Icon Set

[VERIFIED: node -e "require('lucide-react')" check confirming all four icons exist]

| Icon | Import Name | Use in ReferralCard | Size Convention |
|------|------------|---------------------|-----------------|
| Copy | `Copy` | Copy button (default state) | `h-4 w-4` |
| Check | `Check` | Copy button (copied state) | `h-4 w-4` |
| Share2 | `Share2` | Share button | `h-4 w-4` |

**Size convention:** `h-4 w-4` is the codebase standard for inline icons in buttons and list items (confirmed across DealsClient, student pages, CoachInvitesClient). Larger `h-5 w-5` is used for toast icons (not applicable here).

**Import pattern (codebase standard):**
```typescript
import { Copy, Check, Share2 } from "lucide-react";
```

All three are confirmed exported from lucide-react 0.576.0. [VERIFIED: runtime check]

**Existing `Copy` icon usage:** Both `OwnerInvitesClient` and `CoachInvitesClient` already use `Copy` from lucide-react with `h-4 w-4 aria-hidden="true"` — confirms this is the established pattern.

---

## Existing "Student Client Card" Reference Pattern

The closest reference pattern for ReferralCard is the combination of:

**1. DealsClient — ref-pinning for stable callbacks** [VERIFIED: src/components/student/DealsClient.tsx lines 57-66]
```typescript
const router = useRouter();
const routerRef = useRef(router);
routerRef.current = router;

const { toast } = useToast();
const toastRef = useRef(toast);
toastRef.current = toast;
```
ReferralCard does not need `routerRef` (no `router.refresh()` needed — component is self-contained), but `toastRef` pattern applies.

**2. OwnerInvitesClient / CoachInvitesClient — clipboard copy pattern** [VERIFIED: src/components/owner/OwnerInvitesClient.tsx lines 121-131]
```typescript
const handleCopy = useCallback(async () => {
  if (!lastUrl) return;
  try {
    await navigator.clipboard.writeText(lastUrl);
    toastRef.current({ type: "success", title: "Copied to clipboard!" });
  } catch (err) {
    console.error("[OwnerInvitesClient] clipboard error:", err);
    toastRef.current({ type: "error", title: "Copy failed — please copy the URL manually" });
  }
}, [lastUrl]);
```
ReferralCard differs: Copy button toggles visual state ("Copied!" text + Check icon) for 2 seconds via `setTimeout` + `useRef` cleanup rather than firing a success toast. The error path is the same (toast on clipboard failure).

**3. WorkTrackerClient — SSR-safe browser API detection** [VERIFIED: src/components/student/WorkTrackerClient.tsx lines 47-49]
```typescript
const [hasSeenCard, setHasSeenCard] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`ima-motivational-seen-${getToday()}`) === "1";
});
```
For `navigator.share`, the correct pattern is `useEffect` (not useState initializer), since `navigator.share` is not directly about initial render value but about conditional rendering after hydration:
```typescript
const [shareSupported, setShareSupported] = useState(false);
useEffect(() => {
  setShareSupported(typeof navigator !== "undefined" && typeof navigator.share === "function");
}, []);
```
This ensures Share button never renders during SSR (defaults to `false`), and appears on client only if supported.

**4. DealsClient — response.ok + error handling pattern** [VERIFIED: DealsClient lines 101-124]
```typescript
const res = await fetch("/api/deals", { method: "POST", ... });
if (!res.ok) {
  const err = await res.json().catch(() => ({ error: null }));
  toastRef.current({ type: "error", title: (err as { error?: string }).error || "Failed to add deal" });
} else {
  toastRef.current({ type: "success", title: "Deal added" });
}
// catch block:
} catch (err) {
  console.error("Failed to add deal:", err);
  toastRef.current({ type: "error", title: "Failed to add deal" });
}
```
ReferralCard's fetch pattern is simpler (no optimistic update, no router.refresh), but the `response.ok` gate + catch structure is identical.

---

## setTimeout Cleanup Pattern for "Copied!" Toggle

ReferralCard needs a 2-second "Copied!" state toggle with cleanup on unmount. The correct pattern:

```typescript
const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleCopy = useCallback(async () => {
  if (!shortUrl) return;
  try {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    console.error("[ReferralCard] clipboard error:", err);
    toastRef.current({ type: "error", title: "Copy failed — please copy the URL manually" });
  }
}, [shortUrl]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  };
}, []);
```

The `Toast.tsx` uses exactly this pattern for its own timer cleanup (`timersRef.current` Map), confirming it as the project standard. [VERIFIED: Toast.tsx lines 38-74]

---

## API Response Shape

[VERIFIED: src/app/api/referral-link/route.ts lines 61-66, 162]

```typescript
// Cache-hit response (API-02):
return NextResponse.json({ shortUrl: profile.referral_short_url, referralCode: profile.referral_code }, { status: 200 });

// New-link response (API-05):
return NextResponse.json({ shortUrl, referralCode }, { status: 200 });
```

**Shape:** `{ shortUrl: string, referralCode: string }`

**Important:** The `shortUrl` stored in DB already has the `https://` scheme prepended (line 126: `const shortUrl = \`https://${rbBody.shortUrl}\``). The component receives a fully-formed URL ready for display and clipboard.

**CSRF:** The route calls `verifyOrigin(request)` — a same-origin check. Client `fetch()` calls with `Content-Type: application/json` from the same app origin will pass automatically. No additional headers needed from the component beyond `Content-Type`.

**Request body:** The route accepts an empty body (schema is `z.object({}).strict()`). The component should POST with an empty JSON body or omit the body entirely. Sending `body: JSON.stringify({})` with `Content-Type: application/json` is safest.

---

## Component State Architecture

Recommended state shape (minimal, no over-engineering):

```typescript
type CardState = "initial" | "loading" | "ready" | "error";

const [cardState, setCardState] = useState<CardState>("initial");
const [shortUrl, setShortUrl] = useState<string | null>(null);
const [copied, setCopied] = useState(false);
const [shareSupported, setShareSupported] = useState(false);
```

The `error` state is transient — on error, component returns to `"initial"` (error message delivered via toast). No persistent error display needed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/student/
│   └── ReferralCard.tsx     # NEW — "use client", no props
├── app/(dashboard)/student/
│   └── page.tsx             # MODIFY — add <ReferralCard /> after line 357
└── app/(dashboard)/student_diy/
    └── page.tsx             # MODIFY — add <ReferralCard /> after line 225
```

### Pattern: Client Component in Server Page

Both dashboard pages are `async` server components. Rendering a `"use client"` component inside them is standard Next.js App Router pattern — no special handling needed. Server component imports the client component normally; the client component receives no props (self-contained).

```typescript
// In server page (student/page.tsx):
import { ReferralCard } from "@/components/student/ReferralCard";
// ...inside JSX:
<div className="mt-6">
  <ReferralCard />
</div>
```

### Anti-Patterns to Avoid
- **Reading `navigator.share` outside `useEffect`:** Will throw during SSR. Always gate behind `useEffect` + state.
- **Reading `navigator.clipboard` outside a click handler:** No issue in a click handler (user gesture), but do not call at render time.
- **Importing Button's `loading` without passing children:** The Button still renders `{children}` after the spinner. Pass empty/null children in loading state for spinner-only appearance, or accept the text+spinner combo (also valid).
- **Using `animate-spin` directly:** Must be `motion-safe:animate-spin`. Spinner.tsx already handles this, so no custom spin class is needed.
- **Using `gray-*` Tailwind classes:** All colors must use `ima-*` tokens. `text-gray-500` is a Hard Rule violation.
- **`import { z } from "zod/v4"`:** Must be `"zod"` per Hard Rule 7 and package.json (zod ^4.3.6 is still importable as `"zod"`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Button loading state | Custom spinner + disabled logic | `Button loading={true}` | Button primitive already handles spinner, aria-busy, disabled-opacity |
| Spinner animation | Custom SVG + CSS | `<Spinner size="sm" />` | motion-safe:animate-spin baked in, sr-only text, role="status" included |
| Toast on error | Custom error div | `useToast()` toast() | Project-wide toast system, already in DOM, auto-dismiss |
| Icon imports | SVG inlined | `lucide-react` Copy/Check/Share2 | Already installed, consistent sizing, tree-shaken |

---

## Common Pitfalls

### Pitfall 1: SSR Crash on `navigator.share`
**What goes wrong:** TypeError: `navigator is not defined` at render time in Next.js SSR.
**Why it happens:** `navigator` is a browser global; server render has no browser globals.
**How to avoid:** Default `shareSupported` state to `false`; set it only in `useEffect`. Never reference `navigator.share` outside an effect or event handler.
**Warning signs:** Build succeeds but page crashes on first server render or during `next build` static analysis.

### Pitfall 2: Text + Spinner Both Visible in Loading State
**What goes wrong:** `<Button loading={true}>Get My Link</Button>` shows spinner + "Get My Link" text side by side.
**Why it happens:** Button renders `{loading && <Spinner>}` then `{children}` — children are not suppressed.
**How to avoid:** Conditionally pass children: `<Button loading={isLoading}>{isLoading ? null : "Get My Link"}</Button>`.
**Warning signs:** LOADING state visually shows both spinner and label text.

### Pitfall 3: useCallback Stale Toast Reference
**What goes wrong:** Error toast fires with stale `toast` function reference after re-renders.
**Why it happens:** `useCallback` deps array captures initial `toast` value; context updates create a new function reference.
**How to avoid:** Use `toastRef` pattern from DealsClient: `const toastRef = useRef(toast); toastRef.current = toast;`
**Warning signs:** Toast stops appearing after first render cycle, or ESLint warns about missing deps.

### Pitfall 4: `setTimeout` Memory Leak on Unmount
**What goes wrong:** "Copied!" state update fires after component unmounts, causing React warning.
**Why it happens:** `setTimeout` callback references component state setter; component may unmount before 2s expires.
**How to avoid:** Store timer in `useRef`, clear in `useEffect` cleanup.
**Warning signs:** React "Can't perform a state update on an unmounted component" warning (React 18) or silent memory leak.

### Pitfall 5: CSRF Rejection on Fetch
**What goes wrong:** POST to `/api/referral-link` returns 403 from `verifyOrigin`.
**Why it happens:** `verifyOrigin` checks `Origin` header matches host. Fetch without `Content-Type: application/json` may trigger preflight behavior.
**How to avoid:** Always include `headers: { "Content-Type": "application/json" }` and send `body: JSON.stringify({})`.
**Warning signs:** API returns 403 with no auth error logged (the CSRF error is returned before auth check).

### Pitfall 6: Wrong Zod Import in Any Adjacent File
**What goes wrong:** `import { z } from "zod/v4"` causes TypeScript or runtime error.
**Why it happens:** zod v4 is in package.json as `"zod": "^4.3.6"` — the correct import is still `"zod"`, not `"zod/v4"`.
**How to avoid:** ReferralCard itself does not use Zod. If adding validation anywhere, use `import { z } from "zod"`.
**Warning signs:** `Module not found: Can't resolve 'zod/v4'` at build time.

---

## Code Examples

### ReferralCard Skeleton (verified against all primitives)
```typescript
// Source: verified against Button.tsx, Spinner.tsx, Toast.tsx, OwnerInvitesClient.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type CardState = "initial" | "loading" | "ready";

export function ReferralCard() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [cardState, setCardState] = useState<CardState>("initial");
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareSupported, setShareSupported] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShareSupported(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleGetLink = useCallback(async () => {
    setCardState("loading");
    try {
      const res = await fetch("/api/referral-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[ReferralCard]", err);
        toastRef.current({ type: "error", title: "Could not generate your link", description: "Please try again." });
        setCardState("initial");
        return;
      }
      const data = await res.json() as { shortUrl: string; referralCode: string };
      setShortUrl(data.shortUrl);
      setCardState("ready");
    } catch (err) {
      console.error("[ReferralCard]", err);
      toastRef.current({ type: "error", title: "Could not generate your link", description: "Please try again." });
      setCardState("initial");
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("[ReferralCard] clipboard error:", err);
      toastRef.current({ type: "error", title: "Copy failed — please copy the URL manually" });
    }
  }, [shortUrl]);

  const handleShare = useCallback(async () => {
    if (!shortUrl) return;
    try {
      await navigator.share({ url: shortUrl, title: "IMA Accelerator Referral" });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // user cancelled
      console.error("[ReferralCard] share error:", err);
      toastRef.current({ type: "error", title: "Share failed" });
    }
  }, [shortUrl]);

  return (
    <div className="bg-ima-surface border border-ima-border rounded-xl p-6">
      <h2 className="text-base font-semibold text-ima-text">Refer a Friend — Earn $500</h2>
      <p className="text-sm text-ima-text-secondary mt-1">
        Share your personal referral link with a friend and earn a $500 bonus when they join the IMA Accelerator program.
      </p>

      {cardState !== "ready" && (
        <Button
          variant="primary"
          size="md"
          className="w-full mt-4"
          aria-label="Get My Link"
          loading={cardState === "loading"}
          disabled={cardState === "loading"}
          onClick={handleGetLink}
        >
          {cardState === "loading" ? null : "Get My Link"}
        </Button>
      )}

      {cardState === "ready" && shortUrl && (
        <div className="flex items-center gap-2 mt-4 bg-ima-surface-light rounded-lg px-2 py-2">
          <span className="flex-1 text-sm text-ima-text truncate font-mono">{shortUrl}</span>
          <button
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-ima-surface-accent motion-safe:transition-colors"
            aria-label={copied ? "Copied to clipboard" : "Copy referral link"}
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-ima-success" aria-hidden="true" />
                <span className="ml-1 text-xs text-ima-success font-semibold">Copied!</span>
              </>
            ) : (
              <Copy className="h-4 w-4 text-ima-text-secondary" aria-hidden="true" />
            )}
          </button>
          {shareSupported && (
            <button
              className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-ima-surface-accent motion-safe:transition-colors"
              aria-label="Share referral link"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4 text-ima-text-secondary" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — project has no test framework installed (no jest, vitest, playwright, cypress in package.json) |
| Config file | None |
| Quick run command | `npm run lint && npx tsc --noEmit` |
| Full suite command | `npm run lint && npx tsc --noEmit && npm run build` |

No automated test runner exists in the project. [VERIFIED: package.json scripts — no `test` script; no jest/vitest/playwright devDependencies]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | `ReferralCard.tsx` exists with `"use client"` and no props | Static analysis | `npx tsc --noEmit` | Wave 0: create file |
| UI-02 | Initial state renders heading, description, "Get My Link" button | Visual/manual | Browser — check student dashboard | N/A |
| UI-03 | Loading state shows spinner (motion-safe) | Visual/manual | Browser — observe on click | N/A |
| UI-04 | Ready state: URL + Copy + Share toggle | Visual/manual | Browser — observe after link generates | N/A |
| UI-05 | ima-* tokens only; aria-hidden; aria-label | Code review + lint | `npm run lint` | Wave 0: lint config in place |
| UI-06 | `response.ok` before JSON; toast on error | Code review | `npx tsc --noEmit` (type safety) | Wave 0: create file |
| INT-01 | `<ReferralCard />` renders in student page | Build | `npm run build` | Wave 0: modify page.tsx |
| INT-02 | `<ReferralCard />` renders in student_diy page | Build | `npm run build` | Wave 0: modify page.tsx |
| CFG-02 | Full build gate | Build | `npm run lint && npx tsc --noEmit && npm run build` | Wave 0: full gate passes |

### Sampling Rate
- **Per task commit:** `npm run lint && npx tsc --noEmit`
- **Per wave merge:** `npm run lint && npx tsc --noEmit && npm run build`
- **Phase gate:** Full suite (`npm run lint && npx tsc --noEmit && npm run build`) green before verification

### Wave 0 Gaps
- [ ] `src/components/student/ReferralCard.tsx` — covers UI-01..06
- [ ] Integration edits to `student/page.tsx` and `student_diy/page.tsx` — covers INT-01, INT-02

*(No test files needed — project has no test framework; code-level verification via TypeScript + lint + build)*

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| lucide-react (Copy, Check, Share2) | UI-04, UI-05 | ✓ | 0.576.0 | — |
| `navigator.clipboard` | UI-04 copy | ✓ (browser) | Browser API | Toast error if fails |
| `navigator.share` | UI-04 share | Conditional | Browser API (mobile/Chrome) | Hidden when unavailable |
| `POST /api/referral-link` | UI-01, UI-06 | ✓ | Phase 59 live | — |
| Button, Spinner, useToast primitives | UI-02, UI-03, UI-06 | ✓ | In src/components/ui/ | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `navigator.share` — not available in all browsers (Firefox desktop, Safari varies); `shareSupported` flag gates the button, so graceful degradation is built in.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Auth handled by API route (Phase 59) |
| V3 Session Management | no | Session handled by proxy.ts + Supabase |
| V4 Access Control | no | Role gate in API route, not UI component |
| V5 Input Validation | no | No user input in this component; POST body is empty |
| V6 Cryptography | no | No crypto in UI component |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via shortUrl display | Tampering | React JSX auto-escapes; `shortUrl` is displayed in `{shortUrl}` binding, never `dangerouslySetInnerHTML` |
| CSRF on POST | Spoofing | `verifyOrigin()` in route handler; component sends same-origin fetch |
| Open redirect (navigator.share) | Tampering | `shortUrl` comes from server-controlled DB, not user input |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified or cited — no user confirmation needed.**

No [ASSUMED] tags in this document. All findings were verified directly from source files.

---

## Open Questions

None. All integration points, primitive shapes, API contracts, and error patterns are fully verified from source code.

---

## Sources

### Primary (HIGH confidence)
- `src/components/ui/Button.tsx` — loading prop, variants, sizes, icon slotting pattern
- `src/components/ui/Spinner.tsx` — motion-safe:animate-spin baked in, sizes
- `src/components/ui/Toast.tsx` — useToast() import path, call signature, provider assumption
- `src/app/(dashboard)/student/page.tsx` — exact line numbers for integration; card class patterns
- `src/app/(dashboard)/student_diy/page.tsx` — exact line numbers for integration
- `src/app/api/referral-link/route.ts` — API response shape `{ shortUrl, referralCode }`, CSRF check, empty body schema
- `src/components/student/DealsClient.tsx` — ref-pinning pattern, response.ok + catch pattern
- `src/components/owner/OwnerInvitesClient.tsx` — clipboard copy pattern with error toast
- `src/components/student/WorkTrackerClient.tsx` — SSR-safe browser API detection pattern
- `tailwind.config.ts` — complete ima-* token palette with hex values
- `package.json` — all dependencies, no test framework, Next.js 16.1.6, lucide-react 0.576.0, zod ^4.3.6
- `.planning/config.json` — nyquist_validation: true confirmed

### Secondary
- `src/components/coach/CoachInvitesClient.tsx` — corroborates Copy icon pattern
- `src/components/student/ReportForm.tsx` — corroborates useToast() destructure pattern

---

## Metadata

**Confidence breakdown:**
- Integration anchor (exact line numbers): HIGH — read from source files
- Button/Spinner/Toast primitive shape: HIGH — read from source files
- Icon availability (Copy, Check, Share2): HIGH — verified via runtime node check
- SSR-safe navigator pattern: HIGH — observed in WorkTrackerClient
- Clipboard copy pattern: HIGH — observed in OwnerInvitesClient/CoachInvitesClient
- API response shape: HIGH — read from route handler source
- No test framework: HIGH — verified package.json scripts and devDependencies

**Research date:** 2026-04-16
**Valid until:** Until primitives or page structure change (stable, ~30 days)
