# Phase 7: Coach Report Review, Invites & Analytics - Research

**Researched:** 2026-03-17
**Domain:** Coach workflow pages — report review inbox, invite generation, cohort analytics (all stat-card only, no charts)
**Confidence:** HIGH

---

## Summary

Phase 7 completes the coach experience by adding three new pages (`/coach/reports`, `/coach/invites`, `/coach/analytics`) and two new API routes (`PATCH /api/reports/[id]/review`, `POST /api/invites`, `POST /api/magic-links`). The codebase already contains a near-complete reference implementation in `reference-old/` that matches the V1 schema exactly, and Phase 6 established the visual DNA (stat cards, admin client pattern, `requireRole`, coach_id filtering) this phase inherits.

The primary complexity areas are: (1) the PATCH review route must support toggling (un-review as well as mark-reviewed, per CONTEXT.md decisions), whereas the reference-old implementation is one-directional mark-only; (2) the sidebar badge for "Reports" currently renders a placeholder string and must be wired to a real unreviewed count — the layout does not yet accept badge data so the approach (server-fetched prop in layout or client-side query from Sidebar) must be resolved; (3) the invites page combines both the `invites` and `magic_links` tables in one view, requiring two parallel queries and two separate API routes.

The analytics page is deliberately simple: stat cards only, no charting library, last-7-days window scoped identically to the report inbox. All four stat cards are computable from a single Supabase query joining daily_reports and users for the coach's cohort.

**Primary recommendation:** Port the reference-old implementations directly, adapting for the three V1-specific differences (toggle vs one-way review, no email/Resend dependency in V1, sidebar badge wiring).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Report inbox layout**
- List-based layout with filter tabs: Unreviewed / Reviewed / All
- Filter by student dropdown
- Each row shows: student name, date, star rating (visual stars), hours worked, outreach count
- Rows are expandable — click to reveal wins/improvements text
- Compact by default, drill-in for detail
- Stat cards at top: Total Reports, Pending count, Reviewed count, Avg Hours

**Mark-as-reviewed interaction**
- Single-click inline "Mark Reviewed" button on each report row — no confirmation modal
- Instant toggle: shows green checkmark + "Reviewed" label after click
- Coach can un-review if needed (toggle back)
- Uses PATCH API that sets reviewed_by = coach.id and reviewed_at = now()
- DB trigger `restrict_coach_report_update()` already enforces that coaches can only change review fields

**Report inbox scope**
- Last 7 days only, matching COACH_CONFIG.reportInboxDays = 7
- No date range picker
- Coach can already see full report history on individual student detail pages (Phase 6)

**Invite flow**
- Claude's Discretion — coach generates student invite link (72-hour expiry) from /coach/invites page
- Reference-old implementation has invite code + magic link generation, stat cards, and invite history
- INVITE_CONFIG already defines: codeExpiryHours: 72, coach can invite "student" role only
- Invites table has: email, role, invited_by, coach_id, code, used, expires_at

**Analytics dashboard**
- Simple stat cards only — no charts, no charting library
- Key metrics: Report Submission Rate (%), Avg Star Rating, Avg Hours/Day, Avg Outreach Count
- Student breakdown card: active count, at-risk count, inactive count, new count
- Time period: last 7 days, consistent with report inbox scope
- No date range picker or time period selector in V1

### Claude's Discretion
- Invite page layout, form fields, and copy-to-clipboard UX (adapt from reference-old)
- Invite history display (list of sent invites with status)
- Magic link generation UI (if included alongside invite codes)
- Stat card icons and styling (follow Phase 6 stat card pattern)
- Empty states for all 3 pages
- How sidebar badge count for "Reports" is wired (unreviewed count)
- Pagination on report inbox if needed
- Loading states

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COACH-04 | Coach can review/acknowledge submitted reports | PATCH /api/reports/[id]/review with toggle support; report inbox page scoped to last 7 days with filter tabs; DB trigger enforces coach can only modify reviewed_by and reviewed_at |
| COACH-05 | Coach can invite new students | POST /api/invites (email + code) and POST /api/magic-links (shareable link); INVITE_CONFIG.codeExpiryHours = 72; RLS coach_insert_invites restricts role to "student" and invited_by to self |
| COACH-06 | Coach sees basic analytics (report submission rates, student activity) | Analytics page with 4 stat cards computed from daily_reports + users queries; no charting library; last 7 days; student breakdown by activity category |
</phase_requirements>

