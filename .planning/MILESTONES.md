# Milestones

## v1.4 Roles, Chat & Resources (Shipped: 2026-04-06)

**Phases completed:** 8 phases (30-37), 19 plans
**Files modified:** 72 | **Lines of code:** 50,816 TypeScript (total codebase)
**Timeline:** 2 days (2026-04-03 → 2026-04-04) | **Commits:** 143
**Requirements:** 42/48 satisfied (6 bookkeeping gaps — see Known Gaps)

**Key accomplishments:**

1. Student_DIY 4th role with reduced feature set (dashboard + work tracker + roadmap only), 8-location atomic wiring across proxy/config/types/DB, dedicated route group with 4 pages
2. Skip tracker via get_weekly_skip_counts RPC — warning badges on coach and owner dashboards showing "X skipped" per student per ISO week
3. Coach assignments — coaches get full assignment power via /coach/assignments page with optimistic dropdown UI, search, and filter tabs
4. Report comments — single coach comment per report (upsert behavior), student read-only feedback view, ownership-verified API
5. Polling-based chat system (5s interval) — WhatsApp-style 1:1 conversations + broadcast, sidebar unread badges, cursor-based pagination, mobile-first layout
6. Resources tab — Links + Discord WidgetBot iframe (CSS hidden pattern) + searchable glossary with role-based CRUD for owner/coach, read-only for students
7. Invite link max_uses — default 10 on magic links, "X/Y used" display, exhausted badge, cap enforcement on registration

### Known Gaps

6 requirements marked Pending in traceability (phases completed, likely bookkeeping — checkboxes not updated during transitions):

- **SKIP-01**: Coach sees "X skipped" badge (Phase 32 completed — feature implemented)
- **SKIP-02**: Skip count only includes past days and today (Phase 32 completed)
- **SKIP-03**: Skip count resets to 0 on Monday (Phase 32 completed)
- **SKIP-05**: Skip count computed via Postgres RPC (Phase 32 completed)
- **CHAT-01**: Coach conversation list with last message preview (Phase 35 completed)
- **CHAT-05**: Coach broadcast message (Phase 35 completed)

**Archives:**

- [v1.4 Roadmap](milestones/v1.4-ROADMAP.md)
- [v1.4 Requirements](milestones/v1.4-REQUIREMENTS.md)

---

## v1.0 IMA Accelerator V1 (Shipped: 2026-03-18)

**Phases completed:** 12 phases, 38 plans
**Files modified:** 298 | **Lines of code:** 12,742 TypeScript
**Timeline:** 3 days (2026-03-16 → 2026-03-18) | **Commits:** 218
**Requirements:** 37/37 satisfied

**Key accomplishments:**

1. Next.js 16 + Supabase foundation with 6-table schema, RLS policies, Google OAuth, invite-only registration with magic links, and role-based routing via proxy.ts
2. Student work tracker (45-min cycles with pause/resume/abandon), 10-step sequential roadmap with auto-seeding, daily reports with auto-filled hours, AI chat embed (Coming Soon)
3. Coach dashboard with student overview and at-risk flagging, student detail tabs, report review inbox, student invite system, and cohort analytics
4. Owner platform-wide stats, searchable student/coach management, invite system for both roles, coach-student assignments page, and 4-type alert system with dismiss
5. Full UI polish: loading skeletons, error boundaries, empty states, mobile responsive at 375px, 44px touch targets, ima-* design tokens
6. Quality pass: invite architecture rewritten to whitelist model, raw Tailwind tokens replaced with ima-* tokens, response.ok checks added, UTC date bug fixed

**Tech Debt (non-blocking):**

- `types.ts` hand-crafted placeholder (regenerate when Docker running)
- `AI_CONFIG.iframeUrl` empty (awaiting external URL from Abu Lahya)
- Owner stat card labels hardcoded (should source from OWNER_CONFIG)
- No `(dashboard)/loading.tsx` skeleton for layout shell
- `POST /api/auth/signout` dead code (Sidebar uses client SDK)
- 22/37 SUMMARY frontmatter requirements_completed fields incomplete (metadata only)

**Archives:**

- [v1.0 Roadmap](milestones/v1.0-ROADMAP.md)
- [v1.0 Requirements](milestones/v1.0-REQUIREMENTS.md)
- [v1.0 Audit](milestones/v1.0-MILESTONE-AUDIT.md)

---
