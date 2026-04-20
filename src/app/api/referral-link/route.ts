import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin } from "@/lib/csrf";

const bodySchema = z.object({}).strict();

const REFERRAL_DESTINATION = "https://www.imaccelerator.com/apply/typeform";

function slugifyName(name: string | null | undefined): string {
  const normalized = (name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export async function POST(request: Request) {
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const apiKey = process.env.REBRANDLY_API_KEY;
  const workspaceId = process.env.REBRANDLY_WORKSPACE_ID;
  const domainId = process.env.REBRANDLY_DOMAIN_ID;
  if (!apiKey) {
    console.error("[POST /api/referral-link] REBRANDLY_API_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!workspaceId) {
    console.error("[POST /api/referral-link] REBRANDLY_WORKSPACE_ID not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!domainId) {
    console.error("[POST /api/referral-link] REBRANDLY_DOMAIN_ID not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

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

  if (profile.referral_short_url) {
    return NextResponse.json(
      { shortUrl: profile.referral_short_url, referralCode: profile.referral_code },
      { status: 200 }
    );
  }

  let referralCode = profile.referral_code;
  if (!referralCode) {
    referralCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const { error: codeError } = await admin
      .from("users")
      .update({ referral_code: referralCode })
      .eq("id", profile.id)
      .is("referral_code", null);
    if (codeError) {
      console.error("[POST /api/referral-link] Failed to persist referral_code:", codeError);
      return NextResponse.json({ error: "Failed to generate referral code" }, { status: 500 });
    }
    const { data: refreshed } = await admin
      .from("users")
      .select("referral_code")
      .eq("id", profile.id)
      .single();
    if (refreshed?.referral_code) referralCode = refreshed.referral_code;
  }

  const nameSlug = slugifyName(profile.name);
  const codeLower = referralCode.toLowerCase();
  const primarySlashtag = nameSlug || `student-${codeLower}`;
  const utmCampaign = nameSlug || "student";
  const destination = `${REFERRAL_DESTINATION}?utm_source=referral&utm_campaign=${encodeURIComponent(utmCampaign)}`;

  const registerSlashtag = (slashtag: string) =>
    fetch("https://api.rebrandly.com/v1/links", {
      method: "POST",
      headers: {
        apikey: apiKey,
        workspace: workspaceId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        destination,
        slashtag,
        domain: { id: domainId },
        title: `IMA Referral - ${profile.name ?? referralCode}`,
      }),
      signal: AbortSignal.timeout(8000),
    });

  let shortUrl: string;
  try {
    let rbResponse = await registerSlashtag(primarySlashtag);
    if (!rbResponse.ok && nameSlug) {
      // Rebrandly returns HTTP 403 (not 409) for a duplicate slashtag, with
      // { errors: [{ code: "AlreadyExists", property: "slashtag" }] } in the
      // body. Inspect the body before deciding to retry; surface any other
      // non-ok immediately.
      const firstErrText = await rbResponse.text().catch(() => "");
      let slashtagTaken = false;
      try {
        const parsed: { errors?: unknown } = JSON.parse(firstErrText);
        if (Array.isArray(parsed.errors)) {
          slashtagTaken = parsed.errors.some(
            (e: { code?: unknown; property?: unknown }) =>
              e?.code === "AlreadyExists" && e?.property === "slashtag"
          );
        }
      } catch {
        slashtagTaken = false;
      }
      if (slashtagTaken) {
        rbResponse = await registerSlashtag(`${nameSlug}-${codeLower}`);
      } else {
        console.error(
          "[POST /api/referral-link] Rebrandly non-OK:",
          rbResponse.status,
          rbResponse.statusText,
          firstErrText
        );
        return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
      }
    }
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
    const rbBody: { shortUrl?: unknown } = await rbResponse.json();
    if (typeof rbBody.shortUrl !== "string" || rbBody.shortUrl.length === 0) {
      console.error("[POST /api/referral-link] Rebrandly response missing shortUrl:", rbBody);
      return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
    }
    shortUrl = `https://${rbBody.shortUrl}`;
  } catch (err) {
    console.error("[POST /api/referral-link] Rebrandly fetch failed:", err);
    return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
  }

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

  return NextResponse.json({ shortUrl, referralCode }, { status: 200 });
}