---

## Standard Stack

### Core (already installed in V1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16 | Server components, route handlers | Locked project stack |
| Supabase JS | project-version | Admin client for all server queries | Established in every prior phase |
| Zod | project-version | API input validation | Hard rule: `import { z } from "zod"` |
| React | 19 | Client components for interactive review/invite forms | Locked project stack |
| Tailwind CSS 4 | project-version | All styling via ima-* tokens | Hard rule: no hardcoded hex |
| class-variance-authority | project-version | CVA-based UI primitives | Used in all existing UI components |

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | project-version | Icons for stat cards and action buttons | All icon needs |
| clsx + tailwind-merge | project-version | cn() utility for conditional classes | All className composition |

### No New Dependencies Required

All functionality is achievable with existing installed packages. The reference-old analytics client uses charting libraries (`TrendChart`, `KpiCard` from `@/components/analytics`) and a `FEATURES` flag — these are NOT in V1. V1 analytics is stat-cards only, no new package needed.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (dashboard)/coach/
│   │   ├── reports/page.tsx           # NEW — report inbox server component
│   │   ├── invites/page.tsx           # NEW — invite page server component
│   │   └── analytics/page.tsx         # NEW — analytics server component
│   └── api/
│       ├── reports/[id]/review/
│   │   │   └── route.ts               # NEW — PATCH mark/unmark reviewed
│       ├── invites/
│   │   │   └── route.ts               # NEW — POST create email invite
│       └── magic-links/
│           └── route.ts               # NEW — POST create magic link
└── components/coach/
    ├── CoachReportsClient.tsx          # NEW — filter tabs, report rows, review toggle
    ├── ReportRow.tsx                   # NEW — expandable single report row
    └── CoachInvitesClient.tsx          # NEW — tabbed invite form + history
```

### Pattern 1: Server Component Page with Parallel Data Fetch

All three new pages follow the established Phase 6 pattern exactly:

```typescript
// Source: established in src/app/(dashboard)/coach/page.tsx
export default async function CoachReportsPage({ searchParams }: Props) {
  const user = await requireRole("coach");   // auth + role guard
  const admin = createAdminClient();          // admin client, never supabase client
  const sp = await searchParams;

  // Parallel fetch — no waterfall
  const [studentsResult, reportsResult] = await Promise.all([
    admin.from("users").select("id, name").eq("role", "student").eq("coach_id", user.id).eq("status", "active"),
    admin.from("daily_reports").select("...").in("student_id", studentIds).gte("date", sevenDaysAgo),
  ]);

  // Error logging, never silently swallowed
  if (studentsResult.error) console.error("[coach/reports]", studentsResult.error);

  return <CoachReportsClient ... />;
}
```

**Confidence:** HIGH — direct match with Phase 6 implementation.

### Pattern 2: PATCH API Route for Review Toggle

The CONTEXT.md decision specifies coaches can un-review, which diverges from the reference-old one-way implementation. The route must support toggle:

```typescript
// Source: reference-old/src/app/api/reports/[id]/review/route.ts (adapted for toggle)
// Schema: z.object({ reviewed: z.boolean() }) — not z.literal(true)
// If reviewed=true:  set reviewed_by=profile.id, reviewed_at=now()
// If reviewed=false: set reviewed_by=null, reviewed_at=null

const reviewSchema = z.object({
  reviewed: z.boolean(),
});

// Security: verify student belongs to this coach before update
const { data: student } = await admin
  .from("users")
  .select("id")
  .eq("id", report.student_id)
  .eq("coach_id", profile.id)  // defense-in-depth beyond RLS
  .single();
```

**Confidence:** HIGH — DB trigger `restrict_coach_report_update()` already enforces field restrictions. RLS `coach_update_reports` scopes to coach's students. Admin client correctly bypasses RLS initplan issues.

### Pattern 3: Server-Driven Filter State via searchParams

The reference-old `CoachReportsClient` uses `router.push()` with URL search params for filter state — no React state for filter selection. This is the correct Next.js App Router pattern (server renders filtered data, client handles interactions):

```typescript
// Source: reference-old/src/components/coach/CoachReportsClient.tsx
function buildUrl(params: { reviewed?: string; student_id?: string }) {
  const sp = new URLSearchParams();
  if (params.reviewed !== "all") sp.set("reviewed", params.reviewed);
  if (params.student_id) sp.set("student_id", params.student_id);
  return sp.toString() ? `?${sp}` : "?";
}
// Filter button: router.push(buildUrl({ reviewed: "false" }))
```

**Confidence:** HIGH — confirmed in reference-old and consistent with Next.js App Router pattern used in Phase 6.

### Pattern 4: Inline Review Toggle with Optimistic Update

Per CONTEXT.md decision (instant toggle, no reload):

```typescript
// In CoachReportsClient — optimistic state update while API call is in-flight
const [reports, setReports] = useState(initialReports);

