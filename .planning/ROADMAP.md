# Roadmap: IMA Accelerator V1

## Milestones

- â **v1.0 IMA Accelerator V1** â Phases 1-12 (shipped 2026-03-18)
- â **v1.1 V2 Feature Build** â Phases 13-18 (shipped 2026-03-28)
- â **v1.2 Performance, Scale & Security** â Phases 19-24 (shipped 2026-03-31)
- â **v1.3 Roadmap Update, Session Planner & Coach Controls** â Phases 25-29 (shipped 2026-04-03)
- â **v1.4 Roles, Chat & Resources** â Phases 30-37 (shipped 2026-04-06)
- ð§ **v1.5 Student Deals** â Phases 38-43 (in progress)

## Phases

<details>
<summary>â v1.0 IMA Accelerator V1 (Phases 1-12) â SHIPPED 2026-03-18</summary>

- [x] Phase 1: Foundation (3/3 plans) â completed 2026-03-16
- [x] Phase 2: Authentication & Access (3/3 plans) â completed 2026-03-16
- [x] Phase 3: Student Work Tracker (3/3 plans) â completed 2026-03-16
- [x] Phase 4: Student Roadmap (2/2 plans) â completed 2026-03-16
- [x] Phase 5: Student Daily Reports & AI Chat (3/3 plans) â completed 2026-03-16
- [x] Phase 6: Coach Dashboard & Student Views (2/2 plans) â completed 2026-03-16
- [x] Phase 7: Coach Report Review, Invites & Analytics (4/4 plans) â completed 2026-03-17
- [x] Phase 8: Owner Stats & People Management (4/4 plans) â completed 2026-03-17
- [x] Phase 9: Owner Invites, Assignments & Alerts (5/5 plans) â completed 2026-03-17
- [x] Phase 10: UI Polish & Production Hardening (4/4 plans) â completed 2026-03-17
- [x] Phase 11: Fix Invite Registration URL (3/3 plans) â completed 2026-03-18
- [x] Phase 12: CLAUDE.md Hard Rule Compliance (2/2 plans) â completed 2026-03-18

</details>

<details>
<summary>â v1.1 V2 Feature Build (Phases 13-18) â SHIPPED 2026-03-28</summary>

- [x] **Phase 13: Schema & Config Foundation** â completed 2026-03-27
- [x] **Phase 14: Flexible Work Sessions** â completed 2026-03-27
- [x] **Phase 15: Outreach KPI Banner** â completed 2026-03-28
- [x] **Phase 16: Coach/Owner KPI Visibility** â completed 2026-03-28
- [x] **Phase 17: Calendar View** â completed 2026-03-28
- [x] **Phase 18: Roadmap Date KPIs & Completion Logging** â completed 2026-03-28

</details>

<details>
<summary>â v1.2 Performance, Scale & Security (Phases 19-24) â SHIPPED 2026-03-31</summary>

- [x] **Phase 19: Database Foundation** â completed 2026-03-29
- [x] **Phase 20: Query Consolidation & Caching** â completed 2026-03-30
- [x] **Phase 21: Write Path & Pre-Aggregation** â completed 2026-03-30
- [x] **Phase 22: Spike Protection & Rate Limiting** â completed 2026-03-30
- [x] **Phase 23: Security Audit** â completed 2026-03-30
- [x] **Phase 24: Infrastructure & Validation** â completed 2026-03-31

</details>

<details>
<summary>â v1.3 Roadmap Update, Session Planner & Coach Controls (Phases 25-29) â SHIPPED 2026-04-03</summary>

- [x] **Phase 25: Roadmap Config & Stage Headers** â completed 2026-03-31
- [x] **Phase 26: Database Schema Foundation** â completed 2026-03-31
- [x] **Phase 27: Coach/Owner Roadmap Undo** â completed 2026-03-31
- [x] **Phase 28: Daily Session Planner API** â completed 2026-03-31
- [x] **Phase 29: Daily Session Planner Client** â completed 2026-03-31

</details>

<details>
<summary>â v1.4 Roles, Chat & Resources (Phases 30-37) â SHIPPED 2026-04-06</summary>

