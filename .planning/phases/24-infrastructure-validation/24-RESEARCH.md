# Phase 24: Infrastructure & Validation - Research

**Researched:** 2026-03-30
**Domain:** k6 load testing, Supabase staging environment, JWT pre-generation, SQL seed scripting, capacity documentation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Separate staging Supabase project, same compute tier and region as production. Do NOT run against production.
- **D-02:** Local Supabase is excluded — won't give realistic latency numbers or PostgREST connection pooling behavior.
- **D-03:** Keep the staging project after Phase 24 for future v1.3+ regression testing. Do not tear down.
- **D-04:** Generate one JWT per seeded student (5,000 tokens total) using the service_role key. Each k6 VU gets a unique user's token so it has its own rate limit bucket per endpoint.
- **D-05:** Bypass Supabase Auth login flow entirely — pre-generated static JWTs avoid Pitfall 14 (Auth rate limits on test accounts).
- **D-06:** SQL seed script generates 5,000 students with ~90 days of reports (~500k rows in daily_reports, proportional rows in work_sessions and roadmap_progress).
- **D-07:** Realistic distribution — 80% of daily report timestamps clustered in the 9-11 PM UTC window to simulate the real submission spike pattern.
- **D-08:** Seed script also creates coach and owner users for dashboard read scenarios.
- **D-09:** Scenarios per requirements: owner dashboard read mix (RPC calls, paginated lists, badge counts), student 11 PM write spike (report submission + work session start/complete), and mixed traffic combining both.
- **D-10:** k6 v1.7.0 standalone CLI (not npm package).
- **D-11:** P95 latency must be under 1 second for all endpoints during load test.
- **D-12:** Connection usage above 70% of max_connections during spike triggers a compute tier upgrade decision.
- **D-13:** Redis/Upstash go/no-go requires BOTH conditions met: unstable_cache miss rate > 30% under load AND P95 exceeds 1s. If only one condition is met, Redis is not adopted.
- **D-14:** All threshold numbers documented in the capacity report so decisions are objective.
- **D-15:** k6 natively captures P50/P95/P99 latencies and throughput metrics.
- **D-16:** Connection counts and pool usage captured from Supabase dashboard during test runs (manual capture, not automated polling).
- **D-17:** Rate limiter trigger counts verified by querying rate_limit_log table after test completion.

### Claude's Discretion

- k6 script structure and VU ramp profiles (stages, duration, concurrency)
- Exact seed script implementation details (SQL functions, batch sizes, random data generation)
- Capacity document format and layout
- Whether to use k6 cloud or local execution
- pg_stat_statements queries to capture before/during/after metrics
- Migration file naming for any staging-specific setup

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | k6 load test simulates 5k students with dashboard read mix and 11 PM write spike | k6 v1.7.0 confirmed installed; SharedArray VU token distribution pattern; ramping-vus executor; threshold syntax for P95 < 1s |
| INFRA-02 | Connection usage, query times, and capacity headroom are documented | pg_stat_statements queries; Supabase dashboard connection monitoring; rate_limit_log post-run query; capacity document structure |
| INFRA-03 | Supabase compute add-on is right-sized based on load test data | Decision criteria (D-11, D-12, D-13) documented; outcome written to PROJECT.md Key Decisions |
</phase_requirements>

---

## Summary

Phase 24 is the final validation phase for v1.2. All infrastructure improvements (indexes, admin singleton, RPC consolidation, caching, rate limiting, CSRF hardening, security audit) are complete. This phase answers the question: does the platform hold up under 5,000 concurrent students at the nightly submission spike?

The work divides into four sequential concerns: (1) staging environment provisioning — a fresh Supabase project with migrations applied, same compute tier as production; (2) seed data generation — 5,000 students with ~90 days of daily_reports (~500k rows), realistically distributed with 80% of timestamps in the 9-11 PM UTC window; (3) JWT pre-generation — one static token per seeded student minted with the JWT secret, stored in a JSON file for k6's SharedArray to distribute across VUs (bypasses Supabase Auth rate limits entirely); and (4) k6 load test execution — three scenarios (read mix, write spike, combined) with documented P50/P95/P99 outputs and connection count snapshots.

