"use client";

import { Pin, Trash2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ResourceLinkCardProps {
  resource: {
    id: string;
    title: string;
    url: string;
    comment: string | null;
    is_pinned: boolean;
    created_at: string;
    created_by_user: { name: string } | null;
  };
  canManage: boolean;
  onDelete: (id: string) => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function ResourceLinkCard({ resource, canManage, onDelete }: ResourceLinkCardProps) {
  return (
    <Card variant="default">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="text-base font-semibold text-ima-text truncate">{resource.title}</h3>
            {resource.is_pinned && (
              <Pin className="h-4 w-4 text-ima-primary flex-shrink-0" aria-hidden="true" />
            )}
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(resource.id)}
              aria-label={"Delete " + resource.title}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-ima-primary hover:underline truncate block max-w-xs mt-1 flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{resource.url}</span>
        </a>

        {resource.comment && (
          <p className="text-sm text-ima-text-secondary mt-1">{resource.comment}</p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-ima-border">
          <span className="text-xs text-ima-text-muted">
            Posted by {resource.created_by_user?.name ?? "Unknown"}
          </span>
          <span className="text-xs text-ima-text-muted">
            {formatRelativeDate(resource.created_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
