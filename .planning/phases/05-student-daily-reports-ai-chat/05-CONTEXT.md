# Phase 5: Student Daily Reports & AI Chat - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Students can submit a daily report with hours auto-filled from completed work sessions, view past reports, and access the AI coach chat via iframe embed. Report fields: star rating (1-5), outreach count, wins (optional), improvements (optional). Students can update a submitted report. The AI chat page uses a placeholder URL until Abu Lahya provides the real one. This phase does NOT include: coach report review (Phase 7), owner report views (Phase 8), email reminders (V2), or any gamification.

</domain>

<decisions>
## Implementation Decisions

### Report form UX
- Clickable star rating: 5 star icons in a row, click to set, filled stars up to selection (same as reference-old StarRating component)
- Students can update their report after submitting — form shows "Update Report" button and "Last submitted at" timestamp when a report already exists
- Report page header: date card showing today's date + auto-filled hours tracked displayed prominently, plus a status banner (green "Report submitted" when done, amber "Not yet submitted" when pending)
- Form uses react-hook-form for validation UX, field-level errors, and less re-renders
- Hours worked displayed as read-only at top of form (auto-filled from completed work sessions)
- Form fields in order: hours worked (read-only), star rating, outreach count, wins (optional textarea with char counter), improvements (optional textarea with char counter)

### Dashboard report card
- Replace current placeholder with live data card showing submission status
- Adaptive CTA: "Submit Report" if not submitted today, "Update Report" if already submitted
- Visual status indicator: green checkmark badge when submitted, amber dot when pending — quick visual scan
- Show deadline reminder: small "Due by 11 PM" text under status for gentle nudge
- Dashboard card fetches today's daily_reports data server-side

### Claude's Discretion
- Past reports page layout and information density (not discussed — use clean list with date, rating, hours)
- AI chat page implementation (follow reference-old pattern: AskIframe with Coming Soon fallback when no URL, skeleton loader while iframe loads)
- Report form styling details (spacing, card variants, animation delays)
- Loading skeleton design for report page
- Toast messages for submit/update success and errors
- StarRating component implementation details (hover states, accessibility)
- Input and Textarea component creation (V1 needs these — reference-old has them)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Report requirements
- `.planning/REQUIREMENTS.md` — REPT-01, REPT-02, REPT-03 (report submission, hours auto-fill, past reports view) and AICHAT-01 (iframe embed)
- `.planning/ROADMAP.md` — Phase 5 success criteria (5 acceptance tests)
- `.planning/PROJECT.md` — Daily report fields (hours, star rating 1-5, outreach count, wins, improvements), deadline 11 PM

### Configuration
- `src/lib/config.ts` — DAILY_REPORT config (field labels, autoFillHours, deadlineHour: 23)
- `src/lib/config.ts` — VALIDATION (starRating min/max, outreachCount min/max, reportWins/reportImprovements max: 500)
- `src/lib/config.ts` — AI_CONFIG (method: iframe, iframeUrl: empty placeholder, title, subtitle)
- `src/lib/config.ts` — ROUTES.student.report ("/student/report"), ROUTES.student.ask ("/student/ask")

### Reference implementation
- `reference-old/src/app/(dashboard)/student/report/page.tsx` — Full report page with date card, hours display, status banner, ReportFormWrapper
- `reference-old/src/components/student/ReportForm.tsx` — Complete form with react-hook-form, StarRating, Input, Textarea, submit/update logic
- `reference-old/src/components/student/ReportFormWrapper.tsx` — Client wrapper that provides router.refresh() on success
- `reference-old/src/components/student/AskIframe.tsx` — Iframe component with skeleton loader and Coming Soon fallback
- `reference-old/src/app/(dashboard)/student/ask/page.tsx` — AI chat page with PageHeader and iframe card
- `reference-old/src/app/api/reports/route.ts` — POST API with Zod validation, upsert logic (insert or update existing)

### Database schema
- `supabase/migrations/00001_create_tables.sql` — daily_reports table (student_id, date, hours_worked, star_rating, outreach_count, wins, improvements, submitted_at, reviewed_by, reviewed_at)
- `supabase/migrations/00001_create_tables.sql` — RLS policies for daily_reports (student can select/insert/update own, coach can select/update assigned students', owner can select all)

### Auth & session
- `src/lib/session.ts` — requireRole() helper for server components
- `src/lib/supabase/admin.ts` — createAdminClient() for server-side queries

### Dashboard integration
- `src/app/(dashboard)/student/page.tsx` — Current dashboard with placeholder Daily Report card (replace with live data)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reference-old/src/components/student/ReportForm.tsx` — Complete form with react-hook-form, field validation, StarRating integration. Port with V1 token adjustments (replace ima-brand-gold, ima-surface-warm with V1 equivalents).
- `reference-old/src/components/student/ReportFormWrapper.tsx` — Thin client wrapper providing router.refresh(). V1-ready.
- `reference-old/src/components/student/AskIframe.tsx` — Iframe with skeleton loader and empty state. Uses Skeleton component (needs V1 creation or simplification).
- `reference-old/src/app/api/reports/route.ts` — Complete API with auth check, Zod validation, upsert logic. Port with V1 import path adjustments.
- `src/lib/config.ts` — DAILY_REPORT, VALIDATION, AI_CONFIG already defined with all needed constants.
- `src/components/ui/` — Button, Badge, Modal, Spinner, Toast already exist. Missing: Input, Textarea, Card, StarRating (need creation).

### Established Patterns
- Server components for reads, "use client" only for interactivity (form is client-side)
- Admin client for all server queries, user ID filtering for defense-in-depth
- API routes at `/api/` with Zod validation, auth + role check before validation
- useRef for toast/router in client components (Phase 3 pattern)
- motion-safe: prefix on all animations, 44px touch targets, ARIA labels
- Adaptive CTA pattern on dashboard cards (Phase 3 work progress, Phase 4 roadmap)

### Integration Points
- `src/app/(dashboard)/student/page.tsx` — Dashboard needs daily_reports query added, placeholder card replaced with live status card
- `src/app/(dashboard)/student/report/` — New directory for report page (server component) + form
- `src/app/(dashboard)/student/report/history/` or similar — New page for past reports list
- `src/app/(dashboard)/student/ask/` — New directory for AI chat page
- `src/app/api/reports/` — New API route for POST (submit/update report)
- Student nav already configured: "Daily Report" -> "/student/report", "Ask Abu Lahya" -> "/student/ask"

</code_context>

<specifics>
## Specific Ideas

- Dashboard report card should be a natural sibling of Work Progress and Roadmap cards — same visual weight, same card styling pattern
- Adaptive CTA continues the Phase 3/4 pattern: context-aware label telling the student exactly what to do next
- "Due by 11 PM" deadline text is a gentle nudge, not an aggressive countdown
- Reference-old report form is nearly V1-ready — main adaptation is token adjustments and missing UI primitives (Input, Textarea need creation)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-student-daily-reports-ai-chat*
*Context gathered: 2026-03-16*
