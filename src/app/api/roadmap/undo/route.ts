import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROADMAP_STEPS } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

const undoSchema = z.object({
  studentId: z.string().uuid(),
  step_number: z.number().int().min(1).max(ROADMAP_STEPS.length),
});

export async function PATCH(request: NextRequest) {
  try {
    // 1. CSRF protection — Origin header must match app host
    const csrfError = verifyOrigin(request);
    if (csrfError) return csrfError;

    // 2. Auth — get authenticated user
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Profile lookup via admin client (bypasses RLS)
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 4. Role guard — only coach and owner may undo roadmap steps
    if (profile.role !== "coach" && profile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 5. Rate limit check
    const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/roadmap/undo");
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 6. Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 7. Zod validation
    const parsed = undoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    // 8. Destructure validated data
    const { studentId, step_number } = parsed.data;

    // Ownership check — coach may only undo steps for their assigned students
    const { data: student, error: studentError } = await admin
      .from("users")
      .select("id, coach_id")
      .eq("id", studentId)
      .eq("role", "student")
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (profile.role === "coach" && student.coach_id !== profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Revert step N: only if currently completed
    const { data: reverted, error: revertError } = await admin
      .from("roadmap_progress")
      .update({ status: "active", completed_at: null })
      .eq("student_id", studentId)
      .eq("step_number", step_number)
      .eq("status", "completed")
      .select()
      .single();

    if (revertError || !reverted) {
      return NextResponse.json(
        { error: "Step not found or already reverted" },
        { status: 400 }
      );
    }

    // Cascade re-lock N+1: only if step N+1 is currently active
    let relocked = null;
    if (step_number < ROADMAP_STEPS.length) {
      const { data: nextStep } = await admin
        .from("roadmap_progress")
        .update({ status: "locked" })
        .eq("student_id", studentId)
        .eq("step_number", step_number + 1)
        .eq("status", "active")
        .select()
        .single();
      relocked = nextStep ?? null;
    }

    // Audit log — record the undo action
    await admin.from("roadmap_undo_log").insert({
      actor_id: profile.id,
      actor_role: profile.role,
      student_id: studentId,
      step_number,
    });

    return NextResponse.json({
      data: { reverted, relocked, cascade: relocked !== null },
    });
  } catch (error) {
    console.error("PATCH /api/roadmap/undo error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
