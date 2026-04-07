# Feature Research

**Domain:** Student performance + coaching platform (v1.4 — roles, chat, resources)
**Researched:** 2026-04-03
**Confidence:** HIGH (existing codebase read; decisions locked in PROJECT.md; patterns verified against official docs and multiple sources)

---

## Scope

This document covers only the NEW features in v1.4. The existing work tracker, roadmap,
daily reports, coach review inbox, session planner, and auth are already shipped and out of scope.

New feature groups:
1. student_diy — 4th role (dashboard + work tracker + roadmap only)
2. Skip tracker — "X days skipped this week" on coach/owner views (Mon-Sun ISO week)
3. Coach assignments — coaches get same assignment power as owner
4. Report comments — single coach comment per daily report
5. Chat system — polling-based 5s, 1:1 coach↔student + broadcast, sidebar unread badges
6. Resources tab — URL links + Discord WidgetBot embed + searchable glossary
7. Invite link max_uses — default 10, UI shows usage count

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the platform feels incomplete without for this feature set.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unread badge on Chat sidebar nav | Any chat feature ships with an unread indicator — absence feels broken | LOW | Sidebar already exists; `use client` component polls `/api/chat/unread` on 5s interval; badge reads from `message_reads` join table |
| Message timestamps + sender label | Chat without timestamps feels amateur; coaching context needs an audit trail | LOW | `created_at` on messages table; format relative ("2m ago") for recent, absolute for older |
| Chat message history (scrollable) | Users expect to scroll back; conversations that vanish on reload = broken trust | LOW | Paginate 50 messages `ORDER BY created_at DESC`; render reversed; infinite scroll upward is v2 |
| Broadcast vs 1:1 visual distinction | Users need to know if a message was personal or sent to all | LOW | "Broadcast" label chip on thread header and each broadcast message; distinct icon in thread list |
| Students can reply to coaches | One-way broadcast in a "chat" UI violates user mental model | MEDIUM | Students reply in their own 1:1 thread; broadcast channel is coach-write / student-read |
| Report comment visible in student history | Coach feedback students cannot see is useless — they must be able to act on it | LOW | Comment field at bottom of report detail card; student report history page already exists |
| Coach name + timestamp on report comment | Students need attribution to follow up with the right person | LOW | JOIN users on `commented_by`; display "Coach Ahmed — Apr 3, 2026" |
| Skip count on student rows | Coach dashboard shows student status rows — a "3 days skipped" chip fits naturally | LOW | Scalar derived from `work_sessions`; no new table; Mon-Fri weekdays only |
| ISO week boundary consistent across UI | Mismatch between coach "this week" and student "this week" destroys trust | LOW | Postgres `date_trunc('week', date)` returns Monday; ISO 8601 confirmed; see edge cases below |
| Instant glossary search results | Users abandon glossaries that require page reload to search | LOW | Client-side `useMemo` filter on term/definition strings; Fuse.js only needed if >500 entries (unlikely v1) |
| Glossary empty state with add prompt | Empty glossary with no CTA is confusing for owner/coach | LOW | "No terms yet. Add the first one." with inline create form visible to owner and coach |
| Resources link list — URLs open in new tab | Links that navigate away without new tab = broken back-button UX | LOW | `target="_blank" rel="noopener noreferrer"`; show domain as sub-label |
| student_diy blocked from coach-only routes | A student_diy who can reach the report form but cannot submit it = broken UX | MEDIUM | Own route group `(dashboard)/student-diy/` in App Router; proxy.ts enumerates new role |
| Invite usage count visible | Admins managing invite links need to know remaining slots at a glance | LOW | `use_count / max_uses` on invite list row; schema columns already exist on `magic_links` |
| Coach can assign any student (not just own) | Owner has this power; coach having a weaker subset causes confusion at scale | MEDIUM | `/api/assignments` currently owner-only; expand role check; scope coach to own students |

### Differentiators (Competitive Advantage)

