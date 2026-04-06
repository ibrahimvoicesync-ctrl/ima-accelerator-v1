# Phase 39: API Route Handlers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 39-api-route-handlers
**Areas discussed:** Cache revalidation tags, POST 23505 retry, Validation constants, GET endpoint query design

---

## Cache Revalidation Tags

| Option | Description | Selected |
|--------|-------------|----------|
| deals-{studentId} | Per-student scoped tag for precise revalidation | |
| deals (global) | Single tag invalidates all deal caches | |
| deals + deals-{studentId} | Dual tags for global and per-student invalidation | |

**User's choice:** `deals-{studentId}` — per-student scoping, Claude can decide details
**Notes:** User confirmed via inline text. STATE.md blocker resolved — Phase 42 will use same tag pattern.

---

## POST 23505 Retry Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Inline retry once, no delay | Catch 23505, retry insert immediately, fail on second attempt | |
| Inline retry with delay | Catch 23505, wait 100ms, retry once | |
| Return error to client | Let the client handle retry logic | |

**User's choice:** Inline retry once, no delay needed
**Notes:** Server handles conflict transparently — client never sees the 23505.

---

## Validation Constants Source

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode in Phase 39 | Define limits directly in Zod schemas, Phase 40 refactors to config.ts | |
| Wait for Phase 40 | Build Phase 40 first to have VALIDATION.deals, then Phase 39 imports | |
| Import from config now | Add DEALS to config.ts in Phase 39 (scope creep into Phase 40) | |

**User's choice:** Hardcode now, Phase 40 refactors later — phases run sequentially
**Notes:** Clean separation. Phase 39 hardcodes, Phase 40 extracts to VALIDATION.deals.

---

## GET Endpoint Query Design

| Option | Description | Selected |
|--------|-------------|----------|
| student_id required, page only | Minimal params: student_id + page, sort is always created_at DESC | |
| student_id + date range + sort | Additional filtering and sort flexibility | |
| student_id + search/filter | Full-text search on deal fields | |

**User's choice:** student_id as required param, no extra filters needed
**Notes:** Default sort most-recent-first. Response includes total count for pagination.

---

## Claude's Discretion

- Route file organization (collection vs item split)
- UUID validation approach
- Error message wording
- Exact hardcoded revenue/profit limits for Zod schemas

## Deferred Ideas

None — discussion stayed within phase scope.
