# Requirements: IMA Accelerator

**Defined:** 2026-03-27
**Core Value:** Students can track their daily work, follow the 10-step roadmap, and submit daily reports that coaches review — the core accountability loop.

## v1.1 Requirements

Requirements for milestone v1.1 (V2 Feature Build). Each maps to roadmap phases.

### Work Sessions

- [ ] **WORK-01**: Student can select session duration (30, 45, or 60 min) before starting a cycle
- [ ] **WORK-02**: Student can select break type (short 5-10 min or long 10-30 min) and exact duration before starting a cycle
- [ ] **WORK-03**: First cycle of the day skips the break — break runs between cycles only
- [ ] **WORK-04**: Break displays as a visible countdown; when break ends, student can start next cycle
- [ ] **WORK-05**: Student can skip a break early
- [ ] **WORK-06**: Each work_sessions row stores the chosen session_minutes so history is accurate
- [ ] **WORK-07**: Circular timer adapts to whatever duration was chosen
- [ ] **WORK-08**: No daily cycle cap — students can do unlimited sessions (4-hour daily goal remains as KPI, not hard cap)
- [x] **WORK-09**: DB migration adds session_minutes column to work_sessions

### Outreach KPIs

- [ ] **KPI-01**: daily_reports stores granular outreach: outreach_brands, outreach_influencers, brands_contacted, influencers_contacted, calls_joined
- [ ] **KPI-02**: Total outreach = outreach_brands + outreach_influencers, computed at query time
- [ ] **KPI-03**: Daily report form collects outreach_brands, outreach_influencers, brands_contacted, influencers_contacted, calls_joined (replaces single outreach_count)
- [ ] **KPI-04**: Sticky ProgressBanner on every student page shows: X/2,500 lifetime outreach, X/50 daily outreach, hours worked, calls joined, brands contacted, influencers contacted
- [ ] **KPI-05**: RAG color coding: green (on target), amber (>=80%), red (<80%) on all KPI indicators
- [ ] **KPI-06**: Student homepage shows KPI breakdown cards with RAG color coding
- [x] **KPI-07**: DB migration adds 5 new integer columns to daily_reports

### Coach/Owner Visibility

- [ ] **VIS-01**: Coach student detail page shows read-only KPI summary (lifetime outreach/2,500, daily/50, hours, RAG status)
- [ ] **VIS-02**: Owner student detail page shows same read-only KPI summary
- [ ] **VIS-03**: KPI card includes current roadmap step for context
- [ ] **VIS-04**: Coach and owner see same RAG status colors as the student

### Calendar

- [ ] **CAL-01**: Month grid calendar on coach and owner student detail pages with day indicators (green = work + report, amber = partial, empty = nothing)
- [ ] **CAL-02**: Clicking a day opens inline panel showing that day's work sessions and report side by side
- [ ] **CAL-03**: Month navigation (prev/next) with current month as default
- [ ] **CAL-04**: Calendar tab replaces Work Sessions and Reports tabs; Roadmap stays as separate tab

### Roadmap

- [ ] **ROAD-01**: Each roadmap step has target_days in config; deadline = joined_at + target_days
- [ ] **ROAD-02**: Status chips on each step: on track (green), due soon (amber, within 2 days), overdue (red), completed (with date)
- [ ] **ROAD-03**: Completed steps display their completed_at date
- [ ] **ROAD-04**: Deadline status visible on student roadmap view
- [ ] **ROAD-05**: Deadline status visible on coach and owner student detail roadmap views

## Future Requirements

Deferred to v1.2+. Tracked but not in current roadmap.

### Enhancements

- **ENH-01**: Days-to-target projection on KPI banner ("At current pace, you'll hit 2,500 in ~47 days")
- **ENH-02**: Roadmap completion velocity label ("Steps 1-5 in 12 days, target: 21 days")
- **ENH-03**: Session volume intensity shading on calendar cells (GitHub-style heat map)
- **ENH-04**: Joined-date marker on calendar
- **ENH-05**: Break duration proportional to session length (30 min → 10 min break, 60 min → 20 min)
- **ENH-06**: Session count badge replacing cycle count display

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Free-form duration input (text field) | Validation complexity; 3 presets cover all cases |
| Pause during break countdown | State complexity; skip break covers this |
| Auto-start next session after break | Removes intentional start gesture; ghost sessions inflate data |
| Dismissable/collapsible KPI banner | Defeats ambient KPI visibility purpose |
| Separate outreach tracker page | Daily report IS the logging surface; avoids dual-source-of-truth |
| Coach ability to edit/override KPI targets | Targets are program-wide (Abu Lahya's numbers); per-student overrides are V2 |
| Coach outreach trend charts | Chart infrastructure is non-trivial; sparklines could substitute later |
| Editable calendar (coach corrections) | Trust in record depends on student-generated data |
| Year view / heat map mode | Students have < 8 weeks data; mostly empty |
| Calendar drag-and-drop | Historical record viewer, not a scheduler |
| Absolute calendar deadlines | Penalizes late joiners; relative deadlines auto-correct |
| Automated deadline extensions via UI | Opens negotiation complexity; change config if needed |
| Email/in-app deadline notifications | Notification infrastructure out of scope for v1.1 |
| Per-student custom KPI targets | Program-wide targets; per-cohort targets are V2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WORK-01 | Phase 14 | Pending |
| WORK-02 | Phase 14 | Pending |
| WORK-03 | Phase 14 | Pending |
| WORK-04 | Phase 14 | Pending |
| WORK-05 | Phase 14 | Pending |
| WORK-06 | Phase 14 | Pending |
| WORK-07 | Phase 14 | Pending |
| WORK-08 | Phase 14 | Pending |
| WORK-09 | Phase 13 | Complete |
| KPI-01 | Phase 15 | Pending |
| KPI-02 | Phase 15 | Pending |
| KPI-03 | Phase 15 | Pending |
| KPI-04 | Phase 15 | Pending |
| KPI-05 | Phase 15 | Pending |
| KPI-06 | Phase 15 | Pending |
| KPI-07 | Phase 13 | Complete |
| VIS-01 | Phase 16 | Pending |
| VIS-02 | Phase 16 | Pending |
| VIS-03 | Phase 16 | Pending |
| VIS-04 | Phase 16 | Pending |
| CAL-01 | Phase 17 | Pending |
| CAL-02 | Phase 17 | Pending |
| CAL-03 | Phase 17 | Pending |
| CAL-04 | Phase 17 | Pending |
| ROAD-01 | Phase 13 | Pending |
| ROAD-02 | Phase 18 | Pending |
| ROAD-03 | Phase 18 | Pending |
| ROAD-04 | Phase 18 | Pending |
| ROAD-05 | Phase 18 | Pending |

**Coverage:**
- v1.1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation*
