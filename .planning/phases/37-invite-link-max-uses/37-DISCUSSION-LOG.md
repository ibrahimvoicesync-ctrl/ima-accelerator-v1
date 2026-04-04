# Phase 37: Invite Link max_uses - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 37-invite-link-max-uses
**Areas discussed:** Max uses form input, Unlimited option, Usage display format

---

## Max uses form input

| Option | Description | Selected |
|--------|-------------|----------|
| Number input | Simple number input with default 10 pre-filled, range 1-10,000 | ✓ |
| Dropdown presets | Dropdown with preset values (5, 10, 25, 50) | |
| No override | Always default 10, no user input | |

**User's choice:** Simple number input with default 10, labeled "Max uses", next to Generate button
**Notes:** Low friction — default pre-filled so most users don't need to change it

---

## Unlimited option

| Option | Description | Selected |
|--------|-------------|----------|
| No unlimited | Every new link always capped (default 10), existing null grandfathered | ✓ |
| Allow unlimited | Form has an "Unlimited" checkbox or special value | |

**User's choice:** No unlimited for new links
**Notes:** Prevents accidental open-ended invite links. Existing null-max_uses links grandfathered as ∞.

---

## Usage display format

| Option | Description | Selected |
|--------|-------------|----------|
| Text only | "X / Y used" below card, ima-danger + "Exhausted" badge when full, ∞ for unlimited | ✓ |
| Progress bar | Visual progress bar with fraction text | |
| Badge only | Compact badge showing usage count | |

**User's choice:** Text format "X / Y used", exhausted = ima-danger + badge, unlimited = "X / ∞ used"
**Notes:** No progress bar. Keep it simple text.

---

## Claude's Discretion

- Migration strategy (ALTER DEFAULT vs application-only)
- Zod schema shape for max_uses on POST
- Exact input sizing/placement in form layout

## Deferred Ideas

None — discussion stayed within phase scope
