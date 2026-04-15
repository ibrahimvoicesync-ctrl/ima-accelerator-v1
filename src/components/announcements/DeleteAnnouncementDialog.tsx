"use client";

/**
 * Phase 56: Delete-confirmation modal for announcements.
 *
 * D-56-04 locks this pattern: Modal primitive + destructive Button + confirm/cancel
 * pair. NO native confirm() dialog (blocked on iOS in some contexts + not themable).
 *
 * Copy is verbatim from 56-UI-SPEC.md §Copywriting.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface DeleteAnnouncementDialogProps {
  open: boolean;
  announcementId: string;
  onClose: () => void;
  /** Called after a successful DELETE — parent should remove the row from state. */
  onDeleted: () => void;
}

export function DeleteAnnouncementDialog({
  open,
  announcementId,
  onClose,
  onDeleted,
}: DeleteAnnouncementDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const routerRef = useRef(router);
  useEffect(() => {
    toastRef.current = toast;
    routerRef.current = router;
  }, [toast, router]);

  const handleConfirm = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/announcements/${announcementId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = "Could not delete the announcement. Try again.";
        try {
          const errBody = (await response.json()) as { error?: string };
          if (response.status === 429) {
            message = "You are posting too fast. Please wait a minute.";
          } else if (errBody?.error) {
            message = errBody.error;
          }
        } catch (parseErr) {
          console.error(
            "[DeleteAnnouncementDialog] Error body parse failed:",
            parseErr
          );
        }
        toastRef.current({
          type: "error",
          title: "Could not delete the announcement. Try again.",
          description: message,
        });
        console.error(
          `[DeleteAnnouncementDialog] DELETE failed with status ${response.status}`
        );
        return;
      }
      onDeleted();
      toastRef.current({ type: "success", title: "Announcement deleted." });
      onClose();
      routerRef.current.refresh();
    } catch (err) {
      console.error("[DeleteAnnouncementDialog] Unexpected error:", err);
      toastRef.current({
        type: "error",
        title: "Could not delete the announcement. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }, [submitting, announcementId, onClose, onDeleted]);

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Delete this announcement?"
      description="This cannot be undone. Students who already saw it will no longer see it in their feed."
      size="md"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end mt-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onClose}
          disabled={submitting}
        >
          Keep it
        </Button>
        <Button
          type="button"
          variant="danger"
          size="md"
          onClick={handleConfirm}
          loading={submitting}
          disabled={submitting}
        >
          Delete Announcement
        </Button>
      </div>
    </Modal>
  );
}
