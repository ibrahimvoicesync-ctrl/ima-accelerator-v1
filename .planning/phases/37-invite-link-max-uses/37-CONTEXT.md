# Phase 37: Invite Link max_uses - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Magic link invites default to 10 uses and display a live usage count; registration via an exhausted link is rejected. Existing null-max_uses links are grandfathered as unlimited.

</domain>

<decisions>
## Implementation Decisions

### Max uses form input
- **D-01:** Simple number input field with default value of 10 pre-filled, range 1-10,000
- **D-02:** Plain number input placed next to the "Generate Invite Link" button, labeled "Max uses"
- **D-03:** Default pre-filled so most users click generate without thinking about it — low friction

### Unlimited option
- **D-04:** No unlimited option for new links — every new link gets a cap (default 10)
- **D-05:** Existing links with null max_uses are grandfathered and display as "∞"
- **D-06:** Cannot create new unlimited links going forward — prevents accidental open-ended invite links

### Usage display format
- **D-07:** Show "X / Y used" as text below each magic link card (e.g., "3 / 10 used")
- **D-08:** When exhausted (use_count >= max_uses), show in ima-danger color with "Exhausted" badge
- **D-09:** For grandfathered unlimited links, show "X / ∞ used" in normal color
- **D-10:** No progress bar — just text

### Claude's Discretion
- Migration strategy (ALTER DEFAULT vs application-only default)
- Zod schema shape for the max_uses field on POST /api/magic-links
- Exact placement/sizing of the number input in the form layout

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md.

### Requirements
- `.planning/REQUIREMENTS.md` — INVITE-01, INVITE-02, INVITE-03 define the three acceptance criteria

### Roadmap
- `.planning/ROADMAP.md` §Phase 37 — Success criteria with grandfathering rule and display format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/magic-links/route.ts` — POST handler currently sets `max_uses: null`; needs change to `10` + accept override from body
- `src/app/api/auth/callback/route.ts:199` — Already enforces `max_uses` cap with optimistic locking on `use_count` (INVITE-03 is done)
- `src/app/(auth)/register/page.tsx:83-84` — Already rejects exhausted links at the register page level
- `src/components/coach/CoachInvitesClient.tsx` — Has MagicLinkItem type with `use_count` and `max_uses`; display at lines 405-406 needs format update
- `src/components/owner/OwnerInvitesClient.tsx` — Mirror of coach component; same display update needed at lines 410-411
- `src/lib/types.ts:116-117` — `max_uses: number | null` and `use_count: number` already in Row type

### Established Patterns
- Zod safeParse on all API inputs (`z.object({...}).safeParse(body)`)
- CVA-based UI primitives (Input, Button, Card components)
- Optimistic UI updates in invite client components
- `checkRateLimit()` on all mutation routes
- `verifyOrigin()` CSRF on all mutation routes

### Integration Points
- POST /api/magic-links — add `max_uses` to Zod schema and insert
- CoachInvitesClient + OwnerInvitesClient — add number input to form, update display format
- Database migration — ALTER COLUMN SET DEFAULT 10

</code_context>

<specifics>
## Specific Ideas

- "Default pre-filled so most users just click generate without thinking about it" — low friction UX priority
- "Prevents accidental open-ended invite links" — safety rationale for no-unlimited policy
- Exhausted links get ima-danger color + "Exhausted" badge — visual urgency
- Grandfathered unlimited links show "∞" in normal color — no alarm for legacy links

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-invite-link-max-uses*
*Context gathered: 2026-04-04*
