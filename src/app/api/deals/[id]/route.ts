import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// Route context type (Next.js 16 uses Promise<Params>)
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// UUID validation regex
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Zod schema for PATCH — at least one of revenue/profit must be provided
// ---------------------------------------------------------------------------

const patchDealSchema = z
  .object({
    revenue: z.number().min(0).max(9999999999.99).optional(),
    profit: z.number().min(0).max(9999999999.99).optional(),
  })
  .refine((data) => data.revenue !== undefined || data.profit !== undefined, {
    message: "At least one field (revenue or profit) must be provided",
  });

// ---------------------------------------------------------------------------
// PATCH /api/deals/[id] — update revenue/profit (student/student_diy only)
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    // 1. Params — async params per Next.js 16
    const { id } = await params;

    // UUID validation
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
    }

    // 2. CSRF protection
    const csrfError = verifyOrigin(request);
    if (csrfError) return csrfError;

    // 3. Auth check
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 4. Profile lookup (admin client bypasses RLS)
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 5. Role check — only students can update their own deals
    if (!["student", "student_diy"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 6. Rate limit (per D-10, endpoint = "/api/deals/[id]")
    const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/deals/[id]");
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 7. Body parse
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 8. Zod validation
    const parsed = patchDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    // 9. Ownership-scoped update (single query enforces ownership via student_id filter)
    const updatePayload: Record<string, number> = {};
    if (parsed.data.revenue !== undefined) updatePayload.revenue = parsed.data.revenue;
    if (parsed.data.profit !== undefined) updatePayload.profit = parsed.data.profit;

    const { data: updated, error: updateError } = await admin
      .from("deals")
      .update(updatePayload)
      .eq("id", id)
      .eq("student_id", profile.id) // ownership enforced at query level
      .select()
      .single();

    // 10. Handle not found / forbidden (student_id filter eliminates row → .single() returns null)
    if (updateError || !updated) {
      if (updateError) {
        console.error("[PATCH /api/deals/[id]] Update failed:", updateError);
      }
      return NextResponse.json({ error: "Deal not found or forbidden" }, { status: 404 });
    }

    // 11. Cache invalidation
    revalidateTag(`deals-${profile.id}`, "default");

    // 12. Return updated deal
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[PATCH /api/deals/[id]] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/deals/[id] — three-tier authorization (student own / coach assigned / owner any)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    // 1. Params — async params per Next.js 16
    const { id } = await params;

    // UUID validation
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
    }

    // 2. CSRF protection
    const csrfError = verifyOrigin(request);
    if (csrfError) return csrfError;

    // 3. Auth check
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 4. Profile lookup — all roles need access for three-tier check
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 5. Role check — all four roles can delete (scope varies per tier)
    if (!["student", "student_diy", "coach", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 6. Rate limit (per D-10, endpoint = "/api/deals/[id]")
    const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/deals/[id]");
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 7. Fetch the deal first — needed for student_id to scope revalidateTag and tier checks
    const { data: deal, error: dealFetchError } = await admin
      .from("deals")
      .select("id, student_id")
      .eq("id", id)
      .single();

    if (dealFetchError || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // 8. Three-tier authorization (per D-11)
    if (profile.role === "student" || profile.role === "student_diy") {
      // Tier 1: students can only delete their own deals
      if (deal.student_id !== profile.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role === "coach") {
      // Tier 2: coaches can delete deals of assigned students only
      const { data: assignedStudent } = await admin
        .from("users")
        .select("id")
        .eq("id", deal.student_id)
        .eq("coach_id", profile.id)
        .single();

      if (!assignedStudent) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    // Tier 3: owner — already validated in role check step 5, passes through

    // 9. Delete the deal
    const { error: deleteError } = await admin
      .from("deals")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[DELETE /api/deals/[id]] Delete failed:", deleteError);
      return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 });
    }

    // 10. Cache invalidation — use deal.student_id (NOT profile.id) so coach/owner
    //     invalidate the correct student's cache (per D-02, Pitfall 4)
    revalidateTag(`deals-${deal.student_id}`, "default");

    // 11. Return success
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/deals/[id]] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
