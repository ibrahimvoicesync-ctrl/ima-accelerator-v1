# Feature Research

**Domain:** Coaching / Accelerator Platform — v1.1 New Features
**Researched:** 2026-03-27
**Confidence:** MEDIUM — patterns drawn from established productivity apps, KPI dashboard standards, and calendar UX guides; cross-validated against existing v1.0 codebase

---

## Scope Note

This document supersedes the v1.0 FEATURES.md. It preserves the v1.0 table stakes, differentiators, and anti-features as shipped context, then adds a dedicated v1.1 feature landscape for the five new feature areas. v1.0 features are already built and validated — they appear only where they create dependencies for v1.1 features.

---

## v1.1 Feature Landscape

The five new feature areas are:

1. Flexible work sessions (selectable durations, breaks, no cycle cap)
2. KPI progress banner (granular outreach tracking, sticky banner, 2,500 lifetime / 50 daily targets)
3. Coach/owner student KPI visibility (read-only progress views)
4. Calendar view (month grid on student detail pages)
5. Roadmap date KPIs (deadlines relative to joined_at, completion timestamps)

---

### Feature Area 1: Flexible Work Sessions

#### What platforms do

Productivity apps like Pomofocus, Forest, and Super Productivity converged on the same UX in 2024–2025:

- **Duration picker at idle state** — a segmented button group (3–4 options: 25 / 45 / 60 / 90 min) shown before the session starts. The currently selected duration shows a filled/active state. This is chosen once per session start, not re-configurable mid-session.
- **No selection after start** — once the timer is running, duration is locked. Changing it requires abandoning and restarting.
- **Break countdown as a distinct phase** — after a session completes, the UI transitions to a break phase with its own countdown (separate visual: lighter color, different label "Break Time"). Break duration is typically half the session duration by convention (15 min after 30, 20 min after 45–60).
- **Skip break = one button** — a ghost/secondary "Skip Break" button sits alongside the break countdown. Tapping it immediately ends the break state and shows the idle/start-next state. No confirmation required.
- **No cycle cap in flex mode** — flex mode apps track cycles but don't enforce a daily maximum. The count is informational ("4 cycles completed today"), not a gate.

#### Table stakes for this feature

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Duration selector (3 options: 30/45/60 min) | Users starting a session expect to choose duration; a single hardcoded value feels like a prototype, not a tool | LOW | Segmented button group at idle state; 45 min pre-selected as default (matches v1.0 behavior) |
| Break countdown after session completion | Every productive timer app shows a break state; skipping it makes the tool feel incomplete and removes recovery time UX | LOW | Auto-starts on session complete; shown as a distinct "Break" phase with its own visual |
| Skip break button | Users who want to chain sessions back-to-back expect a one-tap skip; forcing the full break countdown creates friction | LOW | Single ghost button during break phase; no confirmation dialog |
| Remove 4-cycle daily cap | Without a cap, students can do more than 4 sessions on motivated days; cap felt arbitrary once flexible durations are supported | LOW | Remove `cyclesPerDay` enforcement; keep `cyclesPerDay` config for display/analytics only |
| Duration stored per session | Coach/owner views show session duration to give accurate total hours; "45 min" label was previously implicit, must now be explicit | LOW | `duration_minutes` already exists in schema; store selected duration at session start |

#### Differentiators for this feature

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Break duration proportional to session length | 30-min sessions get 10-min breaks; 60-min sessions get 20-min breaks — more accurate than a flat 15-min break | LOW | Compute in config: break = session / 3, rounded to 5 min |
| Session count badge on daily summary | Show total sessions + total hours worked (not just cycles) after removing the cap | LOW | Replaces "4/4 cycles" with "6 sessions · 4h 30m" pattern |

#### Anti-features for this feature

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Free-form duration input (text field) | Power users want exactly 37 minutes | Validation complexity, UX complexity, timer math breaks at edge values | 3 preset options cover 99% of cases; presets = safe values |
| Pause during break countdown | Some users want to freeze the break | State complexity multiplies; break is recovery time, not a tracked work period | Skip break covers this: if you want to stop the break, skip it |
| Auto-start next session after break | Apps like Forest offer this | Removes intentional start gesture; students may be AFK during break; ghost sessions inflate data | Keep explicit "Start Session" CTA after break; no auto-start |

---

### Feature Area 2: KPI Progress Banner

#### What platforms do

