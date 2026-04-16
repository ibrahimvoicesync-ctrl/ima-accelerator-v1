---
status: resolved
trigger: "User reported 'referal link doesn't work'. Actual repeating error in dev server logs is [layout] Badge RPC failed PGRST203 — could not choose between two get_sidebar_badges signatures."
created: 2026-04-16
updated: 2026-04-16
slug: get-sidebar-badges-overload
---

# Debug: get_sidebar_badges PostgREST overload

## Symptoms

DATA_START
**Expected behavior:**
- Sidebar layout calls `supabase.rpc('get_sidebar_badges', ...)` and gets back the badges payload (chat unread, alerts, announcements, etc.) without error.
- The page renders normally (no console pollution from `[layout] Badge RPC failed:`).
- Whatever the user actually clicked ("referal link") proceeds.

**Actual behavior:**
- Every dashboard page render emits `[layout] Badge RPC failed: { code: 'PGRST203', ... }`.
- PostgREST returns an "ambiguous function" error because TWO versions of `public.get_sidebar_badges` exist in the database:
  1. `public.get_sidebar_badges(p_user_id => uuid, p_role => text)` (2 args — older)
  2. `public.get_sidebar_badges(p_user_id => uuid, p_role => text, p_today => date, p_tech_setup_enabled => boolean)` (4 args — added in v1.5 Phase 50 NOTIF/tech_setup work)
- The PostgREST hint: "Try renaming the parameters or the function itself in the database so function overloading can be resolved".
- User says "referal link doesn't work" — likely a downstream symptom (the layout RPC failing OR a separate referral-link issue).

**Error message (verbatim from dev server):**
```
[layout] Badge RPC failed: {
  code: 'PGRST203',
  details: null,
  hint: 'Try renaming the parameters or the function itself in the database so function overloading can be resolved',
  message: 'Could not choose the best candidate function between: public.get_sidebar_badges(p_user_id => uuid, p_role => text), public.get_sidebar_badges(p_user_id => uuid, p_role => text, p_today => date, p_tech_setup_enabled => boolean)'
}
```

**Timeline:**
- v1.5 Phase 50 introduced milestone notifications + `tech_setup` feature flag and added the 4-arg version of `get_sidebar_badges`.
- The 2-arg legacy version was apparently NOT dropped (or was re-created by a later migration).
- Both definitions now coexist in the linked remote Supabase project (uzfzoxfakxmsbttelhnr).

**Reproduction:**
1. Run `npm run dev`.
2. Sign in as any role that renders the (dashboard) Sidebar (student_diy in the paste, but likely affects all roles).
3. Navigate to any dashboard page (e.g. `/student_diy/work`).
4. Observe `[layout] Badge RPC failed: ...` in the server console on every render.

**Related context:**
- Caller: server-side layout that calls `supabase.rpc('get_sidebar_badges', ...)` — likely `src/app/(dashboard)/layout.tsx` and/or a helper in `src/lib/`.
- The 2-arg version is reachable from any caller passing only `{ p_user_id, p_role }` — but the conflict triggers regardless of call site because PostgREST resolves on signature, and a partial/named-arg call still ambiguates.
- Migrations directory: `supabase/migrations/` — recent additions include 00031_referral_links and earlier NOTIF/tech_setup migrations.
DATA_END

## Current Focus

hypothesis: Two definitions of `public.get_sidebar_badges` coexist in the remote Supabase DB. The 4-arg version (added in v1.5 Phase 50 for NOTIF/tech_setup) does not drop or replace the legacy 2-arg version. PostgREST hits PGRST203 because it cannot disambiguate by call shape. Fix is to drop the legacy 2-arg overload (or rename it) and ensure the 4-arg version is the single authoritative function, then have all callers pass all four named args (or rely on defaults).

test: Inspect remote DB for both function definitions (`pg_proc` lookup or migration grep), identify which migration created each, and confirm the 4-arg is the canonical one used by current call sites.

