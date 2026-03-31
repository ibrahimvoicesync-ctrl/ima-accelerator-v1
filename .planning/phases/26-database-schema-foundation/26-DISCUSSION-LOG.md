# Phase 26: Database Schema Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 26-database-schema-foundation
**Areas discussed:** Migration organization, UTC date safety, Append-only enforcement, plan_json constraints

---

## Migration Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Single file | One migration for both tables, like Phase 13/19 pattern | |
| Separate files | One migration per table | |

**User's choice:** Single file (answered inline — "Migration: single file, wie bei vorherigen Phasen")
**Notes:** User confirmed without needing discussion. Consistent with established Phase 13/19 pattern.

---

## UTC Date Safety

| Option | Description | Selected |
|--------|-------------|----------|
| DB CHECK constraint | Add CHECK constraint to enforce UTC date correctness at DB level | |
| Application-level only | Use getTodayUTC() consistently, no DB constraint | ✓ |

**User's choice:** Application-level only
**Notes:** User stated: "UTC dates should be enforced at application level only, not via DB constraint. The app already has getToday() and getTodayUTC() utils — use those consistently when creating and querying plans. No CHECK constraint needed."

---

## Append-Only Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| RLS only | No UPDATE/DELETE policies, trust admin code | ✓ |
| RLS + trigger | Also add trigger to block service_role deletes | |

**User's choice:** RLS only (answered inline — "trust admin code, RLS reicht")
**Notes:** User confirmed RLS-only enforcement is sufficient.

---

## plan_json Constraints

| Option | Description | Selected |
|--------|-------------|----------|
| DB CHECK | Add CHECK constraint on JSONB structure (e.g., require version key) | |
| App-level Zod only | All validation via Zod safeParse at application layer | ✓ |

**User's choice:** App-level Zod only (answered inline — "Zod at app level, keine DB constraints auf JSONB")
**Notes:** Aligns with v1.3 research decision: "always Zod safeParse at read, never TypeScript cast."

---

## Claude's Discretion

- Index strategy details beyond required (student_id, date) composite
- Column types for roadmap_undo_log (text vs enum for actor_role)
- RLS policy naming conventions
- Foreign key CASCADE behavior

## Deferred Ideas

None — discussion stayed within phase scope.
