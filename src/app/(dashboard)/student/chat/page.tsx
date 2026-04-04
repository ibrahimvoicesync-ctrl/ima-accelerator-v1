"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Megaphone, MessageSquare } from "lucide-react";
import { MessageThread } from "@/components/chat/MessageThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
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
  const [viewMode, setViewMode] = useState<"chat" | "broadcasts">("chat");

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Initialization: get profile via /api/messages (admin client, no RLS issues)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function init() {
      try {
        // Fetch messages — the API route looks up profile with admin client
        // and returns { profile: { id, coachId } } for students
        const res = await fetch("/api/messages");
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          const errMsg = (json as { error?: string }).error ?? "Failed to load chat";
          if (errMsg === "No coach assigned") {
            // No coach assigned — show empty state, skip polling
            setIsLoading(false);
            return;
          }
          console.error("Failed to init chat", json);
          toastRef.current({ type: "error", title: "Failed to load chat" });
          setIsLoading(false);
          return;
        }

        const data = (await res.json()) as {
          messages: MessageWithSender[];
          hasMore: boolean;
          profile: { id: string; coachId: string };
        };

        setCurrentUserId(data.profile.id);
        setCoachId(data.profile.coachId);

        // Set initial messages
        setMessages(data.messages);
        setHasMore(data.hasMore);
        prevMessageCountRef.current = data.messages.length;

        // Extract coach name from messages
        const coachMsg = data.messages.find(
          (m) => m.sender_id === data.profile.coachId
        );
        if (coachMsg) {
          setCoachName(coachMsg.sender_name);
        }

        // Mark messages as read on mount (CHAT-07)
        const readRes = await fetch("/api/messages/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coach_id: data.profile.coachId }),
        });
        if (!readRes.ok) {
          console.error("Failed to mark messages as read");
        }

        setIsLoading(false);

        // Scroll to bottom after initial load
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
        });
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

      const prevCount = prevMessageCountRef.current;
      const newCount = data.messages.length;
      prevMessageCountRef.current = newCount;

      setMessages(data.messages);
      setHasMore(data.hasMore);

      if (newCount > prevCount) {
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

  const filteredMessages = viewMode === "broadcasts"
    ? messages.filter((m) => m.is_broadcast)
    : messages.filter((m) => !m.is_broadcast);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 md:-m-8 bg-white">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-ima-border flex-shrink-0">
        <MessageSquare size={20} className="text-ima-primary" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-ima-text">
          {coachName ?? "Your Coach"}
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-ima-border flex-shrink-0">
        <button
          type="button"
          onClick={() => setViewMode("chat")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium min-h-[44px] motion-safe:transition-colors ${
            viewMode === "chat"
              ? "text-ima-primary border-b-2 border-ima-primary"
              : "text-ima-text-light hover:text-ima-text"
          }`}
        >
          <MessageSquare size={16} aria-hidden="true" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setViewMode("broadcasts")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium min-h-[44px] motion-safe:transition-colors ${
            viewMode === "broadcasts"
              ? "text-ima-primary border-b-2 border-ima-primary"
              : "text-ima-text-light hover:text-ima-text"
          }`}
        >
          <Megaphone size={16} aria-hidden="true" />
          Announcements
        </button>
      </div>

      {/* Message thread */}
      <MessageThread
        messages={filteredMessages}
        currentUserId={currentUserId ?? ""}
        hasMore={hasMore}
        onLoadMore={loadOlderMessages}
        isLoadingMore={isLoadingMore}
        bottomRef={bottomRef}
      />

      {/* Composer — only in chat mode */}
      {viewMode === "chat" && (
        <ChatComposer
          onSend={handleSend}
          placeholder="Message your coach..."
        />
      )}
    </div>
  );
}
