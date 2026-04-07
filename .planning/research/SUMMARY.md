# Project Research Summary

**Project:** IMA Accelerator v1.4 — Roles, Chat & Resources
**Domain:** Student performance & coaching platform (Next.js 16 + Supabase)
**Researched:** 2026-04-03
**Confidence:** HIGH

## Executive Summary

IMA Accelerator v1.4 adds seven feature groups on top of a production v1.0–v1.3 system: a fourth user role (student_diy), a polling-based chat system, a resources/glossary tab, a weekly skip tracker, coach assignment parity, report comments, and invite link usage limits. This is an incremental integration release, not a greenfield build. The research is grounded in direct codebase inspection, locked decisions from `.planning/PROJECT.md` (D-01 through D-14), and verified external sources. Every new npm dependency was evaluated and rejected — all seven feature groups are implementable with the existing stack.

The recommended approach is to treat the work as a strict phase dependency chain with a single hard prerequisite: Phase A (DB schema + config.ts + proxy.ts + types.ts) must ship first and atomically. Eight interdependent locations control the student_diy role — the DB CHECK constraint, proxy.ts DEFAULT_ROUTES, proxy.ts ROLE_ROUTE_ACCESS, config.ts ROLES, config.ts Role type, config.ts ROLE_HIERARCHY, config.ts NAVIGATION, and config.ts INVITE_CONFIG. Only after all eight are updated and TypeScript compiles cleanly should any page code be written. Phases B through H can then be sequenced from lowest to highest complexity.

The primary risks are: (1) partial role expansion causing runtime redirect loops or silent empty dashboards; (2) chat polling memory leaks and rate limiter misuse that bloats the rate_limit_log table at scale; (3) missing ownership verification on the report comment endpoint (a known pattern from v1.2 that must be repeated); and (4) Discord iframe CSP failures that are invisible on localhost but break silently in Vercel production. All four risks have concrete, documented prevention strategies and are well understood from prior v1.x work.

---

## Key Findings

### Recommended Stack

No new npm packages are needed for v1.4. The full feature set — polling chat, Discord iframe, glossary search, CRUD forms, role expansion — is covered by the existing stack: React 19 useEffect/useRef/useState for polling, native HTML iframe for WidgetBot, Array.filter for glossary search, react-hook-form ^7.71.2 for CRUD, and Supabase/Postgres for schema additions.

The one infrastructure addition is a CSP header block in `next.config.ts` (currently empty). This is not a package install — it is a config file edit that must ship before the Discord embed component is written, because CSP failures are invisible on localhost and only surface on Vercel production deployments.

**Core technologies:**
- Next.js 16 App Router + proxy.ts: route guard and role-based redirect — no changes to core routing model
- React 19 useEffect + useRef: `useInterval` custom hook for 5s polling chat — useRef prevents stale closures, useEffect cleanup prevents memory leaks
- Supabase Postgres: 4 new tables (report_comments, messages, resources, glossary_terms), 3 modified CHECK constraints, 1 updated RPC (get_sidebar_badges)
- config.ts as single source of truth: role expansion touches config first, code second — TypeScript errors propagate to all eight integration points automatically
- next.config.ts headers(): CSP for `frame-src https://e.widgetbot.io` — required before any iframe component is written

**No new dependencies confirmed:** zero npm installs for v1.4.

### Expected Features

**Must have (table stakes) — P1:**
- student_diy role: 4th role with dashboard/work tracker/roadmap only; no chat, no reports, no resources — prerequisite for chat and resources gating
- Skip tracker: "X days skipped this week" on coach/owner student rows — ISO Mon-Sun week, Mon-Fri weekdays only, derived from existing work_sessions with no new table
- Coach assignments parity: coach gets /coach/assignments page mirroring owner, scoped to own students and unassigned students only
- Report comments: single nullable coach comment per daily_reports row; coach writes, student reads
- Invite max_uses UI: default 10, use_count/max_uses displayed on invite list (schema columns already exist)
- Chat system: 1:1 coach-student and broadcast, 5s polling, unread badge in sidebar
- Resources tab: URL link list + Discord WidgetBot embed + searchable glossary

