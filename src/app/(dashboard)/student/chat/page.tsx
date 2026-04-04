"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { MessageThread } from "@/components/chat/MessageThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { usePolling } from "@/lib/hooks/usePolling";
import {
  MESSAGE_POLL_INTERVAL,
  MESSAGE_PAGE_SIZE,
  type MessageWithSender,
} from "@/lib/chat-utils";

export default function StudentChatPage() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [coachName, setCoachName] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Initialization: get user profile + coachId
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsLoading(false);
          return;
        }

        // Students can read their own row via RLS (self-read allowed)
        const { data: profile, error } = await supabase
          .from("users")
          .select("id, coach_id, name")
          .eq("auth_id", user.id)
          .single();

        if (error || !profile) {
          console.error("Failed to load student profile", error);
          toastRef.current({ type: "error", title: "Failed to load profile" });
          setIsLoading(false);
          return;
        }

        setCurrentUserId(profile.id);

        if (!profile.coach_id) {
          // No coach assigned — show error state, skip polling
          setIsLoading(false);
          return;
        }

        setCoachId(profile.coach_id);

        // Mark messages as read on mount (CHAT-07)
        const readRes = await fetch("/api/messages/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coach_id: profile.coach_id }),
        });
        if (!readRes.ok) {
          console.error("Failed to mark messages as read");
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Chat init error", err);
        toastRef.current({ type: "error", title: "Failed to initialize chat" });
        setIsLoading(false);
      }
    }

    void init();
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch messages (used by polling and initial load)
  // ---------------------------------------------------------------------------
  const fetchMessages = useCallback(async () => {
    if (!coachId) return;
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("Failed to fetch messages", json);
        return;
      }
      const data = (await res.json()) as {
        messages: MessageWithSender[];
        hasMore: boolean;
        coachName?: string;
      };

      // Extract coach name from first message if available
      if (data.coachName && !coachName) {
        setCoachName(data.coachName);
      } else if (data.messages.length > 0 && !coachName) {
        // Try to infer coach name from a message where sender is the coach
        const coachMsg = data.messages.find((m) => m.sender_id === coachId);
        if (coachMsg) {
          setCoachName(coachMsg.sender_name);
        }
      }

      setHasMore(data.hasMore);

      // Auto-scroll guard (Pitfall 4, CHAT-09): only scroll to bottom if user
      // is near the bottom OR if new messages arrived while they were at bottom
      const container = scrollContainerRef.current;
      const isNearBottom = container
        ? container.scrollTop + container.clientHeight >= container.scrollHeight - 100
        : true;

      const prevCount = prevMessageCountRef.current;
      const newCount = data.messages.length;
      prevMessageCountRef.current = newCount;

      setMessages(data.messages);

      if (isNearBottom && newCount > prevCount) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }
    } catch (err) {
      console.error("Polling fetch error", err);
    }
  }, [coachId, coachName]);

  // ---------------------------------------------------------------------------
  // Polling — enabled only after initialization completes and coachId is set
  // ---------------------------------------------------------------------------
  usePolling(fetchMessages, MESSAGE_POLL_INTERVAL, !!coachId && !isLoading);

  // Scroll to bottom on initial message load
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  // Only run once after initial load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // ---------------------------------------------------------------------------
  // Send message (CHAT-04)
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(
    async (content: string) => {
      if (!coachId || !currentUserId) return;
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            recipient_id: coachId,
            is_broadcast: false,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          toastRef.current({
            type: "error",
            title: "Failed to send message",
            description: (json as { error?: string }).error ?? undefined,
          });
          return;
        }
        const data = (await res.json()) as { message: MessageWithSender };

        // Optimistically append the new message and scroll to bottom
        setMessages((prev) => [...prev, data.message]);
        prevMessageCountRef.current += 1;
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      } catch (err) {
        console.error("Send message error", err);
        toastRef.current({ type: "error", title: "Failed to send message" });
      }
    },
    [coachId, currentUserId]
  );

  // ---------------------------------------------------------------------------
  // Load older messages (CHAT-08) — cursor-based pagination
  // ---------------------------------------------------------------------------
  const loadOlderMessages = useCallback(async () => {
    if (!coachId || isLoadingMore || !hasMore || messages.length === 0) return;
    setIsLoadingMore(true);

    const oldest = messages[0].created_at;
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    try {
      const res = await fetch(
        `/api/messages?before=${encodeURIComponent(oldest)}&limit=${MESSAGE_PAGE_SIZE}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("Failed to load older messages", json);
        return;
      }
      const data = (await res.json()) as {
        messages: MessageWithSender[];
        hasMore: boolean;
      };

      setHasMore(data.hasMore);
      setMessages((prev) => [...data.messages, ...prev]);

      // Restore scroll position after DOM update (Pitfall 3)
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop += container.scrollHeight - prevScrollHeight;
        }
      });
    } catch (err) {
      console.error("Load older messages error", err);
      toastRef.current({ type: "error", title: "Failed to load older messages" });
    } finally {
      setIsLoadingMore(false);
    }
  }, [coachId, isLoadingMore, hasMore, messages]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!coachId) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center px-4">
        <EmptyState
          icon={<MessageSquare size={32} aria-hidden="true" />}
          title="No Coach Assigned"
          description="You need a coach assignment to use chat. Contact your administrator."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 md:-m-8 bg-white">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-ima-border flex-shrink-0">
        <MessageSquare size={20} className="text-ima-primary" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-ima-text">
          {coachName ?? "Your Coach"}
        </h1>
      </div>

      {/* Message thread */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <MessageThread
          messages={messages}
          currentUserId={currentUserId ?? ""}
          hasMore={hasMore}
          onLoadMore={loadOlderMessages}
          isLoadingMore={isLoadingMore}
          bottomRef={bottomRef}
        />
      </div>

      {/* Composer */}
      <ChatComposer
        onSend={handleSend}
        placeholder="Message your coach..."
      />
    </div>
  );
}
