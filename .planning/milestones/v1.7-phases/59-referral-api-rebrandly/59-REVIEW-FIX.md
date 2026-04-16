---
phase: 59-referral-api-rebrandly
fixed_at: 2026-04-16T00:00:00Z
review_path: .planning/phases/59-referral-api-rebrandly/59-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 4
skipped: 3
status: partial
---

# Phase 59: Code Review Fix Report

**Fixed at:** 2026-04-16
**Source review:** `.planning/phases/59-referral-api-rebrandly/59-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (warnings + info): 7
- Fixed: 4 (both warnings + 2 straightforward info)
- Skipped (intentional design decisions per PLAN prior_decisions): 3
- Status: partial — all actionable findings addressed; remaining items are documented design choices, not defects

**Verification after all fixes:**
- `npx tsc --noEmit` exits 0 (empty stdout)
- `node -c scripts/phase-59-smoke-runner.cjs` exits 0
- Production route contract (`{ shortUrl, referralCode }`, status codes, idempotency semantics) unchanged — fixes are either in the .cjs smoke runner (out of the route's runtime path) or a single log-message augmentation in the route's genuinely-unreachable error branch.

## Fixed Issues

### WR-01: Smoke runner `.env.local` parser strips trailing quotes too greedily

**Files modified:** `scripts/phase-59-smoke-runner.cjs`
**Commit:** `30d0272`
**Applied fix:** Replaced the greedy `.replace(/^['"]|['"]$/g, "")` with an explicit matched-pair check. Now strips only when the value begins AND ends with the same quote character (`"` or `'`) AND is at least 2 chars long — values like `foo"bar` (internal quote, no surrounding pair) are preserved intact. Added an inline comment documenting the rationale.

### WR-02: SMOKE 6 wipes a real student's `referral_short_url` without restore-on-failure

**Files modified:** `scripts/phase-59-smoke-runner.cjs`
**Commit:** `fd281f5`
**Applied fix:** Wrapped the reset-and-double-POST block in `try { ... } finally { ... }`. Before the reset, snapshot `studentRow.referral_short_url` into `originalShortUrl`. In the finally block, if the snapshot was non-null, restore it via an admin update. If the snapshot was already NULL (first run for that student), leave the post-test value in place — it is the legitimate fresh-create result. Logs a `[SMOKE 6]` prefixed console.error on restore failure (never swallowed — Hard Rule 5). Also documents in the block comment that this is the fix for WR-02 and explains the "at most one Rebrandly call per user for life" invariant it protects.

### IN-02: Dead branch — post-CAS re-read "Lost CAS but no winner found" had no user context in log

**Files modified:** `src/app/api/referral-link/route.ts`
**Commit:** `7badbeb`
**Applied fix:** Augmented the existing `console.error` call in the genuinely-unreachable lost-CAS-no-winner branch to pass `profile.id` as a second argument. The failure mode remains fully handled with a generic user-facing 500 + error body; the only change is that the log now carries enough context for on-call to locate the affected user row immediately if this branch ever fires (indicating a deeper data-integrity issue — row deleted mid-request). No response-contract change.

### IN-05: Smoke runner mixes `process.env` and `.env` lookups inconsistently

**Files modified:** `scripts/phase-59-smoke-runner.cjs`
**Commit:** `23e8b20`
**Applied fix:** Flipped the precedence order on `BASE_URL`, `TEST_STUDENT_COOKIE`, `TEST_STUDENT_EMAIL`, `REBRANDLY_API_KEY` so `env.X || process.env.X` is used uniformly across the file, matching the existing precedence of `url`/`key` at lines 52–53. `.env.local` now wins everywhere — conventional for dev-only tooling. Added an inline comment explaining the chosen precedence.

## Skipped Issues

### IN-01: `crypto.randomUUID()` collision — no retry on 23505

**File:** `src/app/api/referral-link/route.ts:71-89`
**Reason:** Intentional design decision per **PLAN prior_decisions Q3** — "Do NOT retry on 23505. Surface 500 with clear console.error. Collision probability is <0.1% for v1 user base; retry complexity is not worth it." The REVIEW.md finding itself explicitly flags this as intentional ("No action required if the team is comfortable with the documented decision"). Leaving untouched per the fix-scope directive.
**Original issue:** 23505 unique-violation on a generated code is surfaced as 500 with no retry path; user is blocked until manual intervention. Collision probability for <10k users is negligible (~0 in 4.3B codespace).

### IN-03: Body parse `try { body = await request.json() } catch { body = {} }` without console.error

**File:** `src/app/api/referral-link/route.ts:50-54`
**Reason:** Intentional design decision per **Pitfall 8** — "Empty-body POST is valid". The REVIEW.md finding itself confirms: "the swallow is by design... No action required." The existing comment at line 8 documents the rationale. Leaving untouched per the fix-scope directive.
**Original issue:** The catch is silently swallowed, differing from Hard Rule 5's spirit (every catch should console.error). However this is the ONE catch in the file where the swallow is load-bearing — a malformed client body should still be coerced to `{}` so the empty-body Phase 60 call continues to work.

### IN-04: Rebrandly title leaks user's display name to third-party API

**File:** `src/app/api/referral-link/route.ts:99`
**Reason:** Not a trivial one-line fix — requires a team/privacy-policy decision on whether `profile.name` is PII that should be withheld from Rebrandly, or legitimate metadata useful in their dashboard. The REVIEW.md finding itself notes: "If the privacy policy permits, leave as-is." Deferring to a team decision outside the scope of this fix pass.
**Original issue:** `title: \`IMA Referral - ${profile.name ?? referralCode}\`` sends the student's display name to Rebrandly as link metadata. Not a security flaw, but a data-flow worth a privacy-policy review.

---

_Fixed: 2026-04-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
