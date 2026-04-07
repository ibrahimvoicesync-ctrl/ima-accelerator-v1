# Phase 31: Student_DIY Role - Research

**Researched:** 2026-04-03
**Domain:** Role integration — config, proxy, auth callback, pages, invite forms
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Own route group `/student_diy/` with separate page files under `src/app/(dashboard)/student_diy/`. Do NOT share `/student/` pages — keeps proxy routing clean and avoids conditional rendering complexity.
- **D-02:** Reuse student components (WorkTrackerClient, RoadmapClient) via imports in the new page.tsx files, but each page.tsx is separate with `requireRole("student_diy")`.
- **D-03:** Stripped-down student dashboard. Show work progress card + roadmap progress card only. No daily report card, no coach info, no KPI outreach cards (student_diy doesn't submit reports).
- **D-04:** Add "Student DIY" to the existing role dropdown on both coach and owner invite forms. No separate invite flow.
- **D-05:** Silent redirect to `/student_diy` dashboard — same pattern as existing proxy behavior. No toast needed.

### Claude's Discretion

- Dashboard card layout and spacing for the reduced 2-card layout
- Exact requireRole helper pattern (reuse existing or create shared)
- Order of config.ts changes (ROLES, ROLE_HIERARCHY, ROUTES, ROLE_REDIRECTS, NAVIGATION)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROLE-01 | User can register with a student_diy invite and be assigned role 'student_diy' via Google OAuth callback | Auth callback uses `Object.keys(ROLE_REDIRECTS)` as validRoles — adding student_diy to ROLE_REDIRECTS and seeding roadmap on `invite.role === "student_diy"` covers this |
| ROLE-02 | Student_DIY user is redirected to /student_diy dashboard after login | ROLE_REDIRECTS and proxy DEFAULT_ROUTES must both include student_diy entry |
| ROLE-03 | Student_DIY sidebar shows exactly 3 items: Dashboard, Work Tracker, Roadmap | NAVIGATION[role] drives Sidebar — add `student_diy` key with 3 NavItems |
| ROLE-04 | Student_DIY user can access work tracker and roadmap with full functionality | Separate page.tsx files import WorkTrackerClient and RoadmapClient; requireRole("student_diy") on each |
| ROLE-05 | Student_DIY user cannot access Ask Abu Lahya, Daily Report, Resources, or Chat pages | proxy ROLE_ROUTE_ACCESS restricts student_diy to ["/student_diy"] prefix only |
| ROLE-06 | Student_DIY user cannot be assigned to a coach (fully independent) | No coach_id set on creation path; invite forms pass coach_id: null for student_diy invites |
| ROLE-07 | Owner and coach can create student_diy invites | inviteSchema z.enum and magicRole z.enum must accept "student_diy"; coach role-restriction guard must allow student_diy |
</phase_requirements>

---

## Summary

Phase 31 wires the `student_diy` role across 8 discrete integration points: config.ts (5 maps), proxy.ts (2 maps), and auth callback (1 validRoles check). No new dependencies are needed — all patterns are already established by the existing 3-role architecture.

The work divides cleanly into three tracks: (1) config and proxy expansion — add `student_diy` to ROLES, ROLE_HIERARCHY, ROUTES, ROLE_REDIRECTS, NAVIGATION, DEFAULT_ROUTES, and ROLE_ROUTE_ACCESS; (2) route files — create the `/student_diy/` route group with dashboard, work, and roadmap page.tsx files; (3) invite surface — expand invite form dropdowns, API Zod schemas, and the auth callback roadmap-seeding branch to recognize student_diy.

The auth callback is the most risky location: it uses `Object.keys(ROLE_REDIRECTS)` as its runtime validRoles array in three separate code paths (invite, magic link, whitelist). All three paths will auto-accept student_diy once ROLE_REDIRECTS includes the key — no manual array surgery needed.

**Primary recommendation:** Update config.ts and proxy.ts atomically in a single plan step, then build route files and update the auth callback seeding branch before touching invite forms — this ordering prevents a half-wired state where a student_diy user can register but has nowhere to land.

---

## Standard Stack

No new npm packages. All libraries already installed.

### Core (already installed)
| Library | Purpose | Notes |
|---------|---------|-------|
| Next.js App Router | Route group, page.tsx files | Same pattern as `/student/` |
| `@/lib/session` `requireRole()` | Server-side role guard per page | Already accepts `Role | Role[]` array |
| `@/lib/config` | Single source of truth | 5 maps to expand |
| `@/lib/types` | TypeScript types | Already includes `student_diy` in Role union (Phase 30) |
| Zod | API input validation | `z.enum` on invite and magic-link routes must add `"student_diy"` |

### Version verification
No `npm install` step — zero new packages.

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
src/app/(dashboard)/
├── student_diy/
│   ├── page.tsx          # Dashboard (stripped-down, D-03)
│   ├── work/
│   │   └── page.tsx      # Imports WorkTrackerClient, requireRole("student_diy")
│   └── roadmap/
│       └── page.tsx      # Imports RoadmapClient, requireRole("student_diy")
```

### Pattern 1: Config-Driven Role Expansion

**What:** Every role-gated behavior derives from `config.ts`. Adding a role means editing the 5 config maps — the rest of the application (Sidebar, layout, session helper) picks it up automatically.

**Where in config.ts:**

```typescript
// ROLES — add student_diy
export const ROLES = {
  OWNER: "owner",
  COACH: "coach",
  STUDENT: "student",
  STUDENT_DIY: "student_diy",
} as const;

// ROLE_HIERARCHY — student_diy is peer to student (level 1)
export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  coach: 2,
  student: 1,
  student_diy: 1,
};

