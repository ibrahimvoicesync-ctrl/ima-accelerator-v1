"use client";

/**
 * Phase 56: Announcement create + edit form.
 *
 * Reused for:
 *  - Create (mode="create") — rendered in the inline expand panel above the
 *    feed when owner/coach clicks "New Announcement". POSTs to /api/announcements.
 *  - Edit (mode="edit") — rendered INSIDE an AnnouncementCard when owner/coach
 *    clicks the Edit (Pencil) icon. PATCHes /api/announcements/[id].
 *
 * Char-count limit is 2000 (D-56-01 + Phase 55 DB CHECK + Plan 01 Zod).
 * Counter turns text-ima-error when exceeded. Submit disabled when empty or over.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { Announcement } from "./announcement-types";

const MAX_CONTENT_LENGTH = 2000;

type Mode = "create" | "edit";

interface AnnouncementFormProps {
  mode: Mode;
  /** Only required in edit mode — the announcement being edited. */
  initialContent?: string;
  /** Only required in edit mode — the row id to PATCH. */
  announcementId?: string;
  /** Called after a successful POST/PATCH with the fresh row. */
  onSuccess: (announcement: Announcement) => void;
  /** Called when the user clicks Cancel. Collapse the panel / exit edit. */
  onCancel: () => void;
}

export function AnnouncementForm({
  mode,
  initialContent = "",
  announcementId,
  onSuccess,
  onCancel,
}: AnnouncementFormProps) {
  const [content, setContent] = useState(initialContent);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  // Stable refs so the submit callback below doesn't rerender on toast/router changes
  // (pattern from CLAUDE.md §Code Quality "Stable useCallback deps").
  const toastRef = useRef(toast);
  const routerRef = useRef(router);
  useEffect(() => {
    toastRef.current = toast;
    routerRef.current = router;
  }, [toast, router]);

  const trimmedLength = content.trim().length;
  const tooLong = content.length > MAX_CONTENT_LENGTH;
  const tooShort = trimmedLength === 0;
  const canSubmit = !tooShort && !tooLong && !submitting;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      try {
        const url =
          mode === "create"
            ? "/api/announcements"
            : `/api/announcements/${announcementId}`;
        const method = mode === "create" ? "POST" : "PATCH";
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim() }),
        });
        if (!response.ok) {
          // Read the server error message if present; never swallow.
          let message = "Could not post the announcement. Try again.";
          try {
            const errBody = (await response.json()) as { error?: string };
            if (response.status === 429) {
              message = "You are posting too fast. Please wait a minute.";
            } else if (errBody?.error) {
              message = errBody.error;
            }
          } catch (parseErr) {
            console.error("[AnnouncementForm] Error body parse failed:", parseErr);
          }
          toastRef.current({
            type: "error",
            title: mode === "create"
              ? "Could not post the announcement. Try again."
              : "Could not update the announcement. Try again.",
            description: message,
          });
          console.error(
            `[AnnouncementForm] ${method} ${url} failed with status ${response.status}`
          );
          return;
        }
        const data = (await response.json()) as { announcement: Announcement };
        onSuccess(data.announcement);
        toastRef.current({
          type: "success",
          title: mode === "create" ? "Announcement posted." : "Announcement updated.",
        });
        routerRef.current.refresh();
      } catch (err) {
        console.error("[AnnouncementForm] Unexpected error:", err);
        toastRef.current({
          type: "error",
          title: "Could not post the announcement. Try again.",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, content, mode, announcementId, onSuccess]
  );

  return (
    <form
      onSubmit={handleSubmit}
      role="region"
      aria-label={mode === "create" ? "New announcement form" : "Edit announcement form"}
      className="flex flex-col gap-4"
    >
      <div>
        <label htmlFor={`announcement-content-${mode}`} className="sr-only">
          Announcement
        </label>
        <Textarea
          id={`announcement-content-${mode}`}
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share an update with your students…"
          disabled={submitting}
          maxLength={MAX_CONTENT_LENGTH}
          aria-describedby={`announcement-counter-${mode}`}
          error={
            tooLong
              ? "Announcements are limited to 2000 characters."
              : undefined
          }
        />
        <div
          id={`announcement-counter-${mode}`}
          role="status"
          aria-live="polite"
          className={
            "mt-1 text-xs font-medium " +
            (tooLong ? "text-ima-error" : "text-ima-text-secondary")
          }
        >
          {content.length} / {MAX_CONTENT_LENGTH}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!canSubmit}
          loading={submitting}
        >
          {mode === "create" ? "Post Announcement" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