Features that add distinctive value beyond what generic coaching tools offer.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Weekly skip count prominently on coach dashboard | Most platforms show absence passively (empty calendar rows); surfacing "3 skips this week" drives proactive intervention before a student falls behind | LOW | Scalar subquery on existing `work_sessions`; Mon-Fri weekdays; shown on student card in coach list |
| Broadcast channel with per-student read status | WhatsApp Channels shows aggregate read counts; showing "read by 12/15" per broadcast message is more accountable in a coaching context | MEDIUM | `message_reads(message_id, user_id, read_at)` join table; coach sees read count chip on broadcast messages |
| Discord embed as first-class tab | Linking to Discord = students leave the platform; embedding keeps them in the accountability environment | MEDIUM | WidgetBot iframe: `https://e.widgetbot.io/channels/{GUILD_ID}/{CHANNEL_ID}`; requires WidgetBot bot added to server; `allow="clipboard-write; fullscreen"` |
| Inline glossary in resources hub | Standalone glossary pages are rarely visited; one "Resources" tab combining links + Discord + glossary is the single reference hub | MEDIUM | Tabbed sub-navigation inside Resources: Links / Discord / Glossary |
| student_diy role as self-service on-ramp | Most platforms have one student tier; a lightweight DIY role with no coach dependency lowers barriers for informal learners while protecting the premium experience | HIGH | New role touches proxy.ts, ROLES config, DB CHECK constraint, RLS policies, invite flow, and all feature-gating logic |
| Report comments as async micro-feedback | Most coaching platforms require a full session to give feedback; a single comment field lets coaches leave targeted notes in 30 seconds without scheduling a call | LOW | Single `comment text`, `commented_by`, `commented_at` on `daily_reports`; no threading |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Supabase Realtime for chat | Zero polling latency feels like the "right" technical choice | Pro plan has 500 concurrent WebSocket connection limit; 5k students with open tabs would exceed this instantly (PROJECT.md D-07 explicitly decided against) | 5s polling with `setInterval` + `fetch` — adequate for async coaching chat |
| Rich text / markdown in chat | Coaches want formatted messages | Adds XSS sanitization, rendering inconsistency, WYSIWYG editor complexity | Plain text + URL auto-linking only in v1 |
| File/image uploads in chat | "Send a screenshot of your outreach" is a real use case | Requires Supabase Storage config, CSP `img-src`, virus scan surface area | Coaches share Google Drive / Notion links as plain text URLs |
| Threaded replies (Discord-style) | Power users want reply-to-specific-message | Adds `thread_id` FK, nested rendering, polling must handle thread nesting | Flat chronological chat per 1:1 thread; 1:1 is already focused by nature |
| Email notifications on chat messages | Coaches want students to reply quickly | Resend integration is explicitly Out of Scope (PROJECT.md) | Unread badge in sidebar is the v1 nudge mechanism |
| Glossary with rich text / images | Looks polished in demos | CRUD complexity spikes; owner/coach needs WYSIWYG or markdown renderer | `term` (short text) + `definition` (plain text textarea); sufficient for influencer marketing terminology |
| Per-student resource visibility | "Coach A's students see different links than Coach B's" | Multiplies resource management surface area; requires `resource_visibility` join table | One shared library for owner/coach/student; student_diy excluded by role, not by resource record |
| Broadcast to student segments | "Send this to Bronze-tier students only" | Tier system is V2+; ad-hoc segmentation needs group selection UI | Broadcast = all students under caller's purview (owner sees all; coach sees their students) |
| Chat message edit/delete | Coaches want to fix typos | Audit trail matters in an accountability context; edited messages create ambiguity | No edit/delete in v1; send a corrective follow-up message |
| student_diy can see coach comments on reports | DIY students might want coach feedback eventually | student_diy has NO coach assignment by design (D-04); coach comments are coach→student only | student_diy role does not submit daily reports at all (D-05) |

---

