# Phase 34: Report Comments - Research

**Researched:** 2026-04-03
**Domain:** Supabase upsert, Next.js App Router API route, React client component pattern
**Confidence:** HIGH

## Summary

Phase 34 is a focused, well-scoped feature with all its dependencies already in place. The database table (`report_comments`) and its RLS policies were created in Phase 30 (migration 00015). TypeScript types are already defined in `src/lib/types.ts`. The API pattern is a near-exact mirror of the existing `POST /api/reports/[id]/review/route.ts` — the only divergence is using Supabase `.upsert()` with `onConflict: 'report_id'` instead of a plain `.update()`.

There are three surfaces to build: (1) a shared `CommentForm` client component consumed by both `ReportRow.tsx` and `CalendarTab.tsx`; (2) a `CoachFeedbackCard` read-only component for the student history page; and (3) the new `POST /api/reports/[id]/comment/route.ts` API route. The coach/owner comment queries also need to include existing comments so the textarea pre-fills correctly. The student history page query needs a left join on `report_comments` so feedback cards render server-side.

**Primary recommendation:** Mirror the review route pattern exactly. Build the shared `CommentForm` component first, then wire it into the two coach surfaces, then build the student feedback card, then update the student history query to join comments.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Show the comment textarea on BOTH `/coach/reports` (inside expanded ReportRow `<details>`) AND CalendarTab on student detail. Same component, same behavior in both places.
- **D-02:** Owner sees the comment form on CalendarTab only (that's their only report access point).
- **D-03:** Show as a distinct card below the report on student's `/student/report/history` page. Light `ima-surface-accent` background, coach avatar (initials circle), coach name, timestamp, comment text. Visually distinct from the report itself but not overpowering. Read-only for students.
- **D-04:** Pre-fill the textarea with the existing comment if one exists. Seamless replace on submit — no confirmation modal. The coach can see they're editing because the textarea already has text in it.
- **D-05:** Identical to coach. Owner comments via CalendarTab textarea, same API endpoint, same upsert behavior. The API allows owner OR coach role.

### Claude's Discretion
- Exact textarea sizing and character counter UX
- Loading/saving state indicators on the comment form
- Empty state messaging details
- Initials circle color derivation for coach avatar

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMMENT-01 | Coach can submit a text comment (max 1000 chars) on any of their students' daily reports | Zod schema validates `z.string().min(1).max(1000)`. API ownership check mirrors review route. Supabase `.upsert()` with `onConflict: 'report_id'` handles create/update. |
| COMMENT-02 | Only one comment per report is allowed (upsert — resubmitting updates the existing comment) | `UNIQUE INDEX idx_report_comments_report_id ON report_comments(report_id)` already exists in 00015. Supabase upsert: `.upsert({ report_id, coach_id, comment }, { onConflict: 'report_id' })`. |
| COMMENT-03 | Student sees coach comment on their report history page as a read-only feedback card | Student history page server component queries `daily_reports` and joins `report_comments`. Coach name comes from a joined `users` table lookup. Feedback card is rendered server-side below each report card. |
| COMMENT-04 | Owner can also comment on any student's report | API role check: `profile.role !== 'coach' && profile.role !== 'owner'` returns 403. Owner ownership check: owner can comment on any report (no coach_id match needed), coach requires student.coach_id match. |
| COMMENT-05 | API returns 403 for student and student_diy roles attempting to comment | Enforced in the role check step of the API route before any DB access. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.99.2 (installed) | `.upsert()` with `onConflict` for single-row comment | Already installed; upsert is the idiomatic Supabase pattern for this use case |
| `zod` | Installed | Validate comment body: `z.string().min(1).max(1000)` | Project hard rule: `import { z } from "zod"`, Zod safeParse on all API inputs |
| `next` | 16.1.6 (installed) | App Router API route for `POST /api/reports/[id]/comment` | Project stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.576.0 (installed) | Icons in feedback card (e.g., `MessageSquare`) | Already installed; used throughout the codebase |
| `Textarea` UI primitive | Internal (`src/components/ui/Textarea.tsx`) | Accessible textarea with `label`, `error` props, min-h-[44px] baked in | Reuse — do not hand-roll a textarea |
| `Card`, `CardContent` | Internal | Comment form container and feedback card wrapper | Consistent with all other report cards in the codebase |
| `Button` | Internal | "Save" button on comment form | Consistent; has `loading` prop for saving state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side join for student history | Separate client fetch | Server-side join is simpler: one query, no loading state, consistent with existing history page pattern |
| Passing comment as prop to `ReportRow` | Fetching it client-side | Prop is simpler: comment data is already loaded with the report list on the server |

**Installation:** No new npm dependencies required.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/api/reports/[id]/
│   ├── review/route.ts      # existing — template to mirror
│   └── comment/route.ts     # NEW — POST upsert
├── components/
│   ├── coach/
│   │   ├── ReportRow.tsx    # MODIFY — add CommentForm below wins/improvements
│   │   └── CalendarTab.tsx  # MODIFY — add CommentForm below report detail panel
│   └── shared/
│       ├── CommentForm.tsx  # NEW — "use client" textarea + save button
│       └── CoachFeedbackCard.tsx  # NEW — read-only feedback card for student
└── app/(dashboard)/student/report/history/
    └── page.tsx             # MODIFY — join report_comments, render CoachFeedbackCard
```

### Pattern 1: Supabase Upsert with onConflict
**What:** Single INSERT that updates on unique constraint violation, guaranteeing max one row per report.
**When to use:** Any time the business rule is "one record per foreign key."
**Example:**
```typescript
// Source: Supabase docs + existing 00015 migration (UNIQUE INDEX idx_report_comments_report_id)
const { data, error } = await admin
  .from("report_comments")
  .upsert(
    { report_id: id, coach_id: profile.id, comment: parsed.data.comment },
    { onConflict: "report_id" }
  )
  .select()
  .single();
```

### Pattern 2: Two-Step Ownership Check (mirror of review route)
**What:** Fetch the report to confirm it exists, then verify the student belongs to the requesting coach. Owner skips the second check (can comment on any report).
**When to use:** Every API route that mutates data belonging to a specific coach's students.
**Example:**
```typescript
// Source: src/app/api/reports/[id]/review/route.ts — exact template
// Step 1: fetch report
const { data: report } = await admin
  .from("daily_reports")
  .select("id, student_id")
  .eq("id", id)
  .single();
if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

// Step 2: ownership check (coach only — owner skips this)
if (profile.role === "coach") {
  const { data: studentMatch } = await admin
    .from("users")
    .select("id")
    .eq("id", report.student_id)
    .eq("coach_id", profile.id)
    .single();
  if (!studentMatch) return NextResponse.json({ error: "Report not found" }, { status: 404 });
}
```

### Pattern 3: Server Component Left Join for Student History
**What:** Extend the existing `daily_reports` query to left-join `report_comments` (and the coach's name) so the feedback card data is available server-side.
**When to use:** When adding a related one-to-one record to an existing server component list query.
**Example:**
```typescript
// Source: Supabase select with foreign key join syntax
const { data: reports } = await admin
  .from("daily_reports")
  .select(`
    *,
    report_comments (
      id,
      comment,
      updated_at,
      coach:users!report_comments_coach_id_fkey ( name )
    )
  `)
  .eq("student_id", user.id)
  .order("date", { ascending: false })
  .limit(30);
```

### Pattern 4: Shared CommentForm Client Component
**What:** Single `"use client"` component that takes `reportId`, `initialComment` (string | null), and optionally the current user's id. Manages textarea value, char count, saving state, and calls `POST /api/reports/[id]/comment`.
**When to use:** Reused in both `ReportRow` (expanded section) and `CalendarTab` (after report data panel).
**Example shape:**
```typescript
// Source: project pattern — mirrors CoachReportsClient.tsx fetch + toast pattern
type CommentFormProps = {
  reportId: string;
  initialComment: string | null;
};
// Internal state: value (string), isSaving (boolean)
// On submit: fetch POST /api/reports/{reportId}/comment, toast on error/success
// Ref pattern: toastRef = useRef(toast) for stable callback deps
```

### Pattern 5: CalendarTab comment data threading
**What:** CalendarTab receives comments as a prop (Map<reportId, {comment, coachName, updatedAt}>), passes the relevant comment to `CommentForm` when a day is selected.
**When to use:** CalendarTab already receives `reports` and `sessions` as props from the server component; adding a `comments` prop follows the same channel.

### Anti-Patterns to Avoid
- **Passing coach profile info client-side for ownership:** The API must always perform ownership check server-side — never rely on client sending coach_id.
- **Using student role or student_diy role to call the comment API:** The API must reject these with 403 on the role check step, before any DB access.
- **Rolling a custom textarea:** `src/components/ui/Textarea.tsx` already satisfies all CLAUDE.md rules (min-h-[44px], aria-label via `label` prop, ima-* tokens). Use it.
- **Showing confirmation modal on re-save:** D-04 locks this as seamless replace — no confirmation dialog.
- **Duplicate comment rows:** Never use `.insert()` for this — always `.upsert()` with `onConflict: 'report_id'`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upsert with uniqueness | Custom "check if exists, then update or insert" two-query logic | Supabase `.upsert({ onConflict: 'report_id' })` | Race condition between check and insert; Supabase upsert is atomic via ON CONFLICT |
| Accessible textarea | Custom `<textarea>` element | `src/components/ui/Textarea.tsx` | Already has label, aria, error, min-h-[44px], ima-* tokens |
| CSRF protection | Custom header check | `verifyOrigin(request)` from `src/lib/csrf.ts` | Already handles all edge cases; project hard rule is to use it on all mutations |
| Rate limiting | Custom counter | `checkRateLimit(profile.id, endpoint)` from `src/lib/rate-limit.ts` | DB-backed, already used on every mutation route |

**Key insight:** Every infrastructure concern for this API route is already solved. The implementation is purely domain logic layered onto proven utilities.

## Common Pitfalls

### Pitfall 1: Owner Ownership Check Bypass
**What goes wrong:** The two-step ownership check from the review route checks `student.coach_id === profile.id`. For owners this will always fail because owners have no coach_id assignment.
**Why it happens:** Blindly copying the review route without reading the role condition.
**How to avoid:** The ownership check step must be conditional: run it only when `profile.role === 'coach'`. When `profile.role === 'owner'`, skip to the upsert immediately after confirming the report exists.
**Warning signs:** Owner gets 404 when trying to comment.

### Pitfall 2: CalendarTab Comment Data Staleness After Month Change
**What goes wrong:** CalendarTab fetches new month data from `/api/calendar` on month change, but that endpoint doesn't return comment data. After navigating months, comment pre-fill breaks.
**Why it happens:** The calendar API only returns sessions and reports, not report_comments.
**How to avoid:** Either (a) extend `/api/calendar` to include comment data in its response, OR (b) have `CommentForm` fetch its own initial comment from a GET endpoint when `reportId` changes. Option (a) is simpler and consistent with existing data threading.
**Warning signs:** Comment textarea is empty when it should be pre-filled after switching months in CalendarTab.

### Pitfall 3: ReportRow Type Missing comment Field
**What goes wrong:** `ReportItem` type in `CoachReportsClient.tsx` doesn't include the comment. The server-side query fetches it but TypeScript doesn't know about it, causing a silent property access error.
**Why it happens:** `ReportItem` is a custom type defined in the client component, not derived from the Database type.
**How to avoid:** Add `existingComment: { id: string; comment: string; updated_at: string } | null` to the `ReportItem` type and update the server-side query to include the join.
**Warning signs:** TypeScript error on `report.existingComment` in `ReportRow.tsx`, or pre-fill silently not working.

### Pitfall 4: Returning 403 vs 404 for Unauthorized Access
**What goes wrong:** Returning 403 when a coach tries to comment on another coach's student reveals that the report exists (report-ID probing). The review route correctly returns 404 for all ownership failures.
**Why it happens:** Instinct to return 403 for "forbidden", but that leaks information.
**How to avoid:** Match the review route exactly: ownership failure returns `{ error: "Report not found" }` with status 404.
**Warning signs:** Security review flags 403 on ownership failures.

### Pitfall 5: Student History Page Missing Coach Name
**What goes wrong:** The feedback card design (D-03) requires the coach's name for display. The `report_comments` table only stores `coach_id`.
**Why it happens:** Forgetting to join the `users` table when fetching comment data.
**How to avoid:** Use Supabase's foreign key join syntax in the server component query: `report_comments ( *, coach:users!report_comments_coach_id_fkey ( name ) )`.
**Warning signs:** Coach name shows as `undefined` or requires a second query per report.

## Code Examples

Verified patterns from project source:

### API Route Structure (from review route)
```typescript
// Source: src/app/api/reports/[id]/review/route.ts
// Order: CSRF -> Auth -> Admin client -> Role check -> Rate limit -> Parse body -> Zod -> Params -> Fetch report -> Ownership check -> Mutate
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("id, role").eq("auth_id", authUser.id).single();
  if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  // COMMENT-05: reject student and student_diy
  if (profile.role !== "coach" && profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // rate limit, body parse, zod, params, ownership check, upsert...
}
```

### Supabase Upsert
```typescript
// Source: Supabase JS v2 docs (confirmed available in @supabase/supabase-js ^2.99.2)
// COMMENT-02: onConflict ensures max one row per report_id
const { data, error } = await admin
  .from("report_comments")
  .upsert(
    { report_id: reportId, coach_id: profile.id, comment: parsed.data.comment },
    { onConflict: "report_id" }
  )
  .select()
  .single();
```

### CommentForm Component Shape
```typescript
// Source: project pattern from CoachReportsClient.tsx (useRef toast, fetch, response.ok check)
"use client";
import { useState, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

type CommentFormProps = { reportId: string; initialComment: string | null };

export function CommentForm({ reportId, initialComment }: CommentFormProps) {
  const [value, setValue] = useState(initialComment ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: value }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to save" });
        return;
      }
      toastRef.current({ type: "success", title: "Comment saved" });
    } catch {
      toastRef.current({ type: "error", title: "Network error" });
    } finally {
      setIsSaving(false);
    }
  }
  // render: Textarea (maxLength=1000, rows=3), char counter, Button loading={isSaving}
}
```

### Student History Query with Comment Join
```typescript
// Source: Supabase select with nested join; src/app/(dashboard)/student/report/history/page.tsx
const { data: reports } = await admin
  .from("daily_reports")
  .select(`
    *,
    report_comments (
      id,
      comment,
      updated_at,
      coach:users!report_comments_coach_id_fkey ( name )
    )
  `)
  .eq("student_id", user.id)
  .order("date", { ascending: false })
  .limit(30);
