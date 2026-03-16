# Feature Research

**Domain:** Coaching / Accelerator Platform (Influencer Marketing Training)
**Researched:** 2026-03-16
**Confidence:** HIGH — conclusions drawn from multiple coaching/mentorship platform sources, cross-validated against project requirements

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Role-based access control | Any multi-role platform requires this; coaches seeing admin data or students seeing other students' data is a hard failure | MEDIUM | Three roles: owner, coach, student. Must gate routes and data, not just UI |
| Invite-only / controlled registration | Paid/curated programs are not open signup; uncontrolled access destroys cohort trust | MEDIUM | Invite codes + magic links; 72h expiry; coaches invite students only |
| Student progress dashboard | Students need a personal view of where they are; without it they feel lost in the program | MEDIUM | 10-step roadmap with locked/active/completed states |
| Work session tracking | Accountability programs live or die by visible effort; no tracker = no accountability loop | MEDIUM | 45-min cycles, 4/day, start/complete/abandon states with grace period |
| Daily report submission | Industry-standard in coaching: structured daily check-in is the core accountability mechanism | MEDIUM | Hours, star rating, outreach count, wins, improvements; 11 PM deadline |
| Coach dashboard with student overview | Coaches must see who they're responsible for at a glance; without this coaching is reactive not proactive | MEDIUM | Shows assigned students, recent activity, at-risk flags |
| Coach report review | Reports submitted to coaches are meaningless without a review/acknowledge loop; it signals the coach is present | LOW | Mark-as-reviewed is the minimum; feedback can come later |
| Owner/admin management panel | Any platform with multiple users needs an admin who can manage users, assignments, and platform health | HIGH | Covers user lists, coach-student assignment, invite issuance |
| Mobile-responsive UI | Most students check their dashboards on phones; a desktop-only experience loses engagement after the first session | MEDIUM | 44px touch targets, readable layouts on small screens |
| Empty states and loading feedback | Users encountering blank screens or hanging UIs assume the platform is broken; trust erodes | LOW | Skeletons, error boundaries, empty state copy for all data-empty views |
| Google OAuth login | Password flows create friction and support burden; OAuth is the expected auth UX for modern tools | LOW | Supabase handles this; invite gates it to approved emails only |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected in every coaching tool, but directly valuable to this program's goals.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Structured 10-step roadmap with gated progression | Most coaching programs are amorphous; a locked linear roadmap creates a curriculum artifact students can point to and work toward | MEDIUM | Steps unlock sequentially; gives students a concrete sense of advancement that daily reports alone can't provide |
| AI chat assistant (Ask Abu Lahya) | Students get async answers from the coach's methodology without waiting for live sessions; scales the coach's presence | LOW | iframe embed of existing hosted chatbot; no custom AI infrastructure needed in V1 |
| Owner early-warning alert system | Proactive intervention before drop-off — most platforms tell you what happened, not what's about to happen | MEDIUM | Triggers on 3-day inactivity, 7-day no-login, coach avg rating < 2.5 for 14 days, unreviewed reports |
| Work cycle tracking tied to daily reports | Automatic hours-worked field in reports (populated from session tracker) removes self-reporting bias and adds objective data to subjective ratings | LOW | Hours auto-filled from completed sessions; reduces friction and improves data integrity |
| Coach-level at-risk threshold configuration | Most platforms use one global threshold; per-coach config lets mentors set expectations based on their cohort's pace | LOW | At-risk threshold: 3-day inactive or rating < 2; max 50 students per coach |
| Report inbox scoped to last 7 days | Avoids overwhelming coaches with historical backlog; focuses attention on current accountability window | LOW | Simple date filter; purposefully narrow scope keeps coaches acting on fresh data |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems — documented explicitly to prevent re-addition under pressure.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Gamification tier system (Bronze/Silver/Gold) | Creates visible achievement hierarchy; feels motivating at kickoff | Leaderboards demotivate the bottom 90%; overjustification effect causes students to optimize for points not skills; adds schema complexity (snapshots, calculations) disproportionate to V1 value | Roadmap step completion provides structural progression without peer competition |
| Leaderboard and rankings | Students want to see where they stand vs peers | Research shows group-size N-effect: as cohort grows, individual motivation drops. Creates anxiety for lower performers who most need to stay engaged | Coach-level at-risk alerts surface struggling students privately to people who can help |
| In-app notification system | Users expect notifications; coaches want to ping students | Full notification system (inbox, read/unread state, notification types, delivery channels) is disproportionately complex for V1; becomes a maintenance surface | Alert panel for owners captures platform health; direct communication happens outside the platform (WhatsApp, DMs) as is typical in small cohort programs |
| Email notifications (Resend/SMTP) | Standard for web apps; "why don't I get emails?" | Email deliverability, unsubscribe flows, template management, and bounce handling are a product vertical unto themselves; adds operational burden before core loop is validated | Defer until V1 core loop is proven valuable; add in V1.x when users confirm they want email nudges |
| Settings pages (name/niche editing) | Standard profile management UX expectation | Invites scope creep into profile editing, avatar uploads, niche selection flows; each setting creates a new state management surface; V1 schema doesn't need these fields mutable | Owner/admin manages user details if changes are needed; simplicity is a feature in V1 |
| Focus Mode / Pomodoro mode | Power users want time-box variants | Pomodoro's 25-min intervals conflict with the platform's 45-min cycle structure; two modes creates confusion about what a "completed session" means; feature parity pressure follows | The 45-min work cycle IS the platform's Pomodoro; one mode, one definition of done |
| Real-time collaboration / live session tools | Accelerators do live calls; why not built-in? | Live video is a solved problem (Zoom, Google Meet); building it in-platform adds infrastructure cost with no differentiation; users already have preferences | AI chat covers async; live sessions happen on existing tools coaches already use |
| Deals / influencer tracking CRM pipeline | Students will eventually manage brand relationships; a pipeline view feels logical | Premature optimization for a skill students haven't developed yet in V1 roadmap; adds relational complexity (deals, contacts, pipeline stages) that overwhelms students at Step 2-4 | 10-step roadmap's final steps (Brand Outreach, Close First Deal) are milestones, not tracked pipelines; add CRM in V2 when students are at Step 9+ |
| Streak tracking | Daily habits benefit from streak visualization; Duolingo-proven mechanic | Streak systems require cron-job infrastructure for streak-check and expiry logic; missed streaks cause disengagement exactly when the student is already struggling; punishes absences twice | Daily report submission history already shows consistency patterns; coaches surface the gap via at-risk alerts |