**Should have (differentiators):**
- Weekly skip count prominently surfaced on coach dashboard student cards (proactive intervention signal)
- Broadcast with per-student read status (read by X/Y count on coach broadcast messages)
- Discord embed as first-class tab (keeps students in accountability environment vs. external Discord link)
- Report comments as async micro-feedback (30-second coaching note without scheduling a call)
- student_diy as self-service on-ramp (lower barrier for informal learners without diluting premium experience)

**Defer to v1.5+:**
- Message editing/deletion (audit trail concern)
- File/image uploads in chat (Supabase Storage complexity)
- Per-student resource visibility (requires tier/segment system)
- Threaded replies (flat chat is the correct v1 model)
- Email notifications (Resend integration is explicitly out of scope — PROJECT.md)
- Supabase Realtime (polling is adequate; Realtime hits 500 concurrent connection limit on Pro plan)

### Architecture Approach

The existing architecture pattern — async Server Components for reads passing props to thin "use client" islands for interactivity, with all mutations going through a strict API pipeline (CSRF → Auth → Role → RateLimit → Zod → Ownership → Logic) — applies unchanged to all v1.4 features. The chat system introduces the only client-side polling pattern in the codebase, implemented as a `useInterval` custom hook that uses `useRef` to hold a stable callback reference and pauses on `document.hidden`. Initial messages are server-rendered and passed as `initialMessages` props; the polling loop fetches only messages newer than the cursor.

**Major components:**
1. **proxy.ts** — must be updated atomically with config.ts; student_diy added to DEFAULT_ROUTES and ROLE_ROUTE_ACCESS
2. **src/lib/config.ts** — expanded ROLES, ROLE_HIERARCHY, NAVIGATION, INVITE_CONFIG; the TypeScript Role type propagates errors to all integration points
3. **(dashboard)/student_diy/ route group** — thin wrappers reusing WorkTrackerClient and RoadmapClient via props; own layout.tsx with reduced nav
4. **ChatClient.tsx** (shared component) — polling loop, cursor-based fetch, tab visibility optimization; used by both /coach/chat and /student/chat pages
5. **API routes (7 new + 2 modified)** — /api/reports/[id]/comment, /api/messages, /api/resources, /api/resources/[id], /api/glossary, /api/glossary/[id], /api/assignments — all follow the established pipeline without exception
6. **ResourcesTab / DiscordEmbed / GlossaryTab** (shared components) — tabbed sub-navigation controlled by React state, not URL segments (WidgetBot back-button is broken per docs)
7. **get_sidebar_badges RPC** — extended to return unread_messages count; sidebar badge passes server-rendered count on page load; no polling interval inside Sidebar

### Critical Pitfalls

1. **Partial role expansion (Pitfall 1)** — Adding student_diy to the DB but missing any of the other seven locations causes infinite redirect loops or runtime TypeError. Prevention: update all eight locations in a single atomic commit; let the TypeScript Role type compile errors guide which sites need updating.

2. **RLS policies missing student_diy (Pitfall 2)** — Admin client bypasses RLS so dev tests pass; anon client hits default-deny and returns empty data or 500 errors. Prevention: write student_diy RLS policies in the same migration, validate with anon client directly in Supabase Studio.

3. **Chat polling setInterval memory leak and stale closure (Pitfall 3)** — Missing clearInterval in useEffect cleanup lets intervals fire after navigation; missing useRef causes stale conversationId. Prevention: always use the useInterval custom hook pattern with useRef.

4. **Discord iframe blocked by missing CSP in production (Pitfall 4)** — next.config.ts is currently empty; Vercel injects SAMEORIGIN headers that block the WidgetBot iframe. Invisible on localhost. Prevention: add `frame-src 'self' https://e.widgetbot.io` to next.config.ts as the first step of the resources phase; test on Vercel preview before marking complete.

5. **Chat GET polling endpoint hit by rate limiter (Pitfall 7)** — checkRateLimit() INSERTs a row per request; 5k students polling at 12 req/min = 60k inserts/min into rate_limit_log. Prevention: never call checkRateLimit() in read-only GET endpoints; it is for mutation routes only.

