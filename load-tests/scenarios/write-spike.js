// Write Spike Scenario — simulates 11 PM student submission spike
// Hits PostgREST directly with service_role key (matches production admin client behavior)
//
// Run: k6 run -e SUPABASE_URL=http://127.0.0.1:54321 -e SUPABASE_ANON_KEY=<key> -e SERVICE_ROLE_KEY=<key> load-tests/scenarios/write-spike.js

import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

// Load pre-generated student profiles (id + auth_id) for each VU
// Using the DB primary key (id) as student_id for inserts
const students = new SharedArray('student-profiles', function () {
  return JSON.parse(open('../tokens/student_profiles.json'));
});

export const options = {
  scenarios: {
    write_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },  // ramp to 500 VUs (simulates spike onset)
        { duration: '5m', target: 500 },  // sustain peak for 5 minutes
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

export default function () {
  // Each VU picks its unique student from the pool (modulo prevents out-of-bounds)
  const student = students[(__VU - 1) % students.length];

  // PostgREST headers — service_role bypasses RLS (matches admin client in production API routes)
  const headers = {
    'Authorization': `Bearer ${__ENV.SERVICE_ROLE_KEY}`,
    'apikey': __ENV.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  // Random date offset 0-89 days back (matches seeded data range per D-06/D-07)
  const dayOffset = Math.floor(Math.random() * 90);
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  const date = d.toISOString().split('T')[0];

  // Request 1: Upsert daily report via PostgREST
  // Uses Prefer: resolution=merge-duplicates for upsert behavior (matches API route ON CONFLICT)
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

  // Request 2: Insert work session via PostgREST
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

  // Rate limit protection: 2 requests per iteration + 3s sleep = ~40 req/min total
  // Split across 2 tables = ~20 req/min per table, safely under real rate limits
  sleep(3);
}
