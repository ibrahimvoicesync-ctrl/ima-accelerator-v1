---
phase: 59
slug: referral-api-rebrandly
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none installed — Wave 0 authors CommonJS smoke runner (pattern from Phase 57) |
| **Config file** | scripts/phase-59-smoke-runner.cjs (authored in Wave 0) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run lint && npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~25 seconds |

Smoke-runner is the Phase 57/58 idiom: a standalone Node CommonJS script invoked via `node scripts/phase-59-smoke-runner.cjs` that hits the deployed endpoint (or local dev server) to verify all 6 success criteria. Eslint ignores `scripts/**/*.cjs` globally (Phase 58 commit 876319d). Planner will include this as a Wave 0 task.

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` (1.8s — catches type drift)
- **After every plan wave:** Full combined gate (~25s)
- **Before verification:** Full suite green + manual smoke run of endpoint via admin client in dev OR via authed curl against local dev server
- **Max feedback latency:** ~25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 59-01-01 | 01 | 1 | API-01 | T-59-01 | Unauth POST → 401 without touching DB/Rebrandly | smoke | `node scripts/phase-59-smoke-runner.cjs --case unauth` | ❌ W0 | ⬜ pending |
| 59-01-02 | 01 | 1 | API-02 | T-59-02 | owner/coach POST → 403 without touching DB/Rebrandly | smoke | `node scripts/phase-59-smoke-runner.cjs --case wrong-role` | ❌ W0 | ⬜ pending |
| 59-01-03 | 01 | 1 | API-03 | — | Backfilled user POST → 200 with `{shortUrl, referralCode}` | smoke | `node scripts/phase-59-smoke-runner.cjs --case happy-path` | ❌ W0 | ⬜ pending |
| 59-01-04 | 01 | 1 | API-04 | T-59-04 | Second POST → same shortUrl, zero new Rebrandly calls | smoke | `node scripts/phase-59-smoke-runner.cjs --case idempotent` | ❌ W0 | ⬜ pending |
| 59-01-05 | 01 | 1 | API-05 | — | NULL-code user → fresh 8-char code persisted pre-Rebrandly | smoke | `node scripts/phase-59-smoke-runner.cjs --case missing-code` | ❌ W0 | ⬜ pending |
| 59-01-06 | 01 | 1 | API-06 | T-59-06 | Missing REBRANDLY_API_KEY → 500 + dashboard still loads | smoke | `node scripts/phase-59-smoke-runner.cjs --case no-key` | ❌ W0 | ⬜ pending |
| 59-01-07 | 01 | 1 | API-07 | T-59-07 | Rebrandly non-OK/timeout → 502, referral_short_url stays NULL | smoke | `node scripts/phase-59-smoke-runner.cjs --case rebrandly-fail` | ❌ W0 | ⬜ pending |
| 59-01-08 | 01 | 1 | API-08 | — | response.ok checked before parse; Zod imported from "zod" | static | `grep -c "response.ok" src/app/api/referral-link/route.ts` ≥ 1 | ❌ W0 | ⬜ pending |
| 59-01-09 | 01 | 1 | CFG-02 | — | Combined build gate exits 0 | gate | `npm run lint && npx tsc --noEmit && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/phase-59-smoke-runner.cjs` — 9 case handlers covering API-01..08 + CFG-02 via deployed-endpoint integration (uses Supabase admin client to seed + reset state between cases; uses `fetch()` against localhost dev server for the POST)
- [ ] No framework install — smoke runner is standalone CommonJS (pattern from Phase 57)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rebrandly link actually resolves when visited | — | Requires live Rebrandly account + click in browser | After first successful POST, paste `shortUrl` into browser; confirm redirect to destination URL with `referral_code` param preserved |
| Rebrandly dashboard shows exactly one link per user, not duplicates | API-04 | Requires logging into Rebrandly web UI | After running smoke suite, count links in Rebrandly dashboard for the test project; expected = 1 per user who POSTed |

---

## Validation Sign-Off

- [ ] All 9 tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers `scripts/phase-59-smoke-runner.cjs` creation
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter once smoke runner lands

**Approval:** pending
