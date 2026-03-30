#!/usr/bin/env node
// ============================================================================
// IMA Accelerator V1 — JWT Pre-generation Script
// ============================================================================
// Purpose: Mint one JWT per seeded user (5,000 students + 1 owner + 10 coaches)
//          using the staging Supabase JWT secret. These tokens are used by k6
//          load test scenarios to authenticate as distinct users, ensuring each
//          VU has its own rate limit bucket (30 req/min/user/endpoint).
//
// Usage:   STAGING_JWT_SECRET=<secret> node load-tests/scripts/gen-tokens.js
//
// Output files (written to load-tests/tokens/):
//   student_tokens.json   — Array of 5,000 student JWT strings
//   owner_token.json      — Single owner JWT string (for read-mix scenarios)
//   student_uuids.json    — Array of 5,000 student auth_id UUIDs (reference)
//
// Auth_id pattern (must match 00001_staging_seed.sql):
//   Owner:     00000000-0000-4000-b000-000000000001
//   Coach N:   00000000-0000-4000-b000-{N+1 zero-padded to 12 digits}
//   Student N: 00000000-0000-4000-a000-{N zero-padded to 12 digits}
//
// JWT claims (Supabase-compatible):
//   sub:  auth_id UUID
//   role: "authenticated"
//   aud:  "authenticated"
//   iss:  "supabase"
//   iat:  now (Unix seconds)
//   exp:  7 days from now (Unix seconds)
//
// Install dependency: npm install jsonwebtoken
// ============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const jwt  = require('jsonwebtoken');

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------
const STUDENT_COUNT = 5000;
const COACH_COUNT   = 10;
const TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

// Deterministic UUID patterns (must match seed SQL)
const STUDENT_PREFIX = '00000000-0000-4000-a000-';
const STAFF_PREFIX   = '00000000-0000-4000-b000-';

// ----------------------------------------------------------------------------
// Input validation
// ----------------------------------------------------------------------------
const jwtSecret = process.env.STAGING_JWT_SECRET;
if (!jwtSecret) {
  console.error('ERROR: STAGING_JWT_SECRET environment variable is not set.');
  console.error('');
  console.error('Usage: STAGING_JWT_SECRET=<your-jwt-secret> node load-tests/scripts/gen-tokens.js');
  console.error('');
  console.error('Find the JWT secret in:');
  console.error('  Supabase Dashboard -> Settings -> API -> JWT Secret');
  process.exit(1);
}

// ----------------------------------------------------------------------------
// UUID generation (deterministic, matches seed SQL lpad() pattern)
// ----------------------------------------------------------------------------

/**
 * Generate a deterministic UUID for a student by index (1-5000).
 * Pattern: 00000000-0000-4000-a000-{N zero-padded to 12 digits}
 * Matches: generate_series student auth_id in seed SQL.
 * @param {number} n  Student index (1-based)
 * @returns {string}  UUID string
 */
function studentUUID(n) {
  return STUDENT_PREFIX + String(n).padStart(12, '0');
}

/**
 * Generate a deterministic UUID for a staff member.
 * Owner: staffUUID(1) -> 00000000-0000-4000-b000-000000000001
 * Coach N: staffUUID(N+1) -> 00000000-0000-4000-b000-{N+1 padded}
 * @param {number} n  Staff index (1-based; owner=1, coach1=2, coach10=11)
 * @returns {string}  UUID string
 */
function staffUUID(n) {
  return STAFF_PREFIX + String(n).padStart(12, '0');
}

// ----------------------------------------------------------------------------
// JWT minting
// ----------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);
const exp = now + TOKEN_TTL_SEC;

/**
 * Mint a Supabase-compatible JWT for the given auth_id.
 * @param {string} authId  UUID (the auth_id from public.users)
 * @returns {string}       Signed JWT string
 */
function mintToken(authId) {
  const payload = {
    sub:  authId,
    role: 'authenticated',
    aud:  'authenticated',
    iss:  'supabase',
    iat:  now,
    exp:  exp,
  };
  return jwt.sign(payload, jwtSecret, { algorithm: 'HS256' });
}

// ----------------------------------------------------------------------------
// Generate tokens
// ----------------------------------------------------------------------------

console.log('Generating tokens...');
console.log('  JWT secret length:', jwtSecret.length, 'chars');
console.log('  Token TTL: 7 days');
console.log('  Expiry:', new Date(exp * 1000).toISOString());
console.log('');

// Student tokens (5,000)
const studentUUIDs  = [];
const studentTokens = [];

for (let i = 1; i <= STUDENT_COUNT; i++) {
  const uuid  = studentUUID(i);
  const token = mintToken(uuid);
  studentUUIDs.push(uuid);
  studentTokens.push(token);

  // Progress indicator every 1000 tokens
  if (i % 1000 === 0) {
    process.stdout.write(`  Students: ${i}/${STUDENT_COUNT}\r`);
  }
}
process.stdout.write('\n');

// Owner token (1)
const ownerUUID  = staffUUID(1); // 00000000-0000-4000-b000-000000000001
const ownerToken = mintToken(ownerUUID);

// Coach tokens (10) — generated but not written to a separate file
// They are available as staff UUIDs 2-11 if needed for coach scenarios
const coachTokens = [];
for (let i = 1; i <= COACH_COUNT; i++) {
  coachTokens.push(mintToken(staffUUID(i + 1)));
}

// ----------------------------------------------------------------------------
// Write output files
// ----------------------------------------------------------------------------

const tokensDir = path.join(__dirname, '..', 'tokens');

// Ensure tokens directory exists
if (!fs.existsSync(tokensDir)) {
  fs.mkdirSync(tokensDir, { recursive: true });
}

const studentTokensPath = path.join(tokensDir, 'student_tokens.json');
const ownerTokenPath    = path.join(tokensDir, 'owner_token.json');
const studentUUIDsPath  = path.join(tokensDir, 'student_uuids.json');

fs.writeFileSync(studentTokensPath, JSON.stringify(studentTokens, null, 0));
fs.writeFileSync(ownerTokenPath,    JSON.stringify(ownerToken,    null, 0));
fs.writeFileSync(studentUUIDsPath,  JSON.stringify(studentUUIDs,  null, 2));

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------

const studentTokensKB = Math.round(fs.statSync(studentTokensPath).size / 1024);
const ownerTokenKB    = Math.round(fs.statSync(ownerTokenPath).size    / 1024);
const uuidsKB         = Math.round(fs.statSync(studentUUIDsPath).size  / 1024);

console.log('Done! Generated tokens:');
console.log('');
console.log(`  Generated ${STUDENT_COUNT} student tokens, 1 owner token, ${COACH_COUNT} coach tokens`);
console.log('');
console.log('Output files:');
console.log(`  ${studentTokensPath}  (${studentTokensKB} KB)`);
console.log(`  ${ownerTokenPath}     (${ownerTokenKB} KB)`);
console.log(`  ${studentUUIDsPath}   (${uuidsKB} KB)`);
console.log('');
console.log('IMPORTANT: These files are gitignored (load-tests/tokens/*.json).');
console.log('           They are equivalent to authenticated sessions — treat as secrets.');
console.log('');
console.log('Next step: Run k6 load test scenarios (Plan 02)');
console.log('  k6 run load-tests/scenarios/01-owner-read-mix.js');
