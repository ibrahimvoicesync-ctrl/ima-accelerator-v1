# Phase 32: Skip Tracker - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 32-skip-tracker
**Areas discussed:** Skip day definition, Badge appearance, Owner view placement, Student_DIY inclusion

---

## Skip Day Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Weekdays only (Mon-Fri) | Count only weekdays as potential skip days | |
| All 7 days (Mon-Sun) | Count all days in ISO week as potential skip days | * |
| Today included always | Today always counts if no activity | |
| Today after deadline hour | Today counts as skipped only after DAILY_REPORT.deadlineHour (23/11PM) | * |

**User's choice:** All 7 days Mon-Sun count. Today counts as skipped ONLY if past 11 PM (deadlineHour). Before that hour, today is excluded.
**Notes:** A skip = zero completed work sessions AND no submitted daily report for that date.

---

## Badge Appearance

| Option | Description | Selected |
|--------|-------------|----------|
| Always show (incl. "0 skipped") | Badge visible even with zero skips | |
| Show only when > 0 | Badge appears only when student has skipped days | * |
| Error color (ima-error) | Red badge for urgency | |
| Warning color (ima-warning) | Amber/yellow badge for attention | * |

**User's choice:** Show "X skipped" as ima-warning Badge in top-right of StudentCard, only when X > 0. Zero skips = no badge.
**Notes:** Positioned alongside/replacing existing New/At Risk badge area.

---

## Owner View Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Badge on student rows | Small badge inline with student name | |
| Dedicated column | "Skipped" column in student table | * |

**User's choice:** Add a "Skipped" column to owner's student table. Highlight in ima-warning when > 0.
**Notes:** Same skip count logic as coach view.

---

## Student_DIY Inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Include student_diy | Show skip counts for student_diy (work sessions only) | |
| Exclude student_diy | No skip counts for student_diy users | * |

**User's choice:** Student_DIY excluded. No coach, no reports, no accountability tracking. Skip tracker only for role = 'student'.
**Notes:** None.

---

## Claude's Discretion

- RPC function naming and SQL implementation
- Batch vs per-student RPC calls
- Badge positioning when both At Risk and X skipped apply
- Exact column styling in owner table

## Deferred Ideas

None -- discussion stayed within phase scope
