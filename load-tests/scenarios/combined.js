// Combined Scenario — simultaneous read + write traffic
// Hits PostgREST directly with service_role key
//
// Run: k6 run -e SUPABASE_URL=http://127.0.0.1:54321 -e SUPABASE_ANON_KEY=<key> -e SERVICE_ROLE_KEY=<key> load-tests/scenarios/combined.js

import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

// Load student profiles for write VUs
const students = new SharedArray('student-profiles', function () {
  return JSON.parse(open('../tokens/student_profiles.json'));
});

export const options = {
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
// writeSpike: student report + work session writes via PostgREST
// =============================================================================
export function writeSpike() {
  const student = students[(__VU - 1) % students.length];

  const headers = {
    'Authorization': `Bearer ${__ENV.SERVICE_ROLE_KEY}`,
    'apikey': __ENV.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  const dayOffset = Math.floor(Math.random() * 90);
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  const date = d.toISOString().split('T')[0];

  // Request 1: Upsert daily report
  const reportBody = JSON.stringify({
    student_id: student.id,
    date: date,
    hours_worked: (2 + Math.random() * 6).toFixed(2),
    star_rating: 1 + Math.floor(Math.random() * 5),
    outreach_count: Math.floor(Math.random() * 16),
    brands_contacted: Math.floor(Math.random() * 10),
    influencers_contacted: Math.floor(Math.random() * 5),
    calls_joined: Math.floor(Math.random() * 3),
    wins: 'Load test report',
    improvements: 'Load test data',
  });

  const reportRes = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/daily_reports?on_conflict=student_id,date`,
    reportBody,
    { headers: Object.assign({}, headers, { 'Prefer': 'return=minimal,resolution=merge-duplicates' }) }
  );

  check(reportRes, {
    'report upserted (2xx)': (r) => r.status >= 200 && r.status < 300,
  });

  // Request 2: Insert work session
  const sessionBody = JSON.stringify({
    student_id: student.id,
    date: date,
    cycle_number: 1 + Math.floor(Math.random() * 10),
    session_minutes: [30, 45, 60][Math.floor(Math.random() * 3)],
    status: 'completed',
    duration_minutes: [30, 45, 60][Math.floor(Math.random() * 3)],
    started_at: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
    completed_at: new Date().toISOString(),
  });

  const sessionRes = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/work_sessions`,
    sessionBody,
    { headers }
  );

  check(sessionRes, {
    'session inserted (2xx)': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(3);
}

// =============================================================================
// readMix: owner dashboard RPC calls + paginated student list
// =============================================================================
export function readMix() {
  const headers = {
    'Authorization': `Bearer ${__ENV.SERVICE_ROLE_KEY}`,
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

  // Request 2: RPC get_sidebar_badges (requires user_id and role params)
  const badgesRes = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/rpc/get_sidebar_badges`,
    JSON.stringify({ p_user_id: __ENV.OWNER_USER_ID, p_role: 'owner' }),
    { headers }
  );

  check(badgesRes, {
    'get_sidebar_badges: 200': (r) => r.status === 200,
  });

  // Request 3: Paginated student list
  const randomPage = Math.floor(Math.random() * 200);
  const listRes = http.get(
    `${__ENV.SUPABASE_URL}/rest/v1/users?role=eq.student&order=name.asc&offset=${randomPage * 25}&limit=25`,
    { headers }
  );

  check(listRes, {
    'paginated student list: 200': (r) => r.status === 200,
  });

  sleep(2);
}
