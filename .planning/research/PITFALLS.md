# Pitfalls Research

**Domain:** Adding session planner, coach roadmap undo, and motivational completion card to an existing Next.js 16 + Supabase coaching platform (v1.3)
**Researched:** 2026-03-31
**Confidence:** HIGH — primary sources: existing codebase audit (WorkTrackerClient.tsx, roadmap route, migration history), Supabase Postgres docs, Next.js App Router docs, Tailwind CSS 4 RTL docs

> **Scope:** These pitfalls are specific to the v1.3 features being ADDED to an already-shipped, production system. The platform has real students with real roadmap_progress rows. Every pitfall here is about what breaks when you introduce a session planner, undo capability, and post-plan UX on top of an existing state machine and schema — not about building from scratch.

---

## Critical Pitfalls

### Pitfall 1: Adding "planning" State to WorkTracker Breaks Phase Initialization Effect

**What goes wrong:**
`WorkTrackerClient.tsx` has a `useEffect` that syncs `phase` state with the presence of `activeSession`/`pausedSession`. The logic is:
```typescript
if (activeSession) { setPhase({ kind: "working" }) }
else if (pausedSession) { setPhase({ kind: "working" }) }
else if (phase.kind !== "setup" && phase.kind !== "break") { setPhase({ kind: "idle" }) }
```
If a new `"planning"` phase kind is added but NOT included in the guard clause of the `else if`, any page refresh while the user is in the planning flow will immediately reset `phase` back to `"idle"`. The planner UI vanishes. This is silent — no error is thrown.

**Why it happens:**
The guard `phase.kind !== "setup" && phase.kind !== "break"` is an exhaustive allowlist of "non-idle" phases that should not be reset. Developers add a new phase kind elsewhere in the component but forget to update this guard. The existing test for the code path is: "no active or paused session" — which is always true in the planning state.

**How to avoid:**
Add `"planning"` to the guard clause atomically with creating the new phase kind:
```typescript
else if (
  phase.kind !== "setup" &&
  phase.kind !== "break" &&
  phase.kind !== "planning"  // ADD THIS when adding planning state
) { setPhase({ kind: "idle" }) }
```
The success criterion is: refreshing the page while in `planning` phase preserves the planner UI (plan data is fetched from DB, not purely from React state).

**Warning signs:**
- Planner UI disappears on page navigation back, browser back/forward, or tab focus change
- `phase` state resets to `"idle"` in React DevTools after any re-render triggered by session state change

**Phase to address:** Daily session planner schema + API phase (schema and client integration)

---

### Pitfall 2: Coach Undo Does Not Re-Lock the Next Active Step

**What goes wrong:**
The current `PATCH /api/roadmap` flow for completing a step:
1. Marks `step_number` as `completed`
2. Unlocks `step_number + 1` by setting it to `active`

The undo endpoint (`PATCH /api/roadmap/undo`) reverts step N from `completed` back to `active`. If the developer only updates step N and does not re-lock step N+1, the student ends up with two `active` steps simultaneously — step N (undone, now active again) and step N+1 (was unlocked, stays active). The student can complete N+1 while N is still active, breaking the sequential progression invariant. Coaches cannot see this inconsistency in the UI because the roadmap renders the first active step they find.

**Why it happens:**
The undo operation is conceptually the inverse of complete, but developers model it as a single-row `UPDATE` on the target step. The cascade — that completing a step unlocked the next one — is invisible in the UI at undo time because the coach is looking at the target step, not the downstream one.

