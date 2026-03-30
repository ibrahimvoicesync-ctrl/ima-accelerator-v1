import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

const dismissSchema = z.object({
  alert_key: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Profile + role check (owner only)
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit check (per D-01, D-04)
  const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/alerts/dismiss");
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // 3. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = dismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  // 4. Upsert dismissal (idempotent — UNIQUE constraint prevents duplicates)
  // owner_id from authenticated profile, NEVER from request body
  const { error } = await admin
    .from("alert_dismissals")
    .upsert(
      { owner_id: profile.id, alert_key: parsed.data.alert_key },
      { onConflict: "owner_id,alert_key", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[POST /api/alerts/dismiss] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("badges", "default");
  return NextResponse.json({ success: true });
}
