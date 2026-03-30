// Write Spike Scenario — simulates 11 PM student submission spike
// Run: "/c/Program Files/k6/k6.exe" run -e APP_URL=<staging-url> load-tests/scenarios/write-spike.js

import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

// Load pre-generated JWT tokens for each student VU (D-04)
// One unique token per VU prevents rate limit bucket collisions
const tokens = new SharedArray('student-tokens', function () {
  return JSON.parse(open('../tokens/student_tokens.json'));
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

// 500 VUs x ~100 iterations over 5-min sustain = ~50,000 total requests
// Simulates 5,000 students submitting a few reports/sessions each in the spike window

export default function () {
  // Each VU picks its unique token from the pool (modulo prevents out-of-bounds)
  const token = tokens[(__VU - 1) % tokens.length];

  // CSRF: Origin header must match APP_URL host (Pitfall 2 — verifyOrigin() check)
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

  // 200 = update existing, 201 = new report, 409 = duplicate (all acceptable under load)
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

  // 201 = created, 409 = active session exists or cycle duplicate (both acceptable under load)
  check(sessionRes, {
    'session started (201/409)': (r) => r.status === 201 || r.status === 409,
  });

  // Rate limit protection: 2 requests per iteration + 3s sleep = ~40 req/min total
  // Split across 2 endpoints = ~20 req/min per endpoint, safely under 30/min limit (Pitfall 5)
  sleep(3);
}
