"use client";

import { Megaphone, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/chat-utils";

export type ConversationSummary = {
  studentId: string;
  studentName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string) => void;
  onSelectBroadcast: () => void;
  isBroadcastSelected: boolean;
}

export function ConversationList({
  conversations,
  selectedStudentId,
  onSelectStudent,
  onSelectBroadcast,
  isBroadcastSelected,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      <h2 className="text-lg font-semibold text-ima-text px-4 py-3 border-b border-ima-border">
        Messages
      </h2>

      {/* Broadcast item pinned at top */}
      <button
        type="button"
        onClick={onSelectBroadcast}
        aria-label="Send broadcast message"
        className={`flex items-center gap-3 px-4 py-3 border-b border-ima-border cursor-pointer min-h-[44px] w-full text-left motion-safe:transition-colors ${
          isBroadcastSelected
            ? "bg-ima-surface-accent"
            : "hover:bg-ima-surface-light"
        }`}
      >
        <div className="w-9 h-9 rounded-full bg-ima-primary flex items-center justify-center shrink-0">
          <Megaphone size={16} className="text-white" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ima-text">Broadcast</p>
          <p className="text-xs text-ima-text-light truncate">
            Send a message to all students
          </p>
        </div>
      </button>

      {/* Conversation list */}
      <div className="overflow-y-auto flex-1">
        {conversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={24} aria-hidden="true" />}
            title="No conversations yet"
            description="Your student conversations will appear here."
            variant="compact"
          />
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.studentId}
              type="button"
              onClick={() => onSelectStudent(conv.studentId)}
              className={`flex items-center gap-3 px-4 py-3 w-full text-left min-h-[44px] cursor-pointer motion-safe:transition-colors border-b border-ima-border ${
                selectedStudentId === conv.studentId
                  ? "bg-ima-surface-light"
                  : "hover:bg-ima-surface-light"
              }`}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-ima-primary flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-white">
                  {conv.studentName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-ima-text truncate">
                    {conv.studentName}
                  </p>
                  <p className="text-xs text-ima-text-light shrink-0">
                    {formatRelativeTime(new Date(conv.lastMessageAt))}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs text-ima-text-light truncate max-w-[180px]">
                    {conv.lastMessage}
                  </p>
                  {conv.unreadCount > 0 && (
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-ima-primary shrink-0"
                      aria-label={`${conv.unreadCount} unread messages`}
                    />
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