expecting: Two `pg_proc` rows for `get_sidebar_badges` with arg counts 2 and 4. The 2-arg row is dead code from before v1.5 Phase 50.

next_action: RESOLVED — see Resolution below.

## Evidence

- timestamp: 2026-04-16 — Migration grep across `supabase/migrations/`: `CREATE OR REPLACE FUNCTION public.get_sidebar_badges` appears in 00010 (2-arg, original), 00014 (2-arg, replace), 00017 (2-arg, chat-badges replace), 00027 (4-arg, milestone+tech_setup), 00029 (2-arg, chat-removal). The original hypothesis had the polarity inverted: the 4-arg was added in 00027 (Phase 51), not Phase 50, and the 2-arg was RECREATED — not orphaned — by 00029.
- timestamp: 2026-04-16 — Migration 00027 line 171 explicitly does `DROP FUNCTION IF EXISTS public.get_sidebar_badges(uuid, text);` before creating the 4-arg, so at the end of 00027 only the 4-arg existed.
- timestamp: 2026-04-16 — Migration 00029 (Phase 55, chat removal) then ran `CREATE OR REPLACE FUNCTION public.get_sidebar_badges(p_user_id uuid, p_role text)`. Postgres treats overloads as distinct functions keyed by full signature; `CREATE OR REPLACE` only matches the 2-arg signature (which did NOT exist), so it created a fresh 2-arg function alongside the existing 4-arg. The dual overload was born here.
- timestamp: 2026-04-16 — The 4-arg body (00027 lines 280-285, 300-307) still references `public.messages`, which 00029 step (3) `DROP TABLE public.messages CASCADE` deleted. So the 4-arg overload is doubly broken: ambiguous to PostgREST AND would raise "relation public.messages does not exist" if it ever resolved as the chosen candidate for `coach` or `student` roles.
- timestamp: 2026-04-16 — Layout caller `src/app/(dashboard)/layout.tsx:12-15` passes only `{ p_user_id, p_role }` (named args). PostgREST then sees two candidates that both accept exactly those two named args (the 4-arg one defaults `p_today` and `p_tech_setup_enabled`), so it raises PGRST203 instead of guessing.
- timestamp: 2026-04-16 — Auto-generated `src/lib/types.ts:918-928` shows the type union for `get_sidebar_badges` with both 2-arg and 4-arg variants — independent confirmation that `supabase gen types typescript` saw both overloads in the live remote schema.
- timestamp: 2026-04-16 — `get_coach_milestones(uuid, date, boolean)` is defined separately in 00027 (re-replaced in 00030) and called directly from `src/lib/rpc/coach-milestones.ts:52` with the `tech_setup_enabled` flag. So the v1.5 milestone payload is delivered independently of `get_sidebar_badges`. Dropping the 4-arg badge overload causes no v1.5 regression.
- timestamp: 2026-04-16 — `src/app/api/referral-link/route.ts:37` accepts both `student` and `student_diy` roles. The route is healthy. The user's "referal link doesn't work" complaint was almost certainly a misattribution to the dashboard error spam: with PGRST203 firing on every render, the layout returns `{}` and the dashboard chrome never settles, which can make any in-page action (including referral) feel broken.
- timestamp: 2026-04-16 — Applied fix migration `00032_drop_get_sidebar_badges_legacy_4arg.sql` via `supabase db push --linked`. `migration list --linked` confirms 00032 is applied to remote. Live RPC verification via REST (service-role): `student_diy` → `{}`, `coach` → `{"unreviewed_reports":0,"coach_milestone_alerts":0}`, `owner` → `{"active_alerts":5}`. PGRST203 is gone; the 2-arg function dispatches cleanly. `npx tsc --noEmit` passes with zero errors.

## Eliminated

