---
phase: quick
plan: 260401-cwd
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/00014_coach_alert_dismissals.sql
  - src/lib/config.ts
  - src/lib/rpc/types.ts
  - src/app/api/alerts/dismiss/route.ts
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/coach/alerts/page.tsx
  - src/app/(dashboard)/coach/alerts/loading.tsx
  - src/app/(dashboard)/coach/alerts/error.tsx
  - src/components/coach/CoachAlertsClient.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Coach sees a 100h milestone alert card for each assigned student who has 6000+ total session_minutes AND whose joined_at is within 45 days of today"
    - "Alert message shows student name and days since joining in format: '[Name] has reached 100+ hours in [X] days! Check them out and ask for a testimonial.'"
    - "Alert links to /coach/students/{studentId} detail page"
    - "Dismissing an alert permanently hides it via key 100h_milestone:{student_id} in existing alert_dismissals table"
    - "Sidebar badge shows count of undismissed 100h milestone alerts for coach role"
    - "No new database table is created — uses existing alert_dismissals + computed alert pattern"
  artifacts:
    - path: "supabase/migrations/00014_coach_alert_dismissals.sql"
      provides: "Coach RLS policies on alert_dismissals + updated get_sidebar_badges RPC"
    - path: "src/app/(dashboard)/coach/alerts/page.tsx"
      provides: "Server component computing 100h milestone alerts"
    - path: "src/components/coach/CoachAlertsClient.tsx"
      provides: "Client component rendering alert cards with dismiss"
  key_links:
    - from: "src/app/(dashboard)/coach/alerts/page.tsx"
      to: "alert_dismissals + work_sessions tables"
      via: "admin.from('alert_dismissals') for dismissed keys, admin.from('work_sessions') for session_minutes sum"
      pattern: "alert_dismissals|work_sessions"
    - from: "src/components/coach/CoachAlertsClient.tsx"
      to: "/api/alerts/dismiss"
      via: "fetch POST on dismiss button click"
      pattern: "fetch.*api/alerts/dismiss"
    - from: "get_sidebar_badges RPC"
      to: "alert_dismissals + work_sessions + users tables"
      via: "SQL computes qualifying students minus dismissed count"
      pattern: "coach_milestone_alerts"
---

<objective>
Add a computed "100-hour milestone" alert for coaches. When a student reaches 100+ total hours worked (SUM session_minutes >= 6000) within 45 days of their joined_at date, their coach sees an alert suggesting they ask for a testimonial. Uses the EXISTING alert_dismissals table and computed alert pattern (per D-01) -- NO new notifications table.

Purpose: Coaches get notified of high-performing students so they can celebrate the milestone and request a testimonial.
Output: Migration (RLS + RPC update), config updates, API update, coach alerts page + client component, sidebar badge.
</objective>

<execution_context>
@.planning/quick/260401-cwd-add-coach-notification-for-100-hours-in-/260401-cwd-PLAN.md
</execution_context>

<context>
@CLAUDE.md
@src/lib/config.ts
@src/lib/types.ts
@src/lib/rpc/types.ts
@supabase/migrations/00004_alert_dismissals.sql
@supabase/migrations/00010_query_consolidation.sql
@src/app/(dashboard)/owner/alerts/page.tsx
@src/components/owner/OwnerAlertsClient.tsx
@src/app/api/alerts/dismiss/route.ts
@src/app/(dashboard)/layout.tsx
@src/app/(dashboard)/coach/page.tsx

<interfaces>
From src/components/owner/OwnerAlertsClient.tsx (reference pattern):
```typescript
export interface AlertItem {
  key: string;
  type: "student_inactive" | "student_dropoff" | "unreviewed_reports" | "coach_underperforming";
  severity: "warning" | "critical";
  title: string;
  message: string;
  subjectId: string | null;
  subjectName: string;
  triggeredAt: string;
  dismissed: boolean;
}
```

From src/lib/rpc/types.ts:
```typescript
export type SidebarBadgesResult = {
  active_alerts?: number;       // owner only
  unreviewed_reports?: number;  // coach only
};
```

