# Feature Research

**Domain:** Coaching / student accountability platform — v1.3 incremental features
**Researched:** 2026-03-31
**Confidence:** HIGH (features well-understood; motivational card bilingual details MEDIUM)

---

## Scope

This document covers only the NEW features in v1.3. Existing features (work tracker,
15-step roadmap, daily reports, coach review inbox) are already shipped and out of scope.

New feature groups:
1. Roadmap text + URL updates (content changes to ROADMAP_STEPS config)
2. Stage headers in student roadmap view
3. Coach/owner roadmap undo (revert completed step back to active)
4. Daily session planner (daily_plans table, 4h cap, alternating breaks, planned execution)
5. Post-plan completion motivational card + ad-hoc session picker

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the platform feels broken or incomplete without.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Roadmap step descriptions are accurate | Students use descriptions to know what to do; wrong/outdated text breaks guidance | LOW | Pure config change in ROADMAP_STEPS — no schema migration |
| Stage grouping headers in roadmap | 15 steps without visual grouping is a wall of text; any multi-stage checklist groups items | LOW | stageName already on every config entry; group in render |
| unlock_url on the correct step | Step 5 needs the Skool classroom link for "Begin 14 Day Warmup" | LOW | Single field move in config — no DB change |
| Confirmation before roadmap undo | Reverting a completed step is destructive; NN/G standard requires confirmation before irreversible operations | LOW | Reuse existing Modal primitive; mirrors abandon confirm pattern |
| Undo restricted to coach + owner only | Students cannot undo their own completions (accountability core value) | LOW | Role check in API + conditional render; additive to existing RoadmapTab |
| 4-hour work time cap enforced in plan | Platform goal is 4h daily work; plan must reflect this ceiling | MEDIUM | Cap on work minutes only — breaks are excluded from the count |
| Alternating break type in planned sessions | Structured rest between sessions: short break (5-10 min) most sessions, long break (15-20 min) at the midpoint | MEDIUM | Logic derived from session index in plan; matches existing breakOptions config |
| Planned sessions use existing WorkTracker | Students must not have two parallel timer UIs | MEDIUM | Plan stores intent; WorkTracker executes; no duplicate timer |
| Post-plan rest state (motivational card) | After completing 4h of planned work, the idle "Set Up Session" CTA is inappropriate — users need a positive resting state | MEDIUM | Card occupies the idle CTA area once plan is complete |
| Ad-hoc session option after plan complete | Blocking extra work is punitive for motivated students | LOW | Reuses existing duration picker + session start flow; outside plan cap |

### Differentiators (Competitive Advantage)

Features that add distinctive value beyond what generic coaching tools offer.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Arabic + English motivational card | Abu Lahya's community is Arabic-speaking; bilingual celebration card reflects brand identity and cultural resonance | LOW | Static content — Arabic quote + English translation; no RTL layout change needed |
| Undo action logging | Audit trail: coaches cannot silently revert progress; log shows who, which step, when | MEDIUM | New roadmap_undo_log table or audit row; prevents misuse of undo power |
| Plan completion summary | "4h 00m worked, 4 sessions, short/long breaks" gives a satisfying daily snapshot before closing the app | LOW | Derived from work_sessions already in DB; no new data fetch |
| Stage headers with completion counts | "Stage 1 — 7/7 complete" gives coaches and students instant macro-level progress visibility | LOW | Count from existing progress data; no new data source |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Students undo their own completed steps | "I clicked too early" edge case | Removes accountability — the platform's core value | Coaches/owners only; student asks coach if needed |
| Carry incomplete planned sessions to next day | Credit for partial effort | Creates stale plan state; today's plan must be self-contained | Plan expires at midnight; fresh plan each day |
| Rotating motivational quotes | More variety in card | Adds state/randomness; wrong quote could be jarring or culturally off | Single static, carefully chosen quote — always appropriate |
| Gamification on plan completion (streaks, badges) | Engagement loop | Explicitly V2+ scope; partial gamification creates incomplete experience | Plan completion count in daily report auto-fill; streaks V2+ |
| Let student modify session durations mid-plan | Flexibility | Undermines fixed 4h structure that gives the planner its clarity; partial cap recalculation is complex | Students can abandon and restart a session using existing flow |
| Push/in-app notification when plan session is due | Reminders | No notification system in V1 | Daily habit anchored by existing daily report reminder |