6. **Report comment endpoint missing ownership verification (Pitfall 8)** — Any coach can comment on any student's report without an ownership check. This identical gap was fixed in v1.2 for /api/reports/[id]/review. Prevention: two-step check — fetch report to get student_id, verify student.coach_id matches requesting coach.

7. **ISO week skip tracker UTC mismatch (Pitfall 5)** — CURRENT_DATE in Postgres is UTC; student local "today" diverges for UTC+ timezones. Prevention: pass getTodayUTC() from the application layer as a parameter to the RPC function; never use CURRENT_DATE inside the function.

---

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md and the risk analysis from PITFALLS.md, the following phase structure is recommended. All phases after Phase A are unblocked by Phase A's completion, but Phases F and G are the highest complexity and should not be parallelized.

### Phase A: DB Schema + Config Foundation
**Rationale:** Every other phase gates on student_diy being defined in config.ts and the DB. The TypeScript Role type propagates errors to all call sites, making this the only correct atomic change point. Partial execution is the top critical pitfall.
**Delivers:** student_diy added to all eight role gate locations; 4 new tables created (report_comments, messages, resources, glossary_terms); 3 CHECK constraints updated (users, invites, magic_links); types.ts updated; TypeScript compiles cleanly.
**Addresses:** student_diy role foundation, chat/resources table schema, invite constraint
**Avoids:** Pitfall 1 (partial role expansion), Pitfall 2 (RLS gaps — student_diy RLS written in same migration)
**Research flag:** Standard — config-is-truth is the established codebase convention; no additional research needed.

### Phase B: student_diy Route Group
**Rationale:** The simplest new role feature; validates Phase A in a real user flow with zero additional tables. Reuses WorkTrackerClient and RoadmapClient as thin wrappers — no code duplication.
**Delivers:** /student_diy/ dashboard, /student_diy/work, /student_diy/roadmap; proxy correctly routes the 4th role; invite flow accepts student_diy as a role option.
**Addresses:** student_diy user experience, invite flow role expansion
**Avoids:** Anti-Pattern 4 (no copy-pasting WorkTrackerClient into student_diy directory)
**Research flag:** Standard — proxy.ts and route group patterns are identical to existing roles.

### Phase C: Skip Tracker
**Rationale:** Zero table dependencies (reads existing work_sessions), high coach value, low risk. Quick win after Phase A confirms config is live.
**Delivers:** skip_days_this_week scalar on coach and owner student rows; SkipBadge component
**Addresses:** Skip tracker table stakes feature
**Avoids:** Pitfall 5 (UTC mismatch — pass getTodayUTC() as p_today parameter to RPC; never use CURRENT_DATE inside the function)
**Research flag:** Standard — Postgres date_trunc week behavior confirmed; implementation is a single RPC function.

### Phase D: Coach Assignments Parity
**Rationale:** Low complexity (role check expansion and one new page), no new tables. Validates that the expanded /api/assignments route does not introduce privilege escalation.
**Delivers:** /coach/assignments page; coaches can assign/unassign from their own students pool and unassigned students
**Addresses:** Coach assignments table stakes
**Avoids:** Pitfall 6 (unbounded student enumeration — filter server-side to role='student' AND coach_id IS NULL; coaches never see all-platform students)
**Research flag:** One product decision to confirm with Abu Lahya — whether coaches see unassigned students only, or also their own already-assigned students, in the picker. Assume "both" based on research; verify before launch.

### Phase E: Report Comments
**Rationale:** Low complexity (nullable columns on existing table). Must include ownership verification matching the v1.2 review endpoint pattern — this is the only security-critical requirement.
**Delivers:** POST/DELETE /api/reports/[id]/comment; inline comment textarea on coach report review; read-only comment block on student report history
**Addresses:** Report comment table stakes and async micro-feedback differentiator
**Avoids:** Pitfall 8 (ownership check — two-step: fetch report, verify student.coach_id = requesting coach — same pattern as existing /api/reports/[id]/review fix from v1.2 Phase 23)
**Research flag:** Standard — pattern established in v1.2.

