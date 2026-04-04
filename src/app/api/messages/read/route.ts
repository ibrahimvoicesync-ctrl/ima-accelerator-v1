import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// PATCH /api/messages/read — bulk mark messages as read (CSRF, no rate limit)
// ---------------------------------------------------------------------------
// Rate limit is intentionally omitted: this fires at most once per conversation
// open and is not user-controlled frequency. Adding a rate limit here would
// block the mark-as-read from firing on repeated conversation opens, leaving
// unread indicators stuck.
// ---------------------------------------------------------------------------

const readSchema = z.object({
  coach_id: z.string().uuid(),
});

export async function PATCH(request: NextRequest) {
  // 0. CSRF protection
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Profile lookup
    const { data: profile } = await admin
      .from("users")
      .select("id, role, coach_id")
      .eq("auth_id", authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 3. Role check — coach or student only
    if (profile.role !== "coach" && profile.role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Body parse
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 5. Zod validation
    const parsed = readSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    const readAt = new Date().toISOString();

    // 6. Bulk update — mark unread messages as read based on role
    let updateQuery;

    if (profile.role === "coach") {
      // Coach reads: mark messages sent TO the coach that are still unread
      updateQuery = admin
        .from("messages")
        .update({ read_at: readAt })
        .eq("coach_id", parsed.data.coach_id)
        .eq("recipient_id", profile.id)
        .is("read_at", null);
    } else {
      // Student reads: mark DMs to this student AND broadcast messages as read
      updateQuery = admin
        .from("messages")
        .update({ read_at: readAt })
        .eq("coach_id", parsed.data.coach_id)
        .or(
          `and(recipient_id.eq.${profile.id},is_broadcast.eq.false),is_broadcast.eq.true`
        )
        .is("read_at", null);
    }

    const { data: updatedRows, error: updateError } = await updateQuery.select("id");

    if (updateError) {
      console.error("[PATCH /api/messages/read] Update failed:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ updated: updatedRows?.length ?? 0 });
  } catch (err) {
    console.error("[PATCH /api/messages/read] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