## Feature Dependencies

```
[student_diy role]
    └──requires──> [ROLES config: add 'student_diy' constant]
    └──requires──> [DB migration: users.role CHECK constraint adds 'student_diy']
    └──requires──> [DB migration: invites.role and magic_links.role CHECK constraints add 'student_diy']
    └──requires──> [proxy.ts route guard: enumerate student_diy routes]
    └──requires──> [App Router: new route group (dashboard)/student-diy/ with own layout]
    └──blocks-gating-of──> [chat system] (chat restricted to student/coach/owner — NOT student_diy)
    └──blocks-gating-of──> [resources tab] (resources restricted — NOT student_diy per D-11)
    └──must-ship-before──> [chat system, resources tab]

[chat system — 1:1 + broadcast]
    └──requires──> [DB migration: chat_messages table (id, thread_id, sender_id, content, created_at)]
    └──requires──> [DB migration: chat_threads table (id, type: '1:1'|'broadcast', coach_id, student_id nullable)]
    └──requires──> [DB migration: message_reads table (message_id, user_id, read_at)]
    └──requires──> [GET /api/chat/messages?thread_id= (server route)]
    └──requires──> [POST /api/chat/messages (mutation route with rate limit + CSRF)]
    └──requires──> [GET /api/chat/unread (returns count for current user)]
    └──requires──> [Sidebar unread badge: usePolling hook calling /api/chat/unread every 5s]
    └──requires-before──> [student_diy role defined] (gating depends on role constant)
    └──depends-on──> [existing users table (coach_id FK for 1:1 thread creation)]
    └──DOES NOT require──> [Supabase Realtime — polling only per D-07]

[report comments]
    └──requires──> [DB migration: add comment text, commented_by uuid FK, commented_at timestamptz to daily_reports]
    └──requires──> [PATCH /api/reports/[id]/comment endpoint]
    └──requires──> [Comment UI on coach report review page (existing coach reports route)]
    └──requires──> [Comment display on student report history detail (existing student route)]
    └──depends-on──> [existing daily_reports table + /api/reports route]
    └──NO new table needed]

[skip tracker]
    └──depends-on──> [existing work_sessions table (date column)]
    └──requires──> [ISO week SQL: date_trunc('week', date) for Mon boundary]
    └──requires──> [Weekday filter: exclude Sat (DOW=6) and Sun (DOW=0)]
    └──surface-on──> [coach dashboard student card rows]
    └──surface-on──> [owner student list rows]
    └──surface-on──> [coach/owner student detail page header]
    └──NO new table needed]

[resources tab]
    └──requires──> [DB migration: resources table (id, title, url, description, created_by, created_at)]
    └──requires──> [DB migration: glossary_terms table (id, term, definition, created_by, created_at)]
    └──requires──> [CRUD endpoints: /api/resources, /api/glossary]
    └──requires──> [Student nav: new Resources tab (links to /student/resources)]
    └──requires──> [WidgetBot bot added to Discord server — EXTERNAL PREREQUISITE for Abu Lahya]
    └──requires──> [CSP header: frame-src https://e.widgetbot.io in next.config.ts]
    └──requires──> [NEXT_PUBLIC_DISCORD_GUILD_ID + NEXT_PUBLIC_DISCORD_CHANNEL_ID env vars]
    └──must-gate──> [student_diy excluded — depends on student_diy role existing in config]

[coach assignments parity]
    └──depends-on──> [existing /api/assignments PATCH route (currently owner-only)]
    └──requires──> [role check expansion: owner OR coach in route handler]
    └──requires──> [coach scoping: coach can only assign students where student.coach_id IS NULL or = current coach]
    └──requires──> [new /coach/assignments page (mirrors existing /owner/assignments)]
    └──requires──> [coach nav: add Assignments link]
    └──NO new table needed]

[invite link max_uses]
    └──depends-on──> [magic_links table: max_uses + use_count columns already exist]
    └──requires──> [DB migration: ALTER TABLE magic_links ALTER COLUMN max_uses SET DEFAULT 10]
    └──requires──> [UI: max_uses input in invite creation form (default 10)]
    └──requires──> [UI: use_count / max_uses display on invite list rows]
    └──verify-existing──> [invite callback enforces max_uses check — confirm before assuming]
    └──NO new table needed]
```

