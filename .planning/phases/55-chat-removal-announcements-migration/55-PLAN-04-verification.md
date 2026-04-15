---
plan_id: 55-04
phase: 55
title: "Verify clean build and dashboard loads for all 4 roles"
wave: 3
depends_on: [55-01, 55-02, 55-03]
autonomous: false  # interactive: dashboard load check requires running dev server + browser/curl sessions
requirements:
  - CHAT-REM-01
  - CHAT-REM-02
  - CHAT-REM-07
  - ANNOUNCE-10
files_modified: []
must_haves:
  - npm run build exits 0 with no TypeScript errors
  - npx tsc --noEmit exits 0
  - npm run lint exits 0
  - Dashboard loads for owner, coach, student, student_diy without runtime errors
  - No 404s, no "unread_messages is not defined", no "messages table does not exist" in browser console or server logs
---

# Plan 55-04 — End-to-end verification

## Context

Phase 55's success criteria (from ROADMAP.md) mandate that the dashboard loads without errors for all four roles after migration and `npm run build` passes clean. This plan runs the full verification suite. Non-autonomous because dashboard role-check requires an interactive browser session or curl with valid auth cookies.

## Tasks

<task id="55-04-T1" type="execute">
  <title>Run type-check — npx tsc --noEmit</title>
  <read_first>
    - src/lib/rpc/types.ts (post-sweep state)
    - src/lib/types.ts (post-regen state)
    - src/app/(dashboard)/layout.tsx (post-sweep state)
  </read_first>
  <action>
    From the repo root, run:
    ```
    npx tsc --noEmit
    ```

    Expected: exit code 0, zero output (or only informational notices).

    If errors reference any of:
    - `Property 'unread_messages' does not exist on type 'SidebarBadgesResult'` — Plan 55-02 T5/T6 incomplete; file a fix in the offending consumer.
    - `Cannot find module '@/lib/chat-utils'` or `'@/components/chat/...'` — orphaned import escaped Plan 55-02 T8; fix the importing file.
    - `Property 'messages' does not exist on type 'Database['public']['Tables']'` — Plan 55-03 T2 regen did not take effect; re-run.

    Do NOT suppress errors (@ts-ignore, `// eslint-disable`). Fix the underlying cause.
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits with code 0
    - Command output contains no "error TS" lines
  </acceptance_criteria>
</task>

<task id="55-04-T2" type="execute">
  <title>Run lint — npm run lint</title>
  <read_first>
    - .eslintrc* or eslint.config.* (project lint config)
  </read_first>
  <action>
    From the repo root:
    ```
    npm run lint
    ```

    Expected: exit 0. Common post-deletion lint warnings:
    - Unused imports: fix by removing the import (do NOT add eslint-disable)
    - Unused variables: fix by removing the variable

    If `MessageSquare` is flagged as unused anywhere (it should NOT be — we verified Sidebar.tsx, DiscordEmbed.tsx, CoachFeedbackCard.tsx, student/ask still use it), remove only from files where it's genuinely unused.
  </action>
  <acceptance_criteria>
    - `npm run lint` exits with code 0
  </acceptance_criteria>
</task>

