"use client";

import { useState, useRef, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

interface AddGlossaryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingTerm?: { id: string; term: string; definition: string } | null;
}

export function AddGlossaryModal({ open, onClose, onSuccess, editingTerm }: AddGlossaryModalProps) {
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Pre-populate fields when editing
  useEffect(() => {
    if (editingTerm) {
      setTerm(editingTerm.term);
      setDefinition(editingTerm.definition);
    } else {
      setTerm("");
      setDefinition("");
    }
  }, [editingTerm, open]);

  const resetForm = () => {
    setTerm("");
    setDefinition("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const isEditing = !!editingTerm;
      const url = isEditing ? `/api/glossary/${editingTerm.id}` : "/api/glossary";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-origin": window.location.origin,
        },
        body: JSON.stringify({ term, definition }),
      });

      if (!response.ok) {
        let errorMessage = isEditing ? "Failed to update glossary term" : "Failed to add glossary term";
        try {
          const errorData = (await response.json()) as { error?: string };
          if (response.status === 409) {
            errorMessage = "A term with this name already exists";
          } else {
            errorMessage = errorData.error ?? errorMessage;
          }
        } catch {
          // ignore JSON parse error
        }
        toastRef.current({ type: "error", title: errorMessage });
        return;
      }

      toastRef.current({
        type: "success",
        title: isEditing ? "Glossary term updated" : "Glossary term added",
      });
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      console.error("[AddGlossaryModal] Network error submitting glossary term:", err);
      toastRef.current({ type: "error", title: "Network error — please try again" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editingTerm ? "Edit Glossary Term" : "Add Glossary Term"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Term"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. CPM"
          required
        />
        <Textarea
          label="Definition"
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          placeholder="e.g. Cost Per Mille — the price per 1,000 ad impressions"
          rows={4}
          required
        />
        <div className="flex gap-3 mt-4 justify-end">
          <Button variant="secondary" type="button" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" loading={isSubmitting} type="submit">
            {editingTerm ? "Save Changes" : "Add Term"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
