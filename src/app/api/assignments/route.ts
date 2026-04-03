import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

const assignSchema = z.object({
  coach_id: z.string().guid().nullable(),
});

export async function PATCH(request: NextRequest) {
  // CSRF protection -- Origin header must match app host
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  // 1. Auth check
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Profile + role check
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }
  if (profile.role !== "owner" && profile.role !== "coach") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit check (per D-01, D-04)
  const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/assignments");
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // 3. Parse studentId from query params
  const studentId = request.nextUrl.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "Missing studentId query parameter" }, { status: 400 });
  }

  // 4. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  // 5. Verify target is a student
  const { data: student } = await admin
    .from("users")
    .select("id")
    .eq("id", studentId)
    .eq("role", "student")
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // 6. If coach_id is not null, verify target is an active coach
  if (parsed.data.coach_id !== null) {
    const { data: coach } = await admin
      .from("users")
      .select("id")
      .eq("id", parsed.data.coach_id)
      .eq("role", "coach")
      .eq("status", "active")
      .single();

    if (!coach) {
      return NextResponse.json({ error: "Coach not found or inactive" }, { status: 404 });
    }
  }

  // 7. Update coach_id
  const { data: updated, error } = await admin
    .from("users")
    .update({ coach_id: parsed.data.coach_id })
    .eq("id", studentId)
    .select("id, coach_id")
    .single();

  if (error) {
    console.error("[PATCH /api/assignments] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: updated });
}