**How to avoid:**
The undo endpoint must be a two-step atomic operation:
1. Fetch the step being undone and confirm it is `completed`
2. In the same request (not two separate API calls), also re-lock step N+1 **only if** its current status is `active` and it has no `completed_at`
```typescript
// Pseudocode for undo endpoint
await admin.from("roadmap_progress")
  .update({ status: "active", completed_at: null })
  .eq("student_id", studentId)
  .eq("step_number", stepNumber)

// Re-lock the next step only if it hasn't been completed independently
const { data: nextStep } = await admin.from("roadmap_progress")
  .select("status, completed_at")
  .eq("student_id", studentId)
  .eq("step_number", stepNumber + 1)
  .single()

if (nextStep && nextStep.status === "active" && !nextStep.completed_at) {
  await admin.from("roadmap_progress")
    .update({ status: "locked" })
    .eq("student_id", studentId)
    .eq("step_number", stepNumber + 1)
}
```
Add undo action to an audit log (separate table or a `undone_at` timestamp on `roadmap_progress`) for the confirmation requirement.

**Warning signs:**
- Two steps showing as `active` for the same student in the roadmap view
- Student can mark step N+1 complete without step N being complete first
- Coach sees unexpected "active" badge on a step the coach already undid

**Phase to address:** Coach undo API phase (PATCH /api/roadmap/undo endpoint)

---

### Pitfall 3: 4h Cap Enforced Only Client-Side Allows Cheating via API

**What goes wrong:**
The 4-hour daily work cap is enforced in the planner UI by disabling the "Add session" button when `sum(session_minutes) >= 240`. A second browser tab, a direct `POST /api/work-sessions` call, or a stale tab that hasn't re-fetched the plan can all create sessions that exceed the cap. The database has no constraint preventing this. A student who knows the API can log 8 hours of sessions in a day.

**Why it happens:**
Client-side validation is fast and produces good UX. Developers forget that for integrity-affecting rules (daily caps, step progression), the server must be the authoritative enforcer. The API route at `POST /api/work-sessions` currently only checks for duplicate `cycle_number` and an existing `in_progress/paused` session — it does not check total minutes worked.

**How to avoid:**
Add server-side enforcement in `POST /api/work-sessions`:
```typescript
// After auth, before insert
const { data: todaySessions } = await admin
  .from("work_sessions")
  .select("session_minutes, status")
  .eq("student_id", profile.id)
  .eq("date", date)
  .in("status", ["completed", "in_progress"])

const minutesWorked = todaySessions?.reduce(
  (sum, s) => sum + (s.session_minutes ?? 0), 0
) ?? 0

const DAILY_CAP_MINUTES = 4 * 60 // 240
if (minutesWorked + session_minutes > DAILY_CAP_MINUTES) {
  return NextResponse.json(
    { error: "Daily 4h work cap reached" },
    { status: 400 }
  )
}
```
Note: the cap is on WORK time, not break time. `duration_minutes` is only set on completion — use `session_minutes` for in-progress sessions in the cap calculation to prevent starting a session that would exceed the cap.

**Warning signs:**
- A student's daily session list shows more than 4h total minutes
- `total_minutes_worked` in any daily report calculation exceeds 240 for planned sessions
- No 400 error returned when manually POSTing sessions that exceed 4h via curl/Postman

**Phase to address:** Daily session planner — API + cap enforcement

---

### Pitfall 4: Date Mismatch Between Client getToday() and Server getTodayUTC() Breaks Plan Lookup at Midnight

**What goes wrong:**
`WorkTrackerClient.tsx` calls `getToday()` which returns today's date in **local time** (`new Date().toLocaleDateString...`). The work page server component uses `new Date().toISOString().split("T")[0]` which is **UTC**. If a UAE student (UTC+4) is still working at 8 PM UAE time (4 PM UTC), both agree it is the same date. But at 11:30 PM UAE (7:30 PM UTC, still the same UTC date), the student's local clock shows tomorrow but the server sees today. When the daily_plans table is keyed on `date`, the client sends today's local date to fetch the plan, but the server-side query uses UTC date — a mismatch that results in a 404 plan lookup or a ghost plan that appears to belong to "yesterday."

