---
status: partial
phase: 20-query-consolidation-caching
source: [20-VERIFICATION.md]
started: 2026-03-30T10:30:00Z
updated: 2026-03-30T10:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. QUERY-01 Round-Trip Count on Warm Cache
expected: Sign in as owner, navigate to /owner dashboard. On second page load (warm cache), only 1 Supabase auth call + 1 get_owner_dashboard_stats RPC visible in Network tab. Badge call absent (served from Next.js cache).
result: [pending]

### 2. Badge Cache Invalidation Timing
expected: Log in as student, submit a daily report, then immediately reload owner dashboard sidebar. Active alerts count should update within seconds (revalidateTag fires immediately, not after 60s TTL).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
