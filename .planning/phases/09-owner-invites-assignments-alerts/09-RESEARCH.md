# Phase 9: Owner Invites, Assignments & Alerts — Research

**Researched:** 2026-03-17
**Domain:** Next.js App Router API extension, Supabase schema migration, computed alert queries
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Reuse existing invite/magic-link patterns from coach flow (Phase 7)
- Owner can invite both "coach" and "student" roles (per INVITE_CONFIG.inviteRules.owner)
- Extend existing POST /api/invites and POST /api/magic-links to accept owner role (currently coach-only)
- Same 72-hour expiry for invite codes, same magic link generation
- Copy-to-clipboard UX pattern from CoachInvitesClient
- Assignment lives on the owner student detail page (/owner/students/[studentId])
- Coach dropdown selector in student detail header area — shows "Coach Name (N students)" format
- Includes "Unassigned" option to remove a student from a coach (sets coach_id = null)
- Instant swap on save — no confirmation modal, no notification to coaches
- PATCH API to update student's coach_id
- No dedicated /owner/assignments page — student detail is the single assignment point
- Alerts computed at query time (no cron, no stored alert rows) — per PROJECT.md constraint
- Small `alert_dismissals` table stores dismissed alert keys (e.g. "student_inactive:uuid:date-range")
- If condition resolves and re-triggers in a new time window, dismissed state doesn't carry over — appears as new alert
- 4 alert types from config: student inactive 3+ days, student dropoff 7+ days, unreviewed reports, coach underperformance (avg rating < 2.5 for 14+ days)
- Card-based list on /owner/alerts page
- Filter tabs: All / Active / Dismissed (matching reference-old AlertsClient pattern)
- Each alert card shows: severity icon, type label, subject name, triggered reason, time
- Alert cards link to the relevant person's detail page (student or coach)
- Unreviewed reports shown as one summary alert ("N reports pending review"), not per-report
- Single "Dismiss" action — no separate acknowledge
- Dismiss inserts a row in alert_dismissals table with the alert key
- Dismissed alerts hidden from active view but visible under "Dismissed" filter tab
- If the underlying condition resolves then re-triggers, new alert key generated — appears fresh

### Claude's Discretion
- Owner invite page layout (tabs vs sections for coach/student role selection)
- Invite history table design and pagination
- Alert card styling, severity color coding, icon choices
- Empty states for alerts page and invite history
- Loading skeletons for all new pages
- alert_dismissals table schema details (columns, indexes)
- Whether to show alert count badge on sidebar "Alerts" nav item

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OWNER-06 | Owner can send invite codes (coach + student) | POST /api/invites extended to accept owner role + role param; POST /api/magic-links same; OwnerInvitesClient adds role selector dropdown |
| OWNER-07 | Owner can assign/reassign students to coaches | New PATCH /api/assignments; OwnerStudentDetailClient extended with coach dropdown; users.coach_id update |
| OWNER-08 | Owner sees alerts (inactive 3d, dropoff 7d, unreviewed reports, coach underperformance) | Computed query patterns; alert_dismissals migration; 4 alert type SQL queries |
| OWNER-09 | Owner can acknowledge/dismiss alerts | POST /api/alerts/dismiss; alert key insertion; Dismissed filter tab on alert list |
</phase_requirements>

---

## Summary

Phase 9 has three distinct functional areas: (1) invite generation for coach and student roles, (2) coach-student assignment from the student detail page, and (3) a computed alert system with a dismissal table.

The invite area is primarily an extension of already-working coach invite patterns. The APIs at `/api/invites` and `/api/magic-links` currently gate on `profile.role !== "coach"` — changing that check to allow `"owner"` as well is the sole authorization change needed. The UI adapts `CoachInvitesClient` by adding a role selector `<select>` — the form shape otherwise remains identical.