---

## Feature Dependencies

```
Google OAuth Login
    └──required by──> Invite-Only Registration
                          └──required by──> All Role Dashboards
                                                └──required by──> Work Tracker
                                                └──required by──> Daily Reports
                                                └──required by──> Roadmap Progress

Work Session Tracker
    └──feeds into──> Daily Report (auto-fills hours worked)

Daily Reports
    └──required by──> Coach Report Review
    └──required by──> Coach Basic Analytics (report rates)
    └──feeds into──> Owner Alerts (unreviewed reports trigger)

Coach-Student Assignment (Owner)
    └──required by──> Coach Dashboard (defines who coach sees)
    └──required by──> Coach Report Review (scopes which reports)
    └──required by──> Coach Analytics (scopes which students)

Student Activity Data (sessions + reports)
    └──required by──> Owner Alert System (inactive/drop-off triggers)
    └──required by──> Coach At-Risk View

Roadmap Progress
    └──independent of──> Daily Reports (parallel tracks, both visible to coaches)
```

### Dependency Notes

- **Auth before everything:** Google OAuth + invite registration must be Phase 1. All features sit downstream of a verified, role-assigned user.
- **Work tracker before daily reports:** Reports auto-fill hours from sessions. Tracker must exist first or the auto-fill is a placeholder that degrades report quality.
- **Coach-student assignment before coach dashboards:** A coach with no assigned students sees an empty dashboard; the owner must be able to assign before coaches can do anything useful.
- **Student data before owner alerts:** Alert thresholds trigger on accumulated data. Alert system is a Phase 2+ concern; it should not block Phase 1 delivery.
- **Roadmap is independent:** Roadmap progress does not depend on reports or sessions — it advances by explicit student action on each step, making it safe to build in parallel with the work tracker.

---

## MVP Definition

### Launch With (V1)

Minimum viable product — what's needed for the accountability loop to function end-to-end.

- [ ] Google OAuth login with invite-only registration — authentication is the gate to everything
- [ ] Role-based routing and access control (owner/coach/student) — without this, the platform is unsafe
- [ ] Owner invite system (coach + student invites, magic links) — must exist before anyone can onboard
- [ ] Owner coach-student assignment — coaches need students before any coaching features are useful
- [ ] Student work session tracker (45-min cycles, 4/day, start/complete/abandon) — core daily habit
- [ ] Student 10-step roadmap (locked/active/completed progression) — structural progress artifact
- [ ] Student daily reports (hours auto-filled, star rating, outreach, wins, improvements) — accountability loop
- [ ] Coach dashboard with assigned student overview — coaches need situational awareness
- [ ] Coach report review (mark as reviewed) — closes the accountability loop; reports without acknowledgment are noise
- [ ] Owner platform-wide stats dashboard — Abu Lahya (owner) needs to monitor program health
- [ ] Owner alerts (inactive, drop-off, unreviewed reports, coach underperformance) — proactive intervention
- [ ] Ask Abu Lahya AI chat (iframe embed) — async coaching presence, scales the mentor
- [ ] Mobile-responsive UI with loading states, error boundaries, empty states — table-stakes polish

