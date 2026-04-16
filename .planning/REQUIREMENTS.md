# Milestone v1.7 Requirements — Student Referral Links (Rebrandly)

**Goal:** Students and student_diy users can generate and share a personal Rebrandly short link from their dashboard to refer friends for a $500 bonus — idempotent, cached forever after first generation.

**Status:** Roadmapped — 3 phases (58–60), 19/19 requirements mapped.
**Last updated:** 2026-04-15

---

## v1.7 Requirements

### Database (DB)

- [x] **DB-01**: Migration `supabase/migrations/00031_referral_links.sql` adds two nullable columns to `public.users`: `referral_code` (`varchar(12)`, UNIQUE where NOT NULL) and `referral_short_url` (`text`). Runs cleanly on top of `00030`.
- [x] **DB-02**: The same migration backfills `referral_code` for every existing `student` and `student_diy` row using `upper(substr(md5(id::text), 1, 8))`. Owner and coach rows are left untouched (still NULL).
- [x] **DB-03**: `referral_code` uniqueness is enforced by index (UNIQUE where NOT NULL) so collisions surface at write time, not silently.

### API (API)

- [x] **API-01**: `POST /api/referral-link` authenticates the caller via `getSessionUser()` and rejects any role other than `student` or `student_diy` with HTTP 403. Unauthenticated requests return 401.
- [x] **API-02**: On each call, the endpoint loads the caller's `referral_code` and `referral_short_url` from `public.users` via the admin client. If `referral_short_url` is already set, it is returned immediately — no Rebrandly call made.
- [x] **API-03**: If `referral_code` is NULL at request time (e.g. for a future role added outside backfill scope), the endpoint generates one (`upper(uuid.slice(0, 8))`) and persists it before calling Rebrandly.
- [x] **API-04**: On first call, the endpoint POSTs to `https://api.rebrandly.com/v1/links` with `Content-Type: application/json` + `apikey: process.env.REBRANDLY_API_KEY`, body `{ destination: "https://www.imaccelerator.com/?ref={CODE}", title: "IMA Referral – {user.name}" }`. Must check `response.ok` before parsing (CLAUDE.md Hard Rule 6).
- [x] **API-05**: The endpoint persists the returned `shortUrl` into `public.users.referral_short_url` and responds with JSON `{ shortUrl, referralCode }`.
- [x] **API-06**: Rebrandly failures (non-OK response, thrown error, or timeout) produce HTTP 502, a `console.error` with the underlying cause, and do not corrupt DB state (never persists a partial row). CLAUDE.md Hard Rule 5 (never swallow errors) observed.
- [x] **API-07**: Missing `REBRANDLY_API_KEY` env var returns HTTP 500 with a clear `console.error` (e.g. "REBRANDLY_API_KEY not configured") — the route does not crash and the dashboard continues to load.
- [x] **API-08**: Request input (body, if any) parsed with Zod `safeParse` and `import { z } from "zod"` (CLAUDE.md Hard Rule 7). Auth + role check runs BEFORE validation.

### UI (UI)

- [ ] **UI-01**: `src/components/student/ReferralCard.tsx` is a `"use client"` component that takes no props and fetches its own state from `POST /api/referral-link`.
- [ ] **UI-02**: Initial state shows a card with the $500 referral headline/description (professional, one-sentence; no hype, no emoji, no exclamation marks) and a "Get My Link" button. Button has `min-h-[44px]` (Hard Rule 2).
- [ ] **UI-03**: Loading state shows a spinner inside the button while the fetch is in flight. Spinner uses `motion-safe:animate-spin` (Hard Rule 1).
- [ ] **UI-04**: Ready state displays the short URL, a Copy button (toggles to "Copied!" + check icon for 2 s), and a Share button (Web Share API; hidden when `navigator.share` is unavailable). All interactive elements meet 44 px touch targets.
- [ ] **UI-05**: Card style matches existing dashboard cards: `bg-ima-surface border border-ima-border rounded-xl p-6`. All colors use `ima-*` tokens only (Hard Rule 8). Decorative icons have `aria-hidden="true"`; icon-only buttons have `aria-label` (Hard Rule 3).
- [ ] **UI-06**: Fetch errors are surfaced to the user (toast or inline error) and logged with `console.error` — never silently swallowed (Hard Rule 5). `response.ok` is checked before JSON parse (Hard Rule 6).

