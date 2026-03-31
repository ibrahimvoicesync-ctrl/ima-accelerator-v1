# Requirements: IMA Accelerator

**Defined:** 2026-03-31
**Core Value:** Students can track their daily work, follow the 10-step roadmap, and submit daily reports that coaches review — the core accountability loop.

## v1.3 Requirements

Requirements for milestone v1.3 (Roadmap Update, Session Planner & Coach Controls). Each maps to roadmap phases.

### Roadmap Content

- [x] **ROAD-01**: Step descriptions 1-8 have parenthetical text appended (e.g., "Complete your onboarding and set up your profile (time asap)")
- [x] **ROAD-02**: Step 5 unlock_url set to the skool CRM link; step 6 unlock_url removed
- [x] **ROAD-03**: Step 6 description updated to "Build 100 Influencer Lead List, and Watch 3 Influencer Roast My Email"; step 7 updated to drafting emails only
- [x] **ROAD-04**: Step 8 target_days set to 14
- [x] **ROAD-05**: Student roadmap view groups steps by stage with visible stage headers (Setup & Preparation, Influencer Outreach, Brand Outreach)
- [x] **ROAD-06**: Coach and owner roadmap tab shows stage headers matching student view

### Coach/Owner Undo

- [x] **UNDO-01**: Coach can revert any completed roadmap step to active for their assigned students via PATCH /api/roadmap/undo
- [x] **UNDO-02**: Owner can revert any completed roadmap step to active for any student via the same endpoint
- [x] **UNDO-03**: Undo presents a confirmation dialog before executing ("Are you sure you want to reset Step X back to active?")
- [x] **UNDO-04**: If step N+1 is currently active (not completed), undoing step N re-locks N+1 to maintain sequential progression
- [x] **UNDO-05**: Every undo action is logged to roadmap_undo_log table (who, when, which student, which step)

### Session Planner

- [ ] **PLAN-01**: Student sees a daily planner in Work Tracker page before their first session of the day
- [ ] **PLAN-02**: Student can add sessions (30/45/60 min) with a running total showing planned work hours (breaks excluded from total)
- [ ] **PLAN-03**: Break types alternate automatically: odd sessions (1st, 3rd, 5th) get short break, even sessions (2nd, 4th, 6th) get long break, last session has no break
- [ ] **PLAN-04**: Short break options are 5 or 10 min; long break options are 15, 20, 25, or 30 min (fixed choices per break type)
- [ ] **PLAN-05**: Student cannot plan more than 4 hours of work time; confirm button enabled when total reaches exactly 4h or nearest valid total below 4h
- [ ] **PLAN-06**: After confirming plan, planner disappears and WorkTracker executes planned sessions in sequence with assigned breaks
- [x] **PLAN-07**: daily_plans table stores one plan per student per day with plan_json (array of session configs), UNIQUE(student_id, date) constraint
- [ ] **PLAN-08**: POST /api/daily-plans validates 4h work cap server-side; returns existing plan on conflict (idempotent)
- [ ] **PLAN-09**: POST /api/work-sessions enforces 4h daily cap when a plan exists for the day
- [ ] **PLAN-10**: Student must complete all planned sessions before doing additional sessions

### Post-Plan Completion

- [ ] **COMP-01**: When all planned sessions are complete, a motivational card appears with Arabic "اللهم بارك" (large, centered) and English "You have done the bare minimum! Continue with your next work session"
- [ ] **COMP-02**: Card has two buttons: "Start Next Session" (goes to ad-hoc session picker) and "Dismiss" (closes card, returns to work tracker)
- [ ] **COMP-03**: Ad-hoc sessions after plan: student picks duration (30/45/60 min) and break type (short or long) freely, same fixed break options
- [ ] **COMP-04**: Motivational card appears once per day; returning to Work Tracker after seeing it goes straight to ad-hoc picker

## v1.2 Requirements (Completed)

All 20 requirements completed. See .planning/milestones/ for archived details.

### Database & Monitoring — 4/4 complete
### Query Optimization — 6/6 complete
### Write Path — 3/3 complete
### Security & Protection — 4/4 complete
### Infrastructure & Validation — 3/3 complete

## v1.1 Requirements (Completed)

All 29 requirements completed. See .planning/milestones/ for archived details.

### Work Sessions — 9/9 complete
### Outreach KPIs — 7/7 complete
### Coach/Owner Visibility — 4/4 complete
### Calendar — 4/4 complete
### Roadmap — 5/5 complete

## Future Requirements

Deferred to v1.4+. Tracked but not in current roadmap.

### Enhancements

- **ENH-01**: Days-to-target projection on KPI banner ("At current pace, you'll hit 2,500 in ~47 days")
- **ENH-02**: Roadmap completion velocity label ("Steps 1-5 in 12 days, target: 21 days")
- **ENH-03**: Session volume intensity shading on calendar cells (GitHub-style heat map)
- **ENH-04**: Joined-date marker on calendar
- **ENH-05**: Break duration proportional to session length (30 min -> 10 min break, 60 min -> 20 min)
- **ENH-06**: Session count badge replacing cycle count display
- **ENH-07**: Redis/Upstash cache layer (evaluate only if load testing proves Next.js cache insufficient)
- **ENH-08**: Coach visibility of student daily plans
- **ENH-09**: Student-editable plan durations (mid-plan editing with cap recalculation)
- **ENH-10**: Drag-to-reorder sessions in planner

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Supavisor/connection pooler setup | PostgREST has built-in connection pooler |
| Redis/Upstash cache | Evaluate only if load testing proves insufficient |
| In-memory rate limiting (lru-cache) | Broken in serverless — isolated per-container state |
| Student self-undo on roadmap | Accountability is core value; only coaches/owners can undo |
| Streak tracking tied to plan completion | Gamification is V2+ |
| Push/in-app notifications for session reminders | No notification system in V1 |
| Free-form duration input (text field) | V1.1 out of scope carry-over |
| Per-student custom KPI targets | Program-wide targets; per-cohort targets are V2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROAD-01 | Phase 25 | Complete |
| ROAD-02 | Phase 25 | Complete |
| ROAD-03 | Phase 25 | Complete |
| ROAD-04 | Phase 25 | Complete |
| ROAD-05 | Phase 25 | Complete |
| ROAD-06 | Phase 25 | Complete |
| UNDO-01 | Phase 27 | Complete |
| UNDO-02 | Phase 27 | Complete |
| UNDO-03 | Phase 27 | Complete |
| UNDO-04 | Phase 27 | Complete |
| UNDO-05 | Phase 26 | Complete |
| PLAN-01 | Phase 29 | Pending |
| PLAN-02 | Phase 29 | Pending |
| PLAN-03 | Phase 29 | Pending |
| PLAN-04 | Phase 29 | Pending |
| PLAN-05 | Phase 29 | Pending |
| PLAN-06 | Phase 29 | Pending |
| PLAN-07 | Phase 26 | Complete |
| PLAN-08 | Phase 28 | Pending |
| PLAN-09 | Phase 28 | Pending |
| PLAN-10 | Phase 29 | Pending |
| COMP-01 | Phase 29 | Pending |
| COMP-02 | Phase 29 | Pending |
| COMP-03 | Phase 29 | Pending |
| COMP-04 | Phase 29 | Pending |

**Coverage:**
- v1.3 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after v1.3 roadmap creation — all 25 requirements mapped*
