---
phase: 4
slug: student-roadmap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — no jest/vitest config in project |
| **Config file** | None — Wave 0 not applicable (manual-only phase) |
| **Quick run command** | `npm run build && npx tsc --noEmit` |
| **Full suite command** | `npm run build && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build && npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npx tsc --noEmit && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green + manual UAT
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ROAD-02 | build | `npm run build && npx tsc --noEmit` | N/A | ⬜ pending |
| 04-02-01 | 02 | 1 | ROAD-01, ROAD-03 | build | `npm run build && npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. All ROAD requirements are manual-only (UI state rendering + Supabase mutations + auth session). Build verification commands are sufficient for automated checks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Student sees 10-step roadmap with locked/active/completed states | ROAD-01 | Visual state rendering requires browser + Supabase | 1. Log in as student 2. Navigate to /student/roadmap 3. Verify Step 1 completed (green), Step 2 active (blue), Steps 3-10 locked (gray) |
| Student marks active step complete, next unlocks | ROAD-02 | Requires Supabase DB mutation + browser interaction | 1. Click "Mark Complete" on active step 2. Confirm modal 3. Verify step moves to completed, next step becomes active |
| Step 1 auto-completes on first visit | ROAD-03 | Requires new student account + first page visit | 1. Register new student 2. Navigate to /student/roadmap 3. Verify Step 1 already completed, Step 2 is active |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
