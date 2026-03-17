---
status: investigating
trigger: "Investigate why the owner coaches list at /owner/coaches has coach cards that are too compact/ugly with truncated name and email."
created: 2026-03-17T00:00:00Z
updated: 2026-03-17T00:00:00Z
---

## Current Focus

hypothesis: The CoachCard uses a single-row horizontal flex layout with truncate CSS on name/email, combined with two right-aligned stat columns stealing width, causing the name+email to be heavily truncated on most screen sizes
test: Analyze the CSS layout structure and identify all contributing factors
expecting: Multiple layout issues working together to produce the compact/ugly appearance
next_action: Document root cause analysis (research only, no changes)

## Symptoms

expected: Each coach card shows initials avatar, full name, email, student count, and avg rating without truncation
actual: Cards are compact and ugly - only the beginning of name + email is visible, rest is truncated
errors: None (visual/layout issue only)
reproduction: Navigate to /owner/coaches
started: Since implementation (phase 08-03)

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-17T00:01:00Z
  checked: CoachCard.tsx layout structure (lines 29-52)
  found: Single-row flex layout (flex items-center gap-3) containing 4 elements side by side - avatar (w-10), name/email div (flex-1 min-w-0), student count (shrink-0), avg rating (shrink-0 ml-2). Name has "truncate" class, email has "truncate" class.
  implication: The flex-1 name/email div competes for width with three shrink-0 siblings, and truncate forces single-line with ellipsis

- timestamp: 2026-03-17T00:02:00Z
  checked: Page grid layout (page.tsx line 107)
  found: Grid uses "grid-cols-1 md:grid-cols-2" - on medium+ screens, cards get only ~50% viewport width
  implication: On md+ screens, each card has roughly half the container width, further squeezing the name/email area

- timestamp: 2026-03-17T00:03:00Z
  checked: CoachCard.tsx text sizing
  found: Name uses text-sm, email uses text-xs - both are small font sizes combined with truncate behavior
  implication: Even though text is small, the horizontal layout leaves little room for it

- timestamp: 2026-03-17T00:04:00Z
  checked: CardContent default padding vs CoachCard override
  found: CardContent default is "p-6 pt-0" but CoachCard overrides with "p-4 flex items-center gap-3". The p-4 is tighter padding. Also the card has no minimum width constraint.
  implication: Tighter padding helps slightly but the fundamental issue is the horizontal layout

## Resolution

root_cause: Multiple compounding layout issues cause the compact/truncated appearance:

1. **Primary: Single-row horizontal flex layout** (CoachCard.tsx line 29) - All 4 elements (avatar + name/email + student count + avg rating) are crammed into one horizontal row. The name/email div gets flex-1 but three shrink-0 siblings (avatar ~40px, student count ~60px, avg rating ~70px with ml-2) consume substantial fixed width.

2. **Explicit truncate CSS** (lines 34, 37) - Both the name `<p>` and email `<p>` have the `truncate` Tailwind class, which applies `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`. This is the DIRECT cause of the text being cut off with ellipsis. The truncate class was likely added as a "safety" measure but it actively harms readability when the flex-1 column is narrow.

3. **Two-column grid on md+ screens** (page.tsx line 107) - `grid-cols-1 md:grid-cols-2` means on medium screens (768px+), each card gets only ~50% of container width (minus gap). Combined with the sidebar taking space, the available card width is significantly reduced.

4. **Four competing horizontal sections** - Avatar (w-10 = 40px) + gap-3 (12px) + name column + gap-3 (12px) + student count + gap-3 (12px) + ml-2 (8px) + rating count. The fixed-width elements plus gaps consume roughly 150-170px, leaving only ~150-200px for the name/email column on a typical md screen with sidebar.

fix: (research only - not applying)
verification: (research only)
files_changed: []