// report_comments is either null (no comment) or a single object (UNIQUE index = one row max)
// Supabase returns it as an array; use report.report_comments?.[0] to access
```

### CoachFeedbackCard (read-only, student view)
```typescript
// Source: design decision D-03 from CONTEXT.md
// ima-surface-accent background, initials circle, coach name, timestamp, comment text
function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export function CoachFeedbackCard({ comment, coachName, updatedAt }: {
  comment: string; coachName: string; updatedAt: string;
}) {
  // Card with bg-ima-surface-accent, initials circle, coachName, formatted updatedAt, comment text
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom insert-then-update logic | Supabase `.upsert()` with `onConflict` | Supabase JS v2 (already in use) | Single atomic DB call, no race conditions |

## Open Questions

1. **CalendarTab month-change comment data**
   - What we know: CalendarTab fetches `/api/calendar` on month change, which currently returns `{ sessions, reports }`.
   - What's unclear: Whether to extend `/api/calendar` to also return comments, or have `CommentForm` do a lazy fetch.
   - Recommendation: Extend `/api/calendar` response to include a `comments` map keyed by `report_id`. This keeps data threading consistent with the existing sessions/reports pattern and avoids a client-side fetch inside CommentForm.

2. **`report_comments` Supabase nested select return shape**
   - What we know: The UNIQUE index means at most one row per report_id. Supabase returns nested one-to-many as an array.
   - What's unclear: Whether Supabase returns a single object or array for a one-to-one foreign key relationship.
   - Recommendation: Treat it as `report_comments: { ... }[]` and access `[0]` defensively. The TypeScript type in `src/lib/types.ts` shows `isOneToOne: true` in Relationships, so Supabase may return a single object — verify at runtime with a test query and update the type access pattern accordingly.

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — all tools are already installed and in use).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed (no jest.config, no vitest.config, no test scripts in package.json) |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` (type-check as proxy for unit validation) |
| Full suite command | `npm run build && npm run lint && npx tsc --noEmit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMMENT-01 | Coach submits comment (max 1000 chars) | manual-only | Build passes; manual browser test | N/A |
| COMMENT-02 | Upsert — second submit replaces first, no duplicate rows | manual-only | Verify single row in DB after two submits | N/A |
| COMMENT-03 | Student sees read-only feedback card | manual-only | Manual browser test as student role | N/A |
| COMMENT-04 | Owner can comment via CalendarTab | manual-only | Manual browser test as owner role | N/A |
| COMMENT-05 | Student/student_diy POST returns 403 | manual-only | `curl -X POST /api/reports/{id}/comment` with student session | N/A |