- [x] **Phase 30: Database Migration** (1/1 plans) â completed 2026-04-03
- [x] **Phase 31: Student_DIY Role** (3/3 plans) â completed 2026-04-03
- [x] **Phase 32: Skip Tracker** (2/2 plans) â completed 2026-04-03
- [x] **Phase 33: Coach Assignments** (2/2 plans) â completed 2026-04-03
- [x] **Phase 34: Report Comments** (2/2 plans) â completed 2026-04-03
- [x] **Phase 35: Chat System** (4/4 plans) â completed 2026-04-04
- [x] **Phase 36: Resources Tab** (3/3 plans) â completed 2026-04-04
- [x] **Phase 37: Invite Link max_uses** (2/2 plans) â completed 2026-04-04

</details>

### ð§ v1.5 Student Deals (In Progress)

**Milestone Goal:** Students can track closed deals with revenue and profit; coaches and owners can view and manage deal history on student detail pages.

- [x] **Phase 38: Database Foundation** - deals table, deal_number trigger, RLS, indexes (completed 2026-04-06)
- [x] **Phase 39: API Route Handlers** - full CRUD endpoints with rate limiting and role-scoped delete (completed 2026-04-06)
- [x] **Phase 40: Config & Type Updates** - routes, nav, validation constants, types.ts (completed 2026-04-07)
- [ ] **Phase 41: Student Deals Pages** - DealsClient CRUD UI with useOptimistic for student and student_diy
- [ ] **Phase 42: Dashboard Stat Cards** - Deals Closed, Total Revenue, Total Profit on both dashboards
- [ ] **Phase 43: Coach & Owner Deals Tab** - DealsTab component wired into both detail pages

## Phase Details

### Phase 38: Database Foundation
**Goal**: The deals table exists in Supabase with all constraints, policies, and indexes â no application code can proceed without it
**Depends on**: Nothing (first phase of milestone)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, DEAL-02
**Success Criteria** (what must be TRUE):
  1. The deals table exists with revenue and profit as numeric(12,2) columns, deal_number integer, and a UNIQUE (student_id, deal_number) constraint
  2. A BEFORE INSERT trigger assigns deal_number by selecting MAX(deal_number) FOR UPDATE, preventing race-condition duplicates on concurrent inserts
  3. RLS policies use the (SELECT auth.uid()) and (SELECT get_user_role()) initplan pattern â EXPLAIN ANALYZE shows initplan, not per-row function calls
  4. An index on (student_id, created_at DESC) exists and is confirmed by \d deals in Supabase Studio
  5. types.ts has a Deal type with revenue and profit declared as string | number to force explicit Number() coercion at every arithmetic site
**Plans**: 1 plan
Plans:
- [x] 38-01-PLAN.md â Migration SQL, Deal types, schema push

### Phase 39: API Route Handlers
**Goal**: All deal mutation and query endpoints exist, are secured, and are testable before any UI is built
**Depends on**: Phase 38
**Requirements**: DEAL-01, DEAL-04, DEAL-05, VIEW-05, VIEW-06, INFR-05
**Success Criteria** (what must be TRUE):
  1. POST /api/deals creates a deal for the authenticated student (or student_diy) and returns the new row including deal_number; a 23505 conflict triggers one retry
  2. PATCH /api/deals/[id] updates revenue and profit for deals owned by the requesting student only; other students receive 403
  3. DELETE /api/deals/[id] allows a student to delete their own deal, a coach to delete a deal belonging to their assigned student (two-step coach_id check), and an owner to delete any deal; unauthorized deletes return 403
  4. GET /api/deals returns a paginated list (25/page) of deals for a given student_id; accepts page query param; accessible to coach and owner roles only
  5. All four endpoints enforce verifyOrigin CSRF check, checkRateLimit at 30 req/min, and Zod input validation â requests failing any check return 400, 403, or 429 with a JSON error body
**Plans**: 1 plan
Plans:
- [x] 39-01-PLAN.md â POST+GET and PATCH+DELETE deal CRUD route handlers

