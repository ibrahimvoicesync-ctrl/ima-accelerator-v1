# Phase 5: Student Daily Reports & AI Chat - Research

**Researched:** 2026-03-16
**Domain:** React Hook Form, form UX patterns, iframe embeds, Supabase upsert
**Confidence:** HIGH

## Summary

Phase 5 is a high-confidence port phase. The reference-old codebase contains complete, V1-compatible implementations for every deliverable: the POST /api/reports route, ReportForm, ReportFormWrapper, AskIframe, and both page components. The primary work is (1) creating three missing V1 UI primitives (Input, Textarea, Card + StarRating), (2) porting all components with token adjustments, and (3) wiring the dashboard's placeholder Daily Report card to live data.

The daily_reports table is already in the V1 migration with the correct schema, unique constraint, and RLS policies. The config.ts already has DAILY_REPORT, VALIDATION, AI_CONFIG, and ROUTES fully defined. The past reports list is a server-component read — no separate GET API endpoint is needed.

**Primary recommendation:** Port from reference-old with import path corrections and token substitutions (replace `ima-surface-warm` → `ima-surface-light`, `ima-brand-gold` → `ima-warning`, `ima-warm-*` tokens with V1 equivalents); create four missing UI primitives (Input, Textarea, Card family, Skeleton) before touching the form components.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Report form UX:**
  - Clickable star rating: 5 star icons in a row, click to set, filled stars up to selection (same as reference-old StarRating component)
  - Students can update their report after submitting — form shows "Update Report" button and "Last submitted at" timestamp when a report already exists
  - Report page header: date card showing today's date + auto-filled hours tracked displayed prominently, plus a status banner (green "Report submitted" when done, amber "Not yet submitted" when pending)
  - Form uses react-hook-form for validation UX, field-level errors, and less re-renders
  - Hours worked displayed as read-only at top of form (auto-filled from completed work sessions)
  - Form fields in order: hours worked (read-only), star rating, outreach count, wins (optional textarea with char counter), improvements (optional textarea with char counter)
- **Dashboard report card:**
  - Replace current placeholder with live data card showing submission status
  - Adaptive CTA: "Submit Report" if not submitted today, "Update Report" if already submitted
  - Visual status indicator: green checkmark badge when submitted, amber dot when pending
  - Show deadline reminder: "Due by 11 PM" text under status
  - Dashboard card fetches today's daily_reports data server-side

### Claude's Discretion
- Past reports page layout and information density (not discussed — use clean list with date, rating, hours)
- AI chat page implementation (follow reference-old pattern: AskIframe with Coming Soon fallback when no URL, skeleton loader while iframe loads)
- Report form styling details (spacing, card variants, animation delays)
- Loading skeleton design for report page
- Toast messages for submit/update success and errors
- StarRating component implementation details (hover states, accessibility)
- Input and Textarea component creation (V1 needs these — reference-old has them)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPT-01 | Student can submit daily report (hours, star rating 1-5, outreach count, wins, improvements) | reference-old ReportForm + POST /api/reports fully implements this; upsert pattern handles both insert and update |
| REPT-02 | Hours auto-fill from completed work sessions | Server component queries work_sessions WHERE status='completed' AND date=today, sums duration_minutes, passes autoMinutes to form as read-only display |
| REPT-03 | Student can view their own past reports | Server component reads daily_reports ordered by date DESC; no GET API needed — server-side fetch is sufficient |
| AICHAT-01 | Student can access Ask Abu Lahya via iframe embed | AskIframe component with AI_CONFIG.iframeUrl guard; Coming Soon EmptyState when URL is empty (current state); full iframe with skeleton loader when URL exists |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.x (already installed) | Form state, validation, field-level errors, minimal re-renders | Project standard; used in reference-old ReportForm; avoids re-render on every keystroke |
| zod | ^3.x (already installed) | Schema validation on API input | Project hard rule: `import { z } from "zod"`, never `"zod/v4"` |
| @supabase/supabase-js | already installed | Admin client upsert to daily_reports | All server queries use createAdminClient() |
| lucide-react | already installed | Star, Calendar, Clock, CheckCircle, FileText, Bot icons | All icons are lucide in this project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | already installed | Card variants (default, warm, bordered-left) | Card component uses CVA for variant props |
| clsx + tailwind-merge | already installed | cn() utility for conditional classes | Already in src/lib/utils.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hook-form | Controlled state (useState) | RHF gives field-level errors, less re-renders, better UX at zero extra cost — already project standard |
| Server-side fetch for past reports | GET /api/reports | API adds latency + boilerplate; direct server component fetch is faster and simpler for read-only list |