Assignment is the simplest sub-feature: a single PATCH endpoint that updates `users.coach_id`, and a new dropdown section in the owner student detail page. The existing `owner_update_users` RLS policy already permits owners to update the `coach_id` column. The security trigger `restrict_self_update_users` only blocks role changes for non-owners, so an owner-authenticated admin client call can freely set `coach_id`. The new coach dropdown section receives the full coaches list (name + student count) passed from the server component.

Alert computation is the most novel work. There is no `alert_dismissals` table in the schema yet — it must be created in a new migration. Alerts are computed at request time via four SQL queries joining `users`, `work_sessions`, `daily_reports`, and `roadmap_progress` tables. Each alert type is identified by a deterministic string key. The dismissal check is a simple `NOT IN (SELECT key FROM alert_dismissals WHERE owner_id = ...)` filter applied after computing which entities currently qualify. The alert key design determines whether dismissed state persists across re-triggers.

**Primary recommendation:** Extend APIs minimally (role checks only), create alert_dismissals migration, build three new pages (invites, alerts) plus one extended component (student detail), with all alert logic in server-side query functions.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router) | 16 (already installed) | Server components, route handlers | Project standard |
| Supabase JS | already installed | Admin client queries, RLS bypass | Project standard |
| Zod | already installed | API input validation | Project hard rule |
| Lucide React | already installed | Alert icons (AlertTriangle, UserX, UserMinus, Bell) | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React useState/useCallback/useRef | built-in | Client component interactivity | All client components |
| navigator.clipboard | browser API | Copy-to-clipboard for invite links | OwnerInvitesClient |

### No New Dependencies Required
All tooling for Phase 9 already exists in the project. No `npm install` needed.

---

## Architecture Patterns

### File Layout for Phase 9

```
src/
├── app/
│   ├── (dashboard)/owner/
│   │   ├── invites/
│   │   │   └── page.tsx              # NEW — server component, fetches invites + magic_links + coaches
│   │   └── alerts/
│   │       └── page.tsx              # NEW — server component, computes alerts, fetches dismissals
│   └── api/
│       ├── invites/route.ts          # EXTEND — allow owner role, add role param to schema
│       ├── magic-links/route.ts      # EXTEND — allow owner role, add role param to schema
│       ├── assignments/route.ts      # NEW — PATCH updates users.coach_id
│       └── alerts/
│           └── dismiss/route.ts      # NEW — POST inserts alert_dismissals row
├── components/owner/
│   ├── OwnerInvitesClient.tsx        # NEW — adapted from CoachInvitesClient, adds role selector
│   ├── OwnerAlertsClient.tsx         # NEW — alert list with filter tabs, dismiss action
│   └── OwnerStudentDetailClient.tsx  # EXTEND — add coach assignment dropdown section
supabase/migrations/
└── 00004_alert_dismissals.sql        # NEW — alert_dismissals table + RLS
```

### Pattern 1: API Role Extension (invites + magic-links)

The current guard is `if (profile.role !== "coach")`. Change to:

