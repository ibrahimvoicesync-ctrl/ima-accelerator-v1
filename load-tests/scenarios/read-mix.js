// Read Mix Scenario — simulates owner dashboard browsing
// Run: "/c/Program Files/k6/k6.exe" run -e APP_URL=<url> -e SUPABASE_URL=<url> -e SUPABASE_ANON_KEY=<key> load-tests/scenarios/read-mix.js

import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

// Load owner token (single token — only one owner per staging environment per D-08)
const ownerTokenArr = new SharedArray('owner-token', function () {
  return JSON.parse(open('../tokens/owner_token.json'));
});

// Load student tokens for student detail page reads
const studentTokens = new SharedArray('student-tokens', function () {
  return JSON.parse(open('../tokens/student_tokens.json'));
});

export const options = {
  scenarios: {
    read_mix: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },  // ramp to 100 VUs
        { duration: '5m', target: 100 },  // sustain
        { duration: '1m', target: 0 },    // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'],  // D-11: P95 < 1 second
    'http_req_failed': ['rate<0.01'],      // error rate < 1%
  },
};

// 100 VUs (not 500) — owner dashboard is 1 owner + a few coaches,
// but each RPC is heavier (aggregates over 500k rows)

export default function () {
  // Owner token from pre-generated pool (gen-tokens.js writes owner_token.json as array)
  const ownerToken = ownerTokenArr[0];

  // PostgREST headers — Authorization + apikey required for Supabase RPC calls
  // No Origin header needed on reads (GET and Supabase RPC do not require CSRF)
  const headers = {
    'Authorization': `Bearer ${ownerToken}`,
    'apikey': __ENV.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };

  // Request 1: RPC get_owner_dashboard_stats — aggregates totals across all students
  const dashboardRes = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/rpc/get_owner_dashboard_stats`,
    JSON.stringify({}),
    { headers }
  );

  check(dashboardRes, {
    'get_owner_dashboard_stats: 200': (r) => r.status === 200,
  });

  // Request 2: RPC get_sidebar_badges — badge counts for unread reports, etc.
  const badgesRes = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/rpc/get_sidebar_badges`,
    JSON.stringify({}),
    { headers }
  );

  check(badgesRes, {
    'get_sidebar_badges: 200': (r) => r.status === 200,
  });

  // Request 3: Paginated student list — random page offset simulates browsing
  // 200 pages * 25 per page = 5,000 students (matches D-06 seed size)
  const randomPage = Math.floor(Math.random() * 200);
  const listRes = http.get(
    `${__ENV.SUPABASE_URL}/rest/v1/users?role=eq.student&order=name.asc&offset=${randomPage * 25}&limit=25`,
    { headers }
  );

  check(listRes, {
    'paginated student list: 200': (r) => r.status === 200,
  });

  // Dashboard browsing cadence — 2s between full page view cycles
  sleep(2);
}