**Installation:**
All dependencies are already installed. No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dashboard)/student/
│   ├── page.tsx                    # MODIFY: add daily_reports query + live report card
│   ├── report/
│   │   ├── page.tsx                # NEW: server component — fetch report + sessions, render layout
│   │   ├── history/
│   │   │   └── page.tsx            # NEW: server component — list all student reports
│   │   └── loading.tsx             # NEW: skeleton for report page
│   └── ask/
│       └── page.tsx                # NEW: server component — Coming Soon or AskIframe
├── app/api/reports/
│   └── route.ts                    # NEW: POST handler (upsert — insert or update)
├── components/
│   ├── ui/
│   │   ├── Input.tsx               # NEW: forwardRef input with label + error
│   │   ├── Textarea.tsx            # NEW: forwardRef textarea with label + error
│   │   ├── Card.tsx                # NEW: CVA card + CardHeader + CardContent + CardTitle etc.
│   │   ├── Skeleton.tsx            # NEW: Skeleton + SkeletonCard components
│   │   └── index.ts                # UPDATE: export Input, Textarea, Card family, Skeleton
│   └── student/
│       ├── ReportForm.tsx          # NEW: "use client" — react-hook-form, StarRating, submit/update
│       ├── ReportFormWrapper.tsx   # NEW: "use client" — thin wrapper providing router.refresh() onSuccess
│       ├── StarRating.tsx          # NEW: "use client" — accessible radiogroup, hover states, keyboard nav
│       └── AskIframe.tsx           # NEW: "use client" — iframe with skeleton loader + Coming Soon fallback
```

### Pattern 1: Server Component Page with Client Island Form
**What:** Page is an async server component that fetches data and passes it as props to a client island. The island (ReportFormWrapper) owns the interactivity and calls router.refresh() on success so the server component re-renders with fresh data.
**When to use:** Any page that shows server data AND has a mutation form — separates concerns cleanly.
**Example:**
```typescript
// src/app/(dashboard)/student/report/page.tsx
export default async function DailyReportPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();
  const today = getToday();

  const [reportResult, sessionsResult] = await Promise.all([
    admin.from("daily_reports").select("*").eq("student_id", user.id).eq("date", today).maybeSingle(),
    admin.from("work_sessions").select("duration_minutes").eq("student_id", user.id).eq("date", today).eq("status", "completed"),
  ]);

  const autoMinutes = (sessionsResult.data ?? []).reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

  return (
    // ... layout ...
    <ReportFormWrapper date={today} existingReport={reportResult.data} autoMinutes={autoMinutes} />
  );
}
```

### Pattern 2: Upsert Logic (insert or update)
**What:** POST handler checks for an existing report for the same student_id + date. If found, updates it; if not, inserts. Uses the unique constraint `idx_daily_reports_student_date` as a natural conflict key.
**When to use:** Any "one record per day per student" operation.
**Example:**
```typescript
// src/app/api/reports/route.ts
const { data: existing } = await admin
  .from("daily_reports")
  .select("id")
  .eq("student_id", profile.id)
  .eq("date", date)
  .maybeSingle();

