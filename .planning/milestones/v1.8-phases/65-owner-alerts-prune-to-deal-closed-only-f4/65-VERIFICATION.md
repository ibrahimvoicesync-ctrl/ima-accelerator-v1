---
phase: 65-owner-alerts-prune-to-deal-closed-only-f4
verified: 2026-04-17T00:00:00Z
status: passed
score: 9/9 must-haves verified (human UAT deferred per lean-context policy)
---

# Phase 65: Owner Alerts Prune to `deal_closed` Only (F4) Verification Report

**Phase Goal:** The `/owner/alerts` feed stops generating `student_inactive`, `student_dropoff`, `unreviewed_reports`, and `coach_underperforming` alerts entirely — silently, with no tombstone — and replaces them with one `deal_closed` alert per closed deal (title = student name, message = "Closed a $X,XXX deal", links to `/owner/students/{student_id}`, key `deal_closed:{deal_id}`, dismissible via the existing `/api/alerts/dismiss` route); the owner sidebar badge count matches the pruned feed via a rewritten `get_sidebar_badges` OWNER branch.

**Verified:** 2026-04-17
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/owner/alerts` feed generates exactly one `deal_closed` alert per deal closed in the 30-day trailing window; title = student.name, message = `Closed a $X,XXX deal`, key = `deal_closed:{deal_id}`, link = `/owner/students/{student_id}` | VERIFIED | `src/app/(dashboard)/owner/alerts/page.tsx` queries `from("deals").gte("created_at", thirtyDaysAgoIso)` with embedded `users!deals_student_id_fkey`, maps each row to an `AlertItem` with `type:"deal_closed"`, `key:\`deal_closed:${d.id}\``, `title: studentRow?.name`, `message: \`Closed a $${revenueFormatted} deal\``, `subjectId: d.student_id`. `getDetailHref` returns `/owner/students/${subjectId}`. |
| 2 | Zero alerts of type `student_inactive`, `student_dropoff`, `unreviewed_reports`, `coach_underperforming` are ever rendered; no tombstone/deprecation copy | VERIFIED | `grep -c 'student_inactive\|student_dropoff\|unreviewed_reports\|coach_underperform' src/app/(dashboard)/owner/alerts/page.tsx` returns 2 (one comment line documenting the prune + the `AlertItem` import). Page body contains no computation of legacy alert types — the 4 legacy fetches (sessions, reports, coach ratings, unreviewed count) are fully removed. No "pruned"/"removed"/"no longer"/"deprecated" copy in page. |
| 3 | `AlertItem.type` narrowed to `"deal_closed"`; `TYPE_CONFIG` has single `deal_closed` entry (DollarSign + ima-success tokens); `getDetailHref` only handles `deal_closed` | VERIFIED | `src/components/owner/OwnerAlertsClient.tsx` declares `type: "deal_closed"` on `AlertItem`. `TYPE_CONFIG = { deal_closed: { bg: "bg-ima-success/10", text: "text-ima-success", Icon: DollarSign, label: "Deal" } }`. `getDetailHref` returns only the deal_closed branch. Imports simplified to `{ Bell, DollarSign }` — legacy icons (AlertTriangle, UserX, UserMinus, FileText) removed. |
| 4 | `/api/alerts/dismiss` route, `alert_dismissals` table, dismissal uniqueness contract all unchanged | VERIFIED | No changes to `src/app/api/alerts/dismiss/route.ts` (git log for phase 65 touches 0 files in `api/alerts/`). Dismissal route accepts any `alert_key` string (Zod `z.string().min(1).max(200)`) so `deal_closed:<uuid>` keys work verbatim. `alert_dismissals` uniqueness `(owner_id, alert_key)` inherited from migration 00004 — unchanged. |
| 5 | New deal POST → exactly one `deal_closed` alert appears on next owner feed render | VERIFIED | The feed is an SSR page (no `unstable_cache` wrapper on the page itself). Every request rebuilds the alert list from a live `deals` SELECT. `src/app/api/deals/route.ts` already calls `revalidateTag("badges", "default")` on deal insert (lines 184 and 219), which busts the `sidebar-badges-v2` cache so the sidebar badge increments in lockstep. |
| 6 | Dismissed `deal_closed` alerts stay dismissed across reloads | VERIFIED | Page query `from("alert_dismissals").select("alert_key").eq("owner_id", user.id)` is executed on every render and mapped into a `Set<string>`. Every alert row sets `dismissed: dismissedKeys.has(key)` on map construction — persistent across reload. |
| 7 | Migration 00036 rewrites `get_sidebar_badges` OWNER branch; defensive DROP; exactly one `pg_proc` row post-migration; cache-key bump in same commit | VERIFIED | `supabase/migrations/00036_prune_owner_alerts_to_deal_closed.sql` contains the `DO $drop$` block iterating `pg_get_function_identity_arguments` for `get_sidebar_badges`, then `CREATE OR REPLACE FUNCTION public.get_sidebar_badges(p_user_id uuid, p_role text)`. OWNER branch body: `SELECT COUNT(*) FROM deals d WHERE d.created_at >= NOW() - INTERVAL '30 days'` minus a dismissal count joined on `split_part(ad.alert_key, ':', 2) = d.id::text`. `GREATEST(0, …)` preserved. Cache key bumped from `["sidebar-badges"]` to `["sidebar-badges-v2"]` in `src/app/(dashboard)/layout.tsx` in the same commit (`d793de7`). `npx supabase db push` applied cleanly on top of 00035. |
| 8 | Coach alerts feed unaffected — COACH branch of get_sidebar_badges preserved verbatim (unreviewed_reports + coach_milestone_alerts still counted) | VERIFIED | Migration 00036 COACH branch copies lines 61-100 of 00029 byte-for-byte: `daily_reports` unreviewed count + 100h_milestone loop + `alert_key LIKE '100h_milestone:%'` dismissal subtract. Returns `jsonb_build_object('unreviewed_reports', …, 'coach_milestone_alerts', …)`. STUDENT branch also unchanged (`RETURN '{}'::jsonb`). `src/components/coach/*` not touched in phase 65. |
| 9 | Build gate passes: `npm run lint && npx tsc --noEmit && npm run build` exits 0 | VERIFIED | Lint: 0 errors, 4 pre-existing warnings (unrelated to phase 65 code — student/loading.tsx, CalendarTab.tsx, WorkTrackerClient.tsx, Modal.tsx). tsc: 0 errors. Build: `Compiled successfully in 7.1s`, all owner routes including `/owner/alerts` rendered. |