---

## Feature Dependencies

```
[Roadmap text + URL updates]
    └──requires──> [ROADMAP_STEPS config change only] (no DB migration)
    └──enhances──> [Stage headers in student roadmap view]

[Stage headers in student roadmap view]
    └──requires──> [stageName field already on every ROADMAP_STEPS entry] (exists)
    └──requires──> [Grouping logic in RoadmapClient + RoadmapTab]
    └──no new DB needed

[Coach/owner roadmap undo]
    └──requires──> [PATCH /api/roadmap/undo endpoint] (new)
    └──requires──> [roadmap_undo_log table] (new schema)
    └──requires──> [Undo button in RoadmapTab — coach + owner only] (conditional render)
    └──requires──> [Confirmation modal reusing existing Modal primitive]
    └──depends on──> [roadmap_progress table + status column] (exists)

[Daily session planner]
    └──requires──> [daily_plans table] (new schema)
    └──requires──> [POST /api/daily-plans endpoint] (new)
    └──requires──> [4h cap calculation: sum of plan session_minutes <= 240]
    └──requires──> [Alternating break assignment per session index]
    └──feeds into──> [Existing WorkTracker execution — no changes to WorkTrackerClient core]
    └──depends on──> [work_sessions + session_minutes column] (exists since v1.1)
    └──depends on──> [WORK_TRACKER.breakOptions config] (exists)

[Post-plan completion motivational card]
    └──requires──> [Daily session planner] (plan must exist and be fully complete)
    └──requires──> [Completion detection: all planned sessions have status=completed]
    └──replaces──> [Idle "Set Up Session" CTA in WorkTrackerClient]
    └──enhances──> [Ad-hoc session picker]

[Ad-hoc session picker]
    └──requires──> [Post-plan completion state is active]
    └──reuses──> [Existing WorkTracker session start + duration picker]
    └──NOT counted toward plan cap] (unlimited ad-hoc after plan complete)
```

### Dependency Notes

- **Roadmap text updates need no migration.** All step data lives in `src/lib/config.ts`. Deployed config change takes effect immediately. The `step_name` column in `roadmap_progress` is populated at lazy-seed time and not user-facing in a way that needs backfill — existing students see new descriptions on next page load.

- **Stage headers are purely presentational.** `stageName` is already on every step config entry. The RoadmapClient and RoadmapTab just need to group steps by `stage` number and render a section header when the stage changes. Zero new data.

- **Undo requires a new table.** Logging who undid which step and when is not optional — without an audit trail, the undo power can be misused silently. A `roadmap_undo_log` table with (id, student_id, step_number, undone_by, undone_at) is the minimum.

- **Daily session planner is the highest-complexity feature in v1.3.** New table, new endpoint, cap logic, alternating break assignment, and WorkTracker integration. The WorkTracker itself should NOT change — it becomes the execution layer for a planned session.

- **Motivational card conflicts with WorkTrackerClient idle state.** When plan is complete, the "Ready for Session N / Set Up Session" CTA must be suppressed or replaced. The card occupies that space. Ad-hoc sessions are surfaced below the card.

- **New endpoints need rate limiting and CSRF.** `checkRateLimit()` and `verifyOrigin()` already exist; they must be applied to PATCH /api/roadmap/undo and POST /api/daily-plans.

---

## MVP Definition

### Launch With (v1.3)