The critical non-obvious fact is that k6 on this Windows machine runs k6.exe from `C:\Program Files\k6\k6.exe` — it is NOT in PATH as `k6`, so scripts must invoke it as `"/c/Program Files/k6/k6.exe"` or the planner must add the absolute path to test run commands. The planner should also note that the staging Supabase project is a human-provisioned prerequisite: the developer must create a new project in the Supabase dashboard and apply migrations via `supabase db push` before any seed or test scripts run.

**Primary recommendation:** Build seed SQL + JWT pre-generation script as Wave 0 blockers. No load test can run without them. k6 scripts are Wave 1. Capacity documentation is Wave 2 (post-run artifact).

---

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| k6 | v1.7.0 (confirmed installed) | Load test runner | Locked by D-10; confirmed at `C:\Program Files\k6\k6.exe` |
| Node.js | v24.13.0 (confirmed installed) | JWT pre-generation script | Already in project for npm; `jsonwebtoken` or `fast-jwt` used to mint tokens |
| Supabase CLI | v2.78.1 (in devDependencies) | Apply migrations to staging project | `supabase link` + `supabase db push` workflow |
| PostgreSQL (Supabase) | Supabase Pro plan | Staging database | Same tier as production per D-01 |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| jsonwebtoken | ^9.x (npm install) | Mint static JWTs for VU pool | JWT pre-gen script — signs payload with Supabase JWT secret |
| pg_stat_statements | Supabase Pro built-in | Query timing before/during/after | Run SQL queries against staging during test runs |
| Supabase Dashboard | — | Connection count monitoring | Manual capture per D-16 during spike scenario |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| k6 local execution | k6 Cloud | k6 Cloud adds cost, not needed for one-time validation |
| jsonwebtoken | fast-jwt | Both work; jsonwebtoken is more common in the ecosystem |
| Manual dashboard monitoring | Automated pg_stat polling | Automation adds complexity; manual is sufficient for one-time test |

**Installation (for JWT script only):**
```bash
npm install jsonwebtoken
```

k6 is already installed at `C:\Program Files\k6\k6.exe`. No PATH modification needed if scripts invoke it with the full path.

---

## Architecture Patterns

### Recommended Directory Structure

```
load-tests/
├── tokens/
│   └── student_tokens.json     # 5,000 pre-generated JWTs (gitignored — contains signed JWTs)
├── seed/
│   └── 00001_staging_seed.sql  # SQL seed script: 5k students, 500k reports
├── scripts/
│   └── gen-tokens.js           # Node.js: reads student UUIDs, mints JWTs, writes tokens JSON
├── scenarios/
│   ├── read-mix.js             # Owner dashboard RPC + paginated list scenario
│   ├── write-spike.js          # Student report submission + work session scenario
│   └── combined.js             # Mixed traffic scenario
└── CAPACITY.md                 # Filled in after test runs
```

`load-tests/tokens/student_tokens.json` MUST be in `.gitignore` — it contains signed JWTs equivalent to authenticated sessions for 5,000 users.

### Pattern 1: VU Token Distribution via SharedArray

Each k6 VU picks a unique pre-generated JWT using its VU index modulo pool size. This gives every VU its own rate limit bucket (D-04) and avoids Auth rate limits (D-05).

```javascript
// Source: k6 official docs + catjam.fi/articles/supabase-gen-access-token pattern
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check } from 'k6';

const tokens = new SharedArray('student-tokens', function () {
  return JSON.parse(open('../tokens/student_tokens.json'));
});

export default function () {
  // Each VU picks from the pool; modulo prevents out-of-bounds
  const token = tokens[(__VU - 1) % tokens.length];

  const res = http.post(
    `${__ENV.STAGING_URL}/api/reports`,
    JSON.stringify({ /* report payload */ }),
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Origin': __ENV.STAGING_URL,
      },
    }
  );

  check(res, { 'status is 201': (r) => r.status === 201 });
}
```

**Important:** The `Origin` header must be set on every request — the app's `verifyOrigin()` CSRF helper runs on all mutation routes and will return 403 if Origin is missing.

### Pattern 2: k6 Thresholds for Pass/Fail