// ROUTES — new student_diy section
routes: {
  student_diy: {
    dashboard: "/student_diy",
    workTracker: "/student_diy/work",
    roadmap: "/student_diy/roadmap",
  },
}

// ROLE_REDIRECTS — auth callback and requireRole() both read this
export const ROLE_REDIRECTS: Record<Role, string> = {
  owner: "/owner",
  coach: "/coach",
  student: "/student",
  student_diy: "/student_diy",
};

// NAVIGATION — Sidebar reads NAVIGATION[role] directly
export const NAVIGATION: Record<Role, NavItem[]> = {
  // ... existing roles ...
  student_diy: [
    { label: "Dashboard",    href: "/student_diy",         icon: "LayoutDashboard" },
    { label: "Work Tracker", href: "/student_diy/work",    icon: "Timer" },
    { label: "Roadmap",      href: "/student_diy/roadmap", icon: "Map" },
  ],
};

// INVITE_CONFIG — update inviteRules so owner can invite student_diy
export const INVITE_CONFIG = {
  inviteRules: {
    owner: ["coach", "student", "student_diy"] as Role[],
    coach: ["student", "student_diy"] as Role[],
    student: [] as Role[],
    student_diy: [] as Role[],
  },
};
```

**Confidence:** HIGH — read directly from source.

### Pattern 2: Proxy Expansion (2 maps)

**What:** `proxy.ts` holds `DEFAULT_ROUTES` (post-login redirect) and `ROLE_ROUTE_ACCESS` (allowed path prefixes). Both are plain `Record<string, string | string[]>` — no type import needed.

```typescript
const DEFAULT_ROUTES: Record<string, string> = {
  owner: "/owner",
  coach: "/coach",
  student: "/student",
  student_diy: "/student_diy",   // ADD
};

