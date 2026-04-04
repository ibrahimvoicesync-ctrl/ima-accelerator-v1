import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";
import { MESSAGE_PAGE_SIZE } from "@/lib/chat-utils";

// ---------------------------------------------------------------------------
// GET /api/messages — polling endpoint (no CSRF, no rate limit)
// ---------------------------------------------------------------------------
// Pitfall: DO NOT add checkRateLimit here. Polling every 5s would exhaust the
// 30 req/min cap within 2.5 minutes, locking the user out of the chat.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check (no CSRF on GET endpoints — consistent with /api/calendar pattern)
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
      .select("id, role, coach_id")
      .eq("auth_id", authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 3. Role check — owner, coach, student allowed; student_diy excluded via proxy
    if (!["coach", "student", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Parse query params
    const { searchParams } = request.nextUrl;
    const studentId = searchParams.get("student_id");
    const beforeCursor = searchParams.get("before"); // ISO timestamp for pagination
    const queryType = searchParams.get("type"); // "conversations" = return summaries

    // ---------------------------------------------------------------------------
    // Coach: conversation summaries or thread messages
    // ---------------------------------------------------------------------------
    if (profile.role === "coach" || profile.role === "owner") {
      const coachId =
        profile.role === "coach"
          ? profile.id
          : searchParams.get("coach_id") ?? profile.id;

      // Conversation summaries mode — aggregate last message + unread count per student
      if (queryType === "conversations") {
        // Fetch last 200 messages to build conversation summaries in JS
        const { data: recentMessages, error: msgError } = await admin
          .from("messages")
          .select("*, sender:users!messages_sender_id_fkey(id, name)")
          .eq("coach_id", coachId)
          .order("created_at", { ascending: false })
          .limit(200);

        if (msgError) {
          console.error("[GET /api/messages] Failed to fetch messages:", msgError);
          return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
        }

        // Also fetch all assigned students so we show conversations even if no messages yet
        const { data: students, error: studentError } = await admin
          .from("users")
          .select("id, name")
          .eq("coach_id", coachId)
          .eq("status", "active");

        if (studentError) {
          console.error("[GET /api/messages] Failed to fetch students:", studentError);
          return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
        }

        // Build per-student conversation map
        type ConversationSummary = {
          studentId: string;
          studentName: string;
          lastMessage: string;
          lastMessageAt: string;
          unreadCount: number;
        };

        const conversationMap = new Map<string, ConversationSummary>();

        // Initialize entries from students list (ensures all students appear)
        for (const student of students ?? []) {
          conversationMap.set(student.id, {
            studentId: student.id,
            studentName: student.name ?? "",
            lastMessage: "",
            lastMessageAt: "",
            unreadCount: 0,
          });
        }

        // Process messages to fill in last message and unread count
        type MessageRow = {
          sender_id: string;
          recipient_id: string | null;
          is_broadcast: boolean;
          content: string;
          created_at: string;
          read_at: string | null;
          sender: { id: string; name: string } | null;
        };

        for (const msg of (recentMessages as MessageRow[]) ?? []) {
          // Determine the non-coach participant (the student)
          const participantId = msg.is_broadcast
            ? null // broadcast — handled separately
            : msg.sender_id === coachId
              ? msg.recipient_id
              : msg.sender_id;

          if (!participantId) continue;

          const entry = conversationMap.get(participantId);
          if (entry) {
            // First message we see for this student is the most recent (DESC order)
            if (!entry.lastMessageAt) {
              entry.lastMessage = msg.content;
              entry.lastMessageAt = msg.created_at;
            }
            // Count messages sent TO the coach that are unread
            if (msg.recipient_id === coachId && !msg.read_at) {
              entry.unreadCount += 1;
            }
          }
        }

        const conversations = Array.from(conversationMap.values()).sort((a, b) => {
          if (!a.lastMessageAt) return 1;
          if (!b.lastMessageAt) return -1;
          return b.lastMessageAt.localeCompare(a.lastMessageAt);
        });

        return NextResponse.json({ conversations, profile: { id: profile.id } });
      }

      // Thread messages mode
      let query = admin
        .from("messages")
        .select("*, sender:users!messages_sender_id_fkey(id, name)")
        .eq("coach_id", coachId);

      // Filter by broadcast or specific student conversation
      const broadcast = searchParams.get("broadcast");
      if (broadcast === "true") {
        query = query.eq("is_broadcast", true);
      } else if (studentId) {
        query = query.or(
          `recipient_id.eq.${studentId},sender_id.eq.${studentId}`
        );
      }

      // Cursor pagination — load messages before this timestamp
      if (beforeCursor) {
        query = query.lt("created_at", beforeCursor);
      }

      const { data: messages, error: messagesError } = await query
        .order("created_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      if (messagesError) {
        console.error("[GET /api/messages] Failed to fetch messages:", messagesError);
        return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
      }

      return NextResponse.json({
        messages: (messages ?? []).reverse(),
        hasMore: (messages?.length ?? 0) === MESSAGE_PAGE_SIZE,
        profile: { id: profile.id },
      });
    }

    // ---------------------------------------------------------------------------
    // Student: own conversation with their coach (DMs + broadcasts)
    // ---------------------------------------------------------------------------
    if (!profile.coach_id) {
      return NextResponse.json({ error: "No coach assigned" }, { status: 400 });
    }

    let studentQuery = admin
      .from("messages")
      .select("*, sender:users!messages_sender_id_fkey(id, name)")
      .eq("coach_id", profile.coach_id)
      .or(
        // DMs to/from this student OR broadcast messages from their coach
        `and(recipient_id.eq.${profile.id},is_broadcast.eq.false),and(sender_id.eq.${profile.id},is_broadcast.eq.false),is_broadcast.eq.true`
      );

    if (beforeCursor) {
      studentQuery = studentQuery.lt("created_at", beforeCursor);
    }

    const { data: studentMessages, error: studentMsgError } = await studentQuery
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);

    if (studentMsgError) {
      console.error("[GET /api/messages] Failed to fetch student messages:", studentMsgError);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    return NextResponse.json({
      messages: (studentMessages ?? []).reverse(),
      hasMore: (studentMessages?.length ?? 0) === MESSAGE_PAGE_SIZE,
      profile: { id: profile.id, coachId: profile.coach_id },
    });
  } catch (err) {
    console.error("[GET /api/messages] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/messages — send a message (CSRF + rate limit + Zod)
// ---------------------------------------------------------------------------

const messageSchema = z.object({
  content: z.string().min(1).max(2000),
  recipient_id: z.string().uuid().nullable(),
  is_broadcast: z.boolean().default(false),
});

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
      .select("id, role, coach_id")
      .eq("auth_id", authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 3. Role check — coach or student only (owner cannot send messages)
    if (profile.role !== "coach" && profile.role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Rate limit
    const { allowed, retryAfterSeconds } = await checkRateLimit(
      profile.id,
      "/api/messages"
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
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    // 7. Business rules per role
    let coachId: string;
    let senderId: string;
    let recipientId: string | null;
    let isBroadcast: boolean;

    if (profile.role === "coach") {
      coachId = profile.id;
      senderId = profile.id;

      if (parsed.data.is_broadcast) {
        // Broadcast: recipient must be null
        recipientId = null;
        isBroadcast = true;
      } else {
        recipientId = parsed.data.recipient_id;
        isBroadcast = false;
      }
    } else {
      // Student role
      if (!profile.coach_id) {
        return NextResponse.json({ error: "No coach assigned" }, { status: 400 });
      }
      if (parsed.data.is_broadcast) {
        // Students cannot broadcast
        return NextResponse.json(
          { error: "Students cannot send broadcast messages" },
          { status: 403 }
        );
      }
      coachId = profile.coach_id;
      senderId = profile.id;
      recipientId = profile.coach_id;
      isBroadcast = false;
    }

    // 8. Insert message
    const { data: message, error: insertError } = await admin
      .from("messages")
      .insert({
        coach_id: coachId,
        sender_id: senderId,
        recipient_id: recipientId,
        is_broadcast: isBroadcast,
        content: parsed.data.content,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/messages] Insert failed:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/messages] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