### Dependency Notes

- **student_diy must ship first (or same migration batch) as chat and resources gating.** The gating logic for both features checks the role constant. If student_diy is not in ROLES config or the DB CHECK constraint, the gating is incomplete.
- **Chat requires student_diy role to be defined.** Chat visibility rule ("NOT student_diy") depends on the role constant existing in config and the DB CHECK constraint being live.
- **Discord embed has an external prerequisite.** WidgetBot bot must be invited to the Discord server by Abu Lahya before the iframe renders. The UI should display a "Discord not configured" placeholder (matching the Ask AI "Coming Soon" pattern) when env vars are absent. This is the single most likely deployment blocker for the Resources tab.
- **Skip tracker has zero table dependencies.** It is a pure query derivation from `work_sessions.date`. The ISO week boundary (Mon=start) is confirmed by Postgres `date_trunc('week', ...)` which follows ISO 8601. Sat/Sun are not counted as skips (weekday definition: DOW 1-5).
- **Report comments require schema migration only.** Single nullable column group on an existing table. No new table, no new FK complexity beyond `commented_by → users(id)`.
- **Invite max_uses is schema-ready.** `magic_links` already has `max_uses int` and `use_count int NOT NULL DEFAULT 0`. This is a default-value migration + UI change only. Verify existing callback logic enforces the cap before treating this as pure UI work.
- **Coach assignments parity is a role-check + new UI page.** The `PATCH /api/assignments` route exists. Expanding to coach requires adding an ownership scope: a coach may only assign students whose `coach_id IS NULL OR coach_id = current_coach_id`. Prevents coaches stealing each other's students.

---

## MVP Definition

### This Milestone (v1.4) — All Features In Scope

Build order should respect the dependency chain above:

- [ ] student_diy role: ROLES config + DB migration + proxy.ts + route group + nav — prerequisite for chat and resources gating
- [ ] Skip tracker: SQL query addition on existing coach/owner data fetches — zero-table, high value
- [ ] Coach assignments parity: role check expansion + new /coach/assignments page
- [ ] Report comments: DB migration + PATCH endpoint + two UI changes (coach write, student read)
- [ ] Invite max_uses UI: DB default migration + form input + list display
- [ ] Chat system: 2 new tables + polling hook + unread badge + 1:1 + broadcast pages — highest complexity, build after student_diy role is confirmed
- [ ] Resources tab: 2 new tables + CRUD endpoints + 3 sub-tabs (links / Discord / glossary) + CSP header — build after student_diy role confirmed

### Defer to v1.5+

- [ ] Message editing / deletion — audit trail concern; send a corrective message instead
- [ ] File/image uploads in chat — Storage complexity out of scope
- [ ] Per-student resource visibility — segmentation requires tier system (V2+)
- [ ] Read receipt per-student breakdown on broadcasts — nice-to-have; "read by X/Y" aggregate count is sufficient
- [ ] Threaded replies — flat chat is the correct v1 model
- [ ] Email notifications on chat messages — Resend integration is explicitly Out of Scope

### Future Consideration (v2+)