const ROLE_ROUTE_ACCESS: Record<string, string[]> = {
  owner: ["/owner"],
  coach: ["/coach"],
  student: ["/student"],
  student_diy: ["/student_diy"], // ADD — blocks /student/*, /owner/*, /coach/*
};
```

**Note:** proxy.ts does NOT import from `config.ts` — it has its own local maps. This is intentional (avoids module import in the edge runtime path). Changes here must be kept in sync with config.ts manually.

**Confidence:** HIGH — read directly from source.

### Pattern 3: Auth Callback — validRoles and roadmap seeding

The callback uses `Object.keys(ROLE_REDIRECTS)` as its validRoles check in three places (lines ~100, ~207, ~364). Once `student_diy` is in ROLE_REDIRECTS, all three validation paths accept it automatically — no code change needed at those lines.

The roadmap seeding branch currently reads:
```typescript
if (invite.role === "student") {
  // seed roadmap_progress
}
```

This must be expanded to also seed for student_diy:
```typescript
if (invite.role === "student" || invite.role === "student_diy") {
  // seed roadmap_progress
}
```

This pattern exists in three places in route.ts (invite path, magic link path, whitelist path) — all three must be updated.

**Confidence:** HIGH — read directly from source (lines 160, 311, 417).

### Pattern 4: requireRole() on page.tsx files

The existing `requireRole()` signature already accepts an array:

```typescript
export async function requireRole(allowed: Role | Role[]): Promise<SessionUser>
```

Each new page.tsx calls `requireRole("student_diy")` — single role, not array. The session helper uses `ROLE_REDIRECTS[user.role]` as the redirect target, which will work once config.ts is updated.

**Confidence:** HIGH — read directly from `src/lib/session.ts`.

### Pattern 5: Invite Forms — role dropdown expansion

**OwnerInvitesClient.tsx** currently has:
```typescript
const [selectedRole, setSelectedRole] = useState<"coach" | "student">("student");
// ...
<option value="student">Student</option>
<option value="coach">Coach</option>
```

**Changes needed:**
1. Type union: `"coach" | "student" | "student_diy"`
2. Add `<option value="student_diy">Student DIY</option>` to the select element
3. Update `onChange` cast: `e.target.value as "coach" | "student" | "student_diy"`

**CoachInvitesClient.tsx** currently has no selectedRole state — it hardcodes `role: "student"` in both API calls. Changes needed:
1. Add `selectedRole` state with type `"student" | "student_diy"`, default `"student"`
2. Add role select element (same pattern as OwnerInvitesClient)
3. Pass `role: selectedRole` in the fetch body for both email invite and magic link calls

**API route changes (invites route.ts):**
```typescript
// Before:
role: z.enum(["coach", "student"]).optional().default("student"),

