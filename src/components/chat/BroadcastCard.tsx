"use client";

import { Megaphone } from "lucide-react";
import { formatMessageTime, type MessageWithSender } from "@/lib/chat-utils";

interface BroadcastCardProps {
  message: MessageWithSender;
  showTimestamp: boolean;
}

export function BroadcastCard({ message, showTimestamp }: BroadcastCardProps) {
  return (
    <div className="bg-ima-surface-accent rounded-xl px-4 py-3 mx-2 mt-3">
      <div className="flex items-start gap-3">
        <Megaphone
          size={18}
          className="text-ima-primary mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ima-primary">
            Broadcast from {message.sender_name}
          </p>
          <p className="text-sm text-ima-text mt-1 whitespace-pre-wrap break-words">
            {message.content}
          </p>
          {showTimestamp && (
            <p className="text-xs text-ima-text-light mt-1">
              {formatMessageTime(new Date(message.created_at))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