### Phase F: Chat System
**Rationale:** Highest implementation complexity in this release (2 new tables, polling hook, broadcast model, sidebar badge integration). Must follow Phase A (messages table must exist) and Phase B (student_diy role must be defined for feature gating).
**Delivers:** GET/POST /api/messages with cursor-based polling; ChatClient useInterval component; /coach/chat and /student/chat pages; sidebar unread badge via server-rendered count from updated get_sidebar_badges RPC
**Addresses:** Chat system P1 features, unread badge table stakes, broadcast read-status differentiator
**Avoids:** Pitfall 3 (useInterval hook with useRef), Pitfall 7 (checkRateLimit NOT called on GET polling endpoint), Pitfall 11 (no setInterval inside Sidebar — unread count is server-rendered on page load only)
**Research flag:** Standard — polling pattern is fully documented with implementation examples in STACK.md and FEATURES.md. Confirm broadcast filtering logic (students receive only broadcasts from their assigned coach) before implementing the broadcast message query.

### Phase G: Resources Tab
**Rationale:** Second-highest complexity (2 new tables, 3 sub-tabs, Discord CSP). CSP headers must be added to next.config.ts as the very first step, before any iframe component is written. Has one external prerequisite outside the codebase.
**Delivers:** CRUD /api/resources and /api/glossary; ResourcesTab, DiscordEmbed, GlossaryTab shared components; /student/resources, /coach/resources, /owner/resources pages; next.config.ts CSP headers
**Addresses:** Resources tab P2 features, Discord embed differentiator, inline glossary differentiator
**Avoids:** Pitfall 4 (CSP first, test on Vercel preview), Pitfall 9 (case-insensitive UNIQUE index: CREATE UNIQUE INDEX idx_glossary_term_lower ON glossary (lower(term)))
**Research flag:** Needs external validation — WidgetBot bot must be added to the Discord server by Abu Lahya before the iframe renders. UI must display "Discord not configured" placeholder (matching existing Ask AI "Coming Soon" card pattern) when NEXT_PUBLIC_DISCORD_GUILD_ID is absent. Confirm env vars are set in Vercel production before testing the live embed.

### Phase H: Invite max_uses UI
**Rationale:** Schema columns already exist. This is a migration default-value change plus two UI changes. Smallest phase in the release.
**Delivers:** magic_links.max_uses DEFAULT 10 migration; max_uses input in invite creation form; use_count/max_uses display on invite list rows
**Addresses:** Invite max_uses table stakes
**Avoids:** Pitfall 10 (null guard in capacity check: max_uses !== null && use_count >= max_uses; render null as '∞'; migration must document whether existing null rows are grandfathered or retroactively capped)
**Research flag:** One implementation detail to verify — inspect the existing invite callback (/api/auth/callback) to confirm it enforces max_uses before treating this as a pure UI change. If the callback has no cap check, that logic must be added in this phase.

### Phase Ordering Rationale

- Phase A is the only hard prerequisite; it must ship before a single page or API route is written.
- Phases B–E are low complexity and validate the foundational role expansion in real user flows before the complex new systems are built.
- Phase F should not start until Phase A is confirmed working in production (student_diy gating logic depends on the role constant being live in config and the DB).
- Phase G is P2 and can slip to a point release without blocking the core coaching loop; it also carries an external dependency that Abu Lahya must fulfill.
- Phase H is the smallest change in the release and can slot in at any point after Phase A.

### Research Flags

Phases needing external validation or product confirmation:
- **Phase G (Resources/Discord):** WidgetBot bot setup is an external action by Abu Lahya. Build the "not configured" placeholder first. Confirm NEXT_PUBLIC_DISCORD_GUILD_ID and NEXT_PUBLIC_DISCORD_CHANNEL_ID are in Vercel production env before testing the live embed.
- **Phase D (Coach Assignments):** Confirm with Abu Lahya whether coaches see unassigned students only, or also their own currently-assigned students, in the assignment picker.
- **Phase H (Invite limits):** Verify existing /api/auth/callback enforces the max_uses cap before treating this as a pure UI phase.

