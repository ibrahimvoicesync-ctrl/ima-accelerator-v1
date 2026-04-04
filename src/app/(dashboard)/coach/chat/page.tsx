"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { usePolling } from "@/lib/hooks/usePolling";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import {
  ConversationList,
  type ConversationSummary,
} from "@/components/chat/ConversationList";
import { MessageThread } from "@/components/chat/MessageThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import {
  MESSAGE_POLL_INTERVAL,
  type MessageWithSender,
} from "@/lib/chat-utils";

export default function CoachChatPage() {
  // Auth state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Conversation list
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected conversation state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [selectedStudentName, setSelectedStudentName] = useState<string>("");

  // Message thread state
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  // Mobile toggle: true = show thread, false = show conversation list
  const [showThread, setShowThread] = useState(false);

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Stable refs for toast and router (Hard Rule: stable useCallback deps)
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const selectedStudentIdRef = useRef(selectedStudentId);
  selectedStudentIdRef.current = selectedStudentId;

  const isBroadcastModeRef = useRef(isBroadcastMode);
  isBroadcastModeRef.current = isBroadcastMode;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // currentUserId is set from the API response in fetchConversations

  // Auto-scroll to bottom utility
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages?type=conversations");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("[CoachChatPage] Failed to fetch conversations:", (json as { error?: string }).error ?? res.status);
        return;
      }
      const data = (await res.json()) as { conversations: ConversationSummary[]; profile: { id: string } };
      setConversations(data.conversations ?? []);
      if (data.profile?.id) setCurrentUserId(data.profile.id);
      setIsLoading(false);
    } catch (err) {
      console.error("[CoachChatPage] Network error fetching conversations:", err);
      setIsLoading(false);
    }
  }, []);

  // Fetch messages for the selected student or broadcast
  const fetchMessages = useCallback(async () => {
    const studentId = selectedStudentIdRef.current;
    const isBroadcast = isBroadcastModeRef.current;
    if (!studentId && !isBroadcast) return;

    const url = isBroadcast
      ? "/api/messages?broadcast=true"
      : `/api/messages?student_id=${studentId}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("[CoachChatPage] Failed to fetch messages:", (json as { error?: string }).error ?? res.status);
        return;
      }
      const data = (await res.json()) as {
        messages: MessageWithSender[];
        hasMore: boolean;
      };
      const incoming = data.messages ?? [];

      setMessages((prev) => {
        const isFirstLoad = prev.length === 0;
        if (isFirstLoad) {
          // Scroll to bottom on first load
          requestAnimationFrame(() => scrollToBottom());
          return incoming;
        }

        // Check if new messages arrived
        if (incoming.length > prev.length) {
          // Auto-scroll only if user is near bottom
          const container = scrollContainerRef.current;
          const isNearBottom = container
            ? container.scrollTop + container.clientHeight >= container.scrollHeight - 100
            : true;
          if (isNearBottom) {
            requestAnimationFrame(() => scrollToBottom());
          }
          return incoming;
        }
        return prev;
      });

      setIsLoadingThread(false);
      setHasMore(data.hasMore ?? false);
      prevMessageCountRef.current = incoming.length;
    } catch (err) {
      console.error("[CoachChatPage] Network error fetching messages:", err);
      setIsLoadingThread(false);
    }
  }, [scrollToBottom]);

  // Poll conversation list continuously
  usePolling(fetchConversations, MESSAGE_POLL_INTERVAL);

  // Poll message thread when a student is selected or broadcast mode
  usePolling(fetchMessages, MESSAGE_POLL_INTERVAL, selectedStudentId !== null || isBroadcastMode);

  // Mark messages as read when opening a conversation
  const markAsRead = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch("/api/messages/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-origin": window.location.origin },
        body: JSON.stringify({ coach_id: currentUserId }),
      });
      if (!res.ok) {
        console.error("[CoachChatPage] Failed to mark as read:", res.status);
      }
    } catch (err) {
      console.error("[CoachChatPage] Network error marking as read:", err);
    }
  }, [currentUserId]);

  // Select a student conversation
  const handleSelectStudent = useCallback(
    (studentId: string) => {
      const conv = conversations.find((c) => c.studentId === studentId);
      setSelectedStudentId(studentId);
      setSelectedStudentName(conv?.studentName ?? "");
      setIsBroadcastMode(false);
      setShowThread(true);
      setMessages([]);
      setHasMore(false);
      setIsLoadingThread(true);
      prevMessageCountRef.current = 0;
      void markAsRead();
    },
    [conversations, markAsRead]
  );

  // Select broadcast mode
  const handleSelectBroadcast = useCallback(() => {
    setIsBroadcastMode(true);
    setSelectedStudentId(null);
    setSelectedStudentName("");
    setShowThread(true);
    setMessages([]);
    setIsLoadingThread(true);
  }, []);

  // Load older messages (cursor pagination, scroll preservation)
  const loadOlderMessages = useCallback(async () => {
    const studentId = selectedStudentIdRef.current;
    const isBroadcast = isBroadcastModeRef.current;
    const currentMessages = messagesRef.current;
    if ((!studentId && !isBroadcast) || currentMessages.length === 0) return;

    setIsLoadingMore(true);
    const oldest = currentMessages[0];

    // Record scroll position before prepending
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    const baseUrl = isBroadcast
      ? `/api/messages?broadcast=true`
      : `/api/messages?student_id=${studentId}`;

    try {
      const res = await fetch(
        `${baseUrl}&before=${encodeURIComponent(oldest.created_at)}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to load older messages" });
        return;
      }
      const data = (await res.json()) as {
        messages: MessageWithSender[];
        hasMore: boolean;
      };
      const older = data.messages ?? [];

      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setHasMore(data.hasMore ?? false);

        // Restore scroll position after DOM update
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop += newScrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (err) {
      console.error("[CoachChatPage] Network error loading older messages:", err);
      toastRef.current({ type: "error", title: "Network error loading messages" });
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  // Send a direct message
  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedStudentId) return;
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-origin": window.location.origin,
          },
          body: JSON.stringify({
            content,
            recipient_id: selectedStudentId,
            is_broadcast: false,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to send message" });
          return;
        }
        const data = (await res.json()) as { message: MessageWithSender };
        setMessages((prev) => [...prev, data.message]);
        requestAnimationFrame(() => scrollToBottom());
      } catch (err) {
        console.error("[CoachChatPage] Network error sending message:", err);
        toastRef.current({ type: "error", title: "Network error sending message" });
      }
    },
    [selectedStudentId, scrollToBottom]
  );

  // Send a broadcast message
  const handleBroadcast = useCallback(
    async (content: string) => {
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-origin": window.location.origin,
          },
          body: JSON.stringify({
            content,
            recipient_id: null,
            is_broadcast: true,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to send broadcast" });
          return;
        }
        const data = (await res.json()) as { message: MessageWithSender };
        setMessages((prev) => [...prev, data.message]);
        requestAnimationFrame(() => scrollToBottom());
        toastRef.current({ type: "success", title: "Broadcast sent to all students" });
      } catch (err) {
        console.error("[CoachChatPage] Network error sending broadcast:", err);
        toastRef.current({ type: "error", title: "Network error sending broadcast" });
      }
    },
    []
  );

  if (isLoading || !currentUserId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Spinner size="lg" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Desktop layout: two-panel split
  // -------------------------------------------------------------------------
  const leftPanel = (
    <div className="w-[300px] border-r border-ima-border h-full shrink-0">
      <ConversationList
        conversations={conversations}
        selectedStudentId={selectedStudentId}
        onSelectStudent={handleSelectStudent}
        onSelectBroadcast={handleSelectBroadcast}
        isBroadcastSelected={isBroadcastMode}
      />
    </div>
  );

  const rightPanel = (
    <div className="flex-1 flex flex-col h-full min-w-0 min-h-0">
      {isBroadcastMode ? (
        <>
          <div className="px-4 py-3 border-b border-ima-border bg-white">
            <h2 className="text-base font-semibold text-ima-text">
              Broadcast to All Students
            </h2>
            <p className="text-xs text-ima-text-light mt-0.5">
              Your message will be sent to all your assigned students.
            </p>
          </div>
          {isLoadingThread ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <MessageThread
              messages={messages}
              currentUserId={currentUserId ?? ""}
              hasMore={hasMore}
              onLoadMore={loadOlderMessages}
              isLoadingMore={isLoadingMore}
              bottomRef={bottomRef}
            />
          )}
          <ChatComposer
            onSend={handleBroadcast}
            isBroadcast
            placeholder="Broadcast message to all students..."
          />
        </>
      ) : selectedStudentId ? (
        <>
          <div className="px-4 py-3 border-b border-ima-border bg-white">
            <h2 className="text-base font-semibold text-ima-text">
              {selectedStudentName}
            </h2>
          </div>
          {isLoadingThread ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <MessageThread
              messages={messages}
              currentUserId={currentUserId}
              hasMore={hasMore}
              onLoadMore={loadOlderMessages}
              isLoadingMore={isLoadingMore}
              bottomRef={bottomRef}
            />
          )}
          <ChatComposer onSend={handleSend} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-ima-text-light">
            Select a conversation to start messaging
          </p>
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Mobile: show thread or list based on showThread state (D-04)
  // -------------------------------------------------------------------------
  const mobileHeader = showThread && (selectedStudentId || isBroadcastMode) ? (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-ima-border bg-white">
      <button
        type="button"
        onClick={() => setShowThread(false)}
        aria-label="Back to conversations"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <ArrowLeft size={20} aria-hidden="true" className="text-ima-text" />
      </button>
      <h2 className="text-base font-semibold text-ima-text">
        {isBroadcastMode ? "Broadcast" : selectedStudentName}
      </h2>
    </div>
  ) : null;

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden md:flex h-[calc(100vh-4rem)] -m-4 md:-m-8 bg-white">
        {leftPanel}
        {rightPanel}
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col md:hidden h-[calc(100vh-4rem)] -m-4 bg-white">
        {!showThread ? (
          <ConversationList
            conversations={conversations}
            selectedStudentId={selectedStudentId}
            onSelectStudent={handleSelectStudent}
            onSelectBroadcast={handleSelectBroadcast}
            isBroadcastSelected={isBroadcastMode}
          />
        ) : (
          <>
            {mobileHeader}
            {isBroadcastMode ? (
              <>
                <div className="px-4 py-3 text-xs text-ima-text-light border-b border-ima-border">
                  Your message will be sent to all your assigned students.
                </div>
                {isLoadingThread ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Spinner size="lg" />
                  </div>
                ) : (
                  <MessageThread
                    messages={messages}
                    currentUserId={currentUserId ?? ""}
                    hasMore={hasMore}
                    onLoadMore={loadOlderMessages}
                    isLoadingMore={isLoadingMore}
                    bottomRef={bottomRef}
                  />
                )}
                <ChatComposer
                  onSend={handleBroadcast}
                  isBroadcast
                  placeholder="Broadcast message to all students..."
                />
              </>
            ) : selectedStudentId ? (
              <>
                {isLoadingThread ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Spinner size="lg" />
                  </div>
                ) : (
                  <MessageThread
                    messages={messages}
                    currentUserId={currentUserId}
                    hasMore={hasMore}
                    onLoadMore={loadOlderMessages}
                    isLoadingMore={isLoadingMore}
                    bottomRef={bottomRef}
                  />
                )}
                <ChatComposer onSend={handleSend} />
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
