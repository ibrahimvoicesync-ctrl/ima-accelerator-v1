import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin } from "@/lib/csrf";

// Empty-body POST is valid per Pitfall 8 — Phase 60's <ReferralCard /> sends no body.
const bodySchema = z.object({}).strict();

export async function POST(request: Request) {
  // STEP 0 — CSRF (cheapest check; matches every other mutation POST in src/app/api/**)
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  // STEP 1 — Auth (API-01 401 branch)
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // STEP 2 — Role gate + widened profile read (API-01 403 branch + prefetch for API-02 cache-hit)
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, name, role, referral_code, referral_short_url")
    .eq("auth_id", authUser.id)
    .single();

  if (profileError || !profile) {
    console.error("[POST /api/referral-link] Profile lookup failed:", profileError);
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }
  if (profile.role !== "student" && profile.role !== "student_diy") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // STEP 3 — Env-var guard (API-07). Explicit narrowing; never `process.env.X!`.
  // REBRANDLY_WORKSPACE_ID is required because none of the configured Rebrandly
  // workspaces are marked default — without an explicit `workspace` header the
  // upstream returns 404 {source: "workspace"}.
  const apiKey = process.env.REBRANDLY_API_KEY;
  const workspaceId = process.env.REBRANDLY_WORKSPACE_ID;
  if (!apiKey) {
    console.error("[POST /api/referral-link] REBRANDLY_API_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!workspaceId) {
    console.error("[POST /api/referral-link] REBRANDLY_WORKSPACE_ID not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // STEP 4 — Body parse + Zod (API-08). Empty body is valid per Pitfall 8.
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // STEP 5 — Cache-hit branch (API-02): short-circuits BEFORE any Rebrandly call or DB write.
  if (profile.referral_short_url) {
    return NextResponse.json(
      { shortUrl: profile.referral_short_url, referralCode: profile.referral_code },
      { status: 200 }
    );
  }

  // STEP 5b — Generate + persist code if NULL (API-03). Uses crypto.randomUUID() per prior_decisions Q1.
  let referralCode = profile.referral_code;
  if (!referralCode) {
    referralCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const { error: codeError } = await admin
      .from("users")
      .update({ referral_code: referralCode })
      .eq("id", profile.id)
      .is("referral_code", null);
    if (codeError) {
      // Do NOT retry on 23505 per prior_decisions Q3 — surface 500.
      console.error("[POST /api/referral-link] Failed to persist referral_code:", codeError);
      return NextResponse.json({ error: "Failed to generate referral code" }, { status: 500 });
    }
    // Re-read in case a concurrent writer assigned a different code first.
    const { data: refreshed } = await admin
      .from("users")
      .select("referral_code")
      .eq("id", profile.id)
      .single();
    if (refreshed?.referral_code) referralCode = refreshed.referral_code;
  }

  // STEP 6 — Rebrandly fetch (API-04, API-06). Pattern 3: timeout + ok check + try/catch.
  let rbBody: { id?: string; shortUrl?: string };
  try {
    const rbResponse = await fetch("https://api.rebrandly.com/v1/links", {
      method: "POST",
      headers: {
        apikey: apiKey,
        workspace: workspaceId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        destination: `https://www.imaccelerator.com/?ref=${referralCode}`,
        title: `IMA Referral - ${profile.name ?? referralCode}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!rbResponse.ok) {
      const errText = await rbResponse.text().catch(() => "<unreadable>");
      console.error(
        "[POST /api/referral-link] Rebrandly non-OK:",
        rbResponse.status,
        rbResponse.statusText,
        errText
      );
      return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
    }
    rbBody = await rbResponse.json();
  } catch (err) {
    console.error("[POST /api/referral-link] Rebrandly fetch failed:", err);
    return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
  }

  if (typeof rbBody.shortUrl !== "string" || rbBody.shortUrl.length === 0) {
    console.error("[POST /api/referral-link] Rebrandly response missing shortUrl:", rbBody);
    return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
  }

  // Pitfall 2 + prior_decisions Q5: prepend scheme BEFORE persisting.
  const shortUrl = `https://${rbBody.shortUrl}`;

  // STEP 7 — Compare-and-swap persist (API-05). Pattern 2 from RESEARCH.
  const { data: persisted, error: persistError } = await admin
    .from("users")
    .update({ referral_short_url: shortUrl })
    .eq("id", profile.id)
    .is("referral_short_url", null)
    .select("referral_short_url")
    .maybeSingle();

  if (persistError) {
    console.error("[POST /api/referral-link] Persist failed:", persistError);
    return NextResponse.json({ error: "Failed to save referral link" }, { status: 500 });
  }

  if (!persisted) {
    // Concurrent writer won; re-read and return their value.
    const { data: winner } = await admin
      .from("users")
      .select("referral_short_url")
      .eq("id", profile.id)
      .single();
    if (winner?.referral_short_url) {
      return NextResponse.json(
        { shortUrl: winner.referral_short_url, referralCode },
        { status: 200 }
      );
    }
    console.error(
      "[POST /api/referral-link] Lost CAS but no winner found for user.id=",
      profile.id
    );
    return NextResponse.json({ error: "Failed to save referral link" }, { status: 500 });
  }

  // STEP 8 — Success (REQ-05 exact shape).
  return NextResponse.json({ shortUrl, referralCode }, { status: 200 });
}