```typescript
// Source: src/app/api/invites/route.ts — current pattern to modify
if (profile.role !== "coach" && profile.role !== "owner") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

For invites: add `role` to the Zod schema (default `"student"`, allow `"coach"` only when caller is owner). The existing `coach_id` field on the invites table is set to the inviting coach's ID for coach-created invites. For owner-created invites, `coach_id` should be `null` (owner is setting up the invite, assignment happens separately on student detail page) unless the owner supplies one.

```typescript
// Extended inviteSchema for owner role support
const inviteSchema = z.object({
  email: z.string().email().max(VALIDATION.email.max),
  role: z.enum(["coach", "student"]).optional().default("student"),
});
```

For magic_links: same pattern — add `role` param, validate that coaches can only create `"student"` magic links.

### Pattern 2: Assignment PATCH API

```typescript
// src/app/api/assignments/route.ts
// PATCH /api/assignments?studentId=xxx
// Body: { coach_id: string | null }
const assignSchema = z.object({
  coach_id: z.string().uuid().nullable(),
});
// Auth: owner only
// Update: admin.from("users").update({ coach_id }).eq("id", studentId).eq("role", "student")
```

The `owner_update_users` RLS policy already grants owners full UPDATE on the users table. Using the admin client bypasses RLS entirely (defense-in-depth), which is the V1 pattern.

### Pattern 3: Alert Key Design

Alert keys are deterministic strings that encode type + subject + time window:

```
student_inactive:{student_id}:{YYYY-MM-DD}    — keyed to today so it re-fires next day
student_dropoff:{student_id}:{YYYY-WW}        — keyed to ISO week so week-level re-trigger
unreviewed_reports:{YYYY-MM-DD}               — summary alert, keyed to today
coach_underperform:{coach_id}:{YYYY-MM}       — keyed to month window
```

This design means: if a student is still inactive tomorrow, a new alert key is generated and appears as a fresh alert even if yesterday's was dismissed. Matches the decision: "If condition resolves and re-triggers in a new time window, dismissed state doesn't carry over — appears as new alert."

### Pattern 4: Alert Computation Query

Alert computation runs entirely server-side in the page.tsx server component. No stored alert rows — the query joins current data against the thresholds from `OWNER_CONFIG.alertThresholds`.

```typescript
// Pseudocode for alert computation — all via admin client
const thresholds = OWNER_CONFIG.alertThresholds;
const today = getToday(); // "YYYY-MM-DD"
const inactiveCutoff = new Date(Date.now() - thresholds.studentInactiveDays * 86400000)
  .toISOString().split("T")[0];
const dropoffCutoff = new Date(Date.now() - thresholds.studentDropoffDays * 86400000)
  .toISOString().split("T")[0];
const coachWindowCutoff = new Date(Date.now() - thresholds.coachUnderperformingWindowDays * 86400000)
  .toISOString().split("T")[0];

// 1. Students inactive 3+ days: no work_session AND no daily_report since inactiveCutoff
// 2. Students no login 7+ days: no work_session AND no daily_report since dropoffCutoff
// 3. Unreviewed reports: daily_reports where submitted_at IS NOT NULL AND reviewed_by IS NULL
// 4. Coach underperformance: AVG(star_rating) < 2.5 for reports in last 14 days, by coach
```

### Pattern 5: Alert Dismissals Table

```sql
-- New migration: 00004_alert_dismissals.sql
CREATE TABLE public.alert_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, alert_key)
);
CREATE INDEX idx_alert_dismissals_owner ON public.alert_dismissals(owner_id);

-- RLS: owner sees and inserts only their own dismissals
ALTER TABLE public.alert_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select_dismissals" ON public.alert_dismissals
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'owner' AND owner_id = (select get_user_id()));
CREATE POLICY "owner_insert_dismissals" ON public.alert_dismissals
  FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'owner' AND owner_id = (select get_user_id()));
```

The `UNIQUE(owner_id, alert_key)` constraint prevents duplicate dismissals for the same alert — a re-dismiss is a no-op.

### Pattern 6: OwnerStudentDetailClient Extension

The existing `OwnerStudentDetailClient` needs one new section: a coach assignment area in the header. The server component (`page.tsx`) must be extended to fetch: (a) the current assigned coach, and (b) all coaches with their student counts, to power the dropdown.

```typescript
// Extended server fetch in page.tsx
const coachesResult = await admin
  .from("users")
  .select("id, name")
  .eq("role", "coach")
  .eq("status", "active")
  .order("name");

// Count students per coach
const studentCountsResult = await admin
  .from("users")
  .select("coach_id")
  .eq("role", "student")
  .not("coach_id", "is", null);