```javascript
// Source: grafana.com/docs/k6/latest/using-k6/thresholds/
export const options = {
  thresholds: {
    // P95 under 1 second (D-11)
    'http_req_duration': ['p(95)<1000'],
    // Error rate under 1%
    'http_req_failed': ['rate<0.01'],
  },
};
```

### Pattern 3: Ramping VU Spike Profile

The 11 PM spike scenario: ramp from 0 to peak VUs quickly, sustain, then ramp down.

```javascript
// Source: grafana.com/docs/k6/latest/using-k6/scenarios/
export const options = {
  scenarios: {
    write_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },   // ramp up — 500 VUs simulating spike onset
        { duration: '5m', target: 500 },   // sustain peak
        { duration: '1m', target: 0 },     // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'http_req_failed': ['rate<0.01'],
  },
};
```

VU count of 500 for the write spike (not 5,000) because each VU iterates multiple times — 500 VUs × 10 iterations over 5 minutes approximates 5,000 concurrent student submissions.

### Pattern 4: JWT Pre-Generation Script

```javascript
// load-tests/scripts/gen-tokens.js
// Run: node gen-tokens.js <staging-supabase-url> <staging-anon-key> <jwt-secret>
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Student UUIDs are queried from staging DB or embedded from seed
// Assumes staging DB seeded; query via Supabase REST or use UUIDs directly from seed

const JWT_SECRET = process.env.STAGING_JWT_SECRET;
const tokens = studentUUIDs.map((userId, i) => {
  const payload = {
    sub: userId,
    email: `student${i}@test.ima`,
    role: 'authenticated',
    aud: 'authenticated',
    // Long expiry — 7 days so tokens survive multi-day test sessions
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
});

fs.writeFileSync(
  './tokens/student_tokens.json',
  JSON.stringify(tokens, null, 2)
);
```

**Required JWT claims** (verified against Supabase JWT docs):
- `sub` — the user's UUID from the `users` table (must match a real row)
- `role` — must be `"authenticated"` for PostgREST to apply RLS/grants
- `aud` — `"authenticated"`
- `exp` — future Unix timestamp in seconds

### Pattern 5: SQL Seed Script Structure

```sql
-- load-tests/seed/00001_staging_seed.sql
-- Generates 5,000 student users + proportional data rows

DO $$
DECLARE
  i INTEGER;
  student_id UUID;
  coach_id UUID;
  report_date DATE;
  submission_hour INTEGER;
BEGIN
  -- Insert test coaches first (10 coaches for 5000 students, 500:1 ratio)
  FOR i IN 1..10 LOOP
    INSERT INTO public.users (id, email, name, role, status)
    VALUES (gen_random_uuid(), 'coach' || i || '@test.ima', 'Test Coach ' || i, 'coach', 'active')
    RETURNING id INTO coach_id;
  END LOOP;

  -- Insert 5,000 students
  FOR i IN 1..5000 LOOP
    student_id := gen_random_uuid();
    INSERT INTO public.users (id, email, name, role, status, coach_id)
    VALUES (
      student_id,
      'student' || i || '@test.ima',
      'Test Student ' || i,
      'student',
      'active',
      (SELECT id FROM public.users WHERE role = 'coach' ORDER BY random() LIMIT 1)
    );

    -- ~90 days of reports per student (~500k total rows)
    FOR d IN 0..89 LOOP
      report_date := CURRENT_DATE - d;

      -- 80% of reports get 9-11 PM UTC submission time (D-07)
      IF random() < 0.8 THEN
        submission_hour := 21 + floor(random() * 2)::int; -- 21 or 22 UTC
      ELSE
        submission_hour := floor(random() * 21)::int; -- any other hour
      END IF;

      INSERT INTO public.daily_reports (
        student_id, date, hours_worked, star_rating,
        brands_contacted, influencers_contacted, calls_joined,
        submitted_at
      ) VALUES (
        student_id, report_date,
        2 + floor(random() * 6)::numeric,
        1 + floor(random() * 5)::int,
        floor(random() * 10)::int,
        floor(random() * 5)::int,
        floor(random() * 3)::int,
        (report_date + make_interval(hours => submission_hour))::timestamptz
      );
    END LOOP;
  END LOOP;
END;
$$;
```

**Performance note:** Inserting 500k rows in a DO block is slow. The planner should structure this as batched inserts or use `COPY` for performance (see Pitfalls section).