Productivity dashboards and CRM-lite tools (Streak, SARAL, Upfluence) that track outreach volume use two distinct patterns for progress toward targets:

- **Sticky top banner / persistent card** — a narrow bar or card fixed below the page header (not a toast) that shows the current-period vs target number with a color-coded progress bar. Color convention is universal RAG (Red/Amber/Green): green at/above target, amber within ~20% of target, red below 80% of target. This is not dismissed by the user — it is always visible on the relevant pages.
- **Dual-scope progress** — showing both a daily KPI (50 outreach/day) and a lifetime KPI (2,500 total) in the same banner, stacked or side-by-side. Daily resets at midnight; lifetime accumulates indefinitely.
- **Progress bar with numeric label** — the bar fills proportionally; the label shows "37 / 50 today" or "1,240 / 2,500 lifetime". The bar communicates pace; the label gives precision.
- **Granular outreach breakdown** — CRM tools (Breakcold, SARAL) separate outreach by type: Influencers Contacted vs Brands Contacted. Each gets its own counter. Daily report asks for one combined outreach_count field — the granularity must live somewhere else (a separate tracker or expanded report fields).

#### Table stakes for this feature

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sticky progress banner visible on student dashboard | The target (2,500 lifetime outreach) is a program KPI; students need ambient awareness of where they stand | MEDIUM | Fixed below page header on `/student` dashboard; does not overlay content, pushes layout down |
| Lifetime outreach progress bar (0 → 2,500) | The 2,500 contact target is the core program completion milestone; showing it as a bar makes abstract progress concrete | LOW | Computed from sum of `daily_reports.outreach_count` for this student |
| Daily outreach progress bar (0 → 50) | The 50/day target drives daily motivation; green/amber/red status drives daily behavior | LOW | Sum of outreach_count for today's report; resets daily |
| RAG color coding (green/amber/red) | Universal dashboard convention; users recognize green=good, red=needs work without reading labels | LOW | Green: ≥ target; amber: ≥ 80% of target; red: < 80% of target |
| Numeric labels alongside bars | "342 / 2,500" is more actionable than just a filled bar; users need to know the exact gap | LOW | Show "X / Y" format; on mobile, consider abbreviating to "342/2.5k" |

#### Differentiators for this feature

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Granular breakdown: brands vs influencers contacted | IMA students do two types of outreach; grouping them into one count obscures performance on each dimension | MEDIUM | Requires new fields in `daily_reports`: `brands_contacted` and `influencers_contacted`; sum of both = `outreach_count` for backward compatibility |
| Granular breakdown: contacted vs emailed | "Contacted" (DM/message) vs "emailed" (formal email pitch) are different effort levels; separating them shows pipeline maturity | MEDIUM | Requires additional daily_report fields; consider adding `influencers_emailed`, `brands_emailed` |
| Days-to-target projection | "At your current pace, you'll hit 2,500 in ~47 days" — motivating if on track, alerting if behind | LOW | Compute: (2500 - lifetime_count) / avg_daily_outreach; show only if >7 days of data |

#### Anti-features for this feature

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Dismissable/collapsible banner | Users want to hide it once they've seen it | Defeats the purpose of ambient KPI visibility; coaches lose the signal that students see their targets | Keep it permanently visible; if it becomes noise, revisit in V2 |
| Separate outreach tracker page | More detail is better; dedicated page for outreach logging | Daily report IS the logging surface; a second entry point creates dual-source-of-truth risk | Add fields to the daily report form; no separate page |
| Toast notifications when hitting milestones | "You hit 100 outreach!" celebration toast | Toast infrastructure adds complexity; milestone moments should be celebrated in the banner (color + text change), not ephemerally | Banner text changes on milestone: "Goal reached!" in green |

---

### Feature Area 3: Coach/Owner KPI Visibility

#### What platforms do

B2B coaching tools (CoachAccountable, Qooper, Simply.Coach) give coaches read-only views of their clients' progress metrics. The pattern is consistent:

- **Embedded in the student detail page** — not a separate analytics screen. The coach opens a student's detail page and sees the same progress indicators the student sees, presented as read-only cards.
- **Summary, not raw data** — coaches see lifetime outreach count, daily outreach today, roadmap step, and a mini progress bar. They do not see the student's session-by-session timer log.
- **Status labeling** — the coach sees the same RAG status the student sees ("On track", "Behind today") so coaching conversations have shared reference points.

