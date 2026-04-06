---
phase: 38
slug: database-foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-06
---

# Phase 38 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Supabase client → RLS | Untrusted queries from any authenticated user filtered by RLS policies | Deal rows (revenue, profit, student_id) |
| App API → Postgres | API routes use admin client (bypasses RLS); app-layer auth+role checks are primary defense; RLS is defense-in-depth | Deal CRUD operations |
| Concurrent inserts | Two simultaneous insert requests for the same student could race on deal_number | deal_number sequence values |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-38-01 | Information Disclosure | deals RLS | mitigate | Student policies filter by `student_id = (select get_user_id())`; coach policies filter by `student_id IN (SELECT id FROM users WHERE coach_id = (select get_user_id()))` | closed |
| T-38-02 | Tampering | deal_number | mitigate | BEFORE INSERT trigger with `FOR UPDATE` row lock prevents race-condition duplicate numbers; `UNIQUE (student_id, deal_number)` constraint is safety net | closed |
| T-38-03 | Tampering | revenue/profit | mitigate | `CHECK (revenue >= 0)`, `CHECK (profit >= 0)` constraints prevent negative values at DB level; Phase 39 adds Zod validation at API level | closed |
| T-38-04 | Elevation of Privilege | coach INSERT/UPDATE | mitigate | No `coach_insert_deals` or `coach_update_deals` policies exist; coaches cannot create or modify deals | closed |
| T-38-05 | Tampering | deal_number caller override | accept | Trigger unconditionally overwrites `deal_number` via `NEW.deal_number := v_next`; Insert type marks it optional as signal to Phase 39 to strip from payload | closed |
| T-38-06 | Denial of Service | RLS per-row function calls | mitigate | All 8 policies use `(select get_user_role())` / `(select get_user_id())` initplan pattern — function evaluated once per query, not per row | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-38-01 | T-38-05 | Trigger always overwrites deal_number regardless of caller-supplied value; no application path can bypass the BEFORE INSERT trigger. Risk is that a future migration could drop the trigger — mitigated by UNIQUE constraint as safety net. | gsd-secure-phase | 2026-04-06 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-06 | 6 | 6 | 0 | gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-06
