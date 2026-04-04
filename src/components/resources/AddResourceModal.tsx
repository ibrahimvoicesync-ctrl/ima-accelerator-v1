"use client";

import { useState, useRef, useId } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

interface AddResourceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddResourceModal({ open, onClose, onSuccess }: AddResourceModalProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [comment, setComment] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const checkboxId = useId();

  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const resetForm = () => {
    setTitle("");
    setUrl("");
    setComment("");
    setIsPinned(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-origin": window.location.origin,
        },
        body: JSON.stringify({
          title,
          url,
          comment: comment.trim() || undefined,
          is_pinned: isPinned,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to add resource";
        try {
          const errorData = (await response.json()) as { error?: string };
          if (response.status === 409) {
            errorMessage = "A resource with this URL already exists";
          } else {
            errorMessage = errorData.error ?? errorMessage;
          }
        } catch {
          // ignore JSON parse error
        }
        toastRef.current({ type: "error", title: errorMessage });
        return;
      }

      toastRef.current({ type: "success", title: "Resource added successfully" });
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      console.error("[AddResourceModal] Network error adding resource:", err);
      toastRef.current({ type: "error", title: "Network error — please try again" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add Resource">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Influencer Outreach Guide"
          required
        />
        <Input
          label="URL"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          required
        />
        <Textarea
          label="Comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Brief description or context"
          rows={3}
        />
        <label
          htmlFor={checkboxId}
          className="flex items-center gap-2 text-sm text-ima-text-secondary min-h-[44px] cursor-pointer"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="h-4 w-4 accent-ima-primary"
          />
          Pin this resource
        </label>
        <div className="flex gap-3 mt-4 justify-end">
          <Button variant="secondary" type="button" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" loading={isSubmitting} type="submit">
            Add Resource
          </Button>
        </div>
      </form>
    </Modal>
  );
}
