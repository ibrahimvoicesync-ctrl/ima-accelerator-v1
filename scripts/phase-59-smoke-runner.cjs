#!/usr/bin/env node
/**
 * Phase 59 smoke runner — exercises POST /api/referral-link across the 9
 * verification cases (API-01..08 + CFG-02) using a combination of:
 *   - supabase-js service-role admin client (DB-side invariants + fixture reset)
 *   - fetch() against a running dev/staging server (HTTP contract)
 *
 * Reads from .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required)
 *   REBRANDLY_API_KEY                                     (SMOKE 6 precondition)
 *   TEST_STUDENT_COOKIE                                   (SMOKE 6 — session cookie string for a test student)
 *   TEST_STUDENT_EMAIL                                    (SMOKE 6 — matches the cookie's student by email)
 *   SMOKE_BASE_URL                                        (default http://localhost:3000)
 *
 * Outputs JSON to stdout; exits 1 if any case FAILs, 2 on env/config error, 0 otherwise.
 *
 * Cases:
 *   SMOKE 1: unauth POST → 401
 *   SMOKE 2: wrong-role (owner/coach) POST → 403       [SKIPPED_IN_RUNNER — needs forged session cookie]
 *   SMOKE 3: Phase 58 backfill invariant (all student/student_diy have non-null referral_code)
 *   SMOKE 4: referral_code uniqueness
 *   SMOKE 5: owner/coach rows untouched (null code + null short_url)
 *   SMOKE 6: happy path + idempotency                   [needs TEST_STUDENT_COOKIE]
 *   SMOKE 7: every persisted referral_short_url starts with "https://"
 *   SMOKE 8: missing-key fallback → 500                [SKIPPED_IN_RUNNER — env flip on live server]
 *   SMOKE 9: CFG-02 static evidence (route file contains required tokens)
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const BASE_URL = process.env.SMOKE_BASE_URL || env.SMOKE_BASE_URL || "http://localhost:3000";
const TEST_STUDENT_COOKIE = process.env.TEST_STUDENT_COOKIE || env.TEST_STUDENT_COOKIE || null;
const TEST_STUDENT_EMAIL = process.env.TEST_STUDENT_EMAIL || env.TEST_STUDENT_EMAIL || null;
const REBRANDLY_API_KEY = process.env.REBRANDLY_API_KEY || env.REBRANDLY_API_KEY || null;

const CODE_REGEX = /^[0-9A-F]{8}$/;

const results = [];

function record(name, expected, observed, pass, extra) {
  results.push({ name, expected, observed, result: pass ? "PASS" : "FAIL", ...(extra || {}) });
}

(async () => {
  // SMOKE 1: unauth POST → 401 (API-01)
  try {
    const res = await fetch(`${BASE_URL}/api/referral-link`, {
      method: "POST",
      headers: { Origin: BASE_URL, "Content-Type": "application/json" },
    });
    const pass = res.status === 401;
    record(
      "SMOKE 1: unauth → 401",
      "status === 401",
      `status=${res.status}`,
      pass,
      { method: "HTTP POST no-cookie" }
    );
  } catch (e) {
    record(
      "SMOKE 1: unauth → 401",
      "status === 401",
      null,
      false,
      { error: String(e.message || e), note: "dev server likely not running on " + BASE_URL }
    );
  }

  // SMOKE 2: wrong-role (owner/coach) POST → 403 (API-01 403 branch)
  // Runner cannot forge a session cookie; documented as SKIPPED_IN_RUNNER.
  try {
    const { data: ownerRows } = await sb
      .from("users")
      .select("id, email, role")
      .eq("role", "owner")
      .limit(1);
    const ownerId = ownerRows?.[0]?.id || null;
    record(
      "SMOKE 2: wrong-role → 403",
      "status === 403 when POSTing with owner/coach cookie",
      "SKIPPED_IN_RUNNER",
      true,
      {
        result: "SKIPPED_IN_RUNNER",
        method: "requires owner/coach session cookie — see VERIFICATION.md manual case",
        sample_owner_id: ownerId,
      }
    );
  } catch (e) {
    record(
      "SMOKE 2: wrong-role → 403",
      "status === 403",
      "SKIPPED_IN_RUNNER",
      true,
      {
        result: "SKIPPED_IN_RUNNER",
        method: "requires owner/coach session cookie — see VERIFICATION.md manual case",
        error: String(e.message || e),
      }
    );
  }

  // SMOKE 3: Phase 58 backfill invariant — every student/student_diy has non-null referral_code
  try {
    const { data, error } = await sb
      .from("users")
      .select("id, role, referral_code")
      .in("role", ["student", "student_diy"]);
    if (error) throw error;
    const rows = data || [];
    const nulls = rows.filter((r) => r.referral_code == null);
    const malformed = rows.filter((r) => r.referral_code != null && !CODE_REGEX.test(r.referral_code));
    const pass = nulls.length === 0 && malformed.length === 0;
    record(
      "SMOKE 3: backfill complete",
      "all student/student_diy have referral_code matching /^[0-9A-F]{8}$/",
      `total_rows=${rows.length} null_rows=${nulls.length} malformed_rows=${malformed.length}`,
      pass,
      { null_ids: nulls.map((r) => r.id), malformed_ids: malformed.map((r) => r.id) }
    );
  } catch (e) {
    record(
      "SMOKE 3: backfill complete",
      "all student/student_diy have referral_code matching /^[0-9A-F]{8}$/",
      null,
      false,
      { error: String(e.message || e) }
    );
  }

  // SMOKE 4: referral_code uniqueness
  try {
    const { data, error } = await sb
      .from("users")
      .select("referral_code")
      .not("referral_code", "is", null);
    if (error) throw error;
    const codes = (data || []).map((r) => r.referral_code);
    const unique = new Set(codes).size;
    const pass = unique === codes.length;
    record(
      "SMOKE 4: referral_code uniqueness",
      "unique_rows === total_rows",
      `total_rows=${codes.length} unique_rows=${unique}`,
      pass
    );
  } catch (e) {
    record(
      "SMOKE 4: referral_code uniqueness",
      "unique_rows === total_rows",
      null,
      false,
      { error: String(e.message || e) }
    );
  }

  // SMOKE 5: owner/coach rows untouched (null referral_code AND null referral_short_url)
  try {
    const { data, error } = await sb
      .from("users")
      .select("id, role, referral_code, referral_short_url")
      .in("role", ["owner", "coach"]);
    if (error) throw error;
    const rows = data || [];
    const polluted = rows.filter(
      (r) => r.referral_code != null || r.referral_short_url != null
    );
    const pass = polluted.length === 0;
    record(
      "SMOKE 5: owner/coach untouched",
      "all owner/coach rows have null referral_code AND null referral_short_url",
      `total_rows=${rows.length} polluted=${polluted.length}`,
      pass,
      { polluted_ids: polluted.map((r) => r.id) }
    );
  } catch (e) {
    record(
      "SMOKE 5: owner/coach untouched",
      "all owner/coach rows have null referral_code AND null referral_short_url",
      null,
      false,
      { error: String(e.message || e) }
    );
  }

  // SMOKE 6: happy path + idempotency (API-02 + API-04 + API-05)
  // Requires TEST_STUDENT_COOKIE + TEST_STUDENT_EMAIL + REBRANDLY_API_KEY
  try {
    if (!TEST_STUDENT_COOKIE || !TEST_STUDENT_EMAIL) {
      record(
        "SMOKE 6: happy path + idempotency",
        "POST #1 returns 200 {shortUrl, referralCode}; POST #2 returns same shortUrl",
        "SKIPPED_IN_RUNNER",
        true,
        {
          result: "SKIPPED_IN_RUNNER",
          method:
            "needs TEST_STUDENT_COOKIE + TEST_STUDENT_EMAIL env vars — see VERIFICATION.md for how to obtain",
          has_rebrandly_key: !!REBRANDLY_API_KEY,
        }
      );
    } else if (!REBRANDLY_API_KEY) {
      record(
        "SMOKE 6: happy path + idempotency",
        "POST #1 returns 200 {shortUrl, referralCode}; POST #2 returns same shortUrl",
        "SKIPPED_IN_RUNNER",
        true,
        {
          result: "SKIPPED_IN_RUNNER",
          method: "REBRANDLY_API_KEY not set in .env.local — cannot exercise happy path",
        }
      );
    } else {
      // Fetch the test student by email so we can reset their state
      const { data: studentRow, error: studentErr } = await sb
        .from("users")
        .select("id, email, role, referral_code, referral_short_url")
        .eq("email", TEST_STUDENT_EMAIL)
        .maybeSingle();
      if (studentErr) throw studentErr;
      if (!studentRow) {
        record(
          "SMOKE 6: happy path + idempotency",
          "POST #1 returns 200 {shortUrl, referralCode}; POST #2 returns same shortUrl",
          null,
          false,
          { error: `no user found with email=${TEST_STUDENT_EMAIL}` }
        );
      } else if (studentRow.role !== "student" && studentRow.role !== "student_diy") {
        record(
          "SMOKE 6: happy path + idempotency",
          "test user is student or student_diy",
          null,
          false,
          { error: `TEST_STUDENT_EMAIL resolves to role=${studentRow.role} (not student/student_diy)` }
        );
      } else {
        // Reset referral_short_url to NULL so we can exercise the fresh-create branch
        const { error: resetErr } = await sb
          .from("users")
          .update({ referral_short_url: null })
          .eq("id", studentRow.id);
        if (resetErr) throw resetErr;

        // POST #1 (fresh-create)
        const res1 = await fetch(`${BASE_URL}/api/referral-link`, {
          method: "POST",
          headers: {
            Origin: BASE_URL,
            "Content-Type": "application/json",
            Cookie: TEST_STUDENT_COOKIE,
          },
        });
        const body1 = await res1.json().catch(() => ({}));

        // POST #2 (cache-hit, must match)
        const res2 = await fetch(`${BASE_URL}/api/referral-link`, {
          method: "POST",
          headers: {
            Origin: BASE_URL,
            "Content-Type": "application/json",
            Cookie: TEST_STUDENT_COOKIE,
          },
        });
        const body2 = await res2.json().catch(() => ({}));

        const shortUrlValid =
          typeof body1.shortUrl === "string" && body1.shortUrl.startsWith("https://");
        const codeValid =
          typeof body1.referralCode === "string" && CODE_REGEX.test(body1.referralCode);
        const idempotent =
          body2.shortUrl === body1.shortUrl && body2.referralCode === body1.referralCode;
        const pass =
          res1.status === 200 && res2.status === 200 && shortUrlValid && codeValid && idempotent;
        record(
          "SMOKE 6: happy path + idempotency",
          "status === 200, shortUrl starts https://, referralCode /^[0-9A-F]{8}$/, POST #2 matches POST #1",
          `status1=${res1.status} status2=${res2.status} shortUrlValid=${shortUrlValid} codeValid=${codeValid} idempotent=${idempotent}`,
          pass,
          {
            post1_shortUrl: body1.shortUrl,
            post1_referralCode: body1.referralCode,
            post2_shortUrl: body2.shortUrl,
            post2_referralCode: body2.referralCode,
          }
        );
      }
    }
  } catch (e) {
    record(
      "SMOKE 6: happy path + idempotency",
      "POST #1 returns 200 {shortUrl, referralCode}; POST #2 returns same shortUrl",
      null,
      false,
      { error: String(e.message || e) }
    );
  }

  // SMOKE 7: every persisted referral_short_url starts with "https://"
  try {
    const { data, error } = await sb
      .from("users")
      .select("id, referral_short_url")
      .not("referral_short_url", "is", null);
    if (error) throw error;
    const rows = data || [];
    const bad = rows.filter((r) => !r.referral_short_url.startsWith("https://"));
    const pass = bad.length === 0;
    record(
      "SMOKE 7: persisted shortUrl scheme",
      'every non-null referral_short_url starts with "https://"',
      `total_rows=${rows.length} bad=${bad.length}`,
      pass,
      { bad_ids: bad.map((r) => r.id) }
    );
  } catch (e) {
    record(
      "SMOKE 7: persisted shortUrl scheme",
      'every non-null referral_short_url starts with "https://"',
      null,
      false,
      { error: String(e.message || e) }
    );
  }

  // SMOKE 8: missing-key fallback → 500 (API-07) — env flip cannot be automated in-runner
  record(
    "SMOKE 8: missing-key fallback → 500",
    "POST with REBRANDLY_API_KEY unset returns 500 + console.error",
    "SKIPPED_IN_RUNNER",
    true,
    {
      result: "SKIPPED_IN_RUNNER",
      method:
        "manual: stop dev server, unset REBRANDLY_API_KEY in .env.local, restart, POST /api/referral-link with valid session → expect 500 + console.error",
    }
  );

  // SMOKE 9: CFG-02 static evidence — route file contains required tokens
  try {
    const routePath = path.join(__dirname, "..", "src/app/api/referral-link/route.ts");
    const content = fs.readFileSync(routePath, "utf8");
    const hasOkCheck = content.includes("rbResponse.ok") || content.includes("response.ok");
    const hasZodImport = content.includes('import { z } from "zod"');
    const hasTimeout = content.includes("AbortSignal.timeout");
    const hasServerOnly = content.includes('import "server-only"');
    const pass = hasOkCheck && hasZodImport && hasTimeout && hasServerOnly;
    record(
      "SMOKE 9: CFG-02 static evidence",
      "route.ts contains rbResponse.ok + zod import + AbortSignal.timeout + server-only",
      `okCheck=${hasOkCheck} zodImport=${hasZodImport} timeout=${hasTimeout} serverOnly=${hasServerOnly}`,
      pass,
      { route_path: "src/app/api/referral-link/route.ts" }
    );
  } catch (e) {
    record(
      "SMOKE 9: CFG-02 static evidence",
      "route.ts contains rbResponse.ok + zod import + AbortSignal.timeout + server-only",
      null,
      false,
      { error: String(e.message || e) }
    );
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.result === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
})();