async function handleToggleReview(reportId: string, currentlyReviewed: boolean) {
  setReviewingId(reportId);
  try {
    const res = await fetch(`/api/reports/${reportId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed: !currentlyReviewed }),
    });
    if (!res.ok) {
      const json = await res.json();
      toastRef.current({ type: "error", title: json.error ?? "Failed" });
      return;
    }
    // Optimistic: update local state immediately
    setReports(prev => prev.map(r =>
      r.id === reportId
        ? { ...r, reviewed_by: currentlyReviewed ? null : "me", reviewed_at: currentlyReviewed ? null : new Date().toISOString() }
        : r
    ));
    toastRef.current({ type: "success", title: currentlyReviewed ? "Review removed" : "Report marked reviewed" });
  } catch {
    toastRef.current({ type: "error", title: "Network error" });
  } finally {
    setReviewingId(null);
  }
}
```

**Confidence:** HIGH — toastRef pattern established in Phase 6 StudentDetailClient.

### Pattern 5: Analytics Stat Cards — Query-Time Computation

No charts, no charting library. All four metrics computable from daily_reports in last 7 days:

```typescript
// Parallel queries for analytics page
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

const [studentsResult, reportsResult] = await Promise.all([
  admin.from("users").select("id, status, joined_at").eq("role", "student").eq("coach_id", user.id),
  admin.from("daily_reports")
    .select("student_id, date, hours_worked, star_rating, outreach_count, reviewed_by")
    .in("student_id", studentIds)
    .gte("date", sevenDaysAgo)
    .not("submitted_at", "is", null),
]);

// Derived metrics (pure JS computation from raw rows):
// - submissionRate = reportsResult.length / (studentIds.length * 7) * 100
// - avgStarRating  = avg of star_rating values
// - avgHoursPerDay = avg of hours_worked values
// - avgOutreach    = avg of outreach_count values

// Student categories (from users + cross-referencing reports):
// - active:   reported in last 3 days
// - at-risk:  inactive >=3 days OR avg rating < 2 in last 7 days
// - inactive: no report in 7+ days (joined > 3 days ago)
// - new:      no activity AND joined < 3 days ago
```

**Confidence:** HIGH — thresholds come directly from COACH_CONFIG in src/lib/config.ts.

### Pattern 6: Invite Generation — Two API Routes

The invites page combines email invites (`invites` table) and magic links (`magic_links` table):

```typescript
// POST /api/invites — email-based invite
// Code generation: crypto.randomUUID().replace(/-/g,"").slice(0,16)
// Expiry: INVITE_CONFIG.codeExpiryHours (72h)
// coach_id auto-set to caller.id when callerRole === "coach"
// Register URL: ${NEXT_PUBLIC_APP_URL}/register?code=${code}
// No email sending in V1 — link is copy-pasted manually (no Resend integration)

// POST /api/magic-links — shareable link (no email required)
// Code generation: crypto.getRandomValues(new Uint8Array(8)) mapped through safe char set
// Register URL: ${NEXT_PUBLIC_APP_URL}/register?magic=${code}
```

**Confidence:** HIGH — both patterns lifted directly from reference-old, no V2-only dependencies.

### Pattern 7: Sidebar Badge Wiring

The Sidebar currently renders `(badge)` as a placeholder string. The `NavItem.badge` field is a string key (`"unreviewed_reports"`), not a count. Options for wiring:

**Recommended approach (Claude's Discretion):** Pass badge counts as a prop from `DashboardLayout` to `Sidebar`. The layout already fetches the profile; it can additionally fetch unreviewed count for coach role.

```typescript
// In src/app/(dashboard)/layout.tsx — add for coach role:
let badgeCounts: Record<string, number> = {};
if (profile.role === "coach") {
  const coachProfile = await admin.from("users").select("id").eq("auth_id", user.id).single();
  if (coachProfile.data) {
    const studentIds = (await admin.from("users").select("id").eq("coach_id", coachProfile.data.id).eq("role","student")).data?.map(s=>s.id) ?? [];
    if (studentIds.length > 0) {
      const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split("T")[0];
      const { count } = await admin.from("daily_reports")
        .select("*", { count: "exact", head: true })
        .in("student_id", studentIds)
        .gte("date", sevenDaysAgo)
        .is("reviewed_by", null)
        .not("submitted_at", "is", null);
      badgeCounts = { unreviewed_reports: count ?? 0 };
    }
  }
}
// Pass to Sidebar: <Sidebar ... badgeCounts={badgeCounts} />
// Sidebar renders: {item.badge && badgeCounts[item.badge] > 0 && <span>{badgeCounts[item.badge]}</span>}
```

**Alternative:** Keep badge as placeholder until Phase 10 polish. The CONTEXT.md marks this as Claude's Discretion, so if sidebar badge adds layout complexity, defer.

**Confidence:** MEDIUM — the mechanism is clear from Sidebar source, but the exact prop threading approach is at implementer discretion.

### Anti-Patterns to Avoid

- **Importing analytics charting components from reference-old:** They depend on `ANALYTICS_CONFIG`, `FEATURES`, `KpiCard`, `TrendChart` — none exist in V1. Only stat-card pattern.
- **Using `supabase` (RLS) client in API routes:** All `.from()` calls must use `createAdminClient()`. Established hard rule.
- **Relying on RLS alone for coach scoping:** Always add explicit `coach_id` filter as defense-in-depth (established in Phase 6).
- **Using `getSessionUser()` with role arg:** V1's `session.ts` has `requireRole(allowed)` not `getSessionUser("coach")` — reference-old uses a different signature.
- **Calling `sendInviteEmail`:** No Resend integration in V1. Invite delivery is manual (coach copies link). Remove email-send from reference-old route.
- **slideUp animation without motion-safe:** Hard rule — every `animate-*` must be `motion-safe:animate-*`.
- **Hardcoded hex or gray-* colors:** Hard rule — ima-* tokens only.
- **Using the `z.literal(true)` schema for review:** CONTEXT.md requires toggle support — schema must accept `boolean`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Invite code generation | Custom random string logic | `crypto.randomUUID().replace(/-/g,"").slice(0,16)` (invites) or `crypto.getRandomValues()` with safe chars (magic links) | Already proven in reference-old, uses Web Crypto API available in Next.js edge/Node |
| Copy to clipboard | Custom DOM clipboard handler | `navigator.clipboard.writeText(url)` with try/catch fallback and toast | Standard Web API, reference-old already handles the fallback pattern |
| Filter state persistence | React state + useState for filter tabs | `router.push(buildUrl(...))` with searchParams — server drives the filtered data | Next.js App Router pattern; enables server-side filtering without client-side data management |
| At-risk detection | New algorithm | Re-use COACH_CONFIG thresholds + algorithm from Phase 6 coach dashboard | Identical logic, same config constants; extract or inline |
| Star display | Custom rating component | `role="img"` span with Unicode stars and aria-label, pattern from reference-old ReportCard | Simple, accessible, no dependency |
| Submission rate math | Complex analytics query | Pure JS computation from raw report rows (count submitted / count expected * 100) | Last-7-days scope is small enough for JS aggregation |

---

## Common Pitfalls

### Pitfall 1: Review Toggle vs One-Way Mark

**What goes wrong:** Implementing the API as one-directional (only mark reviewed, reject if already reviewed), then the "un-review" button has no effect.

**Why it happens:** Reference-old `restrict_coach_report_update` trigger allows setting reviewed_by to NULL — the DB supports it. But the reference-old API returns 400 "Already reviewed" if `reviewed_by` is set.

**How to avoid:** Schema: `z.object({ reviewed: z.boolean() })`. When `reviewed=false`, set `reviewed_by=null, reviewed_at=null`. Remove the `if (report.reviewed_by) return 400` guard.

**Warning signs:** PATCH returns 400 when coach clicks "Un-review"; toggle appears broken on second click.

### Pitfall 2: 7-Day Window Boundary

**What goes wrong:** Using `new Date(Date.now() - 7*24*60*60*1000)` produces a timestamp; comparing against date strings requires `.split("T")[0]` to get YYYY-MM-DD.

**Why it happens:** `daily_reports.date` is a `date` type (YYYY-MM-DD string in JS), not a timestamp. Comparing with an ISO timestamp string produces unexpected results in Supabase `.gte()`.

**How to avoid:** Always extract the date part: `const sevenDaysAgo = new Date(nowMs - 7*24*60*60*1000).toISOString().split("T")[0]`. Use `.gte("date", sevenDaysAgo)` not `.gte("date", isoTimestamp)`.

**Warning signs:** Inbox shows 0 reports when students have submitted recent reports.

### Pitfall 3: Invite `coach_id` Auto-Assignment

**What goes wrong:** New invite is created but student who registers via the invite link does not get assigned to the coach, because `coach_id` was not set on the invite record.

**Why it happens:** The invites table has a `coach_id` column. The invite POST route must auto-set `coach_id = caller.id` when `callerRole === "coach"`. If omitted, the auth callback's invite lookup finds the invite but has no coach to assign to.

**How to avoid:** In `POST /api/invites`, always set `coach_id: caller.id` when inserting for a coach caller. Reference-old line 71-72 shows this pattern.

**Warning signs:** Students register successfully but appear unassigned (null coach_id in users table); coach's dashboard shows 0 students.

### Pitfall 4: `getSessionUser` Signature Mismatch

**What goes wrong:** Copying reference-old page code that calls `getSessionUser("coach")` — V1's `session.ts` exports `requireRole("coach")` not `getSessionUser` with a role argument.

**Why it happens:** Reference-old has a different `session.ts` that accepts a role parameter. V1 uses `requireRole()` for role-gated pages.

**How to avoid:** Always use `requireRole("coach")` at the top of every coach page. Check V1's `src/lib/session.ts` before copying page boilerplate.

**Warning signs:** TypeScript error "Expected 0-1 arguments, but got 1" on `getSessionUser`.

### Pitfall 5: Sidebar Badge — Layout Doesn't Pass Counts Yet

**What goes wrong:** Sidebar badge always shows `(badge)` placeholder regardless of unreviewed count.

**Why it happens:** `DashboardLayout` passes only `role` and `userName` to `Sidebar`. The badge key `"unreviewed_reports"` is in config but no count data flows through yet.

**How to avoid:** If wiring the sidebar badge in this phase, extend `Sidebar` props to accept `badgeCounts?: Record<string, number>` and update `DashboardLayout` to fetch and pass the count for coach role. If deferring, leave placeholder — CONTEXT.md marks this as Claude's Discretion.

**Warning signs:** Badge is hardcoded `(badge)` in navigation even after report review.

### Pitfall 6: Missing `submitted_at IS NOT NULL` Filter

**What goes wrong:** Inbox includes "draft" daily_reports rows where student started a report but didn't submit (submitted_at is null). These shouldn't appear in the review inbox.

**Why it happens:** The `daily_reports` table stores reports in progress — `submitted_at` is null until the student submits.

**How to avoid:** Always add `.not("submitted_at", "is", null)` to any coach-side report query. Pattern confirmed in reference-old.

**Warning signs:** Inbox shows reports with 0 hours and no data, or reports that students never submitted.

### Pitfall 7: Empty studentIds Array Crashes `.in()` Query

**What goes wrong:** If a coach has zero assigned students, `.in("student_id", [])` throws a Supabase error or returns unexpected results.

**Why it happens:** Empty array in `.in()` is not a valid filter in PostgREST.

**How to avoid:** Guard with early return before any `.in("student_id", studentIds)` call:
```typescript
if (studentIds.length === 0) {
  return <EmptyStateLayout />;
}
```
Phase 6 coach dashboard already demonstrates this guard pattern.

---

## Code Examples

### Report Inbox — 7-Day Scoped Query

```typescript
// Source: reference-old/src/app/(dashboard)/coach/reports/page.tsx (adapted for V1)
const today = getToday();
const nowMs = new Date(today + "T23:59:59Z").getTime();
const sevenDaysAgo = new Date(nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000)
  .toISOString().split("T")[0];

const { data: reports } = await admin
  .from("daily_reports")
  .select("id, student_id, date, hours_worked, star_rating, outreach_count, wins, improvements, submitted_at, reviewed_by, reviewed_at")
  .in("student_id", studentIds)
  .gte("date", sevenDaysAgo)
  .not("submitted_at", "is", null)
  .order("date", { ascending: false });
```

### PATCH Review Toggle API

```typescript
// Source: reference-old/src/app/api/reports/[id]/review/route.ts (adapted for toggle)
const reviewSchema = z.object({
  reviewed: z.boolean(),  // V1: supports toggle (true or false)
});

// In handler, after auth + ownership check:
const updatePayload = parsed.data.reviewed
  ? { reviewed_by: profile.id, reviewed_at: new Date().toISOString() }
  : { reviewed_by: null, reviewed_at: null };

const { data: updated, error } = await admin
  .from("daily_reports")
  .update(updatePayload)
  .eq("id", id)
  .select()
  .single();
```

### Invite Code Generation + Insert

```typescript
// Source: reference-old/src/app/api/invites/route.ts
const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const expiresAt = new Date(Date.now() + INVITE_CONFIG.codeExpiryHours * 60 * 60 * 1000).toISOString();

await admin.from("invites").insert({
  email,
  role: "student",
  invited_by: caller.id,
  coach_id: caller.id,  // always set for coach callers
  code,
  expires_at: expiresAt,
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? APP_CONFIG.url;
const registerUrl = `${baseUrl}/register?code=${code}`;
// Return registerUrl for coach to copy — no email sending in V1
```

### Magic Link Code Generation + Insert

```typescript
// Source: reference-old/src/app/api/magic-links/route.ts
function generateMagicCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}
// Note: magic link register URL uses ?magic= not ?code=
const registerUrl = `${baseUrl}/register?magic=${link.code}`;
```

### Analytics Stat Computation

```typescript
// Pure JS — no Supabase aggregate needed for 7-day cohort
const submittedReports = reports.filter(r => r.submitted_at !== null);
const submissionRate = studentIds.length > 0
  ? Math.round((submittedReports.length / (studentIds.length * COACH_CONFIG.reportInboxDays)) * 100)
  : 0;
const avgStarRating = submittedReports.length > 0
  ? submittedReports.reduce((s, r) => s + (r.star_rating ?? 0), 0) / submittedReports.length
  : 0;
const avgHoursPerDay = submittedReports.length > 0
  ? submittedReports.reduce((s, r) => s + Number(r.hours_worked), 0) / submittedReports.length
  : 0;
const avgOutreach = submittedReports.length > 0
  ? submittedReports.reduce((s, r) => s + r.outreach_count, 0) / submittedReports.length
  : 0;
```

### Star Display Component

```typescript
// Source: reference-old/src/components/coach/ReportCard.tsx
function StarDisplay({ rating }: { rating: number | null }) {
  const stars = rating ?? 0;
  return (
    <span role="img" aria-label={`Rating: ${stars} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= stars ? "text-ima-warning" : "text-ima-text-muted"}>★</span>
      ))}
    </span>
  );
}
```

---

## State of the Art

| Old Approach (reference-old) | V1 Approach | Reason |
|------------------------------|-------------|--------|
| `getSessionUser("coach")` | `requireRole("coach")` | V1 session.ts has different signature |
| `sendInviteEmail()` via Resend | Omit email sending — return URL for manual copy | No Resend in V1; manual delivery acceptable |
| `reviewSchema = z.literal(true)` (one-way) | `z.object({ reviewed: z.boolean() })` (toggle) | CONTEXT.md requires un-review capability |
| `FEATURES.coachAnalytics` flag | Always render stat cards | No feature flags in V1 |
| `KpiCard`, `TrendChart`, `RankedDistribution` analytics components | Simple stat card grid | No charting library in V1; stat cards only |
| `ANALYTICS_CONFIG.ranges` + date range selector | Fixed 7-day window | No date picker in V1 analytics |
| `StatCard` shared component (reference-old) | Inline stat card pattern from Phase 6 coach dashboard | V1 uses direct Card+CardContent pattern not a StatCard abstraction |

**Deprecated/outdated in V1 context:**
- `reference-old/src/components/coach/CoachAnalyticsClient.tsx`: references V2 features (tier system, deals, calls) — use as pattern reference only, build fresh for V1
- `reference-old/src/app/api/reports/[id]/review/route.ts`: `z.literal(true)` schema — replace with `z.boolean()` for toggle support
- `reference-old/src/app/api/invites/route.ts`: `sendInviteEmail` call — remove, return URL only

---

## Open Questions

1. **Sidebar badge implementation scope**
   - What we know: Badge key `"unreviewed_reports"` is in NAVIGATION config; Sidebar renders it as placeholder `(badge)`; layout does not currently pass count data
   - What's unclear: Whether to wire the badge in this phase or defer to Phase 10 polish
   - Recommendation: Wire it in Phase 7 since we're already fetching unreviewed count on the reports page — pass it down from DashboardLayout as an optional prop. Adds ~10 lines to layout.tsx.

2. **Expandable report rows — client component or details/summary**
   - What we know: CONTEXT.md says "rows are expandable — click to reveal wins/improvements text"; reference-old shows full text inline in `ReportCard`
   - What's unclear: Whether to use HTML `<details>/<summary>` (no JS needed) or client component with useState
   - Recommendation: HTML `<details>/<summary>` for simplicity and accessibility; avoids "use client" on the row itself; works without JS.

3. **Magic link toggle (deactivate/reactivate) — in V1 scope?**
   - What we know: Reference-old CoachInvitesClient includes toggle-active buttons calling `PATCH /api/magic-links/[id]`; this API route does not exist yet in V1
   - What's unclear: CONTEXT.md says magic link UI is "Claude's Discretion" — unclear if toggle is included
   - Recommendation: Include deactivate toggle — it's in the reference-old UX and adds minimal complexity (one PATCH route for magic_links). Without it, coaches can create but not revoke links.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Not detected — no test config files found in project |
| Config file | None — Wave 0 gap |
| Quick run command | `npm run build` (build check as proxy) |
| Full suite command | `npx tsc --noEmit && npm run lint` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COACH-04 | PATCH /api/reports/[id]/review marks report reviewed | manual-only | — | No test infrastructure |
| COACH-04 | PATCH with reviewed=false clears reviewed_by | manual-only | — | No test infrastructure |
| COACH-04 | PATCH forbidden if student not assigned to coach | manual-only | — | No test infrastructure |
| COACH-05 | POST /api/invites creates invite with 72h expiry | manual-only | — | No test infrastructure |
| COACH-05 | POST /api/invites auto-sets coach_id | manual-only | — | No test infrastructure |
| COACH-06 | Analytics page renders 4 stat cards with correct values | manual-only | — | No test infrastructure |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (type check)
- **Per wave merge:** `npx tsc --noEmit && npm run lint && npm run build`
- **Phase gate:** Build green + manual browser smoke test before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No test framework installed — unit testing not established in this project; all validation is manual + build/lint
- [ ] No test files exist — this is consistent with all prior phases (Phases 1-6 have no test files)

---

## Sources

### Primary (HIGH confidence)

- `reference-old/src/app/(dashboard)/coach/reports/page.tsx` — report inbox structure, stat computation, empty-state guard
- `reference-old/src/app/(dashboard)/coach/invites/page.tsx` — invite page structure, parallel fetch pattern
- `reference-old/src/components/coach/CoachReportsClient.tsx` — filter tabs, optimistic update, router.push pattern
- `reference-old/src/components/coach/CoachInvitesClient.tsx` — tabbed invite form, clipboard, toggle magic link
- `reference-old/src/components/coach/ReportCard.tsx` — star display, report row structure
- `reference-old/src/app/api/reports/[id]/review/route.ts` — review PATCH pattern (adapted for toggle)
- `reference-old/src/app/api/invites/route.ts` — invite creation, code generation, coach_id auto-set
- `reference-old/src/app/api/magic-links/route.ts` — magic link creation, safe char code generation
- `supabase/migrations/00001_create_tables.sql` — DB schema, RLS policies, `restrict_coach_report_update` trigger
- `src/lib/config.ts` — COACH_CONFIG, INVITE_CONFIG, NAVIGATION, ROUTES
- `src/lib/session.ts` — requireRole signature
- `src/app/(dashboard)/coach/page.tsx` — Phase 6 visual DNA, parallel fetch pattern, at-risk logic
- `src/app/(dashboard)/layout.tsx` — Sidebar prop surface for badge wiring
- `src/components/layout/Sidebar.tsx` — badge rendering location

### Secondary (MEDIUM confidence)

- CONTEXT.md `## Implementation Decisions` — locked decisions validated against DB schema and code

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all established in prior phases
- Architecture: HIGH — direct reference-old ports with 3 known adaptations (toggle schema, no email, V1 session API)
- Pitfalls: HIGH — all identified from direct code inspection of reference-old and V1 codebase; not inferred
- Analytics computation: HIGH — COACH_CONFIG thresholds confirmed in config.ts; query pattern mirrors Phase 6 dashboard

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack, no external API dependencies)