**Why it happens:**
The existing codebase inconsistently uses `getToday()` (local) vs `getTodayUTC()` (UTC). The original `work/page.tsx` uses `.toISOString().split("T")[0]` (UTC). The client utility `getToday()` uses local time. This inconsistency was a known bug in v1.1 (fixed for calendar view) but the planner will reintroduce it if the date is passed from client to server.

**How to avoid:**
Pick one time reference for `daily_plans.date` and use it everywhere — UTC is the right choice because it matches the server, database, and existing `daily_reports.date` convention. The client must use `getTodayUTC()` (or a re-exported version) when constructing plan lookup requests. Never trust the client's local date as the source of truth for plan identity.

For extra safety, add a database default: `DEFAULT (CURRENT_DATE)` on the `date` column of `daily_plans`, so a server-side `INSERT` without an explicit date always gets UTC.

**Warning signs:**
- Plans disappear or "reset" after midnight in the student's local timezone
- Two plans created for the same student on consecutive UTC dates that look like the same local day
- `UNIQUE(student_id, date)` constraint violation reported in logs around midnight UTC+4/UTC+5 timezones

**Phase to address:** Daily session planner — schema migration

---

### Pitfall 5: plan_json Schema Changes Break Existing Plans Silently

**What goes wrong:**
The `daily_plans.plan_json` column stores the session configuration as a JSON blob. If the JSON shape changes between development iterations (adding/removing fields, renaming `session_minutes` to `duration_minutes`, changing break representation), existing rows with the old schema will fail to parse in the new client code. The UI either crashes, shows blank data, or silently ignores invalid plans. Because there is no schema migration for JSON column values (unlike typed columns), old data is never automatically upgraded.

**Why it happens:**
JSON columns in Postgres feel like "schema-free" storage. Developers evolve the frontend data model without considering that existing rows contain the old shape. Since TypeScript types are compile-time only, runtime reads of `plan_json` have no type safety unless explicitly validated.

**How to avoid:**
Two-part defense:
1. Define a stable TypeScript interface for `plan_json` before writing any API or UI code, and mark it as `v1` internally (e.g., `{ version: 1, sessions: [...] }`). Include the version in the JSON.
2. At read time, use Zod to parse `plan_json` rather than casting:
```typescript
const planSchema = z.object({
  version: z.literal(1),
  sessions: z.array(z.object({
    session_minutes: z.number().int().min(30).max(60),
    break_minutes: z.number().int().min(0).max(30),
    break_type: z.enum(["short", "long"]),
  }))
})
// If parse fails, treat as "no plan" — let student create fresh plan
const parsed = planSchema.safeParse(row.plan_json)
if (!parsed.success) return null
```
Never add new required fields to `plan_json` without handling the case where the field is absent (use `.optional()` in Zod).

**Warning signs:**
- TypeScript cast `as PlanJson` without a Zod parse in the data layer
- Plan displays blank sessions after any frontend field rename
- No `version` field in the `plan_json` object

**Phase to address:** Daily session planner — schema migration and plan API

---

### Pitfall 6: Race Condition on Duplicate Daily Plan Creation (Two Tabs)

**What goes wrong:**
A student opens the Work page in two browser tabs simultaneously (or opens on mobile after leaving desktop open). Both tabs load with no plan for today. Both tabs show the "Create Plan" flow. The student submits a plan in Tab A. Tab B still has the "Create Plan" form open. The student submits a plan in Tab B. The second `INSERT INTO daily_plans` attempts to create a second plan for the same `(student_id, date)`. Without a `UNIQUE` constraint on `(student_id, date)`, two plan rows are created — the UI will render whichever one the query happens to return first, and the second plan is silently orphaned.

**Why it happens:**
Optimistic UI patterns and multi-tab usage make concurrent form submissions common. The schema without a unique constraint relies on UI-side prevention only.

