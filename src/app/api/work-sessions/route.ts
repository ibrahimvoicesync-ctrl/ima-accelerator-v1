import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_TRACKER } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cycle_number: z.number().int().min(1),
  session_minutes: z.number().int().refine(
    (v) => (WORK_TRACKER.sessionDurationOptions as readonly number[]).includes(v),
    { message: "session_minutes must be 30, 45, or 60" }
  ),
});

export async function POST(request: Request) {
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

  // Rate limit check (per D-01, D-04)
  const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/work-sessions");
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { date, cycle_number, session_minutes } = parsed.data;

  // Check for existing in_progress or paused session for this student on this date
  const { data: activeSession } = await admin
    .from("work_sessions")
    .select("id, status")
    .eq("student_id", profile.id)
    .eq("date", date)
    .in("status", ["in_progress", "paused"])
    .limit(1)
    .single();

  if (activeSession) {
    return NextResponse.json(
      { error: "An active or paused session already exists", session_id: activeSession.id },
      { status: 409 }
    );
  }

  // Insert new session
  const { data: session, error: insertError } = await admin
    .from("work_sessions")
    .insert({
      student_id: profile.id,
      date,
      cycle_number,
      session_minutes,
      started_at: new Date().toISOString(),
      status: "in_progress",
    })
    .select()
    .single();

  if (insertError) {
    // Unique constraint violation = duplicate cycle_number for this student+date
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Cycle already exists for this date" }, { status: 409 });
    }
    console.error("[work-sessions POST] Insert failed:", insertError);
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
  }

  revalidateTag("badges", "default");
  return NextResponse.json(session, { status: 201 });
}