From src/app/api/alerts/dismiss/route.ts:
- POST endpoint, validates { alert_key: string } via Zod
- Currently restricted to role === "owner"
- Upserts into alert_dismissals: { owner_id: profile.id, alert_key }
- Uses CSRF, rate-limit, admin client

From supabase/migrations/00004_alert_dismissals.sql:
- Table: alert_dismissals (id uuid PK, owner_id uuid FK->users, alert_key text, dismissed_at timestamptz)
- UNIQUE(owner_id, alert_key)
- RLS: owner-only SELECT and INSERT policies
- Note: "owner_id" column is actually just a FK to users.id — any user ID works

From supabase/migrations/00010_query_consolidation.sql get_sidebar_badges:
- Coach block returns: jsonb_build_object('unreviewed_reports', v_unreviewed_count)
- Owner block computes multi-signal alert counts minus dismissed count
- Full function body must be reproduced in CREATE OR REPLACE

From src/app/(dashboard)/layout.tsx:
- Calls getSidebarBadges RPC, maps active_alerts and unreviewed_reports to badgeCounts
- badgeCounts passed to Sidebar component

From src/lib/config.ts COACH_CONFIG:
```typescript
export const COACH_CONFIG = {
  atRiskInactiveDays: 3,
  atRiskRatingThreshold: 2,
  maxStudentsPerCoach: 50,
  reportInboxDays: 7,
} as const;
```

