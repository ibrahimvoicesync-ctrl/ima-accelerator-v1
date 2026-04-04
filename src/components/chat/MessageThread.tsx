"use client";

import type { RefObject } from "react";
import type { MessageWithSender } from "@/lib/chat-utils";

export interface MessageThreadProps {
  messages: MessageWithSender[];
  currentUserId: string;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  isLoadingMore: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
}

/**
 * Scrollable message thread with day grouping, pagination, and auto-scroll.
 * Full implementation provided by Plan 35-03.
 * This stub satisfies TypeScript for Plan 35-04 compilation.
 */
export function MessageThread({
  messages,
  currentUserId: _currentUserId,
  hasMore: _hasMore,
  onLoadMore: _onLoadMore,
  isLoadingMore: _isLoadingMore,
  bottomRef,
}: MessageThreadProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {messages.map((msg) => (
        <div key={msg.id} className="py-1 text-sm text-ima-text">
          {msg.content}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