// Build: coaches with "(N students)" label for dropdown options
```

Pass `coaches` (with student counts) and `currentCoachId` as new props to `OwnerStudentDetailClient`. The client adds a `<select>` dropdown and a Save button that calls PATCH /api/assignments.

### Anti-Patterns to Avoid

- **Modifying registration flow for owner invites:** The invite `role` column in the invites table already supports `"coach"` — registration uses it. No changes to auth flow.
- **Separate /owner/assignments page:** Decision is locked — assignment lives on student detail only.
- **Cron jobs or stored alert rows:** Alerts are query-time computed only. alert_dismissals stores only dismissed keys, not generated alerts.
- **Passing non-admin supabase client to mutation queries:** Every `.from()` in API routes uses `createAdminClient()`.
- **`import { z } from "zod/v4"`:** Hard rule — always `"zod"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Copy to clipboard | Custom clipboard fallback | `navigator.clipboard.writeText` with try/catch toast | Already pattern in CoachInvitesClient |
| Invite code generation | Custom random string | `crypto.randomUUID().replace(/-/g,"").slice(0,16)` | Already in /api/invites |
| Magic link code generation | Custom charset logic | `generateMagicCode()` already in /api/magic-links | Avoids ambiguous chars (0/O, I/l, 1) |
| Alert deduplication | Custom state tracking | `UNIQUE(owner_id, alert_key)` DB constraint | DB handles at insert time |
| Role access check | Custom role middleware | `requireRole("owner")` from session.ts | Already handles all redirect logic |
| Optimistic UI | Complex state sync | useState + revert on error (CoachInvitesClient pattern) | Established pattern |

**Key insight:** All complex one-time infrastructure (auth, tokens, optimistic UI, toast) is already built. Phase 9 is about wiring together existing pieces.

---

## Common Pitfalls

### Pitfall 1: Invite Role Validation — Coach Creating Coach Invites

**What goes wrong:** After extending `/api/invites` to allow owner role, a coach could pass `role: "coach"` in the body and create coach invites.
**Why it happens:** The Zod schema accepts `role` param but doesn't gate it by caller role.
**How to avoid:** After role extension, add validation: `if (profile.role === "coach" && parsed.data.role !== "student") return 403`.
**Warning signs:** Missing this check means coaches gain ability to invite other coaches.

### Pitfall 2: alert_dismissals Key Collision on Re-trigger

**What goes wrong:** Using a stable key (e.g. `student_inactive:{uuid}` with no time window) means once dismissed, the alert never re-appears even when the condition persists next week.
**Why it happens:** The decision says "new time window = new alert". Without a time component in the key, dismissed = permanently gone.
**How to avoid:** Keys must include a time bucket (date for daily alerts, ISO week for weekly, month for monthly). See Pattern 3 above.
**Warning signs:** "Dismissed" filter grows but "Active" never shows the same subject again.

### Pitfall 3: Student Detail Page Breaking After Coach Assignment

**What goes wrong:** After PATCH /api/assignments succeeds, the page doesn't reflect the new coach assignment because server data is stale.
**Why it happens:** Client-only state update doesn't trigger Next.js server component re-fetch.
**How to avoid:** Call `router.refresh()` after successful PATCH — this re-runs the server component and fetches fresh data. Pattern from CoachInvitesClient toggle.
**Warning signs:** Dropdown shows new selection locally but reverts on page reload.

### Pitfall 4: Admin Client Ownership Check for alert_dismissals

**What goes wrong:** Dismiss API inserts a row without verifying the `owner_id` matches the authenticated user.
**Why it happens:** Admin client bypasses RLS — the INSERT can set any `owner_id`.
**How to avoid:** Always set `owner_id: profile.id` from the authenticated profile lookup (not from request body). Request body only provides `alert_key`.
**Warning signs:** Any user who can reach the dismiss API could dismiss another owner's alerts.

### Pitfall 5: Coach Student Count in Dropdown — Using Client-Side Count