## Requirements Coverage

| REQ-ID | Plan | Status |
|--------|------|--------|
| OAL-01 | 65-02 | Covered — feed generator emits `type:"deal_closed"`, title/message/subjectId/triggeredAt/key per spec |
| OAL-02 | 65-02 | Covered — 4 legacy alert types fully removed from page generator, no tombstone |
| OAL-03 | 65-02 | Covered — `AlertItem.type` union narrowed, `TYPE_CONFIG` rewritten, DollarSign + ima-success tokens |
| OAL-04 | 65-02 | Covered — `/api/alerts/dismiss`, `alert_dismissals` unchanged; orphan rows preserved |
| OAL-05 | 65-02 | Covered — SSR-dynamic feed + existing `revalidateTag("badges")` in POST /api/deals |
| OAL-06 | 65-02 | Covered — `dismissedKeys` set join preserved; reuses existing query |
| OAL-07 | 65-01 | Covered — migration 00036 rewrites OWNER branch, defensive DROP, cache-key bump |
| OAL-08 | 65-01 | Covered — COACH branch of get_sidebar_badges preserved byte-for-byte; coach components untouched |
| OAL-09 | 65-01, 65-02 | Covered — 30-day trailing filter applied consistently in both the feed (`gte(created_at, thirtyDaysAgoIso)`) and the RPC (`>= NOW() - INTERVAL '30 days'`) |

## Build Gate

- `npm run lint` → 0 errors, 4 pre-existing warnings (not phase 65 code)
- `npx tsc --noEmit` → exit 0
- `npm run build` → `Compiled successfully in 7.1s`
- `npx supabase db push` → applied migrations 00033, 00034, 00035, 00036 cleanly to remote

## Human UAT Deferred

Per `feedback_batch_uat_end_of_milestone` memory — autonomous multi-phase runs skip per-phase manual UAT. The following visual/interactive checks are batched to end-of-v1.8:

- Render `/owner/alerts` in dev mode and confirm one card per deal with correct title/message/link.
- Dismiss a `deal_closed` alert and confirm the sidebar badge count decreases by 1.
- Create a deal via `/api/deals`, reload `/owner/alerts`, confirm the new alert appears.
- Verify coach alerts (`/coach/alerts`) unchanged.

Code-level verification (shape, invariants, must-haves) completed autonomously.

## Commits

- `97170b2` — docs(65): auto-generated context
- `2c969af` — docs(65): add phase plans
- `d793de7` — feat(65-01): migration 00036 + cache-key bump
- `f949886` — feat(65-02): feed rewrite + AlertItem shape update
