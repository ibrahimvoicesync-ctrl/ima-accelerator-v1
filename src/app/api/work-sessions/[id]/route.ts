import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";
import { studentAnalyticsTag } from "@/lib/rpc/student-analytics";

const patchSchema = z.object({
  status: z.enum(["completed", "abandoned", "paused", "in_progress"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // CSRF protection -- Origin header must match app host
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  // Auth check
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
  if (!profile || (profile.role !== "student" && profile.role !== "student_diy")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit check (per D-01, D-04)
  const { allowed: rateLimitAllowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/work-sessions/update");
  if (!rateLimitAllowed) {
    return NextResponse.json(
      { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Fetch existing session (filter by student_id for defense-in-depth)
  const { data: session, error: fetchError } = await admin
    .from("work_sessions")
    .select("*")
    .eq("id", id)
    .eq("student_id", profile.id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { status: newStatus } = parsed.data;

  // State transition validation
  // Valid transitions:
  //   in_progress -> completed, paused, abandoned
  //   paused -> in_progress (resume), abandoned
  const validTransitions: Record<string, string[]> = {
    in_progress: ["completed", "paused", "abandoned"],
    paused: ["in_progress", "abandoned"],
  };

  const allowed = validTransitions[session.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${session.status} to ${newStatus}` },
      { status: 400 }
    );
  }

  // Build update object based on transition
  const update: Record<string, unknown> = { status: newStatus };

  if (newStatus === "completed") {
    update.completed_at = new Date().toISOString();
    update.duration_minutes = session.session_minutes;
  } else if (newStatus === "paused") {
    update.paused_at = new Date().toISOString();
  } else if (newStatus === "in_progress" && session.status === "paused") {
    // Resume: shift started_at forward so elapsed = elapsed-before-pause
    const pausedAt = new Date(session.paused_at!).getTime();
    const startedAt = new Date(session.started_at).getTime();
    const elapsedBeforePause = pausedAt - startedAt;
    const newStartedAt = new Date(Date.now() - elapsedBeforePause).toISOString();
    update.started_at = newStartedAt;
    update.paused_at = null;
  } else if (newStatus === "abandoned") {
    // Delete the session so the cycle slot is freed up for retry
    const { error: deleteError } = await admin
      .from("work_sessions")
      .delete()
      .eq("id", id)
      .eq("student_id", profile.id);

    if (deleteError) {
      console.error("[work-sessions PATCH] Delete failed:", deleteError);
      return NextResponse.json({ error: "Failed to abandon session" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }

  const { data: updated, error: updateError } = await admin
    .from("work_sessions")
    .update(update)
    .eq("id", id)
    .eq("student_id", profile.id)
    .select()
    .single();

  if (updateError) {
    console.error("[work-sessions PATCH] Update failed:", updateError);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }

  revalidateTag("badges", "default");
  try {
    revalidateTag(studentAnalyticsTag(profile.id), "default");
  } catch (e) {
    console.error("[revalidate-tag]", e);
  }
  return NextResponse.json(updated);
}
