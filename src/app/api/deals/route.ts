import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const postDealSchema = z.object({
  revenue: z.number().min(0).max(9999999999.99),
  profit: z.number().min(0).max(9999999999.99),
});

// ---------------------------------------------------------------------------
// POST /api/deals — create a new deal (student/student_diy only)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF protection
    const csrfError = verifyOrigin(request);
    if (csrfError) return csrfError;

    // 2. Auth check
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Profile lookup (admin client bypasses RLS)
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 4. Role check — students only can create deals
    if (!["student", "student_diy"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 5. Rate limit (per D-10, endpoint = "/api/deals")
    const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/deals");
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 6. Body parse
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 7. Zod validation
    const parsed = postDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    // 8. DB insert with 23505 retry (trigger assigns deal_number — do NOT include it)
    const insertPayload = {
      student_id: profile.id,
      revenue: parsed.data.revenue,
      profit: parsed.data.profit,
    };

    const { data: deal, error: insertError } = await admin
      .from("deals")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Retry once on unique_violation (race condition on deal_number trigger)
        const { data: retryDeal, error: retryError } = await admin
          .from("deals")
          .insert(insertPayload)
          .select()
          .single();

        if (retryError) {
          console.error("[POST /api/deals] Insert failed:", retryError);
          return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
        }

        // 9. Cache invalidation
        revalidateTag(`deals-${profile.id}`, "default");

        // 10. Return 201
        return NextResponse.json({ data: retryDeal }, { status: 201 });
      }

      console.error("[POST /api/deals] Insert failed:", insertError);
      return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
    }

    // 9. Cache invalidation
    revalidateTag(`deals-${profile.id}`, "default");

    // 10. Return 201
    return NextResponse.json({ data: deal }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/deals] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/deals — paginated deal list for a student (coach/owner only)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. CSRF protection
    const csrfError = verifyOrigin(request);
    if (csrfError) return csrfError;

    // 2. Auth check
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Profile lookup
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 4. Role check — coach and owner only (students read via their own UI, Phase 41)
    if (!["coach", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 5. Rate limit
    const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/deals");
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 6. Query params
    const { searchParams } = request.nextUrl;
    const studentId = searchParams.get("student_id");
    const pageParam = searchParams.get("page") ?? "1";

    // 7. Validate student_id is present
    if (!studentId) {
      return NextResponse.json({ error: "student_id is required" }, { status: 400 });
    }

    // 8. Parse page with bounds
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const pageSize = 25;
    const offset = (page - 1) * pageSize;

    // 9. DB query — paginated, reverse chronological
    const { data, error, count } = await admin
      .from("deals")
      .select("*", { count: "exact" })
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[GET /api/deals] Query failed:", error);
      return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
    }

    // 10. Return paginated result
    return NextResponse.json({ data: data ?? [], total: count ?? 0, page });
  } catch (err) {
    console.error("[GET /api/deals] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