**How to avoid:**
Add a `UNIQUE` constraint on `(student_id, date)` in the `daily_plans` migration:
```sql
CREATE UNIQUE INDEX idx_daily_plans_student_date
  ON public.daily_plans(student_id, date);
```
Handle the 409 conflict in the `POST /api/plans` handler by returning the existing plan rather than an error:
```typescript
if (insertError?.code === "23505") {
  // Plan already exists — return it
  const existing = await admin.from("daily_plans").select("*")
    .eq("student_id", profile.id).eq("date", date).single()
  return NextResponse.json(existing, { status: 200 })
}
```
This makes the creation operation idempotent — a second attempt returns the existing plan, not an error.

**Warning signs:**
- No `UNIQUE` constraint on `(student_id, date)` in the migration
- `POST /api/plans` returns 201 for a date that already has a plan
- Two `daily_plans` rows exist for the same student on the same date in the database

**Phase to address:** Daily session planner — schema migration

---

### Pitfall 7: Arabic Text in Motivational Card Breaks Layout Without dir="rtl"

**What goes wrong:**
The post-plan completion motivational card displays Arabic text mixed with English. Without `dir="rtl"` on the Arabic container, the browser applies LTR layout rules: Arabic characters appear reversed or right-to-left text flows left-to-right visually. In Tailwind CSS 4, `text-right` alone does not set bidirectional text algorithm — it only changes CSS `text-align`, not `direction`. The result is Arabic characters that render in the wrong reading order, making the motivational message unreadable.

**Why it happens:**
CSS `text-align: right` is commonly confused with RTL text direction. Developers who primarily work in LTR languages apply `text-right` and see the text shift to the right but don't realize the character rendering order is still LTR. Arabic text is only visually correct when `direction: rtl` is set, which triggers the Unicode Bidirectional Algorithm properly.

**How to avoid:**
Wrap Arabic text in an element with `dir="rtl"` explicitly:
```tsx
<p dir="rtl" className="text-right font-arabic leading-relaxed">
  {arabicText}
</p>
```
If using a bilingual card (Arabic + English stacked), give each section its own `dir` attribute:
```tsx
<div dir="rtl" lang="ar" className="text-right">{arabicLine}</div>
<div dir="ltr" lang="en" className="text-left">{englishLine}</div>
```
The `lang` attribute is important for screen reader pronunciation of Arabic text.

If using a custom Arabic font (e.g., Cairo, Amiri), load it in the Next.js font configuration rather than a `@import` in CSS — the App Router font optimization prevents FOUT (Flash of Unstyled Text) which is especially noticeable with Arabic script.

**Warning signs:**
- Arabic characters appear but read in the wrong direction
- Punctuation appears at the wrong end of Arabic sentences
- `text-right` on Arabic text without `dir="rtl"` in the DOM

**Phase to address:** Post-plan completion motivational card

---

### Pitfall 8: Roadmap Config Text Updates Go Live Immediately for All Students (Including Those Mid-Step)

**What goes wrong:**
`ROADMAP_STEPS` in `config.ts` is the single source of truth for step titles, descriptions, and URLs. Updating a description or moving `unlock_url` from step 6 to step 5 takes effect the moment the Next.js deployment succeeds. Students who are currently on step 6 (and have already seen the old step 5 without an unlock_url) will suddenly see a video link appear on a step they've already completed, or the step 6 description changes mid-progress without warning. Since `step_name` in `roadmap_progress` is a denormalized copy (set at seed time) and is not updated by config changes, the DB row and the config can diverge.

**Why it happens:**
Config-first design assumes the config is the truth — which it is for new students. But for in-flight students, the rendered UI merges DB `status`/`completed_at` from `roadmap_progress` with titles/descriptions from `config.ts`. The DB row's `step_name` column is only used by legacy queries; the UI always reads from config. So a config text change is a live deploy that all current students see immediately.

**How to avoid:**
This is intentional and acceptable behavior for the IMA platform (Abu Lahya controls the course content and can update descriptions). The risk to document is: do not change `step_number` assignments or reorder steps in config — that would corrupt student progress rows. Only update text fields (title, description, unlock_url, target_days) without renumbering.