**What goes wrong:** Passing coaches without student counts, then trying to count from a separate list client-side.
**Why it happens:** Two data shapes needed: full coach list + per-coach student counts.
**How to avoid:** Compute student counts server-side (one query: `select coach_id from users where role = 'student'`, group by coach_id), then merge before passing to client.
**Warning signs:** Dropdown labels show "(N students)" but N is always 0 or wrong.

### Pitfall 6: OwnerInvitesClient — Tab Switch Clears lastUrl

**What goes wrong:** Owner generates an email invite URL, then switches to magic tab to check something, then switches back — the URL is gone.
**Why it happens:** CoachInvitesClient already handles this: `setLastUrl(null)` on tab switch. This is intentional behavior to prevent confusion between email and magic link URLs.
**How to avoid:** Keep the `setLastUrl(null)` on tab switch — it's the correct behavior. Document it so it's not "fixed".
**Warning signs:** A bug report says "URL disappears when switching tabs" — this is by design.

### Pitfall 7: Alert Computation — Student "Inactive" vs "Dropoff" Overlap

**What goes wrong:** A student inactive for 7 days triggers both `student_inactive` (3d threshold) AND `student_dropoff` (7d threshold). Both appear on the alert list simultaneously.
**Why it happens:** The 7-day case is a superset of the 3-day case — all dropoff students are also inactive.
**How to avoid:** Show only the more severe alert when both thresholds are met. If `daysInactive >= dropoffDays`, generate only the `student_dropoff` alert, not `student_inactive`. Apply thresholds exclusively: `3 <= days < 7` → inactive; `days >= 7` → dropoff.
**Warning signs:** Same student appears twice in the alert list with different labels.

---

## Code Examples

### Extending POST /api/invites for owner role

```typescript
// Source: src/app/api/invites/route.ts — modification

const inviteSchema = z.object({
  email: z.string().email().max(VALIDATION.email.max),
  role: z.enum(["coach", "student"]).optional().default("student"),
});

// After profile lookup:
if (profile.role !== "coach" && profile.role !== "owner") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Role restriction: coaches can only invite students
if (profile.role === "coach" && parsed.data.role !== "student") {
  return NextResponse.json({ error: "Coaches can only invite students" }, { status: 403 });
}

// Insert: coach_id is null for owner-created invites (assigned separately)
const insertData = {
  email: parsed.data.email,
  role: parsed.data.role,
  invited_by: profile.id,
  coach_id: profile.role === "coach" ? profile.id : null,
  code,
  expires_at: expiresAt,
};
```

### PATCH /api/assignments route

```typescript
// Source: New file src/app/api/assignments/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const assignSchema = z.object({
  coach_id: z.string().uuid().nullable(),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users").select("id, role").eq("auth_id", authUser.id).single();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const studentId = request.nextUrl.searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 });
  }

  // Verify target is a student
  const { data: student } = await admin
    .from("users").select("id").eq("id", studentId).eq("role", "student").single();
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const { data: updated, error } = await admin
    .from("users")
    .update({ coach_id: parsed.data.coach_id })
    .eq("id", studentId)
    .select("id, coach_id")
    .single();

  if (error) {
    console.error("[PATCH /api/assignments] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: updated });
}
```

### POST /api/alerts/dismiss route

```typescript
// Source: New file src/app/api/alerts/dismiss/route.ts

const dismissSchema = z.object({
  alert_key: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  // ... auth + role check (owner only) ...
  const parsed = dismissSchema.safeParse(body);
  // Insert with UPSERT to avoid duplicate error (or use onConflict: ignore)
  await admin.from("alert_dismissals")
    .upsert({ owner_id: profile.id, alert_key: parsed.data.alert_key })
    .onConflict("owner_id, alert_key")  // UNIQUE constraint
    .ignore();
  // Actually: insert with ignoreDuplicates or conflict handling
  return NextResponse.json({ success: true });
}
```

Note: Supabase JS uses `.upsert(..., { onConflict: 'owner_id,alert_key', ignoreDuplicates: true })` for idempotent inserts.

