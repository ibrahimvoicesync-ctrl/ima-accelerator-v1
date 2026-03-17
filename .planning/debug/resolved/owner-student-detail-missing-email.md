---
status: resolved
trigger: "owner student detail page at /owner/students/[studentId] does NOT show email in header"
created: 2026-03-17T00:00:00Z
updated: 2026-03-17T18:00:00Z
---

## Current Focus

hypothesis: Email is passed as a prop but never rendered in the JSX template
test: Read the OwnerStudentDetailClient render output and check if student.email appears anywhere in JSX
expecting: student.email is not referenced in JSX despite being available in the student prop
next_action: Document root cause - confirmed after reading code

## Symptoms

expected: Student header shows name, email, and avatar
actual: Header shows name, avatar, join date, and status badges but no email
errors: none - no runtime error, just missing UI element
reproduction: Navigate to /owner/students/[studentId] as owner
started: Since implementation

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-17T00:00:00Z
  checked: page.tsx server component - what data is fetched and passed
  found: Email IS fetched from DB (line 23: select includes "email") and IS passed as a prop (line 108: email: student.email)
  implication: Data fetching and prop passing are correct - bug is in the render layer

- timestamp: 2026-03-17T00:00:00Z
  checked: OwnerStudentDetailClient.tsx - interface and JSX rendering
  found: Interface correctly declares email: string (line 16). But in the JSX (lines 86-112), the "Name and join date" section only renders student.name (line 94) and joinDate (lines 95-97). student.email is NEVER referenced in the JSX template.
  implication: ROOT CAUSE CONFIRMED - email prop exists but is not rendered

- timestamp: 2026-03-17T00:00:00Z
  checked: Coach version StudentHeader.tsx for comparison
  found: The coach version has THE SAME BUG. StudentHeader.tsx accepts email in its interface (line 9) but never renders it in the JSX (lines 42-47 show only name and join date, no email).
  implication: Both owner and coach student detail headers share the same omission - email is typed in the interface and passed as data but never actually displayed in either component

## Resolution

root_cause: In OwnerStudentDetailClient.tsx, the student header JSX section (lines 93-97) renders student.name and the formatted joinDate, but student.email is never placed into the JSX. The email is correctly fetched from the database, correctly passed as a prop, and correctly typed in the interface - it is purely a rendering omission. The coach version (StudentHeader.tsx) has the identical omission.
fix:
verification:
files_changed: []