### Pattern 6: k6 Result Output for Capacity Documentation

```bash
# Run with JSON output for post-processing + summary stats
"/c/Program Files/k6/k6.exe" run \
  --summary-trend-stats="med,p(95),p(99)" \
  --out json=results/write-spike-results.json \
  scenarios/write-spike.js
```

The `--summary-trend-stats` flag controls what percentiles appear in the end-of-test summary printed to the terminal. The `--out json=...` flag writes per-request data to a file for later analysis.

### Anti-Patterns to Avoid

- **Authenticating in k6 setup():** Calling Supabase Auth `/token` endpoint from k6 triggers Auth rate limits — use pre-generated static JWTs only (Pitfall 14).
- **Missing Origin header on mutation requests:** `verifyOrigin()` CSRF check in every mutation route returns 403 without it — set `Origin: <staging-url>` on every POST/PATCH/DELETE request.
- **Running seed script against production:** Seed creates 5,000 users with test emails — this would pollute the user table and hit real rate limits (D-01).
- **Seeding inside k6 setup():** 500k row inserts take minutes — pre-seed before test runs, not inside k6 lifecycle.
- **Using `count: 'exact'` on rate_limit_log:** The `checkRateLimit()` function uses `count: 'exact'` — at 500 VUs × 30 req/min this generates ~15,000 count queries per minute against the rate_limit_log table; verify the covering index handles this (index confirmed in migration 00012).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT generation | Custom base64 encode | `jsonwebtoken` npm package | Edge cases in HS256 signing; wrong padding breaks token validation |
| Percentile calculation | Post-process raw timings | k6 built-in `p(95)` metric | k6 handles reservoir sampling correctly at scale |
| Load ramp profiles | Custom sleep() loops | k6 ramping-vus executor | k6 handles VU lifecycle, connections, and graceful shutdown |
| Seed data randomness | Custom rand functions | PostgreSQL `random()` + `generate_series()` | Portable, no external deps, runs in Supabase SQL editor |
| Connection count polling | cURL loop during test | Supabase dashboard + pg_stat_activity query | Dashboard is real-time; pg_stat_activity gives exact count |

**Key insight:** The test infrastructure (JWT generation, seed SQL, k6 scripts) is one-time tooling. It does not need to be production-quality or reusable beyond Phase 24. Prefer simple and correct over clever and reusable.

---

## Common Pitfalls

### Pitfall 1: k6 Not in PATH on Windows
**What goes wrong:** Running `k6 run script.js` from bash fails with "command not found". k6 is installed via winget to `C:\Program Files\k6\k6.exe` but is not added to the bash PATH automatically.
**Why it happens:** winget installs update the Windows PATH (System env vars) but bash sessions started before the install, or WSL/Git Bash sessions, may not pick up the new PATH entry.
**How to avoid:** All k6 invocations in this phase must use the full path: `"/c/Program Files/k6/k6.exe" run ...`. The planner MUST use this form in all task commands.
**Warning signs:** `bash: k6: command not found` even though winget confirms v1.7.0 is installed.

### Pitfall 2: CSRF 403 on All k6 Mutation Requests
**What goes wrong:** Every POST/PATCH/DELETE request from k6 returns 403 immediately. Rate limit counters never increment. Load test shows 100% error rate.
**Why it happens:** Phase 23 added `verifyOrigin()` to all 10 mutation routes. k6 requests have no `Origin` header by default. The CSRF check fails before auth even runs.
**How to avoid:** Every k6 mutation request must include `'Origin': __ENV.STAGING_URL` in the headers object. The staging URL must match the app host header for `verifyOrigin()` to pass.
**Warning signs:** All mutations return 403, reads return 200.

