import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITE_CONFIG, VALIDATION } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

const inviteSchema = z.object({
  email: z.string().email().max(VALIDATION.email.max),
  role: z.enum(["coach", "student", "student_diy"]).optional().default("student"),
});

export async function POST(request: NextRequest) {
  // CSRF protection -- Origin header must match app host
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  if (profile.role !== "coach" && profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit check (per D-01, D-04)
  const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/invites");
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  // Coaches can only invite students or student_diy
  if (profile.role === "coach" && parsed.data.role !== "student" && parsed.data.role !== "student_diy") {
    return NextResponse.json({ error: "Coaches can only invite students" }, { status: 403 });
  }

  // Check if email already belongs to a registered user
  const { data: existingUser } = await admin
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json(
      { error: "A user with this email is already registered" },
      { status: 409 }
    );
  }

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const expiresAt = new Date(
    Date.now() + INVITE_CONFIG.codeExpiryHours * 60 * 60 * 1000
  ).toISOString();

  const { data: invite, error } = await admin
    .from("invites")
    .insert({
      email: normalizedEmail,
      role: parsed.data.role,
      invited_by: profile.id,
      coach_id: profile.role === "coach" && parsed.data.role === "student" ? profile.id : null,
      code,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/invites] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: invite }, { status: 201 });
}
