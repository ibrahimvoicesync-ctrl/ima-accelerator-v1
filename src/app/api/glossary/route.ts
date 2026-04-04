import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const addGlossarySchema = z.object({
  term: z.string().min(1).max(255),
  definition: z.string().min(1).max(5000),
});

// ---------------------------------------------------------------------------
// GET /api/glossary — fetch all glossary terms alphabetically (no CSRF, no rate limit)
// ---------------------------------------------------------------------------

export async function GET() {
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

    // 3. Role check — owner, coach, student, student_diy allowed
    if (!["owner", "coach", "student", "student_diy"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Fetch glossary terms alphabetically with poster name (D-07)
    const { data, error } = await admin
      .from("glossary_terms")
      .select("*, created_by_user:users!glossary_terms_created_by_fkey(name)")
      .order("term", { ascending: true });

    if (error) {
      console.error("[GET /api/glossary] Failed to fetch glossary terms:", error);
      return NextResponse.json({ error: "Failed to fetch glossary terms" }, { status: 500 });
    }

    return NextResponse.json({ glossary_terms: data ?? [] });
  } catch (err) {
    console.error("[GET /api/glossary] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/glossary — create a glossary term (owner/coach only per D-12)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
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
      "/api/glossary"
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
    const parsed = addGlossarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    // 7. Insert glossary term
    const { data, error: insertError } = await admin
      .from("glossary_terms")
      .insert({
        term: parsed.data.term,
        definition: parsed.data.definition,
        created_by: profile.id,
      })
      .select("*, created_by_user:users!glossary_terms_created_by_fkey(name)")
      .single();

    // 8. Handle 23505 unique violation (per Pitfall 3 / RES-09)
    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "A term with this name already exists" },
          { status: 409 }
        );
      }
      console.error("[POST /api/glossary] Insert failed:", insertError);
      return NextResponse.json({ error: "Failed to create term" }, { status: 500 });
    }

    return NextResponse.json({ glossary_term: data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/glossary] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