if (existing) {
  // UPDATE path: returns 200
} else {
  // INSERT path: returns 201
}
```

### Pattern 3: StarRating as Controlled radiogroup
**What:** StarRating manages its own hover state via useState, but the selected value is controlled by parent (value/onChange props). Uses role="radiogroup" + role="radio" for accessibility. Keyboard navigation with ArrowRight/ArrowLeft. Each button has min-h-[44px] min-w-[44px].
**When to use:** Any click-to-select rating UI.

### Pattern 4: Adaptive Dashboard Card
**What:** Dashboard server component fetches today's daily_reports record. Based on whether submitted_at is present, the CTA changes label and the status indicator switches between green checkmark (submitted) and amber dot (pending).
**When to use:** Continues the Phase 3/4 pattern of context-aware dashboard cards.

### Anti-Patterns to Avoid
- **Creating a GET /api/reports route for the past reports list:** The past reports page is a server component — fetch directly from Supabase admin client in the page. No API route needed for reads.
- **Using Supabase client (not admin) in the POST handler:** All API route `.from()` queries must use createAdminClient(), not the user-facing supabase client.
- **Relying on RLS alone in API routes:** Always filter by `student_id = profile.id` explicitly, even though RLS also enforces it.
- **Using ima-surface-warm or ima-brand-gold tokens:** These are reference-old tokens cut from V1. V1 tokens are: ima-surface-light, ima-warning (for gold/amber), ima-surface-accent (for light blue tints). See tailwind.config.ts for the full V1 token list.
- **Importing Card from reference-old without creating V1 version:** Card is not yet in src/components/ui/. It must be created before ReportForm can be ported.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state + field validation | Custom useState per field | react-hook-form register + formState.errors | Handles dirty state, touched, field-level messages, less re-renders |
| Date validation | Custom regex | isValidDateString from src/lib/utils.ts | Already exists, used in reference-old API |
| Hours formatting | Custom inline | formatHours() from src/lib/utils.ts | Already exists: 90 mins -> "1.5h" |
| Today's date string | new Date().toISOString() inline | getToday() from src/lib/utils.ts | Already exists, returns YYYY-MM-DD in local time |
| Role auth check | Manual getUser() + profile lookup in every page | requireRole("student") from src/lib/session.ts | Established pattern, handles redirect on mismatch |
| Toast notifications | Custom alert state | useToast() from src/components/ui/Toast | Already exists, used in Phase 3/4 client components |
| Textarea char count | Custom watcher | watch("wins") from react-hook-form | RHF watch gives reactive value for counter display |

**Key insight:** Every utility needed for this phase is already written. The work is assembly and porting, not invention.

---

## Common Pitfalls

### Pitfall 1: Token Mismatch — reference-old tokens vs V1 tokens
**What goes wrong:** Reference-old uses `ima-surface-warm`, `ima-border-warm`, `ima-brand-gold`, `ima-warm-50`, `ima-warm-100` — none of these exist in V1's tailwind.config.ts. Using them silently produces no styling.
**Why it happens:** Reference-old had an extended token set; V1 was deliberately trimmed to 17 ima-* tokens only.
**How to avoid:** Before porting any component, check tailwind.config.ts. V1 token substitutions:
- `ima-surface-warm` → `ima-surface-light`
- `ima-border-warm` → `ima-border`
- `ima-brand-gold` → `ima-warning`
- `ima-warm-50` / `ima-warm-100` → `ima-surface-light` or `ima-bg`
- `shadow-warm` → `shadow-sm`
**Warning signs:** A component looks unstyled despite having class names.

### Pitfall 2: Card Variants — reference-old uses "warm" and "bordered-left"
**What goes wrong:** The report page uses `<Card variant="warm">` and `<Card variant="bordered-left">`. These variants exist in reference-old Card.tsx but will NOT exist in V1 until Card is created. Additionally, `bordered-left` in reference-old uses `ima-brand-gold` which must be substituted.
**Why it happens:** Card is one of four primitives not yet in V1's src/components/ui/.
**How to avoid:** Plan 05-01 or 05-02 must create Card.tsx (with CVA variants adjusted for V1 tokens) before the report page and form can be implemented.

### Pitfall 3: StarRating is Outside react-hook-form register
**What goes wrong:** StarRating is a custom component not registered with RHF. The star_rating value is tracked via separate useState. If the developer tries to use register("star_rating") with StarRating, it won't work because the Star buttons use onClick not a standard input event.
**Why it happens:** Custom interactive components can't use register() directly.
**How to avoid:** Keep starRating as a separate useState as in reference-old, validate manually before submit (if (starRating < 1) { toast error; return; }). Do not attempt to connect StarRating to react-hook-form via Controller — it adds complexity without benefit here.

### Pitfall 4: hours_worked Decimal Precision
**What goes wrong:** The daily_reports schema stores hours_worked as decimal(4,2). Sending a value like 1.5000000001 from JavaScript float arithmetic will fail or lose precision.
**Why it happens:** Converting minutes to hours via floating point.
**How to avoid:** Use the reference-old rounding pattern: `Math.round((autoMinutes / 60) * 100) / 100` before sending to the API. This rounds to 2 decimal places.

### Pitfall 5: Missing GET Route Assumption
**What goes wrong:** Developer creates a GET /api/reports route thinking it's needed for the past reports history page.
**Why it happens:** Natural assumption — if there's a POST, there should be a GET.
**How to avoid:** Past reports page is a server component. Fetch directly with createAdminClient() inside the async page function. No API route needed.

### Pitfall 6: iframe Sandbox Attributes
**What goes wrong:** Iframe for AI chat doesn't load content, or specific features (forms, scripts) are blocked.
**Why it happens:** Restrictive `sandbox` attribute.
**How to avoid:** Use the same sandbox string as reference-old: `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`. Also include `allow="microphone"` for voice-capable AI assistants.

### Pitfall 7: Dashboard card missing daily_reports query
**What goes wrong:** Dashboard still shows the placeholder "Submit Report" static link from Phase 3 after Phase 5 is complete.
**Why it happens:** The dashboard query in student/page.tsx currently only fetches work_sessions and roadmap_progress. The daily_reports fetch must be added to the Promise.all() in that file.
**How to avoid:** Plan 05-02 (or 05-03) must explicitly modify src/app/(dashboard)/student/page.tsx to add the daily_reports query.

---

## Code Examples

Verified patterns from reference-old (all imports adjusted to V1 paths):

### API Route: POST with upsert
```typescript
// src/app/api/reports/route.ts
// Source: reference-old/src/app/api/reports/route.ts (V1 import paths)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VALIDATION } from "@/lib/config";
import { isValidDateString } from "@/lib/utils";

