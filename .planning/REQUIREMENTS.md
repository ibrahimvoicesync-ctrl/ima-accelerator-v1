# Requirements: IMA Accelerator v1.4

**Defined:** 2026-04-03
**Core Value:** Students can track their daily work, follow the 10-step roadmap, and submit daily reports that coaches review — the core accountability loop.

## v1.4 Requirements

Requirements for v1.4 milestone (Roles, Chat & Resources). Each maps to roadmap phases.

### Schema & Foundation

- [x] **SCHEMA-01**: All 4 new tables (report_comments, messages, resources, glossary_terms) exist with correct columns, constraints, and indexes in a single migration (00015)
- [x] **SCHEMA-02**: Users, invites, and magic_links role CHECK constraints accept 'student_diy' as a valid value
- [x] **SCHEMA-03**: RLS policies are enabled on all 4 new tables with appropriate read/write restrictions
- [x] **SCHEMA-04**: TypeScript types include Row/Insert/Update types for all 4 new tables and the Role union includes 'student_diy'

### Student_DIY Role

- [x] **ROLE-01**: User can register with a student_diy invite and be assigned role 'student_diy' via Google OAuth callback
- [x] **ROLE-02**: Student_DIY user is redirected to /student_diy dashboard after login
- [x] **ROLE-03**: Student_DIY sidebar shows exactly 3 items: Dashboard, Work Tracker, Roadmap
- [x] **ROLE-04**: Student_DIY user can access work tracker and roadmap with full functionality (same as student)
- [x] **ROLE-05**: Student_DIY user cannot access Ask Abu Lahya, Daily Report, Resources, or Chat pages
- [x] **ROLE-06**: Student_DIY user cannot be assigned to a coach (fully independent)
- [x] **ROLE-07**: Owner and coach can create student_diy invites

### Skip Tracker

- [ ] **SKIP-01**: Coach sees "X skipped" badge on each student card showing days with zero completed work sessions AND zero submitted reports in the current Mon-Sun ISO week
- [ ] **SKIP-02**: Skip count only includes past days and today, not future days in the week
- [ ] **SKIP-03**: Skip count resets to 0 on Monday (new ISO week)
- [x] **SKIP-04**: Owner student views also display the skip count badge
- [ ] **SKIP-05**: Skip count is computed via a Postgres RPC function using UTC-safe date math

### Coach Assignments

- [x] **ASSIGN-01**: Coach can view all students (not just their own) on a /coach/assignments page
- [x] **ASSIGN-02**: Coach can assign an unassigned student to any active coach
- [x] **ASSIGN-03**: Coach can reassign a student from one coach to another
- [x] **ASSIGN-04**: Coach can unassign a student (set coach_id to null)
- [x] **ASSIGN-05**: API returns 403 for student and student_diy roles attempting assignment changes
- [x] **ASSIGN-06**: Owner assignments page continues to work unchanged

### Report Comments

- [x] **COMMENT-01**: Coach can submit a text comment (max 1000 chars) on any of their students' daily reports
- [x] **COMMENT-02**: Only one comment per report is allowed (upsert behavior — resubmitting updates the existing comment)
- [ ] **COMMENT-03**: Student sees coach comment on their report history page as a read-only feedback card
- [x] **COMMENT-04**: Owner can also comment on any student's report
- [x] **COMMENT-05**: API returns 403 for student and student_diy roles attempting to comment

### Chat System

- [ ] **CHAT-01**: Coach sees a conversation list with all assigned students, showing last message preview, timestamp, and unread indicator
- [ ] **CHAT-02**: Coach can open a 1:1 conversation with a student and see message history in WhatsApp-style bubbles
- [ ] **CHAT-03**: Coach can send a message that appears as a right-aligned bubble; student sees it within 5 seconds as a left-aligned bubble
- [ ] **CHAT-04**: Student can reply to their coach; coach sees reply within 5 seconds
- [ ] **CHAT-05**: Coach can send a broadcast message to all assigned students; students see it as a distinct system-style card with megaphone icon
- [ ] **CHAT-06**: Unread message count appears as a sidebar badge for coach and student roles
- [ ] **CHAT-07**: Opening a conversation marks its messages as read (unread indicator clears)
- [ ] **CHAT-08**: Scrolling up in a conversation loads older messages via cursor-based pagination
- [ ] **CHAT-09**: Chat auto-scrolls to newest message on send and on new incoming messages
- [ ] **CHAT-10**: Mobile layout: conversation list is default view; tapping a conversation navigates to thread with back button
- [ ] **CHAT-11**: Student_DIY does NOT have chat navigation or access to /student/chat
- [ ] **CHAT-12**: Chat composer enforces 2000 character limit with visible counter
- [ ] **CHAT-13**: Empty state displays when no conversations exist yet

### Resources Tab

