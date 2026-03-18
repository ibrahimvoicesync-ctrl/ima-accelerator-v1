# Phase 7: Coach Report Review, Invites & Analytics - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

A coach can review and acknowledge student reports from a dedicated inbox, invite new students via invite codes, and see basic analytics on their cohort's performance. This phase delivers 3 new pages (/coach/reports, /coach/invites, /coach/analytics) and a PATCH API for marking reports reviewed. This phase does NOT include: owner invite system (Phase 9), owner analytics (Phase 8), or chart-based visualizations.

</domain>

<decisions>
## Implementation Decisions

### Report inbox layout
- List-based layout with filter tabs: Unreviewed / Reviewed / All
- Filter by student dropdown
- Each row shows: student name, date, star rating (visual stars), hours worked, outreach count
- Rows are expandable — click to reveal wins/improvements text
- Compact by default, drill-in for detail
- Stat cards at top: Total Reports, Pending count, Reviewed count, Avg Hours

### Mark-as-reviewed interaction
- Single-click inline "Mark Reviewed" button on each report row — no confirmation modal
- Instant toggle: shows green checkmark + "Reviewed" label after click
- Coach can un-review if needed (toggle back)
- Uses PATCH API that sets reviewed_by = coach.id and reviewed_at = now()
- DB trigger `restrict_coach_report_update()` already enforces that coaches can only change review fields

### Report inbox scope
- Last 7 days only, matching COACH_CONFIG.reportInboxDays = 7
- No date range picker — keeps it focused on what needs attention now
- Coach can already see full report history on individual student detail pages (Phase 6)

### Invite flow
- Claude's Discretion — coach generates student invite link (72-hour expiry) from /coach/invites page
- Reference-old implementation has invite code + magic link generation, stat cards, and invite history
- INVITE_CONFIG already defines: codeExpiryHours: 72, coach can invite "student" role only
- Invites table has: email, role, invited_by, coach_id, code, used, expires_at

### Analytics dashboard
- Simple stat cards only — no charts, no charting library
- Key metrics: Report Submission Rate (%), Avg Star Rating, Avg Hours/Day, Avg Outreach Count
- Student breakdown card: active count, at-risk count, inactive count, new count
- Time period: last 7 days, consistent with report inbox scope
- No date range picker or time period selector in V1

### Claude's Discretion
- Invite page layout, form fields, and copy-to-clipboard UX (adapt from reference-old)
- Invite history display (list of sent invites with status)
- Magic link generation UI (if included alongside invite codes)
- Stat card icons and styling (follow Phase 6 stat card pattern)
- Empty states for all 3 pages
- How sidebar badge count for "Reports" is wired (unreviewed count)
- Pagination on report inbox if needed
- Loading states

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Coach requirements
- `.planning/REQUIREMENTS.md` — COACH-04 (review/acknowledge reports), COACH-05 (invite students), COACH-06 (basic analytics)
- `.planning/ROADMAP.md` — Phase 7 success criteria (4 acceptance tests)
- `.planning/PROJECT.md` — Coach config thresholds, invite system rules, daily report fields

### Configuration
- `src/lib/config.ts` — COACH_CONFIG (reportInboxDays: 7, atRiskInactiveDays: 3, atRiskRatingThreshold: 2)
- `src/lib/config.ts` — INVITE_CONFIG (codeExpiryHours: 72, inviteRules: coach can invite student)
- `src/lib/config.ts` — ROUTES.coach (reports, invites, analytics paths)
- `src/lib/config.ts` — NAVIGATION.coach (Reports has badge: "unreviewed_reports", Invite Students has separator)

### Database schema
- `supabase/migrations/00001_create_tables.sql` — daily_reports table (reviewed_by, reviewed_at columns), invites table, magic_links table
- `supabase/migrations/00001_create_tables.sql` — restrict_coach_report_update() trigger (coaches can only update review fields)
- `supabase/migrations/00001_create_tables.sql` — RLS policies for coach access to daily_reports, invites

### Reference implementations
- `reference-old/src/app/(dashboard)/coach/reports/page.tsx` — Report inbox with stat cards, filters, pagination, CoachReportsClient
- `reference-old/src/app/(dashboard)/coach/invites/page.tsx` — Invite page with stat cards, CoachInvitesClient
- `reference-old/src/app/(dashboard)/coach/analytics/page.tsx` — Analytics page with CoachAnalyticsClient

### Phase 6 context (carries forward)
- `.planning/phases/06-coach-dashboard-student-views/06-CONTEXT.md` — Dashboard visual DNA, at-risk detection, coach_id filtering pattern

### Auth & session
- `src/lib/session.ts` — requireRole("coach") for server components
- `src/lib/supabase/admin.ts` — createAdminClient() for server-side queries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/Card.tsx` — Card/CardContent for stat cards and report rows
- `src/components/ui/Badge.tsx` — Status badges (reviewed/pending/at-risk)
- `src/components/ui/Button.tsx` — Mark Reviewed button, invite generation button
- `src/components/ui/Input.tsx` — Email input for invite form
- `src/components/ui/Skeleton.tsx` — Loading states
- `src/components/coach/StudentCard.tsx` — Pattern for enriched data display
- `src/lib/utils.ts` — getGreeting(), getToday(), formatHours() helpers

### Established Patterns
- Server component page with parallel data fetch (coach dashboard pattern)
- Admin client for all queries, coach_id filtering for defense-in-depth
- `requireRole("coach")` at top of every page
- Stat cards in 3-column grid (from coach dashboard)
- ima-* tokens only, motion-safe: on animations, 44px touch targets
- Reference-old CoachReportsClient uses search params for filter state (server-driven filtering)

### Integration Points
- `src/app/(dashboard)/coach/reports/page.tsx` — New page for report inbox
- `src/app/(dashboard)/coach/invites/page.tsx` — New page for invite flow
- `src/app/(dashboard)/coach/analytics/page.tsx` — New page for analytics
- `src/app/api/reports/review/route.ts` — New PATCH API for mark-as-reviewed
- `src/app/api/invites/route.ts` — New POST API for invite generation
- Coach dashboard stat card "Reports Pending" already links conceptually — wire to /coach/reports
- Sidebar badge "unreviewed_reports" on Reports nav item — wire to actual count

</code_context>

<specifics>
## Specific Ideas

- Report inbox follows the same visual DNA as coach dashboard — stat cards at top, then content list
- Expandable report rows keep the inbox scannable while letting coach drill into wins/improvements
- Single-click review is friction-free — coach shouldn't need to confirm reviewing a report
- Analytics is deliberately simple for V1 — stat cards only, no charts, matching the "V1 = essentials" philosophy
- 7-day window across both inbox and analytics keeps the mental model consistent

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-coach-report-review-invites-analytics*
*Context gathered: 2026-03-17*