### Pitfall 3: Auth JWT `sub` Must Match a Row in `users` Table
**What goes wrong:** k6 requests return 200 but API routes return 401 "Unauthorized" because `getAdminClient().from("users").select().eq("id", authUser.id)` finds no row.
**Why it happens:** API routes do auth check (Supabase Auth `getUser()`), then immediately look up the user's profile in the `users` table. The seeded users exist in `public.users` but NOT in `auth.users` (they were direct inserts, not Auth signups). When a JWT with `sub=<uuid>` is presented, Supabase Auth validates the JWT signature but the profile lookup fails.
**How to avoid:** The seed script must insert users into BOTH `auth.users` (or use `supabase.auth.admin.createUser()`) AND `public.users`. Alternatively, structure API routes so that the auth check only validates the JWT signature (which is what `createClient().auth.getUser()` does with a valid JWT), and the profile comes from `public.users` keyed on `authUser.id`. Confirm the existing route pattern: if routes call `supabase.auth.getUser()` followed by `getAdminClient().from("users").select().eq("id", user.id)`, then BOTH tables need seed rows.
**Warning signs:** Load test shows 401 responses despite valid JWT signatures.

### Pitfall 4: 500k Row Seed Takes Very Long in PL/pgSQL Loop
**What goes wrong:** The DO block seed script inserting 5,000 students × 90 reports runs for 20-40 minutes in a PL/pgSQL loop because each INSERT is a separate transaction.
**Why it happens:** PL/pgSQL `FOR LOOP` over 500k iterations with individual INSERTs is slow — there's transaction overhead per row. The Supabase SQL editor has a 60-second query timeout.
**How to avoid:** Use set-based SQL with `generate_series()` and `INSERT INTO ... SELECT` pattern. A single INSERT selecting from generate_series() inserts all rows in one statement with minimal overhead. For the 500k daily_reports rows, use cross-join between student UUIDs and date range. Seed via `supabase db execute` or a migration file (not the SQL editor which has timeouts).
**Warning signs:** SQL editor shows "query timeout" after 60 seconds; seed never completes.

### Pitfall 5: Rate Limit Triggers Before Connection Exhaustion
**What goes wrong:** Load test P95 latency looks fine but 429 responses inflate the error rate past the threshold. The test fails on `http_req_failed` not on latency.
**Why it happens:** checkRateLimit() enforces 30 req/min per user per endpoint. Each VU has a unique token (D-04) so each VU has its own bucket — but if a VU iterates faster than 30/min (i.e., each iteration < 2 seconds), it will rate-limit itself.
**How to avoid:** k6 scripts must include a `sleep()` between iterations to stay under 30 req/min per VU. `sleep(3)` means 20 req/min per VU, safely below the limit. This is intentional — the goal is to test at realistic request rates, not to spam.
**Warning signs:** 429 errors on load test that correlate with VU count, not total RPS.

### Pitfall 6: pg_cron Aggregation Running During Load Test Skews Results
**What goes wrong:** The `refresh-student-kpi-summaries` pg_cron job runs at 2 AM UTC. If a load test run straddles 2 AM UTC, the aggregation job runs concurrently, consuming DB resources and skewing P95 latency measurements.
**Why it happens:** pg_cron fires regardless of current system load. With 500k rows to aggregate, the job adds measurable CPU/IO pressure.
**How to avoid:** Schedule load test runs to avoid the 2 AM UTC and 3:30 AM UTC windows (both pg_cron job times). Run tests at 10 AM–12 PM UTC to be safely clear of both jobs. If run time cannot be controlled, note the pg_cron job overlap in the capacity document.
**Warning signs:** Latency spike in test results at exactly 2:00 AM UTC or 3:30 AM UTC.

### Pitfall 7: Supabase Staging Project Needs Auth.users Rows for JWT Validation
**What goes wrong:** `createClient().auth.getUser()` returns null for seeded users because Supabase Auth validates the JWT against the `auth.users` table — if the user UUID doesn't exist in `auth.users`, `getUser()` succeeds (signature valid) but returns the user object from the JWT without an `auth.users` row. The issue is that some API patterns then call `getAdminClient().from("users").select()` — if the profile row doesn't exist in `public.users`, the route returns 401/404.
**Why it happens:** Supabase Auth's `getUser()` validates the JWT signature cryptographically — it does NOT require the user to exist in `auth.users` for a valid signed JWT. However `public.users` profile lookup is the second check that fails.
**How to avoid:** Seed script must insert rows into `public.users` with IDs matching the UUIDs used in JWT `sub` claims. The `auth.users` table is NOT strictly required for API routes that use `createClient().auth.getUser()` + `public.users` profile lookup — only `public.users` needs to exist. Verify this by checking the existing auth flow in `src/lib/session.ts`.
**Warning signs:** API routes return 401 despite correct JWT; `getAdminClient().from("users").select().eq("id", sub)` returns empty.

