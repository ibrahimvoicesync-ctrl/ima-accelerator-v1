import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITE_CONFIG, APP_CONFIG, VALIDATION } from "@/lib/config";

const inviteSchema = z.object({
  email: z.string().email().max(VALIDATION.email.max),
});

export async function POST(request: NextRequest) {
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

  if (profile.role !== "coach") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const expiresAt = new Date(
    Date.now() + INVITE_CONFIG.codeExpiryHours * 60 * 60 * 1000
  ).toISOString();

  const { data: invite, error } = await admin
    .from("invites")
    .insert({
      email: parsed.data.email,
      role: "student",
      invited_by: profile.id,
      coach_id: profile.id, // CRITICAL: auto-assign coach so student is assigned on registration
      code,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/invites] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? APP_CONFIG.url;
  const registerUrl = `${baseUrl}/register?code=${code}`;

  return NextResponse.json({ data: invite, registerUrl }, { status: 201 });
}