- [ ] **RES-01**: Owner, coach, and student see "Resources" in their sidebar navigation
- [ ] **RES-02**: Student_DIY does NOT see Resources in sidebar
- [ ] **RES-03**: Resources page has three tabs: Links, Community (Discord), Glossary
- [ ] **RES-04**: Owner and coach can add resource links (URL + title + optional comment) and delete them
- [ ] **RES-05**: Students can view resource links in read-only mode; links open in a new tab
- [ ] **RES-06**: Community tab shows Discord WidgetBot iframe embed with the configured server/channel
- [ ] **RES-07**: Owner and coach can add, edit, and delete glossary terms (term + definition)
- [ ] **RES-08**: All eligible roles can search/filter glossary terms by name
- [ ] **RES-09**: Glossary terms have case-insensitive unique constraint on term name

### Invite Enhancement

- [ ] **INVITE-01**: Magic link creation accepts an optional max_uses field, defaulting to 10
- [ ] **INVITE-02**: UI shows "X/Y used" on existing magic link cards
- [ ] **INVITE-03**: Registration via magic link is rejected when use_count >= max_uses

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Chat Enhancements

- **CHAT-V2-01**: User can edit or delete sent messages
- **CHAT-V2-02**: User can send images/files in chat (Supabase Storage)
- **CHAT-V2-03**: Threaded replies within conversations
- **CHAT-V2-04**: Supabase Realtime migration (when connection limits allow)

### Notifications

- **NOTF-01**: User receives in-app notifications for key events
- **NOTF-02**: User receives email notifications (Resend integration)

### Advanced Resources

- **RES-V2-01**: Per-student resource visibility (tier/segment system)
- **RES-V2-02**: Resource categories and tagging

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Message editing/deletion | Audit trail concern — defer to v2 |
| File/image uploads in chat | Supabase Storage complexity — defer to v2 |
| Supabase Realtime for chat | 500 concurrent connection limit on Pro plan; polling adequate (D-07) |
| Threaded replies | Flat chat is correct v1 model |
| Email notifications | Resend integration explicitly deferred |
| Per-student resource visibility | Requires tier/segment system not yet built |
| Settings pages | No name/niche editing in v1 |
| Tier system / gamification | V2+ feature |
| Leaderboard and rankings | V2+ feature |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 30 | Complete |
| SCHEMA-02 | Phase 30 | Complete |
| SCHEMA-03 | Phase 30 | Complete |
| SCHEMA-04 | Phase 30 | Complete |
| ROLE-01 | Phase 31 | Complete |
| ROLE-02 | Phase 31 | Complete |
| ROLE-03 | Phase 31 | Complete |
| ROLE-04 | Phase 31 | Complete |
| ROLE-05 | Phase 31 | Complete |
| ROLE-06 | Phase 31 | Complete |
| ROLE-07 | Phase 31 | Complete |
| SKIP-01 | Phase 32 | Pending |
| SKIP-02 | Phase 32 | Pending |
| SKIP-03 | Phase 32 | Pending |
| SKIP-04 | Phase 32 | Complete |
| SKIP-05 | Phase 32 | Pending |
| ASSIGN-01 | Phase 33 | Complete |
| ASSIGN-02 | Phase 33 | Complete |
| ASSIGN-03 | Phase 33 | Complete |
| ASSIGN-04 | Phase 33 | Complete |
| ASSIGN-05 | Phase 33 | Complete |
| ASSIGN-06 | Phase 33 | Complete |
| COMMENT-01 | Phase 34 | Complete |
| COMMENT-02 | Phase 34 | Complete |
| COMMENT-03 | Phase 34 | Pending |
| COMMENT-04 | Phase 34 | Complete |
| COMMENT-05 | Phase 34 | Complete |
| CHAT-01 | Phase 35 | Pending |
| CHAT-02 | Phase 35 | Pending |
| CHAT-03 | Phase 35 | Pending |
| CHAT-04 | Phase 35 | Pending |
| CHAT-05 | Phase 35 | Pending |
| CHAT-06 | Phase 35 | Pending |
| CHAT-07 | Phase 35 | Pending |
| CHAT-08 | Phase 35 | Pending |
| CHAT-09 | Phase 35 | Pending |
| CHAT-10 | Phase 35 | Pending |
| CHAT-11 | Phase 35 | Pending |
| CHAT-12 | Phase 35 | Pending |
| CHAT-13 | Phase 35 | Pending |
| RES-01 | Phase 36 | Pending |
| RES-02 | Phase 36 | Pending |
| RES-03 | Phase 36 | Pending |
| RES-04 | Phase 36 | Pending |
| RES-05 | Phase 36 | Pending |
| RES-06 | Phase 36 | Pending |
| RES-07 | Phase 36 | Pending |
| RES-08 | Phase 36 | Pending |
| RES-09 | Phase 36 | Pending |
| INVITE-01 | Phase 37 | Pending |
| INVITE-02 | Phase 37 | Pending |
| INVITE-03 | Phase 37 | Pending |

**Coverage:**
- v1.4 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after roadmap creation (Phases 30-37)*