#### Table stakes for this feature

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| KPI summary card on coach student detail page | Coaches need to see outreach progress to have informed conversations; without it they can only discuss attitude not metrics | LOW | Read-only card showing: lifetime outreach / 2,500, today's outreach / 50, RAG status |
| KPI summary card on owner student detail page | Owner monitors all students; same visibility needed for platform-level health | LOW | Identical component, different data access path |
| Roadmap step in KPI card | The roadmap step contextualizes outreach numbers; Step 3 vs Step 9 student with 50 outreach means very different things | LOW | Pull from existing roadmap_progress data |

#### Differentiators for this feature

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Banner-consistent RAG coloring on coach view | When coach and student see the same color for the same metric, coaching conversations are aligned — no "I thought you were on track" miscommunication | LOW | Reuse same color-computation logic; extract to utility function |

#### Anti-features for this feature

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Coach ability to edit/override KPI targets | Coaches want to set custom targets per student | Targets are program-wide (2,500/50 are Abu Lahya's numbers); per-student overrides create tracking inconsistency and comparison issues | Keep targets in config.ts; if Abu Lahya wants per-cohort targets, that's V2 |
| Coach-facing analytics tab for outreach trends | Historical chart of daily outreach over time per student | Chart infrastructure (recharts or similar) is non-trivial; this is analytics, not visibility | A 7-day sparkline (simple inline SVG) could substitute without a library |

---

### Feature Area 4: Calendar View

#### What platforms do

Habit trackers (Streaks, Done, Habitify), learning platforms (Duolingo web), and coaching tools with activity logs consistently converge on two patterns:

**Pattern A — Month grid (dominant pattern):**
- A standard calendar grid (7 columns for days, 4–6 rows for weeks)
- Each cell has the date number plus a small indicator: filled dot (activity happened), empty cell (no activity), subtle X or outline (tracked absence)
- Color/opacity intensity reflects volume: one session = light blue fill, four sessions = full blue. GitHub-style heat map intensity.
- Clicking a cell opens a day detail — either as a right panel (desktop) or modal bottom sheet (mobile)

**Pattern B — List with date grouping (simpler alternative):**
- A flat list of days that had activity, newest first
- No calendar grid; no navigation
- Easier to implement, but loses the "weeks at a glance" density view

For the IMA student detail page (coach/owner view), Pattern A is standard. The existing v1.0 design already uses tabs (sessions / reports); a calendar that consolidates both is an upgrade, not a new paradigm.

**Day detail panel conventions:**
- Slide-in side panel on desktop (not a modal; keeps calendar visible)
- Bottom sheet or inline expansion on mobile (modal adds extra tap)
- Panel shows: sessions that day (each with duration + status), the daily report if submitted (rating, outreach, wins/improvements)
- Empty state for days with no data: "No activity recorded"
- Past days only; future days are non-interactive (visually muted)

#### Table stakes for this feature

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Month grid with day cells | Users on coach/owner student detail pages expect a calendar view; tab-based sessions/reports lists lack temporal context | MEDIUM | 7-col grid; start-of-week Sunday (or Monday — match locale); show current month by default |
| Indicator dot per cell | Visual signal that "something happened this day" without reading; density communicates consistency | LOW | One dot = at least one session or a submitted report; dot color: blue (sessions), green (report), both = split or blend |
| Prev/next month navigation | One month of data is insufficient for coaching; coaches need to see last 90 days | LOW | Two chevron buttons in calendar header; disable "next" if current month is shown |
| Day detail panel/drawer | Clicking a day must show what happened; without this the calendar is decoration | MEDIUM | Right panel on md+ screens; bottom sheet or modal on mobile |
| Sessions list in day detail | Coach needs to see if student worked, how long, and whether sessions were completed or abandoned | LOW | Show each session: duration_minutes, status (completed/abandoned), started_at time |
| Daily report in day detail | Report data belongs in the same panel as session data; splitting them requires additional navigation | LOW | Show star rating, outreach count, wins, improvements if report was submitted for that day |
| Empty state for days without data | Clicking an empty cell should not show a blank panel; needs communicative empty state | LOW | "No sessions or report on [date]" copy |

#### Differentiators for this feature

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-indicator cell (session dot + report dot) | Distinguishes "worked but didn't report" vs "reported but didn't track sessions" — both are coaching signals | LOW | Two small dots per cell or a split indicator; color-coded |
| Session volume intensity shading | A cell with 4 sessions is darker than a cell with 1 session; GitHub-style heat intensity shows effort peaks at a glance | LOW | Opacity tiers: 1 session = 30% fill, 2 = 50%, 3 = 70%, 4+ = 100% of ima-primary |
| Joined date marker | Marking the student's first day on the calendar makes the "days since joining" visible and contextualizes early progress | LOW | A subtle border or badge on the joined_at date cell |

#### Anti-features for this feature

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Editable calendar (click day to add/edit data) | Coaches want to retroactively correct data | Opens permission model complexity; coaches should not edit student session or report data; trust in the record depends on it being student-generated | Read-only calendar; if corrections are needed, Owner can handle via database admin |
| Year view / heat map mode | GitHub contribution graph is familiar | Annual heat map requires 52+ weeks of data; most students are weeks in, not years; the view would be mostly empty | Month view with prev/next covers all practical cases |
| Event drag-and-drop | Calendar UIs invite rescheduling | This is a historical record viewer, not a scheduler; no future dates, no events to reschedule | Non-interactive future cells; read-only past cells |

---

### Feature Area 5: Roadmap Date KPIs

#### What platforms do

Online course platforms (Thinkific, Teachable, Kajabi), project management tools (Linear, Basecamp), and mentorship platforms (Qooper, Together Platform) use the same deadline status pattern:

- **Relative-to-start dates** — deadlines computed as `joined_at + N days` for each milestone. This is simpler and fairer than calendar-fixed deadlines because cohorts start at different times.
- **Three states with visual labels** — "On Track" (green), "Due Soon" (amber, typically within 3–7 days of deadline), "Overdue" (red, past deadline). Some platforms add "Completed" (muted/checkmark) for finished milestones.
- **Days remaining / days overdue label** — "3 days left" or "2 days overdue" alongside the status chip. Pure color-coding without numbers makes it hard to act.
- **Completion timestamp** — when a step is completed, show the actual date ("Completed Mar 15") rather than the status label. This is standard in project tools and gives coaches a concrete record.
- **Status displayed at the step level** — not in a global banner; each roadmap step card shows its own deadline status inline. A summary line at the top ("3 steps on track, 1 overdue") gives the overview without replacing per-step labels.

#### Table stakes for this feature

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Target deadline per roadmap step (relative to joined_at) | Students need to know if they are ahead or behind program pace; a roadmap without deadlines is a wishlist | MEDIUM | Define `targetDays` per step in `ROADMAP_STEPS` config; deadline = `joined_at + targetDays` |
| On-track / due-soon / overdue status chips | Color-coded status is the universal pattern for milestone tracking; text alone is insufficient at a glance | LOW | Green chip: on track; amber: ≤ 7 days to deadline; red: past deadline |
| Days remaining / days overdue label | "4 days left" is more motivating and actionable than just "amber"; precision drives behavior | LOW | Compute from `deadline - today`; display as "4 days left" or "2 days overdue" |
| Completion date display on completed steps | "Completed Mar 15" on finished steps gives coaches a coaching artifact ("you hit Step 5 in 8 days — faster than target!") | LOW | `completed_at` already exists in schema; display it formatted as "Completed [date]" |
| Status visible to students on their roadmap | Students must see their own deadline status; the roadmap page is their primary self-awareness surface | LOW | Add deadline KPI inline to each RoadmapStep card |
| Status visible to coaches on student roadmap tab | Coaches need deadline context during report reviews and coaching conversations | LOW | Read-only version of student roadmap displayed on coach student detail page |

#### Differentiators for this feature

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Roadmap completion velocity label | "You completed Steps 1–5 in 12 days (target: 21 days) — ahead of pace" — motivates students who are doing well | LOW | Compute: (steps completed) / (days since joined) vs (target steps) / (program days); show only if ≥ 2 steps complete |
| Target days configurable per step in config.ts | Abu Lahya may revise expected timelines for each step; config-driven means no migration needed | LOW | Add `targetDays` field to each ROADMAP_STEPS entry |

#### Anti-features for this feature

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Absolute calendar deadlines (fixed dates) | Easier to communicate to cohorts as calendar events | Makes all students share the same deadline regardless of when they joined; penalizes late joiners; requires updating deadlines for each new cohort | Relative deadlines (joined_at + N days) are automatically correct for every student regardless of join date |
| Automated deadline extensions via UI | Students want to request more time | Opens negotiation and exception-tracking complexity; coaches would need approval flows | Abu Lahya sets program pace; if a step's target days need adjusting, change the config |
| Email / in-app notifications for approaching deadlines | Platforms like Notion send deadline reminders | Notification infrastructure is explicitly out of scope for V1 (see PROJECT.md) | The deadline status chip on the roadmap page IS the notification |
| Progress % toward next deadline | "You are 60% toward your Step 6 deadline" | Meaningless without knowing what 60% of a roadmap step looks like; roadmap steps are binary (not done / done) | Days remaining is the right metric for binary milestones |

---

## Feature Dependencies (v1.1)

```
[V1.0 daily_reports.outreach_count]
    └──required by──> KPI Progress Banner (lifetime sum)
    └──required by──> KPI Progress Banner (daily count)

[New daily_report fields: brands_contacted, influencers_contacted]
    └──requires──> Daily Report Form update (new fields)
    └──required by──> Granular KPI breakdown

[KPI Progress Banner (student-facing)]
    └──enhances──> Coach/Owner KPI Visibility (same data, different viewer)
    └──shared logic──> RAG color utility function

[V1.0 roadmap_progress.completed_at]
    └──required by──> Roadmap completion date display
    └──already populated──> completed_at set when step status → 'completed' in v1.0

[users.joined_at]
    └──required by──> Roadmap date KPIs (deadline = joined_at + targetDays)
    └──already populated──> set at registration in v1.0

[V1.0 work_sessions + daily_reports per day]
    └──required by──> Calendar view day detail panel
    └──required by──> Calendar cell indicators

[ROADMAP_STEPS config (new targetDays field)]
    └──required by──> Roadmap date KPI computation
    └──required by──> On-track / due-soon / overdue status

[Flexible session duration (duration_minutes stored at start)]
    └──required by──> Accurate total hours in KPI banner
    └──required by──> Accurate hours in calendar day detail

[V1.0 work_sessions.cycle_number UNIQUE constraint]
    └──conflicts with──> Removing 4-cycle cap (constraint must be dropped or relaxed)
```

### Dependency Notes

- **outreach_count before KPI banner:** Daily report submission already captures `outreach_count`. The banner reads this existing data. Granular breakdown (brands/influencers) requires new fields and a daily report form update before the breakdown view can exist.
- **completed_at before completion display:** `completed_at` is already populated in v1.0 when a step is marked complete. No migration needed; just display the value.
- **joined_at before roadmap deadlines:** `joined_at` is set at registration in v1.0. No migration needed; compute `joined_at + targetDays` at render time.
- **cycle_number unique index must change:** The existing `idx_work_sessions_student_date_cycle` unique index enforces `(student_id, date, cycle_number)` uniqueness. Removing the cycle cap means students can start a 5th session. The index must be dropped or the cycle_number column semantics must change (treat it as a sequential session counter, not a 1–4 cap). This is the most significant schema change in v1.1.
- **duration_minutes at session start:** v1.0 stores `duration_minutes` only when a session is completed (set to `WORK_TRACKER.sessionMinutes`). v1.1 needs to store the selected duration at session start time so the timer countdown is accurate for that session. API handler for POST `/api/work-sessions` must accept `selected_duration_minutes`.

---

## MVP Definition (v1.1)

### Build for v1.1

All six features are in scope and interdependent enough to ship together:

- [ ] Flexible work sessions — selectable 30/45/60 min durations, break countdown, skip break, remove 4-cycle cap; requires schema change to `work_sessions`
- [ ] KPI progress banner — lifetime + daily outreach bars on student dashboard; RAG color coding; reads from existing `daily_reports.outreach_count`
- [ ] Granular outreach breakdown — new `brands_contacted` / `influencers_contacted` fields on daily reports; update report form; update KPI banner
- [ ] Coach/owner KPI visibility — read-only KPI card on student detail pages for both roles
- [ ] Calendar view — month grid on coach/owner student detail pages; day detail panel; replaces session + report tabs
- [ ] Roadmap date KPIs — `targetDays` in config per step; on-track/due-soon/overdue status chips; days remaining labels; completed_at display on student roadmap and coach/owner views

### Defer to v1.2+

- [ ] Days-to-target projection on KPI banner — needs 7+ days of data to be meaningful; add after students have accumulated history
- [ ] Roadmap completion velocity label — nice-to-have motivational signal; add after validating that deadline status alone is sufficient
- [ ] Session volume intensity shading on calendar — enhances the calendar; can ship with flat dot indicators first
- [ ] Year/heat-map calendar view — low value for early-stage students; most will have < 8 weeks of data

---

## Feature Prioritization Matrix (v1.1)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Flexible work sessions (duration select + break) | HIGH | MEDIUM | P1 |
| Remove 4-cycle cap (schema change) | HIGH | MEDIUM | P1 — blocks flexible sessions |
| KPI progress banner (lifetime + daily) | HIGH | LOW | P1 |
| RAG color coding utility | MEDIUM | LOW | P1 — shared by banner + coach view |
| Coach/owner KPI visibility | HIGH | LOW | P1 — depends on banner logic |
| Calendar month grid | HIGH | MEDIUM | P1 |
| Calendar day detail panel | HIGH | MEDIUM | P1 — calendar without detail is decoration |
| Roadmap deadline config (targetDays per step) | HIGH | LOW | P1 |
| Roadmap on-track/due-soon/overdue status | HIGH | LOW | P1 — depends on config |
| Completed_at display on roadmap steps | MEDIUM | LOW | P1 — data already exists |
| Granular outreach breakdown (report form update) | MEDIUM | MEDIUM | P2 |
| Break duration proportional to session length | LOW | LOW | P2 |
| Session count badge replacing cycle count | LOW | LOW | P2 |
| Joined-date marker on calendar | LOW | LOW | P3 |
| Days-to-target projection | MEDIUM | LOW | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add when possible within v1.1 scope
- P3: Nice to have, defer to v1.2

---

## UX Patterns Reference (for phase implementation)

### Timer Duration Selection
Standard segmented button group pattern: `[30 min] [45 min] [60 min]` rendered as a row of pill buttons. Active option has filled background (ima-primary). Visible only in the idle state before session start. 45 min pre-selected. Once session starts, the selected duration is locked and the buttons are hidden — only the running timer is shown.

### Break Countdown
Shown as a distinct phase after session completion. Visually differentiated from work phase: lighter background color (ima-success/10), "Break Time" label instead of cycle number, break duration countdown in same monospace timer format. "Skip Break" is a ghost/text button — not a primary CTA — to reduce accidental taps.

### RAG Color Thresholds (outreach KPIs)
- Green (on track): outreach_count >= target
- Amber (at risk): outreach_count >= 80% of target
- Red (behind): outreach_count < 80% of target
- Source: ClearPoint Strategy RAG standard starting tolerances, adjusted to 80% amber threshold (tighter than the 10% recommendation) to reflect this domain's daily behavioral target.

### Calendar Cell Indicators
Two micro-dots per cell (stacked or side-by-side): one for sessions (blue = ima-primary), one for report (green = ima-success). If neither: empty cell. Intensity: cells with 3+ sessions get full opacity; 1–2 sessions get 60% opacity. Future dates: no dots, muted date number, non-interactive cursor.

### Roadmap Status Chips
Inline pill chip per step, right-aligned on the step card:
- On Track: green background (ima-success/10), green text (ima-success), text: "On Track · N days left"
- Due Soon: amber background (ima-warning/10), amber text (ima-warning), text: "Due Soon · N days left"
- Overdue: red background (ima-error/10), red text (ima-error), text: "Overdue · N days ago"
- Completed: muted background (ima-border), secondary text, text: "Completed [date]"

---

## Sources

- ClearPoint Strategy: [RAG Status Thresholds](https://www.clearpointstrategy.com/blog/establish-rag-statuses-for-kpis) — MEDIUM confidence
- UX Patterns for Developers: [Calendar View Pattern](https://uxpatterns.dev/patterns/data-display/calendar) — MEDIUM confidence
- Zapier: [Best Pomodoro Timer Apps 2025](https://zapier.com/blog/best-pomodoro-apps/) — MEDIUM confidence
- Pomofocus.io — observation of break/skip UX pattern — MEDIUM confidence
- Qooper / Simply.Coach / CoachAccountable — read-only coach progress views pattern — MEDIUM confidence
- Eleken: [Calendar UI Examples](https://www.eleken.co/blog-posts/calendar-ui) — MEDIUM confidence
- Existing v1.0 codebase: `src/components/student/WorkTrackerClient.tsx`, `CycleCard.tsx`, `supabase/migrations/00001_create_tables.sql`, `src/lib/config.ts` — HIGH confidence (primary source)
- Project context: `.planning/PROJECT.md` — HIGH confidence

---

*Feature research for: IMA Accelerator v1.1 — Flexible Work Sessions, KPI Banner, Calendar View, Roadmap Date KPIs*
*Researched: 2026-03-27*