The `unlock_url` move from step 6 to step 5 in the config must be paired with verifying that no student currently has step 5 at `status: "completed"` with an old `unlock_url: null` — because they would now see the video link retroactively. This is acceptable (better late than never) but coaches should be aware.

**Warning signs:**
- A step renumber (changing `step: 6` to `step: 5`) instead of a text change
- Step descriptions updated but `step_name` in DB not updated via migration
- Any foreign key or logic that references specific step numbers must be audited after any config reorder

**Phase to address:** Roadmap config text update phase (first v1.3 phase)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing plan as raw JSON without Zod validation at read time | Faster to implement | Silently fails when schema evolves; TypeScript cast gives false confidence | Never — always parse with Zod at read time |
| Client-side-only 4h cap enforcement | Simpler API, no extra DB query | Cap can be bypassed via API or stale tabs | Never — cap must be server-side enforced for integrity |
| Skip `dir="rtl"` and use `text-right` for Arabic | Works for LTR devs in Chrome; looks "right" at a glance | Arabic characters render in wrong order; screen readers mispronounce | Never for Arabic text |
| Undo as single-row update (only the undone step) | Simpler endpoint | Two active steps simultaneously, broken sequential invariant | Never — undo must always cascade to N+1 |
| Keying daily_plans on client local date | Matches user's perceived "today" | Breaks at midnight for UTC+N timezones; mismatch with all other date columns | Never — use UTC consistently |
| Checking 4h cap against `duration_minutes` (completed sessions only) | Simple aggregation | In-progress session counted as 0 minutes; student can start a session that exceeds cap | Never — include `session_minutes` of in-progress sessions in cap check |

---

## Integration Gotchas

Common mistakes when connecting new features to existing system components.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| WorkTracker + Planner state machine | Adding "planning" phase but not updating the phase-reset `useEffect` guard | Add `"planning"` to the `else if` guard atomically with defining the new phase kind |
| daily_plans + work_sessions | Creating sessions from a plan without propagating the `plan_id` back to the session | Add `plan_id uuid REFERENCES daily_plans(id)` on `work_sessions` if you need to know which sessions came from a plan vs ad-hoc |
| Undo endpoint + existing PATCH /api/roadmap | Treating undo as a status-only toggle, ignoring downstream locked/active steps | Undo must read N+1 status before updating N, then conditionally re-lock N+1 |
| Motivational card + Supabase data | Loading the card with student name from Supabase on completion | Student name is already in session/page context — no extra DB call needed; pass via props |
| Coach undo + RLS | Coach undo using the standard Supabase `createClient()` which respects RLS | Use `createAdminClient()` in the undo API route (consistent with all other mutation routes) |
| Rate limiter + new /api/roadmap/undo route | Forgetting to add `checkRateLimit()` to the new undo endpoint | Every new mutation route in `src/app/api/` must call `checkRateLimit()` — this is a hard rule from v1.2 security audit |
| CSRF + new routes | Forgetting `verifyOrigin()` on the new undo and plan creation routes | Every new mutation route must call `verifyOrigin(request)` as the first check — established pattern in all 10 existing mutation routes |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Daily plan creation re-fetches full session list to check 4h cap | Works fine at <50 sessions/student/day | Index `(student_id, date, status)` already exists on `work_sessions`; ensure query uses it | Already indexed — safe indefinitely |
| plan_json stored as unindexed JSONB column queried by session field | No immediate issue for <1000 students | Don't query inside plan_json (e.g., `plan_json->>'sessions'`); always fetch the whole plan row | Breaks at ~5k+ if JSON querying is added without a GIN index |
| Coach undo querying all roadmap steps to find next active step | O(n) fetch of all 15 steps per undo | Only fetch step N and step N+1 (two point lookups by indexed `student_id + step_number`) | Non-issue at current scale; safe by design |
| Motivational card polling for plan completion status | Each tab polls `/api/plans/status` every 5 seconds | Use `router.refresh()` on session completion event; do not introduce a polling loop | Breaks at 5k students with 1-min polling = 5k req/min on a single endpoint |