From src/lib/config.ts NAVIGATION (coach):
```typescript
coach: [
  { label: "Dashboard",       href: "/coach",           icon: "LayoutDashboard" },
  { label: "My Students",     href: "/coach/students",  icon: "Users" },
  { label: "Reports",         href: "/coach/reports",   icon: "FileText",      badge: "unreviewed_reports" },
  { label: "Invite Students", href: "/coach/invites",   icon: "UserPlus",      separator: true },
  { label: "Analytics",       href: "/coach/analytics", icon: "BarChart3" },
],
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migration (coach RLS + RPC update), config, types, dismiss API, layout badge</name>
  <files>
    supabase/migrations/00014_coach_alert_dismissals.sql,
    src/lib/config.ts,
    src/lib/rpc/types.ts,
    src/app/api/alerts/dismiss/route.ts,
    src/app/(dashboard)/layout.tsx
  </files>
  <action>
  **1. Create migration `supabase/migrations/00014_coach_alert_dismissals.sql` (per D-01, D-07):**

  Add RLS policies for coach role on the EXISTING `alert_dismissals` table (no new table):

  ```sql
  -- Coach can read their own dismissals
  CREATE POLICY "coach_select_dismissals" ON public.alert_dismissals
    FOR SELECT TO authenticated
    USING ((select get_user_role()) = 'coach' AND owner_id = (select get_user_id()));

  -- Coach can insert their own dismissals
  CREATE POLICY "coach_insert_dismissals" ON public.alert_dismissals
    FOR INSERT TO authenticated
    WITH CHECK ((select get_user_role()) = 'coach' AND owner_id = (select get_user_id()));
  ```

  Note: We reuse the `owner_id` column to store the coach's user.id. The column is a FK to users.id so any user ID is valid. No schema change needed.

  Then add the full `CREATE OR REPLACE FUNCTION public.get_sidebar_badges(...)` (per D-08). Copy the ENTIRE function from 00010_query_consolidation.sql and modify ONLY the coach block. The coach block must:

  a) Keep existing unreviewed_reports query unchanged.
  b) After that query, add 100h milestone count computation:
     - Declare `v_milestone_count integer := 0;` and `v_milestone_dismissed integer := 0;` in the DECLARE block.
     - SYNC comment: `-- SYNC: must match COACH_CONFIG.milestoneMinutesThreshold (6000) and milestoneDaysWindow (45)`
     - Query: For each of the coach's active students whose `joined_at >= CURRENT_DATE - 45`:
       Check if `(SELECT COALESCE(SUM(ws.session_minutes), 0) FROM work_sessions ws WHERE ws.student_id = student.id AND ws.status = 'completed') >= 6000`.
       If yes, increment `v_milestone_count`.
     - Then count coach's dismissed 100h alerts:
       `SELECT count(*) INTO v_milestone_dismissed FROM alert_dismissals WHERE owner_id = p_user_id AND alert_key LIKE '100h_milestone:%';`
  c) Return updated JSONB:
     `RETURN jsonb_build_object('unreviewed_reports', v_unreviewed_count, 'coach_milestone_alerts', GREATEST(0, v_milestone_count - v_milestone_dismissed));`

  IMPORTANT: The owner block must remain EXACTLY as-is. Reproduce the full function faithfully.

  **2. Update `src/lib/config.ts` (per D-01 config is truth):**

  Add milestone thresholds to COACH_CONFIG:
  ```typescript
  export const COACH_CONFIG = {
    atRiskInactiveDays: 3,
    atRiskRatingThreshold: 2,
    maxStudentsPerCoach: 50,
    reportInboxDays: 7,
    milestoneMinutesThreshold: 6000,  // 100 hours in minutes
    milestoneDaysWindow: 45,          // days since joined_at
  } as const;
  ```

  Add "Alerts" nav item to coach NAVIGATION array. Insert AFTER "Analytics" as the last item:
  ```typescript
  { label: "Alerts", href: "/coach/alerts", icon: "Bell", badge: "coach_milestone_alerts" },
  ```

  Also add `coach.alerts` to ROUTES:
  ```typescript
  coach: {
    dashboard: "/coach",
    students: "/coach/students",
    studentDetail: "/coach/students/[studentId]",
    invites: "/coach/invites",
    reports: "/coach/reports",
    analytics: "/coach/analytics",
    alerts: "/coach/alerts",       // NEW
  },
  ```

  **3. Update `src/lib/rpc/types.ts`:**

  Add `coach_milestone_alerts?: number;` to SidebarBadgesResult:
  ```typescript
  export type SidebarBadgesResult = {
    active_alerts?: number;          // owner only
    unreviewed_reports?: number;     // coach only
    coach_milestone_alerts?: number; // coach only — 100h milestone alerts
  };
  ```

  **4. Update `src/app/api/alerts/dismiss/route.ts` (per D-07):**

  Change the role gate from:
  ```typescript
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  ```
  To:
  ```typescript
  if (profile.role !== "owner" && profile.role !== "coach") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  ```
  The rest of the endpoint stays the same. `owner_id: profile.id` works for coaches too since the column is a FK to users.id.

  **5. Update `src/app/(dashboard)/layout.tsx`:**

  Add coach_milestone_alerts to the badge mapping:
  ```typescript
  if (badges.coach_milestone_alerts !== undefined && badges.coach_milestone_alerts > 0) {
    badgeCounts.coach_milestone_alerts = badges.coach_milestone_alerts;
  }
  ```
  </action>
  <verify>
    <automated>cd C:/Users/ibrah/ima-accelerator-v1 && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
  - Migration 00014 exists with coach RLS policies on alert_dismissals and updated get_sidebar_badges RPC
  - No new table created (per D-01)
  - COACH_CONFIG has milestoneMinutesThreshold (6000) and milestoneDaysWindow (45)
  - ROUTES.coach.alerts added
  - Coach nav includes "Alerts" with Bell icon and coach_milestone_alerts badge key
  - SidebarBadgesResult includes coach_milestone_alerts
  - Dismiss API accepts both owner and coach roles
  - Layout maps coach_milestone_alerts to sidebar badge
  - TypeScript compiles clean
  </done>
</task>

<task type="auto">
  <name>Task 2: Coach alerts page + client component (computed 100h milestone alerts)</name>
  <files>
    src/app/(dashboard)/coach/alerts/page.tsx,
    src/app/(dashboard)/coach/alerts/loading.tsx,
    src/app/(dashboard)/coach/alerts/error.tsx,
    src/components/coach/CoachAlertsClient.tsx
  </files>
  <action>
  **1. Create `src/app/(dashboard)/coach/alerts/page.tsx` (per D-02, D-03, D-04, D-05, D-06):**

  Server component following the EXACT pattern of `src/app/(dashboard)/owner/alerts/page.tsx` but for a single alert type: 100h milestone. The alerts are COMPUTED at render time, not stored.

  Steps:
  1. `const user = await requireRole("coach");`
  2. `const admin = createAdminClient();`
  3. `const today = getToday();`
  4. Import COACH_CONFIG from config. Use `COACH_CONFIG.milestoneMinutesThreshold` (6000) and `COACH_CONFIG.milestoneDaysWindow` (45).
  5. Parallel fetch:
     ```typescript
     const [studentsResult, dismissalsResult] = await Promise.all([
       admin.from("users")
         .select("id, name, joined_at")
         .eq("role", "student")
         .eq("coach_id", user.id)
         .eq("status", "active"),
       admin.from("alert_dismissals")
         .select("alert_key")
         .eq("owner_id", user.id),  // uses owner_id column with coach's ID
     ]);
     ```
  6. Build `dismissedKeys = new Set(...)` from dismissals data.
  7. Error handling: `if (studentsResult.error) console.error(...)` etc.
  8. Compute the 45-day cutoff: `const milestoneCutoff = new Date(nowMs - COACH_CONFIG.milestoneDaysWindow * 86400000).toISOString().split("T")[0];`
  9. Filter students whose joined_at >= milestoneCutoff (joined within 45 days of today). These are "qualifying" students.
  10. If qualifying students exist, fetch their completed session minutes:
      ```typescript
      const { data: sessionData } = await admin
        .from("work_sessions")
        .select("student_id, session_minutes")
        .in("student_id", qualifyingIds)
        .eq("status", "completed");
      ```
  11. Sum session_minutes per student into a Map. For students with sum >= 6000:
      ```typescript
      const key = `100h_milestone:${student.id}`;  // per D-04
      const daysSinceJoin = Math.floor((nowMs - new Date(student.joined_at).getTime()) / 86400000);
      alerts.push({
        key,
        type: "100h_milestone" as const,
        severity: "success" as const,
        title: student.name,
        message: `${student.name} has reached 100+ hours in ${daysSinceJoin} days! Check them out and ask for a testimonial.`,  // per D-05
        link: `/coach/students/${student.id}`,  // per D-06
        dismissed: dismissedKeys.has(key),
      });
      ```
  12. Sort: undismissed first, then by student name.
  13. Compute `activeAlertCount = alerts.filter(a => !a.dismissed).length`.
  14. Render page structure (matching owner alerts page layout):
      ```tsx
      <div className="space-y-6 px-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="h-6 w-6 text-ima-success" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-ima-text">Milestone Alerts</h1>
            {activeAlertCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-ima-success/10 text-ima-success">
                {activeAlertCount} active
              </span>
            )}
          </div>
          <p className="text-sm text-ima-text-secondary">
            Students who&apos;ve reached 100+ hours within {COACH_CONFIG.milestoneDaysWindow} days of joining.
          </p>
        </div>
        <CoachAlertsClient initialAlerts={alerts} />
      </div>
      ```
  15. Import Trophy from lucide-react.

  **2. Create `src/components/coach/CoachAlertsClient.tsx` (per D-09, following OwnerAlertsClient pattern):**

  "use client" component. Define and export:
  ```typescript
  export interface CoachAlertItem {
    key: string;
    type: "100h_milestone";
    severity: "success";
    title: string;
    message: string;
    link: string;
    dismissed: boolean;
  }
  ```

  Props: `{ initialAlerts: CoachAlertItem[] }`

  State:
  - `alerts` from initialAlerts
  - `filter`: FilterTab ("all" | "active" | "dismissed"), default "active"
  - `dismissingKey`: string | null

  Filter tabs: same pattern as OwnerAlertsClient (All, Active, Dismissed) with styling from ima-* tokens. Each tab button min-h-[44px].

  Summary stats line: "{activeCount} active | {dismissedCount} dismissed"

  `handleDismiss` callback (IDENTICAL pattern to OwnerAlertsClient):
  - Optimistic: set alert.dismissed = true in state
  - POST to `/api/alerts/dismiss` with `{ alert_key: alertKey }`
  - Check response.ok before parsing JSON
  - On error: revert optimistic update, toast error
  - On success: toast "Alert dismissed", router.refresh()
  - Use `useRef(useToast())` and `useRef(useRouter())` for stable deps (exact same pattern)

  Each alert card renders inside a Card/CardContent:
  - role="alert" aria-label on container
  - Trophy icon (lucide-react) in `bg-ima-success/10 text-ima-success` 40x40 rounded-lg circle
  - Title (student name) with `<Badge variant="success" size="sm">100h Milestone</Badge>`
  - Message text in `text-sm text-ima-text-secondary`
  - Action row:
    - "View Student" Link to `alert.link` — `text-xs text-ima-primary font-medium hover:underline min-h-[44px] inline-flex items-center`
    - "Dismiss" Button (only if !dismissed) — `variant="ghost" size="sm"` with loading state from dismissingKey
  - Undismissed cards: Card variant="bordered-left" with className "border-l-ima-success"
  - Dismissed cards: Card variant="default"

  Empty state: `<EmptyState icon={<Trophy className="h-6 w-6" />} title={EMPTY_MESSAGES[filter]} />`
  ```typescript
  const EMPTY_MESSAGES: Record<FilterTab, string> = {
    all: "No milestone alerts yet. When students hit 100+ hours within 45 days, they'll appear here!",
    active: "No active milestone alerts. Keep coaching!",
    dismissed: "No dismissed alerts.",
  };
  ```

  All interactive elements: min-h-[44px]. All icons: aria-hidden="true". All colors: ima-* tokens. Transitions: motion-safe: prefix.

  **3. Create `src/app/(dashboard)/coach/alerts/loading.tsx`:**
  Standard loading skeleton. Match the pattern from other coach loading files (e.g., coach/reports/loading.tsx or coach/analytics/loading.tsx). Show 2-3 skeleton card placeholders with `animate-pulse` (use `motion-safe:animate-pulse`).

  **4. Create `src/app/(dashboard)/coach/alerts/error.tsx`:**
  Standard error boundary. "use client". Match pattern from `src/app/(dashboard)/coach/reports/error.tsx` exactly — Card with error message and retry button.
  </action>
  <verify>
    <automated>cd C:/Users/ibrah/ima-accelerator-v1 && npx tsc --noEmit 2>&1 | head -30 && npm run build 2>&1 | tail -20</automated>
  </verify>
  <done>
  - /coach/alerts page computes 100h milestone alerts from work_sessions + users data at render time
  - No new DB table used (per D-01) — only reads from work_sessions, users, alert_dismissals
  - Alert message format matches D-05: "[Name] has reached 100+ hours in [X] days! Check them out and ask for a testimonial."
  - Each alert links to /coach/students/{studentId} (per D-06)
  - Dismiss button calls existing /api/alerts/dismiss, permanently hides the alert via 100h_milestone:{student_id} key (per D-04)
  - Filter tabs (All/Active/Dismissed) work correctly
  - Loading skeleton and error boundary exist
  - All project Hard Rules enforced (44px targets, aria, ima-* tokens, motion-safe, Zod in APIs, admin client, response.ok, no swallowed errors)
  - Build succeeds with no type errors
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` -- zero type errors
2. `npm run build` -- clean production build
3. Manual verification: Log in as coach with students who have 6000+ completed session_minutes AND joined_at within 45 days. Verify alert appears on /coach/alerts with correct message. Verify sidebar "Alerts" badge shows count. Dismiss alert -- verify it moves to dismissed tab and badge count decreases. Refresh page -- dismissed alert stays dismissed. Verify students outside the 45-day window or below 6000 minutes do NOT trigger alerts.
</verification>

<success_criteria>
- Coach sees 100h milestone alerts for qualifying students on /coach/alerts
- Alert message format: "[Student Name] has reached 100+ hours in [X] days! Check them out and ask for a testimonial."
- Dismissing an alert is permanent (keyed by 100h_milestone:{student_id} in existing alert_dismissals table)
- Sidebar badge reflects undismissed 100h milestone count
- Only students with SUM(session_minutes) >= 6000 from completed work_sessions AND joined_at within 45 days trigger the alert
- NO new database table (uses existing alert_dismissals + computed pattern per D-01)
- Build and type check pass cleanly
</success_criteria>

<output>
After completion, verify with `npx tsc --noEmit && npm run build`.
</output>
