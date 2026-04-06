# Phase 34: Report Comments - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 34-report-comments
**Areas discussed:** Comment form surfaces, Student feedback display, Edit/update flow, Owner commenting path

---

## Comment Form Surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Both locations | Show in ReportRow expansion AND CalendarTab | ✓ |
| ReportRow only | Only on /coach/reports page | |
| CalendarTab only | Only on student detail CalendarTab | |

**User's choice:** Both locations — same component, same behavior. Owner sees CalendarTab only (their only report access point).
**Notes:** User provided all decisions upfront without interactive discussion.

---

## Student Feedback Display

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct card | Light ima-surface-accent bg, coach avatar, name, timestamp | ✓ |
| Muted section | Subtle inline text below report | |
| Expandable | Hidden behind a "View feedback" toggle | |

**User's choice:** Distinct card with ima-surface-accent background, initials circle avatar, coach name, timestamp, comment text. Visually distinct but not overpowering. Read-only.
**Notes:** None.

---

## Edit/Update Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Seamless replace | Pre-fill textarea, no confirmation | ✓ |
| Confirm overwrite | Modal before replacing existing comment | |
| Version history | Keep old comment visible | |

**User's choice:** Pre-fill textarea with existing comment. Seamless replace on submit — no confirmation modal. Coach sees they're editing because textarea already has text.
**Notes:** None.

---

## Owner Commenting Path

| Option | Description | Selected |
|--------|-------------|----------|
| Identical to coach | Same CalendarTab textarea, same API, same upsert | ✓ |
| Separate owner UI | Different entry point for owner | |

**User's choice:** Identical to coach. Owner comments via CalendarTab, same API endpoint, same upsert behavior.
**Notes:** None.

---

## Claude's Discretion

- Textarea sizing and character counter UX
- Loading/saving state indicators
- Empty state messaging
- Initials circle color derivation for coach avatar

## Deferred Ideas

None — discussion stayed within phase scope.
