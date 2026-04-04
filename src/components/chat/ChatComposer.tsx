"use client";

import { useState, useCallback } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat-utils";

export interface ChatComposerProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  isBroadcast?: boolean;
}

/**
 * Pinned-bottom textarea composer with 2000 char limit, character counter,
 * and send button. Full implementation provided by Plan 35-03.
 * This stub satisfies TypeScript for Plan 35-04 compilation.
 */
export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Message...",
  isBroadcast = false,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isSending) return;
    setIsSending(true);
    try {
      await onSend(trimmed);
      setValue("");
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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
        setValue(e.target.value);
      }
      // Auto-grow up to 150px
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
    },
    []
  );

  const isOverLimit = value.length >= MAX_MESSAGE_LENGTH * 0.9;
  const canSend = value.trim().length > 0 && !disabled && !isSending;

  return (
    <div className="border-t border-ima-border bg-white px-4 py-3 flex-shrink-0">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isBroadcast ? "Broadcast message to all students..." : placeholder}
          aria-label="Message"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-ima-border px-3 py-2 text-sm text-ima-text placeholder:text-ima-text-light focus:outline-none focus:ring-2 focus:ring-ima-primary focus:border-transparent min-h-[44px] max-h-[150px] overflow-y-auto"
          style={{ height: "44px" }}
        />
        <Button
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label={isBroadcast ? "Send to All" : "Send message"}
          className="min-h-[44px] min-w-[44px]"
        >
          <Send size={16} aria-hidden="true" />
          <span className="sr-only">{isBroadcast ? "Send to All" : "Send"}</span>
        </Button>
      </div>
      <p
        className={`text-xs mt-1 text-right ${isOverLimit ? "text-ima-error" : "text-ima-text-light"}`}
      >
        {value.length}/{MAX_MESSAGE_LENGTH}
      </p>
    </div>
  );
}