**Justification for manual-only:** The project has no test framework installed (no jest, vitest, playwright, or test scripts in package.json). All previous phases have relied on `npm run build`, `npx tsc --noEmit`, and manual UAT for validation. This phase follows the same pattern.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` — confirm no TypeScript errors
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** Full build green + manual UAT checklist before `/gsd:verify-work`

### Wave 0 Gaps
None — no test framework exists in this project. All validation is build-time type checking + manual UAT. This is consistent with every prior phase.

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00015_v1_4_schema.sql` — `report_comments` table definition, UNIQUE index, RLS policies verified directly
- `src/app/api/reports/[id]/review/route.ts` — API template verified directly; exact ordering of CSRF/auth/role/rate-limit/parse/zod/ownership/mutate
- `src/lib/types.ts` — `report_comments` Row/Insert/Update types confirmed present
- `src/components/ui/Textarea.tsx` — confirmed existing, CLAUDE.md-compliant
- `src/components/coach/ReportRow.tsx` — confirmed `<details>` expansion structure; comment form slot identified
- `src/components/coach/CalendarTab.tsx` — confirmed report detail panel location; comment form slot identified
- `src/app/(dashboard)/student/report/history/page.tsx` — confirmed server component structure; join modification point identified

### Secondary (MEDIUM confidence)
- Supabase `.upsert()` with `onConflict` string parameter — consistent with Supabase JS v2 API; used in the project's own migration comments

### Tertiary (LOW confidence)
- Supabase nested select returning `isOneToOne: true` as single object vs array — needs runtime verification (flagged in Open Questions #2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as installed; no new dependencies
- Architecture: HIGH — all integration points verified by reading source files directly
- Pitfalls: HIGH — derived from reading actual source code and the existing review route pattern
- Upsert behavior: HIGH — UNIQUE index on report_id confirmed in migration; Supabase upsert docs are stable

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable ecosystem; no fast-moving dependencies)
