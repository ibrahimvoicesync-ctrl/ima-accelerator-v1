# Quick Task 260404-hgo: Fix student_diy role label display — Summary

**Completed:** 2026-04-04

## Changes

### 1. Added `ROLE_LABELS` map to `src/lib/config.ts`
- New `ROLE_LABELS: Record<Role, string>` mapping all 4 roles to display-friendly labels
- `student_diy` → "Student DIY", `owner` → "Owner", `coach` → "Coach", `student` → "Student"

### 2. Updated `src/components/layout/Sidebar.tsx`
- Imported `ROLE_LABELS` from config
- Replaced `<p className="capitalize">{role}</p>` with `<p>{ROLE_LABELS[role]}</p>`
- Removed unnecessary `capitalize` CSS class

### 3. Updated `src/components/owner/OwnerInvitesClient.tsx`
- Imported `ROLE_LABELS` and `Role` type from config
- Invite history: replaced `<span className="capitalize">{invite.role}</span>` with `{ROLE_LABELS[invite.role as Role] ?? invite.role}`
- Invite links: replaced `<span className="capitalize">{link.role}</span>` with `{ROLE_LABELS[link.role as Role] ?? link.role}`
- Fallback to raw role string for safety if an unknown role appears

## Verification
- `npx tsc --noEmit` passes with zero errors
- All 3 display locations now use the centralized `ROLE_LABELS` map