### Phase 40: Config & Type Updates
**Goal**: src/lib/config.ts and proxy.ts coverage are updated so TypeScript compiles cleanly before any page files are created
**Depends on**: Phase 38
**Requirements**: DEAL-06
**Success Criteria** (what must be TRUE):
  1. ROUTES.student.deals and ROUTES.student_diy.deals exist in config.ts and the TypeScript compiler accepts imports of those values without error
  2. Both student and student_diy nav arrays in config.ts include a "Deals" entry pointing to the correct route
  3. A DEALS validation object in config.ts defines REVENUE_MAX and NOTES_MAX_LENGTH constants used by Zod schemas in Phase 39
  4. npx tsc --noEmit passes with zero errors after config changes and before any page file is created
**Plans**: 2 plans
Plans:
- [x] 40-01-PLAN.md — ROUTES, NAVIGATION, VALIDATION.deals config + route handler refactor
- [x] 40-02-PLAN.md — Gap closure: restore deals table type in Database interface (types.ts)

### Phase 41: Student Deals Pages
**Goal**: Students and student_diy users can add, view, edit, and delete their deals from a dedicated Deals page
**Depends on**: Phase 39, Phase 40
**Requirements**: DEAL-03, DEAL-07
**Success Criteria** (what must be TRUE):
  1. Student navigates to /student/deals and sees their full deal history list sorted most-recent first, with deal number, revenue, profit, and date visible per row
  2. Student adds a deal â the new row appears instantly in the list (useOptimistic) before the API response, labeled "Deal #N" with the correct sequential number
  3. Student edits a deal via an inline or modal form â the updated values appear in the list immediately on save
  4. Student deletes a deal â the row disappears instantly from the list (useOptimistic) and does not reappear after router.refresh() completes
  5. Student_diy user at /student_diy/deals sees the identical UI and all CRUD operations work via the same DealsClient component
**Plans**: 1 plan
Plans:
- [ ] 38-01-PLAN.md â Migration SQL, Deal types, schema push
**UI hint**: yes

### Phase 42: Dashboard Stat Cards
**Goal**: Both student dashboards show deal performance at a glance â deals closed, total revenue, and total profit â using live data
**Depends on**: Phase 39
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. The student dashboard displays three stat cards â Deals Closed (count), Total Revenue (currency-formatted), Total Profit (currency-formatted) â sourced from a live aggregate query on the deals table
  2. After a student adds or deletes a deal on the Deals page, navigating back to the dashboard shows updated counts and totals without a hard refresh
  3. The student_diy dashboard shows the same three stat cards with identical formatting and live-query behavior
  4. When a student has no deals, all three stat cards display 0 / $0.00 (not blank, not an error)
**Plans**: 1 plan
Plans:
- [ ] 38-01-PLAN.md â Migration SQL, Deal types, schema push
**UI hint**: yes

### Phase 43: Coach & Owner Deals Tab
**Goal**: Coaches and owners can view a student's complete deal history and delete deals from the student detail page
**Depends on**: Phase 39
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04
**Success Criteria** (what must be TRUE):
  1. Coach opens a student detail page and sees a "Deals" tab in the tab bar alongside existing tabs; clicking it renders the DealsTab component
  2. Owner opens a student detail page and sees the same "Deals" tab; both roles share the identical DealsTab component
  3. The Deals tab header row shows summary stats: total deals closed, total revenue, total profit, and profit margin percentage
  4. The deal list below the summary is paginated at 25 rows per page using the existing PaginationControls component, sorted most-recent first
  5. Coach clicks delete on a deal belonging to their assigned student â the row is removed; clicking delete on an unassigned student's deal is blocked (403 shown as error toast)
