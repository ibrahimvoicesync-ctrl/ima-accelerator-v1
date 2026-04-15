"use client";

/**
 * Phase 56: The scrollable announcements list with inline-create + Load more.
 *
 * Server component (AnnouncementsPage) fetches the first 25 rows and passes
 * them in via initialItems. This client component:
 *  - Tracks the current list (initialItems + any Load more appends).
 *  - Toggles an inline create panel above the list for owner/coach.
 *  - Handles Load more pagination against GET /api/announcements?page=N.
 *  - Handles optimistic updates from card edits + deletes.
 *  - Renders the correct role-aware empty state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { Card, CardContent } from "@/components/ui/Card";
import { AnnouncementCard } from "./AnnouncementCard";
import { AnnouncementForm } from "./AnnouncementForm";
import type {
  Announcement,
  AnnouncementsPageRole,
} from "./announcement-types";

interface AnnouncementsFeedProps {
  role: AnnouncementsPageRole;
  currentUserId: string; // reserved for future ownership UI gating — defense in depth
  initialItems: Announcement[];
  initialHasMore: boolean;
}

export function AnnouncementsFeed({
  role,
  initialItems,
  initialHasMore,
}: AnnouncementsFeedProps) {
  const [items, setItems] = useState<Announcement[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1); // page 1 was the SSR fetch
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();
  // Stable ref so handleLoadMore doesn't rebind on every toast identity change
  // (pattern from CLAUDE.md §Code Quality "Stable useCallback deps").
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const canAuthor = role === "owner" || role === "coach";

  const handleCreateSuccess = useCallback((fresh: Announcement) => {
    setItems((prev) => [fresh, ...prev]);
    setShowCreate(false);
  }, []);

  const handleUpdated = useCallback((updated: Announcement) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const response = await fetch(`/api/announcements?page=${nextPage}`, {
        method: "GET",
      });
      if (!response.ok) {
        toastRef.current({
          type: "error",
          title: "Could not load more announcements. Try again.",
        });
        console.error(
          `[AnnouncementsFeed] GET /api/announcements?page=${nextPage} failed with status ${response.status}`
        );
        return;
      }
      const data = (await response.json()) as {
        items: Announcement[];
        hasMore: boolean;
        total: number;
      };
      setItems((prev) => {
        // Dedupe by id in case a row was inserted server-side between fetches.
        const existing = new Set(prev.map((i) => i.id));
        const merged = [...prev];
        for (const item of data.items) {
          if (!existing.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (err) {
      console.error("[AnnouncementsFeed] Load more failed:", err);
      toastRef.current({
        type: "error",
        title: "Could not load more announcements. Try again.",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page]);

  // ---------------- Empty state ----------------
  if (items.length === 0 && !showCreate) {
    return (
      <>
        {canAuthor && (
          <div className="mb-4 flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Announcement
            </Button>
          </div>
        )}
        <Card>
          <CardContent className="p-4 md:p-6">
            <EmptyState
              icon={<Megaphone className="h-6 w-6" aria-hidden="true" />}
              title="No announcements yet"
              description={
                canAuthor
                  ? "Post the first update — your students will see it the moment you send it."
                  : "When your coach posts an update, it will appear here."
              }
              action={
                canAuthor ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => setShowCreate(true)}
                  >
                    Create First Announcement
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canAuthor && (
        <div className="flex justify-end">
          {!showCreate ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Announcement
            </Button>
          ) : null}
        </div>
      )}

      {showCreate && canAuthor && (
        <Card>
          <CardContent className="p-4 md:p-6 motion-safe:animate-fadeIn">
            <AnnouncementForm
              mode="create"
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreate(false)}
            />
          </CardContent>
        </Card>
      )}

      <ul className="flex flex-col gap-4 list-none p-0">
        {items.map((item) => (
          <li key={item.id}>
            <AnnouncementCard
              announcement={item}
              viewerRole={role}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="flex justify-center mt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleLoadMore}
            loading={loadingMore}
            disabled={loadingMore}
            aria-busy={loadingMore || undefined}
          >
            {loadingMore ? (
              <>
                <Spinner size="sm" />
                Loading…
              </>
            ) : (
              "Load more announcements"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
