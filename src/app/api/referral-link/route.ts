import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin } from "@/lib/csrf";

const bodySchema = z.object({}).strict();

const REFERRAL_BASE_URL = "https://application.imaccelerator.com";

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

  const shortUrl = `${REFERRAL_BASE_URL}/${referralCode}`;

  // Compare-and-swap persist: first writer wins; a concurrent writer's value is returned below.
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

  return NextResponse.json({ shortUrl, referralCode }, { status: 200 });
}
