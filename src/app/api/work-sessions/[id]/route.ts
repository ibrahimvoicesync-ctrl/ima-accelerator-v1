import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_TRACKER } from "@/lib/config";

const patchSchema = z.object({
  status: z.enum(["completed", "abandoned", "paused", "in_progress"]),
  duration_minutes: z.number().int().min(0).max(60).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const { status: newStatus, duration_minutes } = parsed.data;

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
    update.duration_minutes = duration_minutes ?? WORK_TRACKER.sessionMinutes;
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
    update.completed_at = new Date().toISOString();
    // Calculate actual elapsed minutes for abandoned sessions
    const elapsedMs = Date.now() - new Date(session.started_at).getTime();
    update.duration_minutes = Math.min(
      Math.floor(elapsedMs / 60000),
      WORK_TRACKER.sessionMinutes
    );
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

  return NextResponse.json(updated);
}
