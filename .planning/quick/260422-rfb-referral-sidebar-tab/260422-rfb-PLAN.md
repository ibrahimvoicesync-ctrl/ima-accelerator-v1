# Quick Task 260422-rfb: Referral as a sidebar tab (student + student_diy)

Move the partner-program referral surface off the student/student_diy
dashboards and into a dedicated sidebar route. Both `ReferralNudge` (top of
dashboard) and `ReferralCard` (bottom) are removed from the dashboard pages;
`ReferralCard` is rendered as the body of the new page; `ReferralNudge` is
deleted (no remaining consumers).

The new nav item is the **last** entry in `NAVIGATION.student` and
`NAVIGATION.student_diy`, so it sits at the bottom of the scrollable nav list,
just above the user/sign-out section. Owner and coach sidebars are unchanged.

## Confirmed scope

- New route: `/student/referral` and `/student_diy/referral`
- New pages render the existing `<ReferralCard />` inside the standard
  editorial-restrained masthead (`Dashboard`-style label + h1 + sub) — same
  shell as `/student/deals`.
- Sidebar uses the existing `Gift` Lucide icon (already used inside
  ReferralCard), registered in the Sidebar `ICON_MAP`.
- Proxy unchanged — `/student/*` and `/student_diy/*` prefix matchers in
  `src/proxy.ts` already cover the new sub-routes.

## Out of scope

- `ReferralCard.tsx` body — render unchanged. The `id="referral"` /
  `tabIndex={-1}` / `scroll-mt-6` attributes survive (harmless on a dedicated
  page; no in-page scroll target uses them anymore).
- `/api/referral-link` route — unchanged.
- Owner / coach sidebars — referral remains a student-only program.
- Dashboard layouts otherwise — only the two referral blocks come out.

## Task 1: Config — add route + nav entry, register icon

**Files:**
- `src/lib/config.ts`
- `src/components/layout/Sidebar.tsx`

**Action:**
1. In `ROUTES.student`, add `referral: "/student/referral"`.
2. In `ROUTES.student_diy`, add `referral: "/student_diy/referral"`.
3. In `NAVIGATION.student`, append (after `Resources`):
   `{ label: "Referral", href: ROUTES.student.referral, icon: "Gift" }`.
4. In `NAVIGATION.student_diy`, append (after `Resources`):
   `{ label: "Referral", href: ROUTES.student_diy.referral, icon: "Gift" }`.
5. In `Sidebar.tsx`, import `Gift` from `lucide-react` and add to `ICON_MAP`.

**Verify:** `npx tsc --noEmit`.

## Task 2: New referral pages

**Files (NEW):**
- `src/app/(dashboard)/student/referral/page.tsx`
- `src/app/(dashboard)/student_diy/referral/page.tsx`

**Action:** Mirror the `/student/deals` shell (JetBrains_Mono + masthead + a
single body slot). Body = `<ReferralCard />`. Each page calls `requireRole`
with its own role.

**Verify:** Navigate to `/student/referral` and `/student_diy/referral`
under the appropriate role; both render the card. `npx tsc --noEmit`.

## Task 3: Strip referral from dashboards + delete nudge

**Files:**
- `src/app/(dashboard)/student/page.tsx`
- `src/app/(dashboard)/student_diy/page.tsx`
- `src/components/student/ReferralNudge.tsx` (DELETE — no remaining consumers)

**Action:**
1. Remove the `{/* Referral nudge (shared) */}` block (top, ~lines 224–230 /
   140–146) and the `{/* Referral (shared) */}` block (bottom, ~lines 507–513
   / 325–331) from each page.
2. Drop the `ReferralCard` and `ReferralNudge` imports from both pages.
3. Delete `src/components/student/ReferralNudge.tsx`.

**Verify:** `npx tsc --noEmit` clean (no orphan imports). `npm run lint` clean.
`grep -rn "ReferralNudge"` returns only `.planning/` history.

## Done when

- `Referral` appears as the last nav item in the sidebar for `student` and
  `student_diy` only.
- Both dashboards render with no referral nudge and no referral card.
- `/student/referral` and `/student_diy/referral` render the existing
  ReferralCard inside the standard masthead shell.
- `npx tsc --noEmit` and `npm run lint` both pass.
- `ReferralNudge.tsx` is deleted.
