# Quick Task 260404-hgo: Fix student_diy role label display

## Task 1: Add ROLE_LABELS to config.ts and use across UI

**Files:** `src/lib/config.ts`, `src/components/layout/Sidebar.tsx`, `src/components/owner/OwnerInvitesClient.tsx`

**Action:**
1. Add `ROLE_LABELS` map to config.ts mapping each Role to a display-friendly string
2. Update Sidebar.tsx to import and use `ROLE_LABELS[role]` instead of raw `{role}` with CSS `capitalize`
3. Update OwnerInvitesClient.tsx invite history and invite links to use `ROLE_LABELS` instead of `capitalize` on raw role string

**Verify:** `npx tsc --noEmit` passes, role displays as "Student DIY" instead of "Student_diy"

**Done:** All 3 files updated, type check passes