// After:
role: z.enum(["coach", "student", "student_diy"]).optional().default("student"),
```

The existing coach guard (`if (profile.role === "coach" && parsed.data.role !== "student")`) must become:
```typescript
if (profile.role === "coach" && parsed.data.role !== "student" && parsed.data.role !== "student_diy") {
  return NextResponse.json({ error: "Coaches can only invite students" }, { status: 403 });
}
```

**API route changes (magic-links route.ts):**
```typescript
// magicRole type and enum:
let magicRole: "coach" | "student" | "student_diy" = "student";
// roleSchema:
role: z.enum(["coach", "student", "student_diy"]).optional().default("student"),
```

Same coach guard update needed here too.

**Confidence:** HIGH — read directly from source.

### Pattern 6: student_diy Dashboard Page (D-03)

Two cards only — work progress and roadmap progress. Reference: `/student/page.tsx` work progress card (lines 111–140) and roadmap card (lines 229–279). Omit: KPI outreach cards, daily report card.

The dashboard queries needed:
- `work_sessions` for today (same as student)
- `roadmap_progress` for step status (same as student)
- No `daily_reports` queries needed (student_diy does not report)

Next action CTA on work card should link to `/student_diy/work` (not `/student/work`).
Roadmap card link should point to `/student_diy/roadmap`.

### Anti-Patterns to Avoid

- **Sharing `/student/` pages with conditional role checks:** D-01 explicitly forbids this. Each route group has its own page.tsx.
- **Manually listing `validRoles` arrays in callback:** The callback already uses `Object.keys(ROLE_REDIRECTS)` — rely on that pattern, don't add parallel `if (role === "student_diy")` checks for the validation step.
- **Forgetting roadmap seeding for student_diy magic link path:** Three seeding branches exist (invite, magic, whitelist) — all three must be updated or student_diy registrants will have no roadmap rows.
- **Not updating proxy.ts:** proxy.ts has its own local constants separate from config.ts. Missing this causes redirect loops: the proxy allows login but `DEFAULT_ROUTES[profile.role]` returns undefined → `"/"` → proxy loops back to login.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role-gated page guard | Custom middleware check | `requireRole("student_diy")` from `@/lib/session` | Already handles redirect to role dashboard |
| Role-based navigation | Conditional JSX in Sidebar | `NAVIGATION["student_diy"]` in config.ts | Sidebar reads NAVIGATION[role] dynamically |
| Invite role validation | Custom if/else chain | Zod `z.enum(["coach","student","student_diy"])` | Fail-fast with structured error messages |
| Roadmap seeding logic | New seeding function | Copy-exact pattern from existing `student` seeding branch | Identical schema, identical steps array |

**Key insight:** Every structural concern in this phase (routing, sidebar, auth) is already solved by the config-driven architecture. This phase is purely additive — extend existing maps, don't redesign.

---

## Runtime State Inventory

> This is not a rename/refactor phase — no runtime state migration is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No existing student_diy rows in any table | None — new registrants will create rows |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars needed | None |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: Partial Config Update Causes Redirect Loop

**What goes wrong:** If ROLE_REDIRECTS gets `student_diy` but proxy.ts DEFAULT_ROUTES does not (or vice versa), a student_diy user logs in, gets redirected to `/student_diy`, proxy does not recognize it as an allowed prefix, and redirects back to `DEFAULT_ROUTES["student_diy"]` which is either undefined → `"/"` → infinite loop.

**Why it happens:** proxy.ts has its own local constants, not imported from config.ts.

**How to avoid:** Update both `DEFAULT_ROUTES` and `ROLE_ROUTE_ACCESS` in proxy.ts in the same commit as ROLE_REDIRECTS in config.ts. STATE.md calls this the "8-location atomic update" pattern.

**Warning signs:** Redirect loops or blank screens for student_diy after login — browser network tab shows 302 bouncing between `/student_diy` and another path.

### Pitfall 2: Auth Callback Rejects student_diy Role

**What goes wrong:** Student registers with a student_diy invite, callback checks `Object.keys(ROLE_REDIRECTS).includes(invite.role)` — if ROLE_REDIRECTS doesn't include student_diy yet, callback redirects to `?error=invalid_invite`.

**Why it happens:** ROLE_REDIRECTS update missed or deployed after an invite was already created.

**How to avoid:** Update ROLE_REDIRECTS in the same plan step as all other config changes.

**Warning signs:** Registration attempt redirects to `/register/[code]?error=invalid_invite` for a freshly-created student_diy invite.

### Pitfall 3: Roadmap Not Seeded for student_diy

**What goes wrong:** student_diy registers via magic link, no roadmap_progress rows are inserted (seeding branch only checks `role === "student"`). RoadmapClient renders empty state; lazy seeding in the roadmap page.tsx will add rows as `"locked"` with no `"active"` step — user sees no active step.

**Why it happens:** Three seeding branches in the callback each have `if (invite.role === "student")`. All three must become `=== "student" || === "student_diy"`.

**How to avoid:** Grep for `invite.role === "student"` in route.ts before submitting — ensure 3 matches become 3 expanded conditions.

**Warning signs:** student_diy user's roadmap page loads but all steps show as "locked" with no active step.

### Pitfall 4: Invite API Rejects student_diy Role

**What goes wrong:** Owner or coach creates a student_diy invite, but `inviteSchema` only allows `z.enum(["coach", "student"])`. API returns 400 validation error.

**Why it happens:** Zod schema not updated alongside frontend dropdown.

**How to avoid:** Update inviteSchema and magic-links roleSchema in the same plan step as the frontend dropdown change.

**Warning signs:** `POST /api/invites` returns 400 with a validation error message when `role: "student_diy"` is submitted.

### Pitfall 5: Coach Can't Create student_diy Invites

**What goes wrong:** The coach guard in both `/api/invites` and `/api/magic-links` currently reads `parsed.data.role !== "student"` — this blocks student_diy. Coaches cannot create student_diy invites even after the dropdown is added.

**Why it happens:** Guard logic was written before student_diy existed.

**How to avoid:** Update guard to `role !== "student" && role !== "student_diy"` in both API files.

**Warning signs:** Coach gets 403 "Coaches can only invite students" when trying to invite a student_diy.

### Pitfall 6: Sidebar `isActive` Logic for student_diy

**What goes wrong:** Sidebar.tsx `isActive` check uses `href === "/${role}"` for exact match at role root. For student_diy, role is `"student_diy"` but href is `/student_diy` — this will work correctly since `/${role}` expands to `/student_diy`. No special handling needed, but confirm the role string in NAVIGATION hrefs matches the path exactly.

**How to avoid:** Ensure all hrefs in NAVIGATION["student_diy"] start with `/student_diy` (not `/student-diy` or `/studentdiy`).

---

## Code Examples

### config.ts — INVITE_CONFIG update

```typescript
// Source: src/lib/config.ts (read 2026-04-03)
export const INVITE_CONFIG = {
  codeExpiryHours: 72,
  inviteRules: {
    owner: ["coach", "student", "student_diy"] as Role[],
    coach: ["student", "student_diy"] as Role[],
    student: [] as Role[],
    student_diy: [] as Role[],
  },
} as const;
```

### auth callback — roadmap seeding condition

```typescript
// Source: src/app/api/auth/callback/route.ts (read 2026-04-03)
// Update all 3 occurrences of this pattern:
if (invite.role === "student" || invite.role === "student_diy") {
  const roadmapRows = ROADMAP_STEPS.map((step) => ({
    student_id: newUser.id,
    step_number: step.step,
    step_name: step.title,
    status: step.step === 1 ? ("completed" as const)
           : step.step === 2 ? ("active" as const)
           : ("locked" as const),
    completed_at: step.step === 1 ? new Date().toISOString() : null,
  }));
  await admin.from("roadmap_progress").insert(roadmapRows);
}
```

### student_diy dashboard — stripped-down layout (D-03)

```typescript
// Pattern: 2-card grid, no KPI cards, no daily report card
// Links use /student_diy/* hrefs
// requireRole("student_diy") at top