---

## Code Examples

### JWT Pre-Generation (Confirmed Pattern)

```javascript
// load-tests/scripts/gen-tokens.js
// Source: catjam.fi/articles/supabase-gen-access-token (verified approach)
// Usage: STAGING_JWT_SECRET=<secret> node gen-tokens.js
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Read student UUIDs from seed output file (or hardcode from seed script)
const studentIds = JSON.parse(fs.readFileSync('./tokens/student_uuids.json', 'utf8'));
const JWT_SECRET = process.env.STAGING_JWT_SECRET;

if (!JWT_SECRET) {
  console.error('STAGING_JWT_SECRET env var required');
  process.exit(1);
}

const tokens = studentIds.map((userId) => {
  const payload = {
    sub: userId,
    email: `${userId}@test.ima`,   // doesn't need to be real
    role: 'authenticated',
    aud: 'authenticated',
    iss: 'supabase',
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),  // 7 days
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
});

fs.mkdirSync('./tokens', { recursive: true });
fs.writeFileSync('./tokens/student_tokens.json', JSON.stringify(tokens));
console.log(`Generated ${tokens.length} tokens`);
```

### k6 Write Spike Scenario (Core Structure)

```javascript
// load-tests/scenarios/write-spike.js
// Source: grafana.com/docs/k6/latest + verified patterns
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

const tokens = new SharedArray('student-tokens', function () {
  return JSON.parse(open('../tokens/student_tokens.json'));
});

export const options = {
  scenarios: {
    write_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },   // ramp to peak
        { duration: '5m', target: 500 },   // sustain
        { duration: '1m', target: 0 },     // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'],   // D-11
    'http_req_failed': ['rate<0.01'],
  },
};

const STAGING_URL = __ENV.STAGING_URL || 'https://<staging>.supabase.co/functions/v1';

export default function () {
  const token = tokens[(__VU - 1) % tokens.length];
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Origin': __ENV.APP_URL,             // CSRF: must match app host
  };

  // Report submission (write spike target)
  const today = new Date().toISOString().split('T')[0];
  const reportRes = http.post(
    `${__ENV.APP_URL}/api/reports`,
    JSON.stringify({
      date: today,
      hours_worked: 3,
      star_rating: 4,
      brands_contacted: 5,
      influencers_contacted: 2,
      calls_joined: 1,
    }),
    { headers }
  );

  check(reportRes, { 'report created or already exists': (r) => r.status === 201 || r.status === 409 });

  sleep(3);  // Stay under 30 req/min per VU (D-04 rate limit budget)
}
```

### pg_stat_statements Query for Capacity Document

```sql
-- Run during/after load test to capture slow queries
-- Source: Supabase Pro pg_stat_statements extension
SELECT
  query,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2)  AS mean_ms,
  round(
    (percentile_cont(0.95) WITHIN GROUP (ORDER BY mean_exec_time))::numeric,
    2
  ) AS p95_approx_ms,
  rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Connection Count Query

```sql
-- Run during spike to capture max connection usage
-- Source: Postgres docs pg_stat_activity
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle')   AS idle,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections,
  round(
    count(*) * 100.0 /
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'),
    1
  ) AS pct_used
FROM pg_stat_activity
WHERE datname = current_database();
```

### Rate Limit Trigger Count Query (D-17)

```sql
-- Run after test completion to count triggered rate limits
-- Source: rate_limit_log table (migration 00012)
SELECT
  endpoint,
  count(*) AS total_calls,
  count(DISTINCT user_id) AS unique_users
FROM rate_limit_log
WHERE called_at > now() - interval '30 minutes'
GROUP BY endpoint
ORDER BY total_calls DESC;
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| k6 | Load test execution (INFRA-01) | Yes (not in PATH) | v1.7.0 at `C:\Program Files\k6\k6.exe` | — |
| Node.js | JWT pre-generation script | Yes | v24.13.0 | — |
| npm | Install jsonwebtoken | Yes | v11.6.2 | — |
| Supabase CLI | Apply migrations to staging | Yes (devDep v2.78.1) | 2.78.1 | — |
| Staging Supabase project | All test execution | NOT YET CREATED | — | Human must create in Supabase dashboard |
| jsonwebtoken | JWT pre-gen script | Not installed | — | `npm install jsonwebtoken` |

