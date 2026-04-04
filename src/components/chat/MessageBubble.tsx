"use client";

import {
  formatMessageTime,
  isConsecutive,
  shouldShowTimestamp,
  type MessageWithSender,
} from "@/lib/chat-utils";

interface MessageBubbleProps {
  message: MessageWithSender;
  isOwnMessage: boolean;
  showTimestamp: boolean;
  isCollapsed: boolean;
}

export function MessageBubble({
  message,
  isOwnMessage,
  showTimestamp,
  isCollapsed,
}: MessageBubbleProps) {
  return (
    <div
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} ${
        isCollapsed ? "mt-0.5" : "mt-3"
      }`}
    >
      <div className="max-w-[75%]">
        {!isCollapsed && (
          <p
            className={`text-xs text-ima-text-light font-medium mb-1 ${
              isOwnMessage ? "text-right" : "text-left"
            }`}
          >
            {message.sender_name}
          </p>
        )}
        <div
          className={`px-4 py-2 ${
            isOwnMessage
              ? "bg-ima-primary text-white rounded-2xl rounded-br-sm"
              : "bg-ima-surface-light text-ima-text rounded-2xl rounded-bl-sm"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {showTimestamp && (
          <p
            className={`text-xs text-ima-text-light mt-1 ${
              isOwnMessage ? "text-right" : "text-left"
            }`}
          >
            {formatMessageTime(new Date(message.created_at))}
          </p>
        )}
      </div>
    </div>
  );
}

// Re-export utilities so consumers can compute props
export { isConsecutive, shouldShowTimestamp };