export default async function StudentDiyDashboard() {
  const user = await requireRole("student_diy");
  // Queries: work_sessions (today) + roadmap_progress only
  // No daily_reports query
  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-ima-text">
        {getGreeting()}, {firstName}!
      </h1>
      <p className="mt-1 text-ima-text-secondary">Here&apos;s your progress for today</p>
      {/* Work Progress Card — link to /student_diy/work */}
      {/* Roadmap Progress Card — link to /student_diy/roadmap */}
    </div>
  );
}
```

### student_diy work page

```typescript
// Pattern: identical to /student/work/page.tsx but with requireRole("student_diy")
import { requireRole } from "@/lib/session";
import { WorkTrackerClient } from "@/components/student/WorkTrackerClient";

export default async function StudentDiyWorkPage() {
  const user = await requireRole("student_diy");
  // same data fetching as student work page
  return (
    <div className="max-w-2xl mx-auto px-4">
      <WorkTrackerClient initialSessions={...} initialPlan={...} />
    </div>
  );
}
```

---

## State of the Art

| Old State | Current State | Notes |
|-----------|---------------|-------|
| 3-role system (owner, coach, student) | 4-role system post Phase 30 | types.ts and DB CHECK already include student_diy |
| NAVIGATION typed as `Record<Role, NavItem[]>` | Same type — just needs student_diy key | TypeScript will error if Role expands but NAVIGATION key is missing |
| inviteSchema allows "coach" | "student" only | Needs "student_diy" added |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config-only changes with no external dependencies beyond the already-running Next.js + Supabase stack.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual UAT (no automated test suite detected) |
| Config file | none |
| Quick run command | `npm run build && npx tsc --noEmit` |
| Full suite command | `npm run build && npx tsc --noEmit && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROLE-01 | student_diy invite registration assigns correct role | smoke | `npx tsc --noEmit` (type safety) + manual OAuth flow | ❌ Wave 0 |
| ROLE-02 | Redirect to /student_diy after login | smoke | `npm run build` (route existence) + manual login | ❌ Wave 0 |
| ROLE-03 | Sidebar shows exactly 3 items | unit | `npx tsc --noEmit` (NAVIGATION type check) | ❌ Wave 0 |
| ROLE-04 | Work tracker and roadmap functional | smoke | `npm run build` (import resolution) + manual test | ❌ Wave 0 |
| ROLE-05 | Blocked routes redirect to dashboard | smoke | `npm run build` + manual URL navigation | ❌ Wave 0 |
| ROLE-06 | No coach assignment | unit | `npx tsc --noEmit` + DB verify | ❌ Wave 0 |
| ROLE-07 | Owner/coach can create student_diy invites | smoke | `npx tsc --noEmit` + manual invite creation | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run build && npx tsc --noEmit`
- **Per wave merge:** `npm run build && npx tsc --noEmit && npm run lint`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- No automated test files — TypeScript compilation (`npx tsc --noEmit`) is the primary machine-checkable gate. Manual UAT covers behavioral requirements.

---

## Open Questions

1. **coach_id on student_diy invite (ROLE-06)**
   - What we know: Regular student invites set `coach_id: profile.id` when `profile.role === "coach"`. D-04 says student_diy has no coach assignment.
   - What's unclear: Should the invite API explicitly null out coach_id for student_diy, or does the callback already handle this?
   - Recommendation: In `/api/invites`, when `role === "student_diy"`, always pass `coach_id: null` regardless of who created it. In the auth callback, the magic-link path already conditionally sets coachId only for `role === "student"` (line ~257) — add same guard for student_diy by ensuring that block also skips student_diy.

2. **TypeScript strict error if NAVIGATION is missing student_diy key**
   - What we know: `NAVIGATION: Record<Role, NavItem[]>` — if `Role` expands to include `student_diy` but the object doesn't have that key, `tsc --noEmit` will error.
   - What's unclear: This is actually a feature, not a problem — it forces completeness.
   - Recommendation: Use it as a build-gate check. Add student_diy to NAVIGATION before running tsc.

---

## Sources

### Primary (HIGH confidence)

- `src/lib/config.ts` — read 2026-04-03 — ROLES, ROLE_HIERARCHY, ROUTES, ROLE_REDIRECTS, NAVIGATION, INVITE_CONFIG
- `src/proxy.ts` — read 2026-04-03 — DEFAULT_ROUTES, ROLE_ROUTE_ACCESS
- `src/app/api/auth/callback/route.ts` — read 2026-04-03 — validRoles pattern, roadmap seeding branches (lines 100, 160, 207, 257, 311, 364, 417)
- `src/lib/session.ts` — read 2026-04-03 — requireRole() signature and implementation
- `src/app/(dashboard)/student/page.tsx` — read 2026-04-03 — dashboard card patterns
- `src/app/(dashboard)/student/work/page.tsx` — read 2026-04-03 — work page pattern
- `src/app/(dashboard)/student/roadmap/page.tsx` — read 2026-04-03 — roadmap page pattern
- `src/components/layout/Sidebar.tsx` — read 2026-04-03 — NAVIGATION[role] consumption pattern
- `src/app/(dashboard)/layout.tsx` — read 2026-04-03 — how role is passed to Sidebar
- `src/components/owner/OwnerInvitesClient.tsx` — read 2026-04-03 — selectedRole state, dropdown
- `src/components/coach/CoachInvitesClient.tsx` — read 2026-04-03 — hardcoded "student" role
- `src/app/api/invites/route.ts` — read 2026-04-03 — inviteSchema z.enum, coach guard
- `src/app/api/magic-links/route.ts` — read 2026-04-03 — magicRole type, coach guard
- `src/lib/types.ts` — read 2026-04-03 — Role union already includes student_diy (Phase 30 done)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries read from source, no new packages
- Architecture: HIGH — all patterns extracted directly from existing codebase
- Pitfalls: HIGH — each pitfall derived from reading the actual code paths

**Research date:** 2026-04-03
**Valid until:** Stable — this is an internal codebase, no external API changes
