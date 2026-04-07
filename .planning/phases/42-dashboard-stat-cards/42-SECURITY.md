---
phase: 42
slug: dashboard-stat-cards
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-07
---

# Phase 42 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client -> server component | No boundary crossed — server-rendered pages with no client input for deals query | None (SSR only) |
| server component -> database | Admin client queries deals table; user.id from authenticated session via `requireRole()` | deals.revenue, deals.profit (financial, per-student) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-42-01 | Information Disclosure | deals query in student/page.tsx | mitigate | `.eq("student_id", user.id)` filters to authenticated user's own deals only | closed |
| T-42-02 | Information Disclosure | deals query in student_diy/page.tsx | mitigate | `.eq("student_id", user.id)` filters to authenticated user's own deals only | closed |
| T-42-03 | Elevation of Privilege | unauthorized role access to dashboard | accept | `requireRole("student")` / `requireRole("student_diy")` enforce role gates at page entry | closed |
| T-42-04 | Denial of Service | unbounded deals query | accept | `.select("revenue, profit")` returns only 2 columns; practical deal count per student is low | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-42-01 | T-42-03 | Role gates (`requireRole`) already enforce access control at page entry — no additional mitigation needed | gsd-security-audit | 2026-04-07 |
| AR-42-02 | T-42-04 | Deals query returns only 2 columns; student deal count is practically bounded (tens, not thousands); no pagination needed | gsd-security-audit | 2026-04-07 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-07 | 4 | 4 | 0 | gsd-security-audit |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-07
