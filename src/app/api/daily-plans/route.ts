import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";
import { getTodayUTC } from "@/lib/utils";
import { planJsonSchema } from "@/lib/schemas/daily-plan";

const postBodySchema = z.object({
  plan_json: planJsonSchema,
});

export async function POST(request: Request) {
  // 1. CSRF — cheapest check first
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  // 2. Auth
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 3. Role check — student only
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();
  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Rate limit
  const { allowed, retryAfterSeconds } = await checkRateLimit(
    profile.id,
    "/api/daily-plans"
  );
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // 5. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 6. Zod validation
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 7. Insert plan — idempotent per D-06
  const today = getTodayUTC();
  const { data: inserted, error: insertError } = await admin
    .from("daily_plans")
    .insert({
      student_id: profile.id,
      date: today,
      plan_json: parsed.data.plan_json,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Unique constraint violation (student_id, date) — return existing plan
      const { data: existing } = await admin
        .from("daily_plans")
        .select()
        .eq("student_id", profile.id)
        .eq("date", today)
        .single();
      return NextResponse.json({ data: existing }, { status: 200 });
    }
    console.error("[daily-plans POST] Insert failed:", insertError);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }

  revalidateTag("badges", "default");
  return NextResponse.json({ data: inserted }, { status: 201 });
}

export async function GET() {
  // Auth (no CSRF for GET, no rate-limit for reads — consistent with /api/calendar)
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();
  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = getTodayUTC();
  const { data: plan } = await admin
    .from("daily_plans")
    .select()
    .eq("student_id", profile.id)
    .eq("date", today)
    .maybeSingle();

  return NextResponse.json({ data: plan ?? null });
}