### Integration (INT)

- [ ] **INT-01**: `<ReferralCard />` is imported and rendered at the bottom of `src/app/(dashboard)/student/page.tsx`, inside a `mt-6` wrapper, below the Deals Stat Cards grid.
- [ ] **INT-02**: `<ReferralCard />` is imported and rendered at the bottom of `src/app/(dashboard)/student_diy/page.tsx` in the same `mt-6` position. Server component rendering a client component is acceptable — no data passing required.

### Config & Ops (CFG)

- [x] **CFG-01**: `.env.local.example` gets a commented section and `REBRANDLY_API_KEY=` (empty value) so onboarding devs know the key is required.
- [x] **CFG-02**: Post-phase build gate (`npm run lint && npx tsc --noEmit && npm run build`) passes with zero errors for every phase in v1.7.

---

## Future Requirements

<!-- Deferred to later milestones. -->

- Admin/owner/coach referral management dashboard (visibility into who referred whom, aggregate counts)
- Referral click-count ingestion (Rebrandly analytics API or webhook)
- Automated $500 payout / credit tracking system tied to referred user's successful onboarding
- Custom Rebrandly branded domain (replace default `rebrand.ly` host)
- Landing page `?ref={CODE}` capture + attribution persistence through registration

## Out of Scope

<!-- Explicit exclusions with reasoning. -->

- **Payout tracking / $500 credit system** — this milestone is link generation only; payout is a separate product decision.
- **Referral analytics UI** — click counts and conversion dashboards are a future milestone; not needed for MVP.
- **Admin/owner/coach referral management page** — out of scope per spec; no stakeholder-driven workflow yet.
- **Registration / onboarding flow changes** — referral capture at signup is not in v1.7. The link works as a pure marketing asset.
- **Landing page changes** — `imaccelerator.com` is an external site; out of repo scope.
- **Custom Rebrandly domain** — per spec: "use their default `rebrand.ly`".
- **Rate limiting on `/api/referral-link`** — endpoint is idempotent and cached; cost per user is exactly one Rebrandly call for life. Reuse existing rate-limit infra at coach/owner scope only if needed in a later hardening phase.

---

## Traceability

<!-- Each REQ-ID maps to exactly one phase. CFG-02 is a cross-cutting build gate that applies to every phase (listed on each). -->

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01       | Phase 58 — Schema & Backfill | Complete |
| DB-02       | Phase 58 — Schema & Backfill | Complete |
| DB-03       | Phase 58 — Schema & Backfill | Complete |
| API-01      | Phase 59 — Referral API + Rebrandly | Complete |
| API-02      | Phase 59 — Referral API + Rebrandly | Complete |
| API-03      | Phase 59 — Referral API + Rebrandly | Complete |
| API-04      | Phase 59 — Referral API + Rebrandly | Complete |
| API-05      | Phase 59 — Referral API + Rebrandly | Complete |
| API-06      | Phase 59 — Referral API + Rebrandly | Complete |
| API-07      | Phase 59 — Referral API + Rebrandly | Complete |
| API-08      | Phase 59 — Referral API + Rebrandly | Complete |
| UI-01       | Phase 60 — ReferralCard UI & Dashboard Integration | Pending |
| UI-02       | Phase 60 — ReferralCard UI & Dashboard Integration | Pending |
| UI-03       | Phase 60 — ReferralCard UI & Dashboard Integration | Pending |
| UI-04       | Phase 60 — ReferralCard UI & Dashboard Integration | Pending |
| UI-05       | Phase 60 — ReferralCard UI & Dashboard Integration | Pending |
| UI-06       | Phase 60 — ReferralCard UI & Dashboard Integration | Pending |
| INT-01      | Phase 60 — ReferralCard UI & Dashboard Integration | Pending |
| INT-02      | Phase 60 — ReferralCard UI & Dashboard Integration | Pending |
| CFG-01      | Phase 58 — Schema & Backfill | Complete |
| CFG-02      | Phases 58, 59, 60 (cross-cutting build gate) | Complete |

**Coverage:** 19/19 requirements mapped to exactly one phase (CFG-02 is a per-phase gate, applied to all three).
