"use client";

/**
 * Phase 56: Single announcement card.
 *
 * States:
 *  - Read mode: avatar + author + role chip + timestamp + "(edited)" + content.
 *    Owner/coach viewers additionally see Edit (Pencil) and Delete (Trash2)
 *    icon buttons in the header (44x44 touch targets, aria-labels per Hard Rule 3).
 *  - Edit mode: content area is replaced by <AnnouncementForm mode="edit" />
 *    pre-filled with the current content.
 *
 * UI gating rule (from 56-UI-SPEC.md §Role-Gated UI Rules):
 *   Show Edit/Delete when viewerRole === "owner" OR viewerRole === "coach".
 *   Owner and coach can edit/delete ANY announcement (ANNOUNCE-03 / ANNOUNCE-04).
 *   UI gating here is defense-in-depth — the API route is the security boundary.
 */

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/chat-utils";
import type { Announcement, AnnouncementsPageRole } from "./announcement-types";
import { AnnouncementForm } from "./AnnouncementForm";
import { DeleteAnnouncementDialog } from "./DeleteAnnouncementDialog";

interface AnnouncementCardProps {
  announcement: Announcement;
  viewerRole: AnnouncementsPageRole;
  /** Called when edit/delete mutates or removes this card. Parent updates list state. */
  onUpdated: (updated: Announcement) => void;
  onDeleted: (id: string) => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function AnnouncementCard({
  announcement,
  viewerRole,
  onUpdated,
  onDeleted,
}: AnnouncementCardProps) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canMutate = viewerRole === "owner" || viewerRole === "coach";
  const authorName = announcement.author?.name ?? "Unknown";
  const authorRole = announcement.author?.role ?? "coach";
  const badgeVariant = authorRole === "owner" ? "info" : "success";
  const badgeLabel = authorRole === "owner" ? "Owner" : "Coach";

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <header className="flex flex-wrap items-center gap-2 mb-3">
          <span
            aria-hidden="true"
            className="w-8 h-8 rounded-full bg-ima-primary flex items-center justify-center text-xs font-semibold text-white shrink-0"
          >
            {getInitials(authorName)}
          </span>
          <span className="text-sm font-semibold text-ima-text">
            {authorName}
          </span>
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          <span className="text-xs font-medium text-ima-text-secondary ml-auto flex items-center gap-1">
            <time dateTime={announcement.created_at}>
              {formatRelativeTime(new Date(announcement.created_at))}
            </time>
            {announcement.is_edited && (
              <>
                <span aria-hidden="true"> · </span>
                <span>(edited)</span>
              </>
            )}
          </span>
          {canMutate && !editing && (
            <div className="flex items-center gap-1 ml-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                aria-label="Edit announcement"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                aria-label="Delete announcement"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </header>

        {editing ? (
          <AnnouncementForm
            mode="edit"
            announcementId={announcement.id}
            initialContent={announcement.content}
            onSuccess={(updated) => {
              onUpdated(updated);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <p className="text-sm text-ima-text whitespace-pre-wrap leading-relaxed">
            {announcement.content}
          </p>
        )}
      </CardContent>

      {canMutate && (
        <DeleteAnnouncementDialog
          open={deleteOpen}
          announcementId={announcement.id}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => onDeleted(announcement.id)}
        />
      )}
    </Card>
  );
}