**Missing dependencies with no fallback:**
- **Staging Supabase project** — Must be created manually in the Supabase dashboard before any task in this phase can execute. This is a human-action prerequisite. The plan must include a Wave 0 task flagged as requires-human action.

**Missing dependencies with fallback:**
- `jsonwebtoken` — Install with `npm install jsonwebtoken`. One command, no human action needed.

**k6 PATH note:** k6 v1.7.0 is confirmed installed but NOT in bash PATH. All task commands must use `"/c/Program Files/k6/k6.exe"` as the binary path.

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | k6 v1.7.0 (load test) — no unit test framework in project |
| Config file | `load-tests/scenarios/*.js` — k6 options embedded in each script |
| Quick run command | `"/c/Program Files/k6/k6.exe" run --vus 5 --duration 30s load-tests/scenarios/write-spike.js` |
| Full suite command | `"/c/Program Files/k6/k6.exe" run --summary-trend-stats="med,p(95),p(99)" load-tests/scenarios/write-spike.js` |

**Note:** There is no existing unit test infrastructure in this project (no jest.config, no vitest.config, no test/ directory). Phase 24 validation is entirely load-test-based — the "tests" are k6 scenario scripts. Standard nyquist sampling (per-task quick run, per-wave full suite) applies to the k6 scripts.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | k6 simulates 5k student load, read mix + write spike | load test | `"/c/Program Files/k6/k6.exe" run load-tests/scenarios/write-spike.js` | Wave 0 |
| INFRA-01 | Owner dashboard read mix scenario | load test | `"/c/Program Files/k6/k6.exe" run load-tests/scenarios/read-mix.js` | Wave 0 |
| INFRA-02 | Connection usage documented < 70% max_connections | manual + SQL | SQL queries against staging DB during test run | Wave 0 (SQL files) |
| INFRA-02 | P50/P95/P99 latency recorded | load test | k6 `--summary-trend-stats="med,p(95),p(99)"` output | Wave 0 |
| INFRA-03 | Compute tier decision written to PROJECT.md | manual | human review of test results | post-run |

### Sampling Rate

- **Per task commit:** `"/c/Program Files/k6/k6.exe" run --vus 5 --duration 30s load-tests/scenarios/write-spike.js` (smoke test with 5 VUs)
- **Per wave merge:** Full scenario run with complete VU ramp profile
- **Phase gate:** All three scenarios (read-mix, write-spike, combined) complete with P95 < 1s; results written to CAPACITY.md; PROJECT.md Key Decisions updated

### Wave 0 Gaps

- [ ] `load-tests/seed/00001_staging_seed.sql` — seed 5k students + 500k reports
- [ ] `load-tests/scripts/gen-tokens.js` — JWT pre-generation script
- [ ] `load-tests/tokens/` directory (gitignored) — output of gen-tokens.js
- [ ] `load-tests/scenarios/write-spike.js` — student report + work session scenario
- [ ] `load-tests/scenarios/read-mix.js` — owner dashboard RPC scenario
- [ ] `load-tests/scenarios/combined.js` — mixed traffic scenario
- [ ] `load-tests/CAPACITY.md` — template with threshold table to fill in
- [ ] Staging Supabase project created + migrations applied (human action)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Authenticate in k6 via login flow | Pre-generated static JWTs | k6 community best practice | Avoids Auth rate limits; each VU gets unique token |
| Single monolithic seed script | generate_series() set-based SQL | Postgres performance practice | Minutes vs hours for 500k rows |
| Manual P95 calculation from logs | k6 `--summary-trend-stats` flag | k6 v0.26+ | Automatic P50/P95/P99 in terminal output |

---

## Open Questions