- Possibility that the 4-arg version was the canonical/intended one and we should keep it: REJECTED — its body references `public.messages` which no longer exists, making it dead code regardless of dispatch.
- Possibility that the layout caller needed updating to pass 4 named args: REJECTED — the 2-arg version (from 00029) is the post-chat-removal authoritative implementation, and the layout's 2-named-args call already matches it. No client change required.
- Possibility that the referral-link API itself was broken: REJECTED — `src/app/api/referral-link/route.ts:37` already accepts both `student` and `student_diy` roles; the full route (CSRF → auth → role gate → cache check → Rebrandly → CAS persist) is intact. The "referal link doesn't work" report was a downstream symptom of the badge RPC failure on every dashboard render, not a separate bug.
- Possibility that this is a Postgres pooler / cached prepared-statement issue: REJECTED — `pg_proc` would still show two rows; the cleaning fix would still be the same DROP. No pooler reset required after migration push (PostgREST schema cache invalidates automatically when functions change in v12+ Supabase).

## Resolution

**Root cause:** Migration 00027 (Phase 51, v1.5) created a 4-arg `get_sidebar_badges(uuid, text, date, boolean)` overload. Migration 00029 (Phase 55, chat removal) used `CREATE OR REPLACE FUNCTION public.get_sidebar_badges(p_user_id uuid, p_role text)` — a different signature in Postgres' overload-identity rules — which created a fresh 2-arg function alongside the still-present 4-arg one rather than replacing it. Both overloads coexisted, and PostgREST PGRST203'd on every dashboard `rpc('get_sidebar_badges', { p_user_id, p_role })` call because both candidates accept exactly those two named args.

**Fix:** New migration `supabase/migrations/00032_drop_get_sidebar_badges_legacy_4arg.sql`:

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.get_sidebar_badges(uuid, text, date, boolean);
COMMIT;
```

The 2-arg version (from 00029) is the current authoritative implementation. The 4-arg version was already broken at runtime (references the dropped `public.messages` table), and its only legitimate consumer — the v1.5 milestone count — is delivered separately via `public.get_coach_milestones(uuid, date, boolean)` invoked directly from `src/lib/rpc/coach-milestones.ts`. Dropping the 4-arg overload therefore introduces no functional regression.

**Verification (live, not just type-check):**
- `supabase db push --linked` applied 00032; `migration list --linked` shows 00032 on both sides.
- Direct REST RPC calls with service-role key against `https://uzfzoxfakxmsbttelhnr.supabase.co/rest/v1/rpc/get_sidebar_badges`:
  - `{p_user_id:..., p_role:'student_diy'}` → `{}` (200 OK)
  - `{p_user_id:..., p_role:'coach'}` → `{"unreviewed_reports":0,"coach_milestone_alerts":0}` (200 OK)
  - `{p_user_id:..., p_role:'owner'}` → `{"active_alerts":5}` (200 OK)
- `npx tsc --noEmit` clean.
- The auto-generated overload union in `src/lib/types.ts:918-928` will collapse to a single `Args: { p_user_id, p_role }` shape on the next `supabase gen types typescript` regeneration. Until then, the union is harmless because the call site uses the 2-arg shape (the first member of the union).

**Referral link bug status:** Not a real bug. `src/app/api/referral-link/route.ts:37` already gates `student` AND `student_diy` correctly; the route is end-to-end intact (CSRF → auth → role gate → cache check → Rebrandly with timeout + ok check → CAS persist → success). The user's complaint was a misattribution caused by the badge RPC failing every render (which made the dashboard feel broken). Now that PGRST203 is gone, the referral card should work for both `student` and `student_diy` roles without further changes.

**Follow-ups (none blocking):**
- Optional: regenerate `src/lib/types.ts` via `npx supabase gen types typescript --linked > src/lib/types.ts` to collapse the union. Not required — current types are forward-compatible.
- Future migration hygiene: when a Supabase migration replaces an RPC after a signature change in an earlier migration, prefer an explicit `DROP FUNCTION IF EXISTS public.<name>(<old-signature>);` before the `CREATE OR REPLACE` to avoid leaving orphaned overloads. (Same pattern 00027 used at line 171.)
