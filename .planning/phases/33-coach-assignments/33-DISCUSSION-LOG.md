# Phase 33: Coach Assignments - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 33-coach-assignments
**Areas discussed:** Student visibility scope, student_diy in list, UI parity with owner

---

## Student Visibility Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All students (full visibility) | Coaches see unassigned + own + other coaches' students, same as owner | ✓ |
| Limited (unassigned + own only) | Coaches only see unassigned students and their own assigned students | |

**User's choice:** All students — full visibility same as owner
**Notes:** "You can't reassign another coach's student if you can't see them." D-02 already decided full assignment power.

---

## student_diy in Assignment List

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden entirely | Filter out with WHERE role = 'student' | ✓ |
| Shown as non-assignable | Appear in list but greyed out / disabled | |

**User's choice:** Hidden entirely
**Notes:** "Showing them as disabled is just confusing." D-04 already decided no coach assignment for student_diy.

---

## UI Parity with Owner

| Option | Description | Selected |
|--------|-------------|----------|
| Simplified version | Searchable student list + coach dropdown per student, no capacity cards/stats | ✓ |
| Full mirror | Near-identical copy of owner page with capacity cards, stats counters, filter tabs | |

**User's choice:** Simplified version — same functional power, lighter UI
**Notes:** User also decided to reuse existing /api/assignments endpoint with expanded role check rather than creating a new endpoint.

---

## Claude's Discretion

- Search/filter UX details
- Layout and spacing
- Loading skeleton design
- Empty state messaging

## Deferred Ideas

None