1. **Auth.users population for seeded users**
   - What we know: `createClient().auth.getUser()` validates JWT signature cryptographically. The route then calls `getAdminClient().from("users").select()` to get the profile.
   - What's unclear: Whether `getUser()` requires the user to exist in `auth.users` or just validates the JWT. If it requires `auth.users`, seeded users need to be created via `supabase.auth.admin.createUser()` — 5,000 API calls.
   - Recommendation: The implementer must check `src/lib/session.ts` `getSessionUser()` to determine if `auth.getUser()` is called. If yes, verify empirically with 1 test user before seeding 5,000. **If auth.users rows are required, use `supabase.auth.admin.createUser()` in a Node.js loop, not SQL inserts.**

2. **Staging project compute tier confirmation**
   - What we know: D-01 requires same compute tier and region as production.
   - What's unclear: The current production compute tier is not documented in any tracked file. The max_connections value (needed for D-12 70% threshold) depends on the tier.
   - Recommendation: Document the production compute tier in the capacity document (look up in Supabase dashboard) before creating the staging project.

3. **APP_URL for k6 — staging app vs direct Supabase URL**
   - What we know: Rate limiting and CSRF are implemented at the Next.js API layer (not at Supabase directly). k6 must target the deployed staging Next.js app, not the Supabase PostgREST URL.
   - What's unclear: Whether a staging Next.js deployment exists or will be created. If not, load tests must target the production app URL (which D-01 forbids).
   - Recommendation: The planner must decide: deploy the app to a staging Vercel/hosting environment, OR acknowledge that some tests (PostgREST RPC reads) can go directly to Supabase, but write path tests (rate limiting, CSRF) require a deployed Next.js instance.

---

## Project Constraints (from CLAUDE.md)

All CLAUDE.md directives apply to any source files created in this phase:

| Directive | Impact on Phase 24 |
|-----------|-------------------|
| `import { z } from "zod"` not `"zod/v4"` | Not applicable (no new API routes in this phase) |
| `motion-safe:animate-*` | Not applicable (no UI components) |
| 44px touch targets | Not applicable (no UI components) |
| Never swallow errors — every `catch` must toast or `console.error` | k6 scripts and seed SQL are not app code — CLAUDE.md rules apply to `src/` only |
| `check response.ok` before parsing JSON | Not applicable to k6 scripts or SQL — use k6 `check()` instead |
| Admin client in API routes only | Not applicable — no new routes |
| ima-* tokens only | Not applicable — no UI |

**Conclusion:** CLAUDE.md hard rules apply to `src/` app code. The load-test tooling in `load-tests/` is non-production script tooling — follow the spirit (error handling, correct patterns) but CLAUDE.md UI/API rules do not govern k6 scripts or SQL seed files.

---

## Sources

### Primary (HIGH confidence)

- k6 official docs `grafana.com/docs/k6/latest/` — SharedArray, thresholds, ramping-vus executor, results output, `--summary-trend-stats` flag
- Supabase JWT docs `supabase.com/docs/guides/auth/jwts` — required claims (sub, role, aud, exp)
- Supabase managing environments docs `supabase.com/docs/guides/deployment/managing-environments` — separate project setup, `supabase link` + `supabase db push` workflow
- catjam.fi/articles/supabase-gen-access-token — JWT minting pattern with fast-jwt/jsonwebtoken, verified claims
- k6 v1.7.0 confirmed installed at `C:\Program Files\k6\k6.exe` — direct binary check

### Secondary (MEDIUM confidence)

- k6 community forum `community.grafana.com` — per-VU unique token distribution via SharedArray + modulo pattern
- PostgreSQL `generate_series()` for bulk seed data — well-established Postgres pattern
- `github.com/orgs/supabase/discussions/4826` — k6 use confirmed by Supabase internally

### Tertiary (LOW confidence)

- Pitfall 3 (auth.users population requirement) — inferred from Supabase auth architecture, not empirically verified for this exact code path. Flagged as Open Question requiring implementer verification.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — k6 and Node.js versions confirmed by direct binary checks; jsonwebtoken is a well-established npm package
- Architecture patterns: HIGH — k6 SharedArray, thresholds, and ramping-vus verified against official docs
- Pitfalls: HIGH for Pitfalls 1-6 (confirmed from codebase analysis + official docs), MEDIUM for Pitfall 7 (requires empirical verification)
- Seed SQL: MEDIUM — pattern is correct but batch size and performance characteristics depend on staging hardware

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (k6 API is stable; Supabase JWT structure is stable)