const postSchema = z.object({
  date: z.string().refine(isValidDateString, "Invalid date format (YYYY-MM-DD)"),
  hours_worked: z.number().min(0).max(24),
  star_rating: z.number().int().min(VALIDATION.starRating.min).max(VALIDATION.starRating.max),
  outreach_count: z.number().int().min(VALIDATION.outreachCount.min).max(VALIDATION.outreachCount.max),
  wins: z.string().max(VALIDATION.reportWins.max).optional(),
  improvements: z.string().max(VALIDATION.reportImprovements.max).optional(),
});
// Auth check → role check → JSON parse → safeParse → check existing → update or insert
```

### UI Primitive: Input (forwardRef)
```typescript
// src/components/ui/Input.tsx
// Source: reference-old/src/components/ui/Input.tsx (V1-ready, no token changes needed)
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
// forwardRef with autoId, aria-invalid, aria-describedby, h-11 for 44px touch target
// Error renders as role="alert" paragraph
```

### UI Primitive: Card with CVA
```typescript
// src/components/ui/Card.tsx
// Source: reference-old/src/components/ui/Card.tsx
// V1 TOKEN CHANGES:
//   warm: "bg-ima-surface-light border border-ima-border shadow-sm"  (was ima-surface-warm)
//   bordered-left: "... border-l-ima-primary ..."                     (was ima-brand-gold)
//   hero variant: DROP entirely (uses ima-warm-* tokens not in V1)
```

### StarRating Component
```typescript
// src/components/student/StarRating.tsx
// Source: reference-old/src/components/student/StarRating.tsx
// V1-ready as-is — uses ima-warning (valid V1 token) and ima-text-muted (valid)
// All star buttons have min-h-[44px] min-w-[44px] — satisfies touch target rule
// role="radiogroup" + role="radio" + aria-checked — satisfies accessibility rule
// Keyboard: ArrowRight/ArrowLeft for navigation
```

### AskIframe Component
```typescript
// src/components/student/AskIframe.tsx
// Source: reference-old/src/components/student/AskIframe.tsx
// V1 TOKEN CHANGE: ima-surface-warm -> ima-surface-light
// Depends on Skeleton component (must be created first)
// Empty state when AI_CONFIG.iframeUrl === "" (current V1 state)
// onLoad callback hides skeleton once iframe is ready
```

### Dashboard daily_reports Query Addition
```typescript
// src/app/(dashboard)/student/page.tsx — MODIFICATION
// Add to the existing Promise.all():
admin
  .from("daily_reports")
  .select("submitted_at")
  .eq("student_id", user.id)
  .eq("date", today)
  .maybeSingle()
// Derive: const todayReport = reportResult.data;
// Adaptive CTA: todayReport?.submitted_at ? "Update Report" : "Submit Report"
// Status badge: green checkmark (submitted) or amber dot (pending)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GET endpoint for report list | Server component direct fetch | Phase 3 pattern established | Faster, less code, no extra round-trip |
| Controlled state per field | react-hook-form register | Adopted in reference-old | Less re-renders, better error UX |
| localStorage for form draft | Server upsert (update existing) | Context decision | Students can re-open form and update — no draft state needed |

**Deprecated/outdated:**
- `ima-surface-warm`, `ima-brand-gold`, `ima-warm-*` tokens: Cut from V1. Replaced with V1 equivalents documented in Pitfall 1 above.
- `getSessionUser("student")` (reference-old signature): V1 uses `requireRole("student")` from `@/lib/session` — different function name and import path.

---

## Open Questions