### Alert computation — inactive student query

```typescript
// Server-side computation in /owner/alerts/page.tsx
const thresholds = OWNER_CONFIG.alertThresholds;
const today = getToday(); // "YYYY-MM-DD"
const nowMs = Date.now();

const inactiveCutoffDate = new Date(nowMs - thresholds.studentInactiveDays * 86400000)
  .toISOString().split("T")[0];
const dropoffCutoffDate = new Date(nowMs - thresholds.studentDropoffDays * 86400000)
  .toISOString().split("T")[0];

// Get all active students
const { data: students } = await admin
  .from("users").select("id, name").eq("role", "student").eq("status", "active");

// Get most recent activity date per student (max of sessions and reports)
const { data: recentSessions } = await admin
  .from("work_sessions").select("student_id, date")
  .in("student_id", students.map(s => s.id))
  .gte("date", dropoffCutoffDate); // only need recent ones

const { data: recentReports } = await admin
  .from("daily_reports").select("student_id, date")
  .in("student_id", students.map(s => s.id))
  .gte("date", dropoffCutoffDate)
  .not("submitted_at", "is", null);

// Build per-student last-active map and classify
// 3 <= daysInactive < 7 → student_inactive alert
// daysInactive >= 7 → student_dropoff alert (exclusive, not both)
```

### alert_dismissals upsert (idempotent dismiss)

```typescript
// Supabase JS upsert with ignoreDuplicates
const { error } = await admin
  .from("alert_dismissals")
  .upsert(
    { owner_id: profile.id, alert_key: parsedAlertKey },
    { onConflict: "owner_id,alert_key", ignoreDuplicates: true }
  );
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate /owner/assignments bulk page | Assignment inline on student detail page | Phase 9 decision | Keeps owner in context, simpler flow |
| Stored alert rows in DB with cron compute | Query-time computed alerts + dismissals table | V1 scope decision | No cron infra, minimal DB writes |
| Acknowledge + dismiss as separate actions | Single dismiss action | Phase 9 decision | Simpler UX, one API endpoint |

**Deprecated/outdated patterns (from reference-old, do NOT port):**
- `reference-old` AssignmentsClient: bulk table with capacity progress bars — V1 uses student detail assignment instead
- `reference-old` AlertsClient: `handleMarkAllRead` batch loop — V1 uses single dismiss per alert
- `reference-old` AlertsClient: `isComputedAlert(id.startsWith("computed-"))` hack — V1 uses proper alert_dismissals table
- `reference-old` InvitesClient: `handleResendInvite` resend endpoint — V1 is copy-link only, no email delivery
- `reference-old` InvitesClient: expiry select (24h/7d/30d/never) — V1 locks to 72h from INVITE_CONFIG

---

## Open Questions

1. **Sidebar "Alerts" badge count**
   - What we know: NAVIGATION config has `badge` field support; coach Reports uses `badge: "unreviewed_reports"`. Owner Alerts nav item has no badge key yet.
   - What's unclear: Whether implementing the badge requires extending DashboardLayout's `badgeCounts` computation (currently only fetches coach's unreviewed report count).
   - Recommendation: Implement the badge count as part of Plan 09-03 (alert system plan). Extend `badgeCounts` in the dashboard layout to fetch active alert count for the owner. This is marked as "Claude's Discretion" — implement it as the clean solution.

2. **Coach student count for assignment dropdown**
   - What we know: The dropdown label format is "Coach Name (N students)". The current page.tsx fetches only the student's `coach_id`, not all coaches.
   - What's unclear: Whether to fetch student counts via a GROUP BY query or a separate count-per-coach loop.
   - Recommendation: Single query `select coach_id from users where role = 'student' and status = 'active'`, then client-side group by `coach_id`. Avoids N+1 query.

3. **alert_dismissals grants**
   - What we know: Migration 00002_fix_grants.sql added explicit grants. New tables need identical grants or rely on `ALTER DEFAULT PRIVILEGES` already in 00001.
   - What's unclear: Whether `ALTER DEFAULT PRIVILEGES` in 00001 covers tables created in new migrations.
   - Recommendation: Include explicit grants in 00004_alert_dismissals.sql to be safe: `GRANT ALL ON TABLE public.alert_dismissals TO anon, authenticated, service_role;`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found |
| Config file | None — see Wave 0 |
| Quick run command | `npx tsc --noEmit && npm run lint` |
| Full suite command | `npx tsc --noEmit && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OWNER-06 | POST /api/invites accepts owner role with role param | manual-only | `npm run build` (type-check) | ❌ Wave 0 |
| OWNER-06 | POST /api/magic-links accepts owner role with role param | manual-only | `npm run build` | ❌ Wave 0 |
| OWNER-06 | Owner invite page renders with role selector | manual-only | `npm run build` | ❌ Wave 0 |
| OWNER-07 | PATCH /api/assignments updates coach_id | manual-only | `npm run build` | ❌ Wave 0 |
| OWNER-07 | Owner student detail shows coach assignment dropdown | manual-only | `npm run build` | ❌ Wave 0 |
| OWNER-08 | Alerts page shows 4 alert types from computed queries | manual-only | `npm run build` | ❌ Wave 0 |
| OWNER-09 | POST /api/alerts/dismiss inserts alert_dismissals row | manual-only | `npm run build` | ❌ Wave 0 |
| OWNER-09 | Dismissed alerts appear in "Dismissed" tab, hidden from "Active" | manual-only | `npm run build` | ❌ Wave 0 |