- [ ] Supabase Realtime (replace polling) — only if polling latency becomes a user complaint at scale
- [ ] Rich text in chat — only if coaches explicitly request markdown formatting
- [ ] Broadcast to student segments — needs tier/tag system first
- [ ] Glossary import/export (CSV) — manage at scale

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| student_diy role | HIGH (new user tier) | HIGH (proxy, config, DB, gating) | P1 — build first; unblocks gating |
| skip tracker | HIGH (actionable coach signal) | LOW (SQL derivation, no table) | P1 — quick win |
| coach assignments parity | MEDIUM (coach autonomy) | LOW (role check + one page) | P1 |
| report comments | HIGH (closes feedback loop) | LOW (migration + 2 UI changes) | P1 |
| invite max_uses UI | MEDIUM (operational control) | LOW (schema ready, UI + default) | P1 |
| chat system | HIGH (direct async communication) | HIGH (2 tables, polling, broadcast model) | P1 — build after student_diy |
| resources tab | MEDIUM (reference hub) | MEDIUM (2 tables, 3 sub-tabs, Discord CSP) | P2 — can slip without breaking core loop |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have; add when possible
- P3: Nice to have, future consideration

---

## Behavioral Patterns — Research Findings

### Chat Polling (5s interval — confirmed correct choice)

The 5s polling model is appropriate for async coaching chat. Key considerations:

- **Supabase Pro plan WebSocket limit:** 500 concurrent connections. With 5k students, Realtime is not safe without connection multiplexing — the polling decision (D-07) is architecturally sound.
- **Polling implementation pattern:** `useEffect` + `setInterval` calling `fetch('/api/chat/messages?thread_id=...')`. On mount, fetch immediately (do not wait 5s for first data). Clean up interval on unmount with `clearInterval`. Use `useRef` for interval ID.
- **Tab visibility optimization:** Pause polling when `document.visibilityState === 'hidden'`; resume on `visibilitychange` event. This is important at scale — students with many tabs open would otherwise fire DB queries continuously.
- **`router.refresh()` vs direct fetch:** `router.refresh()` re-renders Server Components; direct fetch to an API route returns JSON and updates local state without full re-render. For a chat component, direct fetch is correct — the chat is a client component that manages its own message list state.
- **Unread count polling:** The sidebar badge can poll `/api/chat/unread` independently at 5s. This endpoint is cheap (COUNT query with index on `message_reads`). The ChatWindow component polls for messages; the Sidebar polls for unread count — two separate intervals with separate lifecycles.

**Confidence:** HIGH — polling pattern verified against Next.js discussion threads and Dave Gray's usePolling article.

### Skip Tracker (ISO Week Edge Cases)

- **Postgres `date_trunc('week', date)`:** Returns Monday of the ISO week. Confirmed ISO 8601 compliant — Sunday is part of the PREVIOUS week. So `date_trunc('week', '2026-04-05'::date)` returns `'2026-03-30'` (the Monday of that week). This matches the D-01 decision (Mon-Sun week).
- **"Skip" definition:** A weekday is a skip if it falls within the current ISO week AND there are no `work_sessions` rows for that `student_id` with `status IN ('completed', 'abandoned')` on that `date`. `status = 'in_progress'` does NOT count as worked (incomplete day).
- **Weekday filter:** Only Mon-Fri count. Use `EXTRACT(DOW FROM date) BETWEEN 1 AND 5`. DOW=0 is Sunday, DOW=6 is Saturday in Postgres.
- **Future days:** Days between today and end of current week (e.g., if today is Wednesday, Thu and Fri are not yet skipped). Exclude future dates from skip count: `date <= CURRENT_DATE`.
- **Query shape:** `COUNT(DISTINCT d.date)` over a generated series of weekdays in the current ISO week, LEFT JOIN work_sessions where status is worked, WHERE work_sessions.id IS NULL AND d.date <= CURRENT_DATE`. Can be a CTE attached to the existing student list RPC.

**Confidence:** HIGH — Postgres date_trunc behavior confirmed with official docs and the Medium gotcha article.

### Discord WidgetBot Embed

- **Bot requirement:** WidgetBot bot MUST be added to the Discord server by Abu Lahya before the iframe renders. This is a hard external prerequisite. Build the UI with a "Discord not configured" placeholder state that shows when `NEXT_PUBLIC_DISCORD_GUILD_ID` is not set — identical to the existing Ask AI "Coming Soon" card pattern.
- **iframe URL format:** `https://e.widgetbot.io/channels/{GUILD_ID}/{CHANNEL_ID}`
- **Required iframe attributes:** `allow="clipboard-write; fullscreen"` and `loading="lazy"` (prevents layout shift on initial tab switch)
- **CSP header critical:** Must add `frame-src https://e.widgetbot.io` to `Content-Security-Policy` in `next.config.ts` headers. This is the most common integration failure — without it, the iframe is silently blocked by browser security policy. Next.js CSP is configured in `next.config.ts` via the `headers()` function.
- **Back-button caveat:** WidgetBot documentation explicitly warns that the iframe back-button is broken. The Resources tab must not rely on browser history for within-tab navigation. Sub-tabs (Links / Discord / Glossary) should be controlled by React state, not URL segments.