### Add After Validation (V1.x)

Features to add once core accountability loop is proven working.

- [ ] Email notifications (Resend) — add when users confirm they want email nudges; do not assume
- [ ] In-app notification system — add when direct platform messaging is consistently needed
- [ ] Coach basic analytics (report rates, activity trends) — add when coaches request historical views vs current inbox
- [ ] Settings pages (name/niche editing) — add if users report friction with static profiles

### Future Consideration (V2+)

Defer until product-market fit is established and student cohort reaches later roadmap stages.

- [ ] Gamification tiers (Bronze/Silver/Gold) — builds on proven engagement, not assumed motivation
- [ ] Leaderboard / rankings — only viable if cohort wants peer comparison; measure first
- [ ] Deals tracking CRM pipeline — relevant only when students reach Step 9-10 at scale
- [ ] Influencer tracking pipeline — V2 when students are actively managing rosters
- [ ] Call scheduling — V2 when coaches need structured session booking inside platform
- [ ] Streak tracking with milestones — V2 with cron infrastructure
- [ ] PostHog / product analytics — V2 for data-driven iteration

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google OAuth + invite registration | HIGH | LOW | P1 |
| Role-based access control | HIGH | MEDIUM | P1 |
| Student work session tracker | HIGH | MEDIUM | P1 |
| Student roadmap progression | HIGH | MEDIUM | P1 |
| Student daily report submission | HIGH | MEDIUM | P1 |
| Coach dashboard (student overview) | HIGH | MEDIUM | P1 |
| Coach report review | HIGH | LOW | P1 |
| Owner invite + assignment system | HIGH | MEDIUM | P1 |
| Owner stats dashboard | HIGH | MEDIUM | P1 |
| Owner alert system | HIGH | MEDIUM | P1 |
| AI chat embed | MEDIUM | LOW | P1 |
| Mobile responsiveness | HIGH | LOW | P1 |
| Loading states / empty states | MEDIUM | LOW | P1 |
| Coach basic analytics | MEDIUM | LOW | P2 |
| Email notifications | MEDIUM | HIGH | P2 |
| In-app notification system | MEDIUM | HIGH | P3 |
| Gamification tiers | LOW | HIGH | P3 |
| CRM deal/influencer pipeline | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | CoachAccountable | GoalsWon | Together Platform | Our Approach |
|---------|-----------------|----------|-------------------|--------------|
| Progress tracking | Metrics + action plans | Daily check-ins with feedback | Goal tracking + milestones | 10-step roadmap with session + report data |
| Role access | Admin/coach/client roles | Coach/client | Admin/coach/coachee | Owner/coach/student with strict RLS |
| Daily accountability | Session notes | Daily check-in review by coach | Automated check-ins | Daily report + coach review loop |
| Analytics | Client engagement reports | Streak + completion data | Program analytics | Owner alerts + coach at-risk view |
| Registration | Open + invite flows | Open signup | Invite to program | Invite-only, Google OAuth only |
| AI features | None (as of research) | None | Basic matching | Embedded AI chat (existing chatbot) |
| Work session tracking | No built-in timer | No built-in timer | No built-in timer | Native 45-min cycle tracker (differentiator) |

---

## Sources

- [CoachAccountable features (official site)](https://www.coachaccountable.com/) — MEDIUM confidence
- [Circle.so: Essential vs Differentiating Features in Coaching Platforms](https://circle.so/blog/best-coaching-platforms) — MEDIUM confidence
- [GoalsWon accountability coaching](https://www.goalswon.com/) — MEDIUM confidence
- [Together Platform — invite-only coaching](https://www.togetherplatform.com/page/coaching-software) — MEDIUM confidence
- [Growth Engineering: Dark Side of Gamification Leaderboards](https://www.growthengineering.co.uk/dark-side-of-gamification/) — MEDIUM confidence (research-backed claims cited)
- [Enflux: Early Alert Systems in Higher Education](https://enflux.com/blog/early-alert-systems-in-higher-education/) — MEDIUM confidence
- [Futuremarketinsights: Coaching Platform Market 2026](https://www.futuremarketinsights.com/reports/coaching-platform-market) — LOW confidence (market sizing only)
- Project context: `.planning/PROJECT.md` — HIGH confidence (primary source)

---

*Feature research for: IMA Accelerator V1 — Coaching / Accelerator Platform*
*Researched: 2026-03-16*