Phases with standard patterns (skip additional research):
- **Phase A:** config-is-truth pattern fully established; TypeScript Role type is the safety net.
- **Phase B:** Route group and proxy patterns are identical to existing roles.
- **Phase C:** Postgres date_trunc week confirmed; one RPC function.
- **Phase E:** Ownership check pattern established in v1.2 Phase 23.
- **Phase F:** Polling pattern fully documented with code examples in research files.
- **Phase H:** Schema is already in place.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All v1.4 features verified against existing stack; zero new packages confirmed; versions locked in package.json |
| Features | HIGH | Decisions D-01 through D-14 are locked in PROJECT.md; feature scope is defined, not exploratory |
| Architecture | HIGH | Derived from direct codebase inspection of proxy.ts, config.ts, existing API routes, layout.tsx, and RPC types |
| Pitfalls | HIGH | All 11 pitfalls grounded in codebase audit and prior v1.x incident records (v1.1 UTC gap closure, v1.2 ownership fix) |

**Overall confidence:** HIGH

### Gaps to Address

- **Coach assignment picker scope (Phase D):** Whether coaches see only unassigned students or also their own assigned students is a product decision not confirmed with Abu Lahya. Implement as "unassigned + own students" during development; verify before launch.
- **WidgetBot allowlist (Phase G):** The production Vercel domain must be registered in the WidgetBot dashboard by Abu Lahya. Flag as a deployment-time prerequisite in Phase G success criteria.
- **get_sidebar_badges RPC extension (Phase F):** The exact current return shape of this RPC must be read from src/lib/rpc/types.ts before writing the unread_messages extension. Low risk but requires verification during Phase F implementation.
- **Invite callback max_uses enforcement (Phase H):** The existing /api/auth/callback may or may not already enforce max_uses. Inspect before writing the Phase H migration to avoid introducing a duplicate or conflicting check.

---

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — locked v1.4 decisions D-01 through D-14 (canonical product requirements)
- Direct codebase inspection: `src/proxy.ts`, `src/lib/config.ts`, `src/lib/session.ts`, `src/lib/csrf.ts`, `src/lib/rate-limit.ts`, `src/lib/supabase/admin.ts`, `src/app/api/reports/route.ts`, `src/app/(dashboard)/layout.tsx`, `src/lib/types.ts`, `supabase/migrations/`
- [WidgetBot iframe documentation](https://docs.widgetbot.io/tutorial/iframes) — iframe URL format, bot requirement, back-button caveat, allow attributes
- [PostgreSQL date_trunc week — Medium](https://medium.com/@raileohang/postgresql-date-trunc-week-gotcha-b8a90960026c) — confirmed Monday-start ISO 8601 behavior and Sunday edge case
- [usePolling custom hook — Dave Gray](https://www.davegray.codes/posts/usepolling-custom-hook-for-auto-fetching-in-nextjs) — setInterval + useEffect polling pattern in Next.js

### Secondary (MEDIUM confidence)
- [Long Polling vs WebSockets — Ably](https://ably.com/blog/websockets-vs-long-polling) — confirms polling is valid for async coaching chat at this scale
- [Real-Time Features in SaaS — TwoCents](https://www.twocents.software/blog/real-time-features-in-saas/) — confirms polling correct for Supabase Pro connection constraints
- [Chat UX Best Practices — GetStream](https://getstream.io/blog/chat-ux/) — broadcast vs 1:1 mental models, unread indicators
- [16 Chat UI Design Patterns — BricxLabs](https://bricxlabs.com/blogs/message-screen-ui-deisgn) — message bubble patterns, sender labels, broadcast channel UI
- [Fuse.js in Next.js — Medium](https://medium.com/@ketchasso72/implementing-client-side-search-in-next-js-with-fuse-js-7bbf241b874f) — confirms client-side Array.filter sufficient for glossary scale
- [Designing Permissions for SaaS — UX Collective](https://uxdesign.cc/design-permissions-for-a-saas-app-db6c1825f20e) — tiered role feature-gating patterns

---

*Research completed: 2026-04-03*
*Ready for roadmap: yes*
