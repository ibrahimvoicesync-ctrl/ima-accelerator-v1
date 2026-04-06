# Requirements: IMA Accelerator V1

**Defined:** 2026-04-06
**Core Value:** Students can track their daily work, follow the 10-step roadmap, and submit daily reports that coaches review — the core accountability loop.

## v1.5 Requirements

Requirements for milestone v1.5 Student Deals. Each maps to roadmap phases.

### Deal CRUD

- [ ] **DEAL-01**: Student can add a deal with revenue and profit fields
- [ ] **DEAL-02**: Deal receives auto-incremented deal_number per student ("Deal #1", "Deal #2")
- [ ] **DEAL-03**: Student can view their deal history list (most recent first)
- [ ] **DEAL-04**: Student can edit their own deals (update revenue and profit)
- [ ] **DEAL-05**: Student can delete their own deals (hard delete)
- [ ] **DEAL-06**: Both student and student_diy roles have access to Deals page
- [ ] **DEAL-07**: Deal add, edit, and delete use useOptimistic for instant UI feedback

### Dashboard Stats

- [ ] **DASH-01**: Student dashboard shows Deals Closed count
- [ ] **DASH-02**: Student dashboard shows Total Revenue
- [ ] **DASH-03**: Student dashboard shows Total Profit
- [ ] **DASH-04**: Student_diy dashboard shows same 3 deal stat cards

### Coach/Owner Visibility

- [ ] **VIEW-01**: Coach student detail page has a Deals tab
- [ ] **VIEW-02**: Owner student detail page has a Deals tab
- [ ] **VIEW-03**: Deals tab shows summary stats (count, total revenue, total profit, profit margin %)
- [ ] **VIEW-04**: Deals tab shows paginated deal list (25/page, most recent first)
- [ ] **VIEW-05**: Coach can delete deals of their assigned students
- [ ] **VIEW-06**: Owner can delete deals of any student

### Infrastructure

- [ ] **INFR-01**: Deals table with numeric(12,2) revenue/profit, deal_number, RLS policies
- [ ] **INFR-02**: BEFORE INSERT trigger for race-safe deal_number auto-increment
- [ ] **INFR-03**: Index on deals(student_id, created_at DESC)
- [ ] **INFR-04**: RLS with (SELECT auth.uid()) initplan pattern
- [ ] **INFR-05**: Rate limiting on deal creation, edit, and delete endpoints

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Deal Pipeline

- **PIPE-01**: Deal pipeline with stage tracking (Prospecting, Pitched, Negotiating, Closed)
- **PIPE-02**: Influencer FK on deals linking to influencer tracking

### Analytics

- **ANLYT-01**: Revenue leaderboard / rankings across students
- **ANLYT-02**: Deal trend charts (monthly revenue over time)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Deal pipeline / stage tracking | V2+ — adds stage management UI and transition logic |
| Influencer FK on deals | V2+ — influencer tracking pipeline not yet built |
| Multi-currency support | V2+ — requires exchange rate logic and per-student currency |
| Recurring revenue / MRR tracking | V2+ — requires deal-type distinction and period fields |
| Deal approval workflow (coach must approve) | Adds async state machine; deals count immediately, coach oversight is read-only + delete |
| Revenue leaderboard / rankings | Gamification is V2+ per PROJECT.md |
| Soft delete / trash / restore | Hard delete matches codebase pattern; coach/owner can delete on behalf |
| File attachments on deals | Requires Supabase Storage; notes field allows free-text contract references |
| Coach edit deals | Creates data ownership confusion; coach deletes, student re-enters |
| KPI pre-aggregation for deals | Live query is cheap at v1 scale; add to pg_cron only if load testing requires it |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEAL-01 | — | Pending |
| DEAL-02 | — | Pending |
| DEAL-03 | — | Pending |
| DEAL-04 | — | Pending |
| DEAL-05 | — | Pending |
| DEAL-06 | — | Pending |
| DEAL-07 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| VIEW-01 | — | Pending |
| VIEW-02 | — | Pending |
| VIEW-03 | — | Pending |
| VIEW-04 | — | Pending |
| VIEW-05 | — | Pending |
| VIEW-06 | — | Pending |
| INFR-01 | — | Pending |
| INFR-02 | — | Pending |
| INFR-03 | — | Pending |
| INFR-04 | — | Pending |
| INFR-05 | — | Pending |

**Coverage:**
- v1.5 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
