# Phase 36: Resources Tab - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 36-resources-tab
**Areas discussed:** Link presentation, Add/delete UX, Discord embed sizing, Glossary layout

---

## Link Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Cards | One Card per resource link with title, URL, comment, author, timestamp | |
| Simple list | Compact rows with link title and URL | |
| Table | Tabular layout with columns | |

**User's choice:** Cards -- one card per resource link using existing Card component. Title (bold), URL (truncated, clickable, new tab), comment below if present, posted by name, timestamp. Pinned resources at top with pin icon.
**Notes:** User provided all decisions upfront in a single batch, skipping iterative discussion.

---

## Add/Delete UX

| Option | Description | Selected |
|--------|-------------|----------|
| Modal form | Opens modal with inputs, consistent with existing CRUD patterns | |
| Inline form | Expandable form at top of list | |
| Top-of-page form | Always-visible form above the list | |

**User's choice:** Modal form -- "Add Resource" button top-right opens modal (title, URL, comment). Same pattern for glossary (term + definition). Delete via icon button with confirm dialog.
**Notes:** Consistent with existing app CRUD flows.

---

## Discord Embed Sizing

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 600px | Fixed height, rounded corners, ima-border | |
| Full viewport | Fills remaining viewport height | |
| Expandable | Starts small with expand button | |

**User's choice:** Fixed 600px height with rounded corners and ima-border. Shares space with tab bar, 600px sufficient for channels + messages.
**Notes:** None.

---

## Glossary Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Definition list | Alphabetical, term as bold heading, definition below | |
| Accordion | Expandable sections per term | |
| Card grid | One card per glossary term | |

**User's choice:** Alphabetical definition list. Bold term heading, definition text below. Search input at top for case-insensitive filtering. Group by first letter (A, B, C...) when list grows. No accordion or cards.
**Notes:** Emphasis on scannability without clicking.

---

## Claude's Discretion

- Tab styling (pill buttons vs underline tabs)
- Pin/unpin mechanism for resources
- URL truncation length on link cards
- Empty state copy for each tab
- Loading skeleton layout
- Glossary edit approach (modal vs inline)

## Deferred Ideas

None -- discussion stayed within phase scope
