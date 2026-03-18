---
phase: 02
slug: authentication-access
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — manual testing only |
| **Config file** | None — no test framework in project |
| **Quick run command** | `npx tsc --noEmit && npm run lint` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must be green + manual auth flow walkthrough
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AUTH-01 | manual-only | N/A — requires live Google OAuth | Manual | ⬜ pending |
| 02-01-02 | 01 | 1 | AUTH-02 | manual-only | N/A — requires live invite + OAuth | Manual | ⬜ pending |
| 02-01-03 | 01 | 1 | AUTH-03 | manual-only | N/A — requires live magic link + OAuth | Manual | ⬜ pending |
| 02-01-04 | 01 | 1 | AUTH-04 | manual-only | N/A — requires session + role | Manual | ⬜ pending |
| 02-02-01 | 02 | 1 | AUTH-01 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | AUTH-02 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | AUTH-05 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | AUTH-04 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | AUTH-06 | manual-only | N/A — requires browser session | Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework needed — auth flows verified via `npm run build` + manual testing
- [ ] Type checking via `npx tsc --noEmit` catches compile-time errors
- [ ] ESLint via `npm run lint` catches code quality issues

*Existing infrastructure covers build-time verification. Auth flows require manual E2E testing (Google OAuth, browser sessions).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth redirect + callback | AUTH-01 | Requires live Google OAuth provider | 1. Visit /login 2. Click "Sign in with Google" 3. Approve OAuth 4. Verify redirect to role dashboard |
| Invite code registration | AUTH-02 | Requires valid invite in DB + live OAuth | 1. Create invite via Supabase Dashboard 2. Visit /register/[code] 3. Verify role shown 4. Click Google sign-in 5. Verify user created + redirected |
| Magic link registration | AUTH-03 | Requires valid magic link in DB + live OAuth | 1. Create magic_link via Supabase Dashboard 2. Visit /register?magic=[code] 3. Verify role shown 4. Click Google sign-in 5. Verify user created |
| Role-based routing | AUTH-04 | Requires authenticated session with role | 1. Log in as student 2. Verify /student 3. Log in as coach 4. Verify /coach 5. Log in as owner 6. Verify /owner |
| No-access redirect | AUTH-05 | Requires unauthenticated + no-profile state | 1. Clear cookies 2. Navigate to /owner 3. Verify redirect to /login or /no-access |
| Session persistence | AUTH-06 | Requires browser session state | 1. Log in 2. Refresh browser 3. Verify still on dashboard 4. Close/reopen tab 5. Verify still logged in |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