**Plans**: 1 plan
Plans:
- [ ] 38-01-PLAN.md â Migration SQL, Deal types, schema push
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-16 |
| 2. Authentication & Access | v1.0 | 3/3 | Complete | 2026-03-16 |
| 3. Student Work Tracker | v1.0 | 3/3 | Complete | 2026-03-16 |
| 4. Student Roadmap | v1.0 | 2/2 | Complete | 2026-03-16 |
| 5. Student Daily Reports & AI Chat | v1.0 | 3/3 | Complete | 2026-03-16 |
| 6. Coach Dashboard & Student Views | v1.0 | 2/2 | Complete | 2026-03-16 |
| 7. Coach Report Review, Invites & Analytics | v1.0 | 4/4 | Complete | 2026-03-17 |
| 8. Owner Stats & People Management | v1.0 | 4/4 | Complete | 2026-03-17 |
| 9. Owner Invites, Assignments & Alerts | v1.0 | 5/5 | Complete | 2026-03-17 |
| 10. UI Polish & Production Hardening | v1.0 | 4/4 | Complete | 2026-03-17 |
| 11. Fix Invite Registration URL | v1.0 | 3/3 | Complete | 2026-03-18 |
| 12. CLAUDE.md Hard Rule Compliance | v1.0 | 2/2 | Complete | 2026-03-18 |
| 13. Schema & Config Foundation | v1.1 | 2/2 | Complete | 2026-03-27 |
| 14. Flexible Work Sessions | v1.1 | 3/3 | Complete | 2026-03-27 |
| 15. Outreach KPI Banner | v1.1 | 2/2 | Complete | 2026-03-28 |
| 16. Coach/Owner KPI Visibility | v1.1 | 4/4 | Complete | 2026-03-28 |
| 17. Calendar View | v1.1 | 3/3 | Complete | 2026-03-28 |
| 18. Roadmap Date KPIs & Completion Logging | v1.1 | 2/2 | Complete | 2026-03-28 |
| 19. Database Foundation | v1.2 | 2/2 | Complete | 2026-03-29 |
| 20. Query Consolidation & Caching | v1.2 | 4/4 | Complete | 2026-03-30 |
| 21. Write Path & Pre-Aggregation | v1.2 | 2/2 | Complete | 2026-03-30 |
| 22. Spike Protection & Rate Limiting | v1.2 | 2/2 | Complete | 2026-03-30 |
| 23. Security Audit | v1.2 | 3/3 | Complete | 2026-03-30 |
| 24. Infrastructure & Validation | v1.2 | 5/5 | Complete | 2026-03-31 |
| 25. Roadmap Config & Stage Headers | v1.3 | 2/2 | Complete | 2026-03-31 |
| 26. Database Schema Foundation | v1.3 | 1/1 | Complete | 2026-03-31 |
| 27. Coach/Owner Roadmap Undo | v1.3 | 2/2 | Complete | 2026-03-31 |
| 28. Daily Session Planner API | v1.3 | 3/3 | Complete | 2026-03-31 |
| 29. Daily Session Planner Client | v1.3 | 3/3 | Complete | 2026-03-31 |
| 30. Database Migration | v1.4 | 1/1 | Complete | 2026-04-03 |
| 31. Student_DIY Role | v1.4 | 3/3 | Complete | 2026-04-03 |
| 32. Skip Tracker | v1.4 | 2/2 | Complete | 2026-04-03 |
| 33. Coach Assignments | v1.4 | 2/2 | Complete | 2026-04-03 |
| 34. Report Comments | v1.4 | 2/2 | Complete | 2026-04-03 |
| 35. Chat System | v1.4 | 4/4 | Complete | 2026-04-04 |
| 36. Resources Tab | v1.4 | 3/3 | Complete | 2026-04-04 |
| 37. Invite Link max_uses | v1.4 | 2/2 | Complete | 2026-04-04 |
| 38. Database Foundation | v1.5 | 1/1 | Complete    | 2026-04-06 |
| 39. API Route Handlers | v1.5 | 1/1 | Complete    | 2026-04-06 |
| 40. Config & Type Updates | v1.5 | 2/2 | Complete    | 2026-04-07 |
| 41. Student Deals Pages | v1.5 | 0/TBD | Not started | - |
| 42. Dashboard Stat Cards | v1.5 | 0/TBD | Not started | - |
| 43. Coach & Owner Deals Tab | v1.5 | 0/TBD | Not started | - |
