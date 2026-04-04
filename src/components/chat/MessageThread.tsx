"use client";

import { useRef, useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { BroadcastCard } from "@/components/chat/BroadcastCard";
import { DaySeparator } from "@/components/chat/DaySeparator";
import {
  groupMessagesByDay,
  shouldShowTimestamp,
  isConsecutive,
  type MessageWithSender,
} from "@/lib/chat-utils";

interface MessageThreadProps {
  messages: MessageWithSender[];
  currentUserId: string;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  isLoadingMore: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}

export function MessageThread({
  messages,
  currentUserId,
  hasMore,
  onLoadMore,
  isLoadingMore,
  bottomRef,
}: MessageThreadProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-trigger load more when scrolled near the top
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 100 && hasMore && !isLoadingMore) {
      void onLoadMore();
    }
  };

  // Re-attach scroll handler when deps change
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoadingMore]);

  const groups = groupMessagesByDay(messages);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto px-4 py-2"
      role="log"
      aria-label="Message history"
      aria-live="polite"
    >
      {/* Load more indicator at top */}
      {isLoadingMore && (
        <div className="flex justify-center py-3">
          <Spinner size="sm" />
        </div>
      )}
      {hasMore && !isLoadingMore && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => void onLoadMore()}
            className="text-xs text-ima-primary hover:underline min-h-[44px] px-4"
          >
            Load older messages
          </button>
        </div>
      )}

      {messages.length === 0 && !isLoadingMore && (
        <div className="flex items-center justify-center h-full py-16">
          <p className="text-sm text-ima-text-light text-center">
            No messages yet — send one to start the conversation
          </p>
        </div>
      )}

      {groups.map((group) => {
        return (
          <div key={group.date}>
            <DaySeparator date={group.date} />
            {group.messages.map((message, idx) => {
              const previous = idx > 0 ? group.messages[idx - 1] : null;
              const isOwnMessage = message.sender_id === currentUserId;
              const showTimestampFlag = shouldShowTimestamp(message, previous);
              const isCollapsedFlag = isConsecutive(message, previous);

              if (message.is_broadcast) {
                return (
                  <BroadcastCard
                    key={message.id}
                    message={message}
                    showTimestamp={showTimestampFlag}
                  />
                );
              }

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={isOwnMessage}
                  showTimestamp={showTimestampFlag}
                  isCollapsed={isCollapsedFlag}
                />
              );
            })}
          </div>
        );
      })}

      {/* Bottom sentinel for auto-scroll */}
      <div ref={bottomRef} />
    </div>
  );
}
