"use client";

import { useState, useCallback } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat-utils";

interface ChatComposerProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  isBroadcast?: boolean;
}

export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  isBroadcast = false,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const effectivePlaceholder = isBroadcast
    ? "Broadcast message to all students..."
    : placeholder;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      // Auto-grow textarea up to 150px, then scroll
      e.target.style.height = "auto";
      const clamped = Math.min(e.target.scrollHeight, 150);
      e.target.style.height = clamped + "px";
      e.target.style.overflowY = e.target.scrollHeight > 150 ? "auto" : "hidden";
    },
    []
  );

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isSending) return;
    setIsSending(true);
    try {
      await onSend(trimmed);
      setValue("");
      // Reset textarea height after clearing
    } finally {
      setIsSending(false);
    }
  }, [value, disabled, isSending, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  const isCounterWarning = value.length >= MAX_MESSAGE_LENGTH * 0.9;
  const canSend = value.trim().length > 0 && !disabled && !isSending;

  return (
    <div className="border-t border-ima-border bg-white px-4 py-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            aria-label="Message"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            disabled={disabled || isSending}
            className="w-full min-h-[44px] px-3 py-2.5 bg-ima-surface border border-ima-border rounded-lg text-ima-text placeholder:text-ima-text-muted focus:outline-none focus:ring-2 focus:ring-ima-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden"
            style={{ height: "44px" }}
          />
          <p
            className={`text-xs mt-1 text-right ${
              isCounterWarning ? "text-ima-error" : "text-ima-text-light"
            }`}
          >
            {value.length}/{MAX_MESSAGE_LENGTH}
          </p>
        </div>
        <Button
          variant="primary"
          size="icon"
          onClick={() => void handleSend()}
          disabled={!canSend}
          loading={isSending}
          aria-label={isBroadcast ? "Send to All" : "Send message"}
          className="min-h-[44px] min-w-[44px] mb-6"
        >
          <Send size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