- [ ] Roadmap step descriptions updated (append parenthetical context per Abu Lahya's spec)
- [ ] unlock_url moved to step 5 (Skool classroom link), step 6/7 descriptions rewritten
- [ ] Step 8 target_days changed to 14
- [ ] Stage headers in student RoadmapClient and coach/owner RoadmapTab
- [ ] Undo button on completed steps in RoadmapTab (coach + owner only)
- [ ] Confirmation dialog before undo with specific action verb
- [ ] PATCH /api/roadmap/undo endpoint with auth + role check + rate limit + CSRF
- [ ] roadmap_undo_log table with RLS (coaches see only their students; owner sees all)
- [ ] daily_plans table with date, student_id, plan sessions JSONB or normalized rows
- [ ] POST /api/daily-plans creates today's plan with 4h cap validation
- [ ] WorkTracker reads from today's plan to surface next planned session context
- [ ] Alternating break type assigned per session index at plan creation
- [ ] Post-plan motivational card (Arabic quote + English translation + completion summary)
- [ ] Ad-hoc session picker below motivational card

### Add After Validation (v1.x)

- [ ] Coach visibility of student's daily plan — plan tab in student detail page; useful once multiple students use the planner actively
- [ ] Plan history view — past days with completion rates; foundation for v2 analytics

### Future Consideration (v2+)

- [ ] Student-editable plan (change session durations before executing) — fixed plan is the intended v1 UX
- [ ] Streak tracking tied to daily plan completion — explicitly out of scope until gamification milestone
- [ ] Push/in-app notification when plan session is due — requires notification system (V2+)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Roadmap text updates | HIGH — students read daily | LOW | P1 |
| Stage headers | MEDIUM — scanability of 15-step list | LOW | P1 |
| Undo (coach/owner) | HIGH — correction power without manual DB edits | MEDIUM | P1 |
| Undo action logging | MEDIUM — accountability audit trail | LOW (new table only) | P1 |
| Daily session planner core | HIGH — structured 4h plan is the daily heartbeat | HIGH | P1 |
| Alternating break logic | MEDIUM — reduces decision friction | LOW | P1 |
| Post-plan motivational card | MEDIUM — positive reinforcement + brand resonance | LOW | P1 |
| Ad-hoc session picker | LOW — power user; most won't need it | LOW | P2 |
| Coach plan visibility tab | LOW — deferred; adds value at scale | MEDIUM | P3 |

---

## Behavioral Patterns — Research Findings

### Daily Session Planner (Structured vs Ad-Hoc Sessions)

The distinction between planned and ad-hoc sessions is well-established in productivity apps
(Sunsama, Morgen, Session iOS): a **planned session** is created with purpose before the work
day begins; an **ad-hoc session** is unscheduled and emerges from available time or extra
motivation. The IMA planner follows this separation cleanly:

- Plan is created once per day, stores work intention up to the 4h cap
- Ad-hoc sessions are permitted after plan completion, uncapped, using the same WorkTracker
- Plan creation enforces the structure; ad-hoc respects student initiative

**4h work cap:** IMA's program defines 4h of focused work as the daily target. This is not
a Pomodoro pattern (25/5) but a total-work-minutes constraint. Break time is excluded from
the cap because Abu Lahya wants students to track _work_ time, not clock time.

**Alternating breaks:** Standard coaching productivity literature (Pomodoro technique,
Ultramarathon training, spaced repetition) uses a long rest at the midpoint of a work block
and short rests between shorter intervals. For a 4-session/4h plan:
- Session 1 → short break, Session 2 → long break, Session 3 → short break, Session 4 → (no break / plan complete)
- This S/L/S pattern matches the existing `breakOptions` config (short: 5/10 min, long: 15/20/25/30 min)

**Confidence:** MEDIUM — Pomodoro literature is well-sourced; specific alternating break
algorithm for 4-session plans is a reasonable inference, not a documented standard.

### Coach/Owner Undo Controls

Destructive action UX consensus from NN/G, UX Psychology, and LogRocket:
- Confirmation dialog is required before any irreversible state change
- The confirm button must use a danger/warning style and specific verb text
  (e.g., "Undo completion" not "Yes")
- The Student Clearinghouse compliance system uses a "Revert Completion Status" button
  in educational contexts — confirming this is an expected pattern in education/coaching platforms
- Optional "reason" field improves audit log quality but adds form complexity; for v1.3,
  logging actor + timestamp + step is sufficient

**Confidence:** HIGH — confirmed by NN/G + UX Psychology + Student Clearinghouse reference.

### Post-Plan Motivational Card

Post-goal motivation drop is a documented UX phenomenon: users lose drive immediately after
reaching a goal even when the next reward is visible (UI Patterns — Goal-Gradient Effect).
The countermeasure:
1. Celebrate with a distinct, non-dismissable completion state (not just a toast)
2. Provide clear "what next" CTAs — ad-hoc session or daily report
3. Keep the card visible until user navigates away (no auto-dismiss)

**Bilingual (Arabic + English):** Abu Lahya's program is Arabic-first. A centered Arabic
motivational quote in a card block with an English translation below is sufficient — no full
RTL layout change required. This pattern is common in Middle Eastern SaaS products. The card
does not change the page layout direction (the rest of the page stays LTR).

**Confidence:** MEDIUM — UX psychology literature is HIGH confidence; Arabic bilingual card
  pattern in web apps is inferred from common Middle Eastern product practice, not a specific
  sourced example.

---

## Existing Feature Interaction Summary

| Existing Feature | Interaction with v1.3 | Risk Level |
|------------------|-----------------------|------------|
| WorkTrackerClient (idle/setup/working/break state machine) | Plan complete state must suppress "Set Up Session" idle CTA; replace with motivational card | MEDIUM — requires conditional render; must not block ad-hoc start |
| RoadmapClient (student interactive) | Stage headers added; step completion flow unchanged | LOW — additive presentation only |
| RoadmapTab (coach/owner read-only) | Gains undo button per completed step; display logic unchanged | LOW — additive |
| ROADMAP_STEPS config | Text, target_days, unlock_url changes | LOW — no DB migration |
| work_sessions table + session_minutes | Daily planner references for cap calculation | LOW — column exists since v1.1 |
| Daily report auto-fill hours | Reads from work_sessions; plan sessions write to same table | NONE — transparent |
| checkRateLimit() helper | New endpoints (POST /api/daily-plans, PATCH /api/roadmap/undo) need rate limits | LOW — helper already exists |
| verifyOrigin() CSRF helper | New mutation endpoints need CSRF check | LOW — helper already exists |

---

## Sources

- [Confirmation Dialogs Can Prevent User Errors — NN/G](https://www.nngroup.com/articles/confirmation-dialog/)
- [How to design better destructive action modals — UX Psychology](https://uxpsychology.substack.com/p/how-to-design-better-destructive)
- [How To Manage Dangerous Actions In User Interfaces — Smashing Magazine](https://www.smashingmagazine.com/2024/09/how-manage-dangerous-actions-user-interfaces/)
- [UX for reversible actions: A decision framework — LogRocket](https://blog.logrocket.com/ux-design/ux-reversible-actions-framework)
- [Revert Sections to In-Progress — Student Clearinghouse](https://help.studentclearinghouse.org/compliancecentral/knowledge-base/revert-sections-to-in-progress-for-fvt-ge-reporting/)
- [Goal-Gradient Effect / Completion pattern — UI Patterns](https://ui-patterns.com/patterns/Completion)
- [12 UX design examples that motivate users to take action — Appcues](https://www.appcues.com/blog/examples-ux-that-encourage-users-to-take-action)
- [Planned and actual times — Sunsama](https://help.sunsama.com/docs/planned-and-actual-times)
- [The Pomodoro Technique — Todoist](https://www.todoist.com/productivity-methods/pomodoro-technique)
- [How to Maximize Client Accountability with Digital Tools — Upcoach](https://upcoach.com/client-accountability/)

---

*Feature research for: IMA Accelerator v1.3 — roadmap updates, coach undo, session planner, motivational card*
*Researched: 2026-03-31*
