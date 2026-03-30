// Read Mix Scenario — simulates owner dashboard browsing
// Hits PostgREST RPCs and table reads directly
//
// Run: k6 run -e SUPABASE_URL=http://127.0.0.1:54321 -e SUPABASE_ANON_KEY=<key> -e SERVICE_ROLE_KEY=<key> load-tests/scenarios/read-mix.js

import http from 'k6/http';
import { check, sleep } from 'k6';

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
  // service_role key bypasses RLS — matches SECURITY DEFINER RPCs in production
  const headers = {
    'Authorization': `Bearer ${__ENV.SERVICE_ROLE_KEY}`,
    'apikey': __ENV.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };

  // Request 1: RPC get_owner_dashboard_stats — aggregates totals across all students (no params)
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
    JSON.stringify({ p_user_id: __ENV.OWNER_USER_ID, p_role: 'owner' }),
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
