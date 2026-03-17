# Requirements: IMA Accelerator V1

**Defined:** 2026-03-16
**Core Value:** Students can track their daily work, follow the 10-step roadmap, and submit daily reports that coaches review — the core accountability loop.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Access

- [x] **AUTH-01**: User can log in via Google OAuth
- [x] **AUTH-02**: User can register with invite code (invite-only)
- [x] **AUTH-03**: User can register via magic link
- [x] **AUTH-04**: User is routed to role-specific dashboard after login (owner/coach/student)
- [x] **AUTH-05**: Unauthorized user sees no-access page
- [x] **AUTH-06**: User session persists across browser refresh

### Student - Work Tracker

- [x] **WORK-01**: Student can start a 45-minute work cycle
- [x] **WORK-02**: Student can complete a work cycle
- [x] **WORK-03**: Student can pause a work cycle (timer state saved, resumable)
- [x] **WORK-04**: Student can track up to 4 cycles per day
- [x] **WORK-05**: Student sees today's cycle progress on dashboard
- [x] **WORK-06**: Student can abandon a work cycle (5-min grace period)

### Student - Roadmap

- [x] **ROAD-01**: Student sees 10-step roadmap with locked/active/completed states
- [x] **ROAD-02**: Student can mark active step as completed (unlocks next)
- [x] **ROAD-03**: Step 1 auto-completes on signup

### Student - Daily Report

- [x] **REPT-01**: Student can submit daily report (hours, star rating 1-5, outreach count, wins, improvements)
- [x] **REPT-02**: Hours auto-fill from completed work sessions
- [x] **REPT-03**: Student can view their own past reports

### Student - AI Chat

- [x] **AICHAT-01**: Student can access Ask Abu Lahya via iframe embed

### Coach

- [x] **COACH-01**: Coach sees dashboard with assigned students overview
- [x] **COACH-02**: Coach can view list of assigned students
- [x] **COACH-03**: Coach can view individual student detail (reports, sessions, roadmap)
- [x] **COACH-04**: Coach can review/acknowledge submitted reports
- [x] **COACH-05**: Coach can invite new students
- [x] **COACH-06**: Coach sees basic analytics (report submission rates, student activity)

### Owner - Management

- [x] **OWNER-01**: Owner sees platform-wide stats dashboard
- [ ] **OWNER-02**: Owner can view/search all students
- [ ] **OWNER-03**: Owner can view individual student detail
- [ ] **OWNER-04**: Owner can view all coaches with stats
- [ ] **OWNER-05**: Owner can view individual coach detail (assigned students, performance)
- [ ] **OWNER-06**: Owner can send invite codes (coach + student)
- [ ] **OWNER-07**: Owner can assign/reassign students to coaches
- [ ] **OWNER-08**: Owner sees alerts (inactive 3d, dropoff 7d, unreviewed reports, coach underperformance)
- [ ] **OWNER-09**: Owner can acknowledge/dismiss alerts

### UI & Polish

- [ ] **UI-01**: All pages have loading skeletons
- [ ] **UI-02**: Error boundaries catch and display errors gracefully
- [ ] **UI-03**: Empty states show motivating copy with action CTAs
- [ ] **UI-04**: All pages are mobile responsive
- [ ] **UI-05**: All interactive elements meet 44px touch target minimum
- [ ] **UI-06**: Shared UI components match old codebase visual style (ima-* tokens, blue primary, Inter font)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Gamification

- **GAME-01**: Tier system (Bronze/Silver/Gold/Special) with progression
- **GAME-02**: Leaderboard with weekly/monthly/all-time rankings
- **GAME-03**: Player cards (collectible, front/back, mini)
- **GAME-04**: Streak tracking with milestones (3/7/14/30/60/90 days)

### Communication

- **COMM-01**: In-app notification system (inbox, read/unread, notification types)
- **COMM-02**: Email notifications via Resend (report reminders, coach messages)

### Advanced Features

- **ADV-01**: Deals tracking CRM pipeline (pipeline/negotiating/closed/lost)
- **ADV-02**: Influencer tracking pipeline (contacted/responded/signed)
- **ADV-03**: Call scheduling (coach-student session booking)
- **ADV-04**: Focus mode / Pomodoro timer
- **ADV-05**: Settings pages for all roles (name/niche editing)
- **ADV-06**: PostHog analytics integration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Password-based auth | Google OAuth only — simplifies auth, no password management |
| Open registration | Invite-only protects cohort trust and program quality |
| Real-time chat / messaging | Students use WhatsApp/DMs; built-in chat adds no value |
| Video calls | Coaches use Zoom/Meet; building in-platform is wasteful |
| Mobile native app | Web-first with responsive design; native app is V2+ |
| Multi-tenant / multi-organization | Single accelerator program; multi-org adds complexity |
| Cron jobs | No streak-check or inactive-check crons in V1; alerts are query-time computed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Complete |
| WORK-01 | Phase 3 | Complete |
| WORK-02 | Phase 3 | Complete |
| WORK-03 | Phase 3 | Complete |
| WORK-04 | Phase 3 | Complete |
| WORK-05 | Phase 3 | Complete |
| WORK-06 | Phase 3 | Complete |
| ROAD-01 | Phase 4 | Complete |
| ROAD-02 | Phase 4 | Complete |
| ROAD-03 | Phase 4 | Complete |
| REPT-01 | Phase 5 | Complete |
| REPT-02 | Phase 5 | Complete |
| REPT-03 | Phase 5 | Complete |
| AICHAT-01 | Phase 5 | Complete |
| COACH-01 | Phase 6 | Complete |
| COACH-02 | Phase 6 | Complete |
| COACH-03 | Phase 6 | Complete |
| COACH-04 | Phase 7 | Complete |
| COACH-05 | Phase 7 | Complete |
| COACH-06 | Phase 7 | Complete |
| OWNER-01 | Phase 8 | Complete |
| OWNER-02 | Phase 8 | Pending |
| OWNER-03 | Phase 8 | Pending |
| OWNER-04 | Phase 8 | Pending |
| OWNER-05 | Phase 8 | Pending |
| OWNER-06 | Phase 9 | Pending |
| OWNER-07 | Phase 9 | Pending |
| OWNER-08 | Phase 9 | Pending |
| OWNER-09 | Phase 9 | Pending |
| UI-01 | Phase 10 | Pending |
| UI-02 | Phase 10 | Pending |
| UI-03 | Phase 10 | Pending |
| UI-04 | Phase 10 | Pending |
| UI-05 | Phase 10 | Pending |
| UI-06 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after roadmap creation — all 37 requirements mapped to phases 2-10*