1. **Past reports history route location**
   - What we know: CONTEXT.md says "past reports list". Plans mention `src/app/(dashboard)/student/report/history/` as a possible path.
   - What's unclear: Should history be at `/student/report/history` (nested under report) or a separate route like `/student/reports`? The nav only shows "Daily Report" pointing to `/student/report`.
   - Recommendation: Place at `/student/report/history` — accessible via "View Past Reports" link from the report page. No nav entry needed; the report page links to it.

2. **Card "bordered-left" left border color for status banners**
   - What we know: Reference-old uses `border-l-ima-success` and `border-l-ima-warning` as overrides on the Card component. Both ima-success and ima-warning exist in V1 tailwind.config.ts.
   - What's unclear: The CVA bordered-left variant in reference-old defaults to `ima-brand-gold`. In V1 the default will be different.
   - Recommendation: Create bordered-left variant with `border-l-ima-primary` as default, then use className override `border-l-ima-success` / `border-l-ima-warning` in the page — same pattern reference-old uses.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config.*, vitest.config.*, or test directories in V1 |
| Config file | None — Wave 0 gap |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPT-01 | POST /api/reports inserts new report, returns 201 | integration | N/A — Wave 0 gap | ❌ Wave 0 |
| REPT-01 | POST /api/reports updates existing report (upsert), returns 200 | integration | N/A — Wave 0 gap | ❌ Wave 0 |
| REPT-01 | POST /api/reports rejects unauthenticated requests with 401 | integration | N/A — Wave 0 gap | ❌ Wave 0 |
| REPT-01 | POST /api/reports rejects non-student role with 403 | integration | N/A — Wave 0 gap | ❌ Wave 0 |
| REPT-01 | POST /api/reports validates star_rating range (1-5) | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| REPT-02 | autoMinutes computed as sum of completed session duration_minutes | unit | N/A — Wave 0 gap | ❌ Wave 0 |
| REPT-03 | Past reports page renders list ordered by date DESC | manual-only | Visual inspection — no e2e framework | N/A |
| AICHAT-01 | AskIframe renders Coming Soon when iframeUrl is empty | unit | N/A — Wave 0 gap | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Visual review — `npm run build && npx tsc --noEmit && npm run lint`
- **Per wave merge:** Full build + type check + lint (same as per-task, no test runner yet)
- **Phase gate:** Build passes, type check clean, lint clean, manual smoke test of report submit flow

### Wave 0 Gaps
- [ ] No test framework installed — if testing is required, install vitest + @testing-library/react
- [ ] No test files exist for any V1 feature
- [ ] Functional verification for this phase relies on manual testing + build/lint/typecheck

*(Note: The project has no test infrastructure. Validation for Phase 5 is build-time (tsc --noEmit, eslint) plus manual browser smoke test of the report submit/update flow.)*

---

## Sources

### Primary (HIGH confidence)
- `reference-old/src/app/api/reports/route.ts` — Complete POST API with upsert logic, verified V1-compatible import paths
- `reference-old/src/components/student/ReportForm.tsx` — Complete form with RHF, StarRating, char counters
- `reference-old/src/components/student/StarRating.tsx` — Accessible radiogroup implementation
- `reference-old/src/components/student/AskIframe.tsx` — Iframe with skeleton + empty state
- `reference-old/src/app/(dashboard)/student/report/page.tsx` — Full page layout with date card, status banners
- `reference-old/src/app/(dashboard)/student/ask/page.tsx` — AI chat page pattern
- `src/lib/config.ts` — Confirmed DAILY_REPORT, VALIDATION, AI_CONFIG, ROUTES all defined
- `src/lib/types.ts` — Confirmed daily_reports Row type with all required fields
- `supabase/migrations/00001_create_tables.sql` — Confirmed daily_reports table schema, unique constraint, RLS policies
- `tailwind.config.ts` — Confirmed V1 token list (17 tokens), identified missing tokens from reference-old

### Secondary (MEDIUM confidence)
- `src/app/(dashboard)/student/page.tsx` — Confirmed dashboard placeholder card location and current query pattern
- `src/components/ui/index.ts` — Confirmed missing: Input, Textarea, Card, Skeleton not yet exported

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, verified in package.json via existing phase usage
- Architecture: HIGH — direct port from reference-old with known, small token substitutions
- Pitfalls: HIGH — all identified from direct code inspection of both codebases
- Token gaps: HIGH — verified by comparing reference-old component tokens against tailwind.config.ts token list

**Research date:** 2026-03-16
**Valid until:** Stable — no external dependencies changing; valid until V1 is shipped
