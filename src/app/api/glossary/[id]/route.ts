import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const updateGlossarySchema = z.object({
  term: z.string().min(1).max(255).optional(),
  definition: z.string().min(1).max(5000).optional(),
});

// ---------------------------------------------------------------------------
// Route context type (Next.js 16 uses Promise<Params>)
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PUT /api/glossary/[id] — edit a glossary term (owner/coach only per D-12)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  // Validate id is a UUID
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid term ID" }, { status: 400 });
  }

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
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 3. Role check — owner and coach only (per D-12)
    if (!["owner", "coach"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Rate limit
    const { allowed, retryAfterSeconds } = await checkRateLimit(
      profile.id,
      "/api/glossary/[id]"
    );
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 5. Body parse
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 6. Zod validation
    const parsed = updateGlossarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    // 7. Check at least one field is provided
    if (!parsed.data.term && !parsed.data.definition) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // 8. Build update object from only defined fields
    const updateObj: Record<string, string> = {};
    if (parsed.data.term !== undefined) updateObj.term = parsed.data.term;
    if (parsed.data.definition !== undefined) updateObj.definition = parsed.data.definition;

    // 9. Update glossary term
    const { data, error: updateError } = await admin
      .from("glossary_terms")
      .update(updateObj)
      .eq("id", id)
      .select("*, created_by_user:users!glossary_terms_created_by_fkey(name)")
      .single();

    // 10. Handle 23505 unique violation (term rename could collide per Pitfall 3)
    if (updateError) {
      if (updateError.code === "23505") {
        return NextResponse.json(
          { error: "A term with this name already exists" },
          { status: 409 }
        );
      }
      console.error("[PUT /api/glossary/[id]] Update failed:", updateError);
      return NextResponse.json({ error: "Failed to update term" }, { status: 500 });
    }

    return NextResponse.json({ glossary_term: data });
  } catch (err) {
    console.error("[PUT /api/glossary/[id]] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/glossary/[id] — remove a glossary term (owner/coach only per D-12)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  // Validate id is a UUID
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid term ID" }, { status: 400 });
  }

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
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 3. Role check — owner and coach only (per D-12)
    if (!["owner", "coach"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Rate limit
    const { allowed, retryAfterSeconds } = await checkRateLimit(
      profile.id,
      "/api/glossary/[id]"
    );
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 5. Delete glossary term
    const { error: deleteError } = await admin
      .from("glossary_terms")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[DELETE /api/glossary/[id]] Delete failed:", deleteError);
      return NextResponse.json({ error: "Failed to delete term" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/glossary/[id]] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