No automated test framework is in place. All verification is via TypeScript type-check (`npx tsc --noEmit`), lint (`npm run lint`), and build (`npm run build`) as the project's established quality gates.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npx tsc --noEmit && npm run build`
- **Phase gate:** Full build green before `/gsd:verify-work`

### Wave 0 Gaps
No test framework to scaffold. The project uses build + type-check as its quality gate. No Wave 0 test file creation needed.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/app/api/invites/route.ts` — current role check pattern, Zod schema, invite insert shape
- Direct code inspection: `src/app/api/magic-links/route.ts` — current role check pattern, generateMagicCode, PATCH toggle
- Direct code inspection: `src/components/coach/CoachInvitesClient.tsx` — tab UI, optimistic toggle, copy-to-clipboard, stable refs
- Direct code inspection: `supabase/migrations/00001_create_tables.sql` — users schema (coach_id column), invites table (role column supports "coach"), RLS policies (owner_update_users grants full user update), security trigger (restrict_self_update_users only blocks non-owner role/coach_id changes)
- Direct code inspection: `src/lib/config.ts` — OWNER_CONFIG.alertThresholds, INVITE_CONFIG.inviteRules.owner, NAVIGATION owner items
- Direct code inspection: `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — server component pattern, parallel fetch, requireRole usage
- Direct code inspection: `src/components/owner/OwnerStudentDetailClient.tsx` — current props interface, tab structure to extend
- Direct code inspection: `reference-old/src/components/owner/AlertsClient.tsx` — alert card pattern, filter tab logic, TYPE_CONFIG icon mapping
- Direct code inspection: `reference-old/src/components/owner/InvitesClient.tsx` — role selector pattern, coach dropdown for student invites

### Secondary (MEDIUM confidence)
- Supabase JS upsert with `ignoreDuplicates: true` — standard Supabase client feature for idempotent inserts on conflict

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in active use
- Architecture: HIGH — patterns derived directly from existing working code in this codebase
- Pitfalls: HIGH — identified from direct code analysis and known V1 decisions
- Alert SQL queries: MEDIUM — query structure is clear but exact performance with large datasets untested; acceptable for V1 scale

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (30 days — stable stack, no fast-moving dependencies)
