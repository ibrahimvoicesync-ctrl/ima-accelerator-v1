---
phase: 31-student-diy-role
plan: 01
subsystem: auth
tags: [role, config, proxy, auth-callback, typescript, supabase]

# Dependency graph
requires:
  - phase: 30-database-migration
    provides: types.ts with student_diy in role union (hand-updated for worktree compatibility)
  - phase: 26-database-schema-foundation
    provides: roadmap_progress table used for student_diy seeding
provides:
  - student_diy in ROLES, ROLE_HIERARCHY, ROUTES, ROLE_REDIRECTS, NAVIGATION, INVITE_CONFIG (6 config maps)
  - student_diy routing in proxy.ts DEFAULT_ROUTES and ROLE_ROUTE_ACCESS
  - auth callback seeds roadmap for student_diy in all 3 registration paths (invite, magic link, whitelist)
affects: [31-02, 31-03, auth, proxy, sidebar, invite-forms]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Config-driven role expansion — adding to ROLES/ROLE_HIERARCHY/ROUTES/ROLE_REDIRECTS/NAVIGATION/INVITE_CONFIG covers all runtime behaviors
    - Proxy local maps kept in sync with config.ts manually (intentional — avoids edge runtime module imports)
    - Object.keys(ROLE_REDIRECTS) as validRoles — auto-expands when key is added to ROLE_REDIRECTS

key-files:
  created: []
  modified:
    - src/lib/config.ts
    - src/lib/types.ts
    - src/proxy.ts
    - src/app/api/auth/callback/route.ts

key-decisions:
  - "student_diy is level 1 in ROLE_HIERARCHY — peer to student, not subordinate"
  - "NAVIGATION for student_diy has exactly 3 items (Dashboard, Work Tracker, Roadmap) — no Ask Abu Lahya or Daily Report per D-03"
  - "INVITE_CONFIG is declarative for type completeness — runtime invite validation is Zod enums in Plan 03"
  - "Magic link coach_id assignment (line 257) intentionally excludes student_diy — student_diy has no coach per ROLE-06"
  - "Object.keys(ROLE_REDIRECTS) as validRoles auto-accepts student_diy once ROLE_REDIRECTS includes the key — no manual validRoles array changes needed"

patterns-established:
  - "Pattern: 8-location atomic update — config.ts + proxy.ts must be updated together to prevent redirect loops"
  - "Pattern: All 3 roadmap seeding branches must include student_diy — invite, magic link, and whitelist paths are independent code paths"

requirements-completed: [ROLE-01, ROLE-02, ROLE-03, ROLE-05, ROLE-06]

# Metrics
duration: 15min
completed: 2026-04-03
---

# Phase 31 Plan 01: Config, Proxy, and Auth Callback Foundation Summary

**student_diy role wired across 8 integration points: 6 config maps in config.ts, 2 route maps in proxy.ts, and 3 roadmap seeding branches in auth callback — enabling registration, routing, and sidebar rendering for the new role**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-03T15:05:00Z
- **Completed:** 2026-04-03T15:21:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- student_diy added to all 6 config maps (ROLES, ROLE_HIERARCHY, ROUTES, ROLE_REDIRECTS, NAVIGATION, INVITE_CONFIG) — TypeScript Record<Role, ...> completeness enforced at compile time
- proxy.ts expanded with student_diy in DEFAULT_ROUTES and ROLE_ROUTE_ACCESS — student_diy users redirect to /student_diy and cannot access /owner/*, /coach/*, /student/* paths
- Auth callback seeds roadmap_progress for student_diy in all 3 registration paths (invite, magic link, whitelist) — student_diy registrants get full 15-step roadmap initialized at step 2 active

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand config.ts with student_diy role across all 6 maps** - `eba0249` (feat)
2. **Task 2: Expand proxy.ts with student_diy routing** - `23695ef` (feat)
3. **Task 3: Update auth callback to seed roadmap for student_diy** - `71cb534` (feat)

## Files Created/Modified
- `src/lib/config.ts` - Added student_diy to ROLES, ROLE_HIERARCHY, ROUTES, ROLE_REDIRECTS, NAVIGATION, INVITE_CONFIG
- `src/lib/types.ts` - Updated users/invites/magic_links role unions to include student_diy (worktree deviation fix)
- `src/proxy.ts` - Added student_diy to DEFAULT_ROUTES and ROLE_ROUTE_ACCESS
- `src/app/api/auth/callback/route.ts` - Expanded 3 roadmap seeding conditions to include student_diy

## Decisions Made
- student_diy level 1 in ROLE_HIERARCHY (peer to student) — same auth hierarchy level, different route space
- NAVIGATION has 3 items only: Dashboard (/student_diy), Work Tracker (/student_diy/work), Roadmap (/student_diy/roadmap) — no AI chat, no Daily Report per D-03
- Coach assignment check at line 257 of auth callback remains `magicLink.role === "student"` only — student_diy intentionally has no coach per ROLE-06
- INVITE_CONFIG.inviteRules is declarative (for Record<Role,...> type completeness) — actual Zod enforcement comes in Plan 03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated types.ts role unions with student_diy**
- **Found during:** Task 1 (config.ts expansion)
- **Issue:** Worktree branch was forked before Phase 30 master commits landed. types.ts in this worktree had `role: "owner" | "coach" | "student"` for users/invites/magic_links tables. After adding student_diy to config.ts ROLES (expanding the Role type), TypeScript errored: `Type '"student_diy"' is not assignable to type '"owner" | "coach" | "student"'` in 3 places in auth callback (lines 132, 282, 389).
- **Fix:** Updated types.ts users Row/Insert/Update, invites Row/Insert/Update, and magic_links Row/Insert/Update to include "student_diy" in role unions — identical to what Phase 30 applied to master.
- **Files modified:** src/lib/types.ts
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** eba0249 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix — worktree was missing Phase 30's types.ts changes. No scope creep.

## Issues Encountered
None beyond the types.ts worktree branch gap documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 01 complete: config, proxy, and auth callback foundation in place
- Plan 02 can proceed: create /student_diy/ route group with dashboard, work, and roadmap page.tsx files
- Plan 03 can proceed: expand invite forms (owner/coach) and invite/magic-link API Zod schemas
- No blockers — tsc --noEmit passes, npm run build passes

## Self-Check: PASSED

- FOUND: src/lib/config.ts
- FOUND: src/proxy.ts
- FOUND: src/app/api/auth/callback/route.ts
- FOUND: .planning/phases/31-student-diy-role/31-01-SUMMARY.md
- FOUND: eba0249 (Task 1 commit)
- FOUND: 23695ef (Task 2 commit)
- FOUND: 71cb534 (Task 3 commit)

---
*Phase: 31-student-diy-role*
*Completed: 2026-04-03*
