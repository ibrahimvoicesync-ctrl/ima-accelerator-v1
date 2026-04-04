"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ResourceLinkCard } from "./ResourceLinkCard";
import { AddResourceModal } from "./AddResourceModal";
import { DiscordEmbed } from "./DiscordEmbed";
import { GlossaryList, type GlossaryTerm } from "./GlossaryList";
import { AddGlossaryModal } from "./AddGlossaryModal";

interface Resource {
  id: string;
  title: string;
  url: string;
  comment: string | null;
  is_pinned: boolean;
  created_at: string;
  created_by: string;
  created_by_user: { name: string } | null;
}

type Tab = "links" | "community" | "glossary";

interface ResourcesClientProps {
  role: "owner" | "coach" | "student";
}

export function ResourcesClient({ role }: ResourcesClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("links");
  const [resources, setResources] = useState<Resource[]>([]);
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingGlossary, setLoadingGlossary] = useState(true);
  const [showAddResource, setShowAddResource] = useState(false);
  const [showAddGlossary, setShowAddGlossary] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "resource" | "glossary"; id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const canManage = role === "owner" || role === "coach";

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch("/api/resources");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("[ResourcesClient] Failed to fetch resources:", (json as { error?: string }).error ?? res.status);
        toastRef.current({ type: "error", title: "Failed to load resources" });
        return;
      }
      const data = (await res.json()) as { resources: Resource[] };
      setResources(data.resources ?? []);
    } catch (err) {
      console.error("[ResourcesClient] Network error fetching resources:", err);
      toastRef.current({ type: "error", title: "Network error loading resources" });
    } finally {
      setLoadingResources(false);
    }
  }, []);

  const fetchGlossary = useCallback(async () => {
    try {
      const res = await fetch("/api/glossary");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("[ResourcesClient] Failed to fetch glossary:", (json as { error?: string }).error ?? res.status);
        toastRef.current({ type: "error", title: "Failed to load glossary" });
        return;
      }
      const data = (await res.json()) as { glossary_terms: GlossaryTerm[] };
      setGlossaryTerms(data.glossary_terms ?? []);
    } catch (err) {
      console.error("[ResourcesClient] Network error fetching glossary:", err);
      toastRef.current({ type: "error", title: "Network error loading glossary" });
    } finally {
      setLoadingGlossary(false);
    }
  }, []);

  useEffect(() => {
    void fetchResources();
    void fetchGlossary();
  }, [fetchResources, fetchGlossary]);

  const refreshResources = useCallback(() => {
    void fetchResources();
  }, [fetchResources]);

  const refreshGlossary = useCallback(() => {
    void fetchGlossary();
  }, [fetchGlossary]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      let res: Response;
      if (deleteTarget.type === "resource") {
        res = await fetch("/api/resources", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-origin": window.location.origin,
          },
          body: JSON.stringify({ id: deleteTarget.id }),
        });
      } else {
        res = await fetch(`/api/glossary/${deleteTarget.id}`, {
          method: "DELETE",
          headers: {
            "x-origin": window.location.origin,
          },
        });
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const errMsg = (json as { error?: string }).error ?? "Failed to delete";
        console.error("[ResourcesClient] Delete failed:", errMsg);
        toastRef.current({ type: "error", title: errMsg });
        return;
      }

      toastRef.current({
        type: "success",
        title: deleteTarget.type === "resource" ? "Resource deleted" : "Glossary term deleted",
      });
      setDeleteTarget(null);

      if (deleteTarget.type === "resource") {
        void fetchResources();
      } else {
        void fetchGlossary();
      }
    } catch (err) {
      console.error("[ResourcesClient] Network error during delete:", err);
      toastRef.current({ type: "error", title: "Network error — please try again" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-ima-border" role="tablist">
        {(["links", "community", "glossary"] as Tab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "min-h-[44px] px-4 text-sm font-medium border-b-2 motion-safe:transition-colors",
              activeTab === tab
                ? "border-ima-primary text-ima-primary"
                : "border-transparent text-ima-text-secondary hover:text-ima-text"
            )}
          >
            {tab === "links" ? "Links" : tab === "community" ? "Community" : "Glossary"}
          </button>
        ))}
      </div>

      {/* Links tab */}
      <div className={activeTab === "links" ? "block" : "hidden"}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-ima-text">Resource Links</h2>
          {canManage && (
            <Button variant="primary" onClick={() => setShowAddResource(true)}>
              Add Resource
            </Button>
          )}
        </div>

        {loadingResources ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : resources.length === 0 ? (
          <EmptyState
            icon={<LinkIcon className="h-6 w-6" aria-hidden="true" />}
            title="No resources yet"
            description={canManage ? "Add your first resource link." : "No resources have been shared yet."}
          />
        ) : (
          <div className="space-y-3">
            {resources.map((resource) => (
              <ResourceLinkCard
                key={resource.id}
                resource={resource}
                canManage={canManage}
                onDelete={(id) => setDeleteTarget({ type: "resource", id })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Community tab — CSS hidden to avoid iframe remount */}
      <div className={activeTab === "community" ? "block" : "hidden"}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-ima-text">Community</h2>
        </div>
        <DiscordEmbed />
      </div>

      {/* Glossary tab */}
      <div className={activeTab === "glossary" ? "block" : "hidden"}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-ima-text">Glossary</h2>
          {canManage && (
            <Button
              variant="primary"
              onClick={() => {
                setEditingTerm(null);
                setShowAddGlossary(true);
              }}
            >
              Add Term
            </Button>
          )}
        </div>

        {loadingGlossary ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <GlossaryList
            terms={glossaryTerms}
            canManage={canManage}
            onEdit={(term) => {
              setEditingTerm(term);
              setShowAddGlossary(true);
            }}
            onDelete={(id) => setDeleteTarget({ type: "glossary", id })}
          />
        )}
      </div>

      {/* Add Resource Modal */}
      <AddResourceModal
        open={showAddResource}
        onClose={() => setShowAddResource(false)}
        onSuccess={refreshResources}
      />

      {/* Add/Edit Glossary Modal */}
      <AddGlossaryModal
        open={showAddGlossary}
        onClose={() => {
          setShowAddGlossary(false);
          setEditingTerm(null);
        }}
        onSuccess={refreshGlossary}
        editingTerm={editingTerm}
      />

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget?.type === "resource" ? "Delete Resource" : "Delete Glossary Term"}
      >
        <p className="text-sm text-ima-text-secondary">
          Are you sure you want to delete this{" "}
          {deleteTarget?.type === "resource" ? "resource" : "glossary term"}? This cannot be undone.
        </p>
        <div className="flex gap-3 mt-4 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" loading={isDeleting} onClick={handleConfirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