<task id="55-04-T3" type="execute">
  <title>Run production build — npm run build</title>
  <read_first>
    - package.json (scripts.build)
    - next.config.* (for build-time assertions)
  </read_first>
  <action>
    From the repo root:
    ```
    npm run build
    ```

    Expected: exit 0, full Next.js build output, all routes compile.

    **Required route absence check:** In the build output, the following routes MUST NOT appear:
    - `/coach/chat`
    - `/student/chat`
    - `/api/messages`
    - `/api/messages/read`

    The following routes SHOULD appear (sanity check — they're unrelated but confirm the build is complete):
    - `/coach`
    - `/student`
    - `/owner`
    - `/student_diy`

    If the build fails due to deleted-module references, trace back to Plan 55-02 (missed an orphaned import) or Plan 55-03 (types regen incomplete).
  </action>
  <acceptance_criteria>
    - `npm run build` exits with code 0
    - Build output contains no "Module not found" errors
    - Build output contains no "Type error" lines
    - Build output route table does not list `/coach/chat`, `/student/chat`, `/api/messages`, or `/api/messages/read`
  </acceptance_criteria>
</task>

<task id="55-04-T4" type="execute">
  <title>Dashboard role smoke test — load dashboards for owner, coach, student, student_diy</title>
  <read_first>
    - src/app/(dashboard)/layout.tsx (post-sweep — confirms badge-mapping logic)
    - src/lib/config.ts (NAVIGATION — coach + student nav no longer show Chat)
  </read_first>
  <action>
    Start the dev server:
    ```
    npm run dev
    ```

    For each of the four roles, either (a) log in through the app and load the dashboard root, or (b) use an authenticated curl request. The goal is to confirm each role's dashboard renders without runtime errors.

    **What to check for each role:**
    1. **Owner** — navigate to `/owner`. Sidebar renders. No `MessageSquare`/Chat entry in coach or student sections (N/A for owner). `active_alerts` badge renders if applicable.
    2. **Coach** — navigate to `/coach`. Sidebar renders. **No "Chat" entry in the nav** (this is the key regression check). `unreviewed_reports` + `coach_milestone_alerts` badges render if applicable.
    3. **Student** — navigate to `/student`. Sidebar renders. **No "Chat" entry**. "Ask Abu Lahya" entry is still present (uses MessageSquare icon but is unrelated).
    4. **student_diy** — navigate to `/student_diy`. Sidebar renders. No Chat entry (there never was one for diy).

    **Runtime-error checks** (browser console + server logs):
    - No `TypeError: Cannot read properties of undefined (reading 'unread_messages')`
    - No `relation "messages" does not exist` in server logs (would indicate the RPC function still queries messages)
    - No 500 responses from `/api/...`
    - The `get_sidebar_badges` RPC call in the dashboard layout returns successfully (check browser Network tab or server logs — response is a valid jsonb object)

    **Manual URL 404 check** — directly request each of these and confirm a 404 response (routes no longer exist):
    - `http://localhost:3000/coach/chat` → 404
    - `http://localhost:3000/student/chat` → 404
    - `http://localhost:3000/api/messages` → 404
    - `http://localhost:3000/api/messages/read` → 404

    Log the verification result for each role (pass/fail + notes) directly in task output.
  </action>
  <acceptance_criteria>
    - Owner dashboard (`/owner`) returns 200 and renders without console errors
    - Coach dashboard (`/coach`) returns 200 and renders without console errors; sidebar has no "Chat" link
    - Student dashboard (`/student`) returns 200 and renders without console errors; sidebar has no "Chat" link; "Ask Abu Lahya" preserved
    - student_diy dashboard (`/student_diy`) returns 200 and renders without console errors
    - `curl -I http://localhost:3000/coach/chat` returns HTTP 404
    - `curl -I http://localhost:3000/student/chat` returns HTTP 404
    - `curl -I http://localhost:3000/api/messages` returns HTTP 404
    - No server log lines contain `relation "messages" does not exist`
    - No server log lines contain `unread_messages is not defined`
  </acceptance_criteria>
</task>

<task id="55-04-T5" type="execute">
  <title>Final sweep audit — confirm zero residual chat artifacts</title>
  <read_first>
    - Output of the scans below
  </read_first>
  <action>
    Run the canonical residual-reference scans:
    ```
    grep -rn "unread_messages" src/
    grep -rn "chat-utils" src/
    grep -rn "components/chat" src/
    grep -rn "api/messages" src/
    grep -rn "/coach/chat" src/
    grep -rn "/student/chat" src/
    find src/app/\(dashboard\)/coach/chat src/app/\(dashboard\)/student/chat src/app/api/messages src/lib/chat-utils.ts src/components/chat 2>/dev/null
    ```

    All MUST return zero matches / no results. If anything remains, fix it (file a followup for Plan 55-02 T8 sweep gap) and re-run.
  </action>
  <acceptance_criteria>
    - `grep -rn "unread_messages" src/` returns 0 matches
    - `grep -rn "chat-utils" src/` returns 0 matches
    - `grep -rn "components/chat" src/` returns 0 matches
    - `grep -rn "api/messages" src/` returns 0 matches
    - `grep -rn "/coach/chat" src/` returns 0 matches
    - `grep -rn "/student/chat" src/` returns 0 matches
    - `find src/app/\\(dashboard\\)/coach/chat src/app/\\(dashboard\\)/student/chat src/app/api/messages src/lib/chat-utils.ts src/components/chat 2>/dev/null | wc -l` returns 0
  </acceptance_criteria>
</task>

## Verification

Phase 55 is complete when:
- Every acceptance criterion across Plans 55-01, 55-02, 55-03, and 55-04 passes
- `npm run build` exits 0
- All 4 role dashboards load cleanly
- No residual chat references in `src/` or the DB
- Migration 00029 is committed and applied to the target environment
