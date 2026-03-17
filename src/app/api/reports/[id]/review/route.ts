import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const reviewSchema = z.object({
  reviewed: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth — verify user session
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Admin client — bypass RLS for profile lookup
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  // 3. Role check — coaches only
  if (profile.role !== "coach") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  // 5. Extract route param
  const { id } = await params;

  // 6. Fetch report — verify it exists
  const { data: report, error: reportError } = await admin
    .from("daily_reports")
    .select("id, student_id")
    .eq("id", id)
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // 7. Defense-in-depth ownership check — student must belong to this coach
  const { data: studentMatch, error: studentError } = await admin
    .from("users")
    .select("id")
    .eq("id", report.student_id)
    .eq("coach_id", profile.id)
    .single();

  if (studentError || !studentMatch) {
    return NextResponse.json({ error: "Not your student" }, { status: 403 });
  }

  // 8. Toggle review status
  const updatePayload =
    parsed.data.reviewed === true
      ? { reviewed_by: profile.id, reviewed_at: new Date().toISOString() }
      : { reviewed_by: null, reviewed_at: null };

  const { data: updated, error: updateError } = await admin
    .from("daily_reports")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ data: updated });
}