---

## Security Mistakes

Domain-specific security issues for this feature set.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Coach undo endpoint accessible to students | Student could undo their own completed steps, corrupting progress | Role check in undo endpoint: `if (profile.role !== "coach" && profile.role !== "owner") return 403` |
| Coach can undo steps for students not assigned to them | Data isolation violation: coach A undoes coach B's student | Filter undo by `student_id IN (SELECT id FROM users WHERE coach_id = profile.id)` before allowing update |
| plan_json accepts arbitrary large payloads | DoS via extremely large JSON upload | Zod schema with `.max()` on sessions array length (e.g., `z.array(...).max(20)`) and `Content-Length` check |
| plan_json stores sensitive data | PII or secrets embedded in plan description fields | Plan fields should be structured (session_minutes, break_minutes, break_type) — no free-text fields in plan_json to avoid accidental PII storage |
| Ad-hoc sessions bypass plan cap check | Student creates ad-hoc session after plan cap is hit | Server-side cap check applies to ALL `POST /api/work-sessions` regardless of whether session is "planned" or ad-hoc |

---

## UX Pitfalls

Common user experience mistakes for this feature set.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Undo confirmation dialog doesn't show which student or step is being undone | Coach confirms wrong undo, data corruption | Confirmation dialog: "Undo step [N]: [Step Title] for [Student Name]?" |
| 4h cap error shown only after starting a session (timer already running) | Student interrupted; plan feels broken | Validate cap before showing "Start Session" button; gray out if adding this session would exceed 4h |
| Motivational card auto-dismisses after 3 seconds | Student didn't read the Arabic text | No auto-dismiss; require explicit "Let's go!" button press; card is a meaningful reward, not a toast |
| Post-plan ad-hoc session picker doesn't indicate it's outside the plan | Student thinks ad-hoc counts toward plan progress | Label clearly: "Extra Session (Ad-hoc)" vs "Planned Session"; show "Plan Complete" badge prominently before the ad-hoc picker |
| Break times in plan shown as fixed (e.g., 15 min short, 25 min long) but actual break is client-side countdown | Student thinks plan tracks breaks | Plan only tracks work time; breaks remain client-side countdown only — document this constraint in UI copy |
| Arabic motivational text truncated on small screens without wrapping | Arabic text is multi-word, long line; truncates illegibly | Use `break-words` and `whitespace-pre-wrap` on the Arabic container; test on 375px viewport |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Coach undo endpoint:** Confirm that N+1 re-locking logic runs — verify by checking `roadmap_progress` rows for the student directly after an undo, not just the UI
- [ ] **4h cap:** Confirm the cap is enforced server-side by testing `POST /api/work-sessions` directly via curl/Postman after the client shows "cap reached" — should return 400
- [ ] **daily_plans unique constraint:** Confirm `UNIQUE(student_id, date)` exists by attempting two plan inserts for the same student/date in the migration test
- [ ] **RTL Arabic text:** Confirm `dir="rtl"` is on the Arabic container by inspecting the DOM, not just visually checking that text appears on the right side
- [ ] **Undo logging:** Confirm the undo action is logged (as required) — check that a `roadmap_undo_log` table row (or equivalent) is written, not just the `roadmap_progress` update
- [ ] **New routes rate-limited:** Confirm `checkRateLimit()` is present in `/api/roadmap/undo` and `/api/plans` route handlers
- [ ] **New routes CSRF-protected:** Confirm `verifyOrigin(request)` is the first check in all new mutation routes
- [ ] **plan_json Zod parse at read time:** Confirm the plan read path uses `safeParse`, not a TypeScript cast — search for `as PlanJson` or `as unknown` in the plan data layer
- [ ] **Roadmap config step_number stability:** Confirm that after text updates, all 15 steps still have the same `step` number — no renumbering, only text/URL changes
- [ ] **Date consistency:** Confirm the client uses `getTodayUTC()` (not `getToday()`) when constructing plan requests and that `daily_plans.date` defaults to UTC in the migration

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Two active steps after undo without cascade | LOW | One-time SQL: `UPDATE roadmap_progress SET status = 'locked' WHERE student_id = X AND step_number = N+1 AND status = 'active' AND completed_at IS NULL` |
| plan_json schema mismatch (old rows fail to parse) | MEDIUM | Migration: `UPDATE daily_plans SET plan_json = NULL WHERE plan_json IS NOT NULL AND (plan_json->>'version')::int != 1` — let affected students create new plans |
| Daily plans with wrong date (local vs UTC) | MEDIUM | One-time migration to shift affected rows: identify plans created between UTC midnight and UTC+4 midnight, re-key by incrementing date by 1 day for affected students |
| Coach undo performed on wrong student | LOW | Reverse undo manually: `UPDATE roadmap_progress SET status = 'completed', completed_at = [original timestamp] WHERE ...` — requires checking undo log for original timestamp |
| Motivational card shown without valid Arabic text (empty string or null) | LOW | Add fallback rendering: if Arabic text is null/empty, show English-only card; never render an empty Arabic container |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Planning state breaks phase-reset effect | Daily session planner — client integration | Refresh page while in planning state; confirm planner UI persists |
| Coach undo doesn't re-lock N+1 | Coach undo endpoint | Check DB after undo: step N is active, step N+1 is locked, not both active |
| 4h cap client-side only | Daily session planner — API and cap enforcement | curl POST after cap reached; expect 400, not 201 |
| Date mismatch (local vs UTC) | Daily session planner — schema migration | Create plan at 11:30 PM UAE time; confirm it reads back correctly the next morning UTC |
| plan_json schema evolution | Daily session planner — schema migration | Run Zod parse on plan_json at read time; no TypeScript casts |
| Race condition on duplicate plan | Daily session planner — schema migration | UNIQUE constraint + idempotent POST handler |
| Arabic RTL rendering | Post-plan motivational card | DOM inspection confirms `dir="rtl"` on Arabic element; verify on 375px viewport |
| Config text updates affect in-flight students | Roadmap config text update phase | Accept as intentional; verify step numbers unchanged after update |
| Missing rate limit on new routes | All new API route phases | Grep for `checkRateLimit` in every new route file before marking phase done |
| Missing CSRF on new routes | All new API route phases | Grep for `verifyOrigin` in every new route file before marking phase done |

---

## Sources

- Codebase audit: `src/components/student/WorkTrackerClient.tsx` — phase state machine and guard logic
- Codebase audit: `src/app/api/roadmap/route.ts` — complete/unlock cascade pattern to invert for undo
- Codebase audit: `src/app/api/work-sessions/route.ts` and `[id]/route.ts` — existing cap and state transition enforcement
- Codebase audit: `src/lib/utils.ts` — `getToday()` (local) vs `getTodayUTC()` (UTC) inconsistency documented
- Codebase audit: `src/lib/roadmap-utils.ts` — UTC-safe date math pattern to follow
- Supabase Postgres docs: JSONB column validation, UNIQUE constraints, idempotent upsert patterns
- MDN Web Docs: Unicode Bidirectional Algorithm, `dir` attribute, `lang` attribute for Arabic text
- Tailwind CSS 4 docs: `text-right` vs `direction: rtl` — CSS text-align does not set bidi direction
- Codebase pattern: all 10 existing mutation routes use `verifyOrigin()` + `checkRateLimit()` as first checks

---
*Pitfalls research for: v1.3 session planner, coach undo, and motivational card additions to IMA Accelerator*
*Researched: 2026-03-31*