**Confidence:** HIGH — confirmed via direct WidgetBot docs fetch.

### Glossary Search

- **Client-side filtering is correct.** A glossary will have at most a few hundred terms in v1. Client-side `useMemo` with `term.toLowerCase().includes(query)` or `definition.toLowerCase().includes(query)` is instant and adds zero server load. No need for Fuse.js fuzzy matching unless the owner explicitly requests "find similar terms" behavior.
- **Load all terms on tab mount.** Single fetch on `ResourcesPage` load; store in component state; filter purely client-side. No search endpoint needed.
- **Owner + coach can CRUD.** `created_by` FK to `users` identifies who created the term. Both roles can delete any term (shared library). Student can only read.

**Confidence:** HIGH — well-established pattern.

### Report Comments

- **Single comment per report (no threading).** `comment text`, `commented_by uuid`, `commented_at timestamptz` added as nullable columns on `daily_reports`. This is intentional simplicity — coaching feedback is a one-shot annotation, not a conversation. (D-03)
- **Coach writes, student reads.** Comment form appears on the coach report review page. On the student report history page, the comment shows in a distinct block at the bottom of the report card.
- **Overwrite vs append:** Since there is only one comment slot, a second comment from a coach overwrites the first. This is simpler than append logic and sufficient for v1.
- **Empty state:** If no comment, show nothing on student side (no "No feedback yet" message that implies feedback was expected).

**Confidence:** HIGH — pattern locked in D-03.

### student_diy Role Architecture

- **Own route group is cleaner than feature-flag gating inside the student group.** Using a separate `(dashboard)/student-diy/` route group with its own `layout.tsx` and nav means student_diy users can never accidentally reach student routes — even if proxy.ts has a bug. Defense in depth.
- **Nav for student_diy:** Dashboard, Work Tracker, Roadmap only. No Chat, Report, Ask AI, Resources. Nav config in `src/lib/config.ts` should drive this (existing pattern) — add a `studentDiy` nav array.
- **ROLE_HIERARCHY:** student_diy = level 1 (same as student). It has no `coach_id` (D-04: no coach assignment). All queries that filter `WHERE coach_id = :current_coach_id` will naturally return 0 student_diy records — correct behavior. Coach dashboard does NOT show student_diy users.
- **Invite flow:** `invites.role` and `magic_links.role` CHECK constraints must expand to include `'student_diy'`. Both owner and coach can invite student_diy users. The invite creation form adds `student_diy` as a role option.

**Confidence:** HIGH — pattern follows existing proxy.ts and route group conventions in this codebase.

### Coach Assignments Parity

- **Scoping rule:** A coach may only assign students to a coach when `student.coach_id IS NULL` (unassigned) OR `student.coach_id = current_coach_id` (their own student). This prevents coaches from reassigning another coach's students without owner oversight.
- **Owner retains full power.** Owner can reassign any student to any coach (existing behavior unchanged).
- **New /coach/assignments page:** Mirrors `/owner/assignments`. Shows the coach's current students and unassigned students. Coach can assign/unassign from their own pool.

