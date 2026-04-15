import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// Route context type (Next.js 16 uses Promise<Params>)
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Constants — EDITED_TOLERANCE_MS mirrors the value in /api/announcements
// (D-56-07 locked at 2000ms). Keep these two in lockstep.
// ---------------------------------------------------------------------------

const EDITED_TOLERANCE_MS = 2000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Zod schema — content only, 1..2000 chars (D-56-01)
// ---------------------------------------------------------------------------

const patchAnnouncementSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(2000, "Content must be 2000 characters or fewer"),
});

// ---------------------------------------------------------------------------
// Shared payload shape — mirrors /api/announcements/route.ts#toAnnouncementPayload.
// Redeclared inline (not imported) because Next.js route handler files must
// only export HTTP verb handlers — extra exports break route detection.
// ---------------------------------------------------------------------------

type AnnouncementRow = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author: { id: string; name: string; role: string } | null;
};

function toAnnouncementPayload(row: AnnouncementRow) {
  const createdMs = new Date(row.created_at).getTime();
  const updatedMs = new Date(row.updated_at).getTime();
  const isEdited = updatedMs - createdMs > EDITED_TOLERANCE_MS;

  return {
    id: row.id,
    author_id: row.author_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_edited: isEdited,
    author: row.author
      ? {
          id: row.author.id,
          name: row.author.name,
          // Narrow unknown role strings to the declared union so the payload
          // can't violate AnnouncementAuthor.role ("owner" | "coach").
          role:
            row.author.role === "owner" || row.author.role === "coach"
              ? row.author.role
              : "coach",
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// PATCH /api/announcements/[id] — update content (owner/coach only, ANY row)
// Gates: CSRF → Auth → Profile → Role → RateLimit → Body → Zod → Update
// ANNOUNCE-03 (edit any) — no ownership filter on the update query.
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    // 1. Params — async per Next.js 16
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "Invalid announcement ID" },
        { status: 400 }
      );
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

    // 4. Profile lookup (admin client — CLAUDE.md Hard Rule 4)
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // 5. Role check — ANNOUNCE-03: owner/coach can edit ANY announcement
    if (!["owner", "coach"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 6. Rate limit (endpoint key distinct from collection — per pattern in deals)
    const { allowed, retryAfterSeconds } = await checkRateLimit(
      profile.id,
      "/api/announcements/[id]"
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Too many requests, try again in ${retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        }
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
    const parsed = patchAnnouncementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    // 9. Update — NO ownership filter (ANNOUNCE-03: edit ANY). The
    //    updated_at trigger from Phase 55 advances updated_at automatically.
    const { data: updated, error: updateError } = await admin
      .from("announcements")
      .update({ content: parsed.data.content })
      .eq("id", id)
      .select("*, author:users!announcements_author_id_fkey(id, name, role)")
      .single();

    if (updateError || !updated) {
      if (updateError && updateError.code !== "PGRST116") {
        // PGRST116 = "no rows found" (expected when id doesn't exist).
        // Anything else is a real error.
        console.error(
          "[PATCH /api/announcements/[id]] Update failed:",
          updateError
        );
      }
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // 10. Return updated row with computed is_edited
    return NextResponse.json({
      announcement: toAnnouncementPayload(updated as AnnouncementRow),
    });
  } catch (err) {
    console.error("[PATCH /api/announcements/[id]] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/announcements/[id] — remove (owner/coach only, ANY row)
// Gates: CSRF → Auth → Profile → Role → RateLimit → Delete
// ANNOUNCE-04 — owner/coach can delete ANY announcement, not just their own.
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    // 1. Params
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "Invalid announcement ID" },
        { status: 400 }
      );
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

    // 4. Profile lookup
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // 5. Role check — ANNOUNCE-04: owner/coach can delete ANY announcement
    if (!["owner", "coach"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 6. Rate limit
    const { allowed, retryAfterSeconds } = await checkRateLimit(
      profile.id,
      "/api/announcements/[id]"
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Too many requests, try again in ${retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        }
      );
    }

    // 7. Existence check — distinguish 404 (not found) from silent no-op.
    const { data: existing } = await admin
      .from("announcements")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // 8. Delete — NO ownership filter (ANNOUNCE-04: delete ANY).
    const { error: deleteError } = await admin
      .from("announcements")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
        "[DELETE /api/announcements/[id]] Delete failed:",
        deleteError
      );
      return NextResponse.json(
        { error: "Failed to delete announcement" },
        { status: 500 }
      );
    }

    // 9. Return success
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/announcements/[id]] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
