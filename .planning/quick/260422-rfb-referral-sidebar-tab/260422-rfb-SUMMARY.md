---
slug: 260422-rfb-referral-sidebar-tab
date: 2026-04-22
status: complete
---

# Summary 260422-rfb: Referral as a sidebar tab

Moved the partner-program referral surface off the student and student_diy
dashboards into its own sidebar tab. Owner and coach navigation are
untouched.

## Commits

- `6813e43` feat(nav): add Referral sidebar tab for student + student_diy
- `949056a` feat(referral): dedicated /student/referral and /student_diy/referral pages
- `3693959` refactor(dashboard): remove referral nudge + card from student dashboards

## Changes

| Area              | Change                                                                  |
|-------------------|-------------------------------------------------------------------------|
| `src/lib/config.ts` | Added `ROUTES.student.referral` + `ROUTES.student_diy.referral`. Appended `Referral` nav item (Gift icon) as the last entry for both roles. |
| `src/components/layout/Sidebar.tsx` | Imported `Gift` from lucide-react; registered in `ICON_MAP`. |
| `src/app/(dashboard)/student/referral/page.tsx` | NEW. `requireRole("student")` + masthead + `<ReferralCard />`. |
| `src/app/(dashboard)/student_diy/referral/page.tsx` | NEW. `requireRole("student_diy")` + masthead + `<ReferralCard />`. |
| `src/app/(dashboard)/student/page.tsx` | Removed `<ReferralNudge />` block (top) and `<ReferralCard />` block (bottom); dropped both imports. Hero section spacing tightened back to `mt-9`. |
| `src/app/(dashboard)/student_diy/page.tsx` | Same removals as above. |
| `src/components/student/ReferralNudge.tsx` | DELETED. No remaining consumers; the in-page scroll target it pointed to no longer exists. |

## Verification

- `npx tsc --noEmit` — clean
- `npm run lint` — clean for changed files (only 2 pre-existing warnings in unrelated files: `WorkTrackerClient.tsx`, `Modal.tsx`)
- Proxy unchanged — `/student/*` and `/student_diy/*` prefix matchers in
  `src/proxy.ts` already cover the new sub-routes.

## Out of scope

- `ReferralCard.tsx` body — render unchanged. Its `id="referral"` /
  `tabIndex={-1}` / `scroll-mt-6` attributes survive (harmless on a dedicated
  page).
- `/api/referral-link` — unchanged.
- Owner / coach sidebars — referral remains a student-only program.

## Done when (all met)

- ✅ Referral appears as the last nav item in the sidebar for student and
  student_diy only.
- ✅ Both dashboards render with no referral nudge and no referral card.
- ✅ `/student/referral` and `/student_diy/referral` render the existing
  ReferralCard inside the standard masthead shell.
- ✅ `npx tsc --noEmit` and `npm run lint` both pass.
- ✅ `ReferralNudge.tsx` is deleted.