**Confidence:** MEDIUM — scoping rule is an inferred best practice; confirm with Abu Lahya whether coaches should see unassigned students only or their own students only.

---

## Existing Feature Interaction Summary

| Existing Feature | Interaction with v1.4 | Risk Level |
|------------------|-----------------------|------------|
| proxy.ts route guard | student_diy needs new route entries; chat/resources need role gating | HIGH — must enumerate student_diy correctly or role bypasses are possible |
| ROLES config in config.ts | ROLE_HIERARCHY and ROLES constants expand to 4 roles; nav config adds studentDiy array | MEDIUM — all consumers of ROLES must handle the new value |
| users.role CHECK constraint | DB migration required; existing role filter queries are unaffected | LOW — additive change |
| magic_links invite flow | max_uses default changes to 10; role options expand to include student_diy | LOW — default is a migration; role expansion is a CHECK constraint change |
| /api/assignments route | role check expands from owner-only to owner+coach with scoping | MEDIUM — must not break existing owner behavior |
| daily_reports table + /api/reports | new nullable columns for comment; existing queries unaffected | LOW — nullable columns are additive |
| Coach dashboard student list RPC | skip count added as a derived column; no schema change | MEDIUM — RPC query complexity increases; test with existing indexes |
| Sidebar layout.tsx | Chat and Resources nav links added; student_diy layout omits them | MEDIUM — sidebar renders from nav config; config change drives render |
| Ask AI "Coming Soon" card pattern | Discord embed should reuse same placeholder pattern when env vars absent | LOW — copy pattern, no regression |
| checkRateLimit() + verifyOrigin() | All new mutation endpoints (chat messages, comments, resources, glossary) need both | LOW — helpers already exist; must not forget to apply |

---

## Sources

- [IMA Accelerator PROJECT.md](file://C:/Users/ibrah/ima-accelerator-v1/.planning/PROJECT.md) — locked v1.4 decisions D-01 through D-14
- [WidgetBot iframe documentation](https://docs.widgetbot.io/tutorial/iframes) — URL format `https://e.widgetbot.io/channels/{GUILD_ID}/{CHANNEL_ID}`, bot requirement, back-button caveat, `allow` attributes
- [PostgreSQL date_trunc week gotcha — Medium](https://medium.com/@raileohang/postgresql-date-trunc-week-gotcha-b8a90960026c) — confirmed Monday-start ISO 8601 behavior, Sunday edge case
- [usePolling custom hook for Next.js — Dave Gray](https://www.davegray.codes/posts/usepolling-custom-hook-for-auto-fetching-in-nextjs) — setInterval + useEffect pattern for polling in client components
- [Fuse.js client-side fuzzy search in Next.js — Medium](https://medium.com/@ketchasso72/implementing-client-side-search-in-next-js-with-fuse-js-7bbf241b874f) — glossary search pattern
- [Long Polling vs WebSockets at scale — Ably](https://ably.com/blog/websockets-vs-long-polling) — tradeoff analysis confirming polling is valid for low-frequency async chat
- [Real-Time Features in SaaS: WebSockets, SSE, or Polling? — TwoCents](https://www.twocents.software/blog/real-time-features-in-saas/) — framework confirming polling is correct for Supabase Pro connection constraints
- [Chat UX Best Practices — GetStream](https://getstream.io/blog/chat-ux/) — broadcast vs 1:1 mental models, unread indicators
- [16 Chat UI Design Patterns — BricxLabs](https://bricxlabs.com/blogs/message-screen-ui-deisgn) — message bubble patterns, sender labels, broadcast channel UI
- [Designing Permissions for a SaaS App — UX Collective](https://uxdesign.cc/design-permissions-for-a-saas-app-db6c1825f20e) — tiered role feature gating patterns

---

*Feature research for: IMA Accelerator v1.4 — student_diy role, chat, resources, skip tracker, coach parity, report comments, invite limits*
*Researched: 2026-04-03*
