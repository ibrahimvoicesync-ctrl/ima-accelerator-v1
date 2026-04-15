import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// Constants (D-56-01 locked content length; D-56-02 locked pageSize=25;
// D-56-07 locked 2000ms tolerance for (edited) indicator)
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;
const EDITED_TOLERANCE_MS = 2000;

// ---------------------------------------------------------------------------
// Zod schema — content only (D-56-01 rejects title field)
// ---------------------------------------------------------------------------

const postAnnouncementSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(2000, "Content must be 2000 characters or fewer"),
});

// ---------------------------------------------------------------------------
// Shared helper: transform DB row + joined author into client-facing Announcement.
// is_edited is computed here (not in SQL) so we can apply the 2-second trigger-
// clock-skew tolerance locked in D-56-07.
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
// POST /api/announcements — create a new announcement (owner/coach only)
// Gates: CSRF → Auth → Profile → Role → RateLimit → Body → Zod → Insert
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF protection (cheapest check first)
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

    // 3. Profile lookup (admin client bypasses RLS per CLAUDE.md Hard Rule 4)
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

    // 4. Role check — only owner/coach can create (ANNOUNCE-02)
    if (!["owner", "coach"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 5. Rate limit — default 30 req / 60s per user (ANNOUNCE-11 / PERF-02)
    const { allowed, retryAfterSeconds } = await checkRateLimit(
      profile.id,
      "/api/announcements"
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

    // 6. Body parse
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 7. Zod validation
    const parsed = postAnnouncementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    // 8. DB insert — select the newly created row joined with the author
    const { data: inserted, error: insertError } = await admin
      .from("announcements")
      .insert({
        author_id: profile.id,
        content: parsed.data.content,
      })
      .select("*, author:users!announcements_author_id_fkey(id, name, role)")
      .single();

    if (insertError || !inserted) {
      console.error(
        "[POST /api/announcements] Insert failed:",
        insertError
      );
      return NextResponse.json(
        { error: "Failed to create announcement" },
        { status: 500 }
      );
    }

    // 9. Return 201 with transformed payload
    return NextResponse.json(
      { announcement: toAnnouncementPayload(inserted as AnnouncementRow) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/announcements] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/announcements?page=N — paginated, any authenticated user.
// D-56-11: auth-only (no role check beyond auth; RLS from Phase 55 enforces
// read access for students + student_diy). No rate limit (read-only). No CSRF
// (safe method).
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check (no CSRF on GET — safe method)
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Profile lookup (admin client — CLAUDE.md Hard Rule 4)
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // 3. Query params — page is 1-indexed; clamp to >= 1 on garbage input.
    const { searchParams } = request.nextUrl;
    const pageParam = searchParams.get("page") ?? "1";
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    // 4. DB query — paginated, newest first, joined with author.
    //    `count: "exact"` drives hasMore + total in the response envelope.
    const { data, error, count } = await admin
      .from("announcements")
      .select(
        "*, author:users!announcements_author_id_fkey(id, name, role)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[GET /api/announcements] Query failed:", error);
      return NextResponse.json(
        { error: "Failed to load announcements" },
        { status: 500 }
      );
    }

    const items = (data ?? []).map((row) =>
      toAnnouncementPayload(row as AnnouncementRow)
    );
    const total = count ?? 0;
    const hasMore = offset + items.length < total;

    return NextResponse.json({ items, hasMore, total });
  } catch (err) {
    console.error("[GET /api/announcements] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
