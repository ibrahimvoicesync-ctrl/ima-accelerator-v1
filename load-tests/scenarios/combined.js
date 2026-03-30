// Combined Scenario — simultaneous read + write traffic
// Run: "/c/Program Files/k6/k6.exe" run -e APP_URL=<url> -e SUPABASE_URL=<url> -e SUPABASE_ANON_KEY=<key> load-tests/scenarios/combined.js

import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

// Load pre-generated JWT tokens for student write VUs (D-04)
const studentTokens = new SharedArray('student-tokens', function () {
  return JSON.parse(open('../tokens/student_tokens.json'));
});

// Load owner token for read VUs (single token for dashboard reads)
const ownerTokenArr = new SharedArray('owner-token', function () {
  return JSON.parse(open('../tokens/owner_token.json'));
});

export const options = {
  // k6 multi-scenario: write_spike and read_mix run simultaneously
  // Combined uses lower VU counts (300 write + 50 read) since both run at the same time
  // Total additive load simulates realistic mixed traffic pattern (D-09)
  scenarios: {
    write_spike: {
      executor: 'ramping-vus',
      exec: 'writeSpike',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 300 },  // ramp to 300 write VUs
        { duration: '5m', target: 300 },  // sustain
        { duration: '1m', target: 0 },    // ramp down
      ],
      gracefulRampDown: '30s',
    },
    read_mix: {
      executor: 'ramping-vus',
      exec: 'readMix',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // ramp to 50 read VUs
        { duration: '5m', target: 50 },   // sustain
        { duration: '1m', target: 0 },    // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'],  // D-11: P95 < 1 second across all requests
    'http_req_failed': ['rate<0.01'],      // error rate < 1% across all requests
  },
};

// =============================================================================
// writeSpike: student report submission + work session start (same as write-spike.js)
// =============================================================================
export function writeSpike() {
  const token = studentTokens[(__VU - 1) % studentTokens.length];

  // CSRF: Origin header required for mutation routes (Pitfall 2 — verifyOrigin() check)
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Origin': __ENV.APP_URL,
  };

  // Random date offset 0-89 days back (matches seeded data range per D-06/D-07)
  const dayOffset = Math.floor(Math.random() * 90);
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  const date = d.toISOString().split('T')[0];

  // Request 1: Submit daily report (POST /api/reports)
  // Body conforms to Zod postSchema in src/app/api/reports/route.ts
  const reportBody = JSON.stringify({
    date: date,
    hours_worked: 2 + Math.random() * 6,                    // 2.0–8.0 (0–24 range)
    star_rating: 1 + Math.floor(Math.random() * 5),          // 1–5 int
    brands_contacted: Math.floor(Math.random() * 10),        // 0–9 int
    influencers_contacted: Math.floor(Math.random() * 5),    // 0–4 int
    calls_joined: Math.floor(Math.random() * 3),             // 0–2 int
  });

  const reportRes = http.post(
    `${__ENV.APP_URL}/api/reports`,
    reportBody,
    { headers }
  );

  check(reportRes, {
    'report submitted (200/201/409)': (r) =>
      r.status === 200 || r.status === 201 || r.status === 409,
  });

  // Request 2: Start work session (POST /api/work-sessions)
  // Body conforms to Zod postSchema in src/app/api/work-sessions/route.ts
  const sessionBody = JSON.stringify({
    date: date,
    cycle_number: 1 + Math.floor(Math.random() * 10),                   // random cycle 1–10
    session_minutes: [30, 45, 60][Math.floor(Math.random() * 3)],        // valid options only
  });

  const sessionRes = http.post(
    `${__ENV.APP_URL}/api/work-sessions`,
    sessionBody,
    { headers }
  );

  check(sessionRes, {
    'session started (201/409)': (r) => r.status === 201 || r.status === 409,
  });

  // Rate limit protection: 2 requests per iteration + 3s sleep = ~20 req/min per endpoint
  sleep(3);
}

// =============================================================================
// readMix: owner dashboard RPC calls + paginated student list (same as read-mix.js)
// =============================================================================
export function readMix() {
  const ownerToken = ownerTokenArr[0];

  // PostgREST headers — Authorization + apikey required for Supabase RPC calls
  // No Origin header needed on reads (GET and Supabase RPC do not require CSRF)
  const headers = {
    'Authorization': `Bearer ${ownerToken}`,
    'apikey': __ENV.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };

  // Request 1: RPC get_owner_dashboard_stats
  const dashboardRes = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/rpc/get_owner_dashboard_stats`,
    JSON.stringify({}),
    { headers }
  );

  check(dashboardRes, {
    'get_owner_dashboard_stats: 200': (r) => r.status === 200,
  });

  // Request 2: RPC get_sidebar_badges
  const badgesRes = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/rpc/get_sidebar_badges`,
    JSON.stringify({}),
    { headers }
  );

  check(badgesRes, {
    'get_sidebar_badges: 200': (r) => r.status === 200,
  });

  // Request 3: Paginated student list — random page offset
  const randomPage = Math.floor(Math.random() * 200);
  const listRes = http.get(
    `${__ENV.SUPABASE_URL}/rest/v1/users?role=eq.student&order=name.asc&offset=${randomPage * 25}&limit=25`,
    { headers }
  );

  check(listRes, {
    'paginated student list: 200': (r) => r.status === 200,
  });

  // Dashboard browsing cadence
  sleep(2);
}
