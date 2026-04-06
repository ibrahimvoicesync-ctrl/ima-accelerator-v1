---
phase: 35
slug: chat-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None configured (lint + type check + build) |
| **Config file** | none |
| **Quick run command** | `npm run lint && npx tsc --noEmit` |
| **Full suite command** | `npm run lint && npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npx tsc --noEmit`
- **After every plan wave:** Run `npm run lint && npx tsc --noEmit && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 1 | CHAT-01 | manual-UAT | — | — | ⬜ pending |
| 35-01-02 | 01 | 1 | CHAT-02 | manual-UAT + lint | `npm run lint && npx tsc --noEmit` | — | ⬜ pending |
| 35-01-03 | 01 | 1 | CHAT-03 | manual-UAT | — | — | ⬜ pending |
| 35-01-04 | 01 | 1 | CHAT-04 | manual-UAT | — | — | ⬜ pending |
| 35-01-05 | 01 | 1 | CHAT-05 | manual-UAT + lint | `npm run lint && npx tsc --noEmit` | — | ⬜ pending |
| 35-01-06 | 01 | 1 | CHAT-06 | manual-UAT | — | — | ⬜ pending |
| 35-01-07 | 01 | 1 | CHAT-07 | manual-UAT | — | — | ⬜ pending |
| 35-01-08 | 01 | 1 | CHAT-08 | manual-UAT | — | — | ⬜ pending |
| 35-01-09 | 01 | 1 | CHAT-09 | manual-UAT | — | — | ⬜ pending |
| 35-01-10 | 01 | 1 | CHAT-10 | manual-UAT | — | — | ⬜ pending |
| 35-01-11 | 01 | 1 | CHAT-11 | lint + proxy | `npx tsc --noEmit` | — | ⬜ pending |
| 35-01-12 | 01 | 1 | CHAT-12 | manual-UAT + lint | `npm run lint && npx tsc --noEmit` | — | ⬜ pending |
| 35-01-13 | 01 | 1 | CHAT-13 | manual-UAT | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test framework to install. Validation is lint + type check + build + manual UAT, consistent with all prior phases.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Conversation list renders with previews, timestamps, unread dot | CHAT-01 | UI rendering state | Open /coach/chat, verify list items show last message preview, relative time, unread dot |
| Messages appear within 5s via polling | CHAT-03, CHAT-04 | Timing-dependent | Send message as coach, switch to student, verify arrival within 5s and vice versa |
| Broadcast card renders with megaphone icon | CHAT-05 | UI rendering | Send broadcast as coach, open student chat, verify full-width card with megaphone icon |
| Sidebar badge shows unread count | CHAT-06 | RPC + layout integration | Send unread message, verify badge count in sidebar |
| Opening conversation clears unread | CHAT-07 | API integration | Open conversation with unread messages, verify badge clears |
| Scroll up loads older messages, no jump | CHAT-08 | Scroll behavior | Scroll to top of long conversation, verify older messages load without losing position |
| Auto-scroll on send/new message | CHAT-09 | Scroll behavior | Send message, verify view scrolls to bottom |
| Mobile list → thread → back works | CHAT-10 | State machine | Resize to mobile, tap conversation, tap back, verify returns to list |
| Student_DIY has no chat | CHAT-11 | Config + proxy | Log in as student_diy, verify no chat nav item and /student/chat redirects |
| Composer enforces 2000 char limit | CHAT-12 | UI constraint | Type 2000+ chars, verify counter shows remaining, send disabled at 0 |
| Empty state renders | CHAT-13 | UI state | Open chat as coach with no messages, verify empty state displays |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
