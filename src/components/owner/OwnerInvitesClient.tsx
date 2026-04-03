"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserPlus, Link2, Copy, Mail, Clock, CheckCircle } from "lucide-react";

type InviteItem = {
  id: string;
  email: string;
  code: string;
  role: string;
  used: boolean;
  expires_at: string;
  created_at: string;
};

type MagicLinkItem = {
  id: string;
  code: string;
  role: string;
  is_active: boolean;
  use_count: number;
  max_uses: number | null;
  expires_at: string | null;
  created_at: string;
};

type Props = {
  invites: InviteItem[];
  magicLinks: MagicLinkItem[];
};

type Tab = "email" | "magic";

export function OwnerInvitesClient({ invites, magicLinks }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  // Stable refs to prevent dep churn in callbacks
  const routerRef = useRef(router);
  const toastRef = useRef(toast);
  routerRef.current = router;
  toastRef.current = toast;

  const [activeTab, setActiveTab] = useState<Tab>("email");
  const [selectedRole, setSelectedRole] = useState<"coach" | "student" | "student_diy">("student");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [lastWhitelistedEmail, setLastWhitelistedEmail] = useState<string | null>(null);
  const [localInvites, setLocalInvites] = useState<InviteItem[]>(invites);
  const [localMagicLinks, setLocalMagicLinks] = useState<MagicLinkItem[]>(magicLinks);

  // --- Email invite ---
  const handleCreateInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: selectedRole }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to create invite" });
        return;
      }
      const { data } = await res.json() as { data: InviteItem };
      setLastWhitelistedEmail(data.email);
      setLastUrl(null); // Clear any magic link URL
      setLocalInvites(prev => [data, ...prev]);
      setEmail("");
      toastRef.current({ type: "success", title: "Email whitelisted!" });
    } catch (err) {
      console.error("[OwnerInvitesClient] create invite error:", err);
      toastRef.current({ type: "error", title: "Something went wrong" });
    } finally {
      setIsSubmitting(false);
    }
  }, [email, isSubmitting, selectedRole]);

  // --- Magic link ---
  const handleCreateMagicLink = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/magic-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to create invite link" });
        return;
      }
      const { data, registerUrl } = await res.json() as { data: MagicLinkItem; registerUrl: string };
      setLastUrl(registerUrl);
      setLocalMagicLinks(prev => [data, ...prev]);
      toastRef.current({ type: "success", title: "Invite link created!" });
    } catch (err) {
      console.error("[OwnerInvitesClient] create magic link error:", err);
      toastRef.current({ type: "error", title: "Something went wrong" });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, selectedRole]);

  // --- Copy URL ---
  const handleCopy = useCallback(async () => {
    if (!lastUrl) return;
    try {
      await navigator.clipboard.writeText(lastUrl);
      toastRef.current({ type: "success", title: "Copied to clipboard!" });
    } catch (err) {
      console.error("[OwnerInvitesClient] clipboard error:", err);
      toastRef.current({ type: "error", title: "Copy failed — please copy the URL manually" });
    }
  }, [lastUrl]);

  // --- Toggle magic link active state ---
  const handleToggleMagicLink = useCallback(async (link: MagicLinkItem) => {
    const newActive = !link.is_active;
    // Optimistic update
    setLocalMagicLinks(prev =>
      prev.map(l => l.id === link.id ? { ...l, is_active: newActive } : l)
    );
    try {
      const res = await fetch(`/api/magic-links?id=${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      });
      if (!res.ok) {
        // Revert optimistic update
        setLocalMagicLinks(prev =>
          prev.map(l => l.id === link.id ? { ...l, is_active: link.is_active } : l)
        );
        const json = await res.json().catch(() => ({}));
        toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to update" });
        return;
      }
      toastRef.current({
        type: "success",
        title: newActive ? "Invite link reactivated" : "Invite link deactivated",
      });
      routerRef.current.refresh();
    } catch (err) {
      // Revert optimistic update
      setLocalMagicLinks(prev =>
        prev.map(l => l.id === link.id ? { ...l, is_active: link.is_active } : l)
      );
      console.error("[OwnerInvitesClient] toggle magic link error:", err);
      toastRef.current({ type: "error", title: "Something went wrong" });
    }
  }, []);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  const getInviteStatus = (invite: InviteItem) => {
    if (invite.used) return "used";
    if (new Date(invite.expires_at) < new Date()) return "expired";
    return "active";
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Role selector */}
      <div className="mb-4">
        <label htmlFor="invite-role" className="block text-sm font-medium text-ima-text mb-1">
          Invite Role
        </label>
        <select
          id="invite-role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as "coach" | "student" | "student_diy")}
          className="w-full sm:w-48 rounded-lg border border-ima-border bg-ima-surface px-3 py-2 text-sm text-ima-text min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ima-primary"
          aria-label="Select role for invite"
        >
          <option value="student">Student</option>
          <option value="coach">Coach</option>
          <option value="student_diy">Student DIY</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ima-border">
        <button
          type="button"
          onClick={() => { setActiveTab("email"); setLastUrl(null); setLastWhitelistedEmail(null); }}
          className={`px-4 py-2.5 text-sm font-medium min-h-[44px] border-b-2 motion-safe:transition-colors ${
            activeTab === "email"
              ? "border-ima-primary text-ima-primary"
              : "border-transparent text-ima-text-secondary hover:text-ima-text"
          }`}
        >
          <span className="flex items-center gap-2">
            <Mail className="h-4 w-4" aria-hidden="true" />
            Email Invite
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("magic"); setLastUrl(null); setLastWhitelistedEmail(null); }}
          className={`px-4 py-2.5 text-sm font-medium min-h-[44px] border-b-2 motion-safe:transition-colors ${
            activeTab === "magic"
              ? "border-ima-primary text-ima-primary"
              : "border-transparent text-ima-text-secondary hover:text-ima-text"
          }`}
        >
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Invite Link
          </span>
        </button>
      </div>

      {/* Email invite tab */}
      {activeTab === "email" && (
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold text-ima-text mb-1">Generate Email Invite</h2>
            <p className="text-xs text-ima-text-secondary mb-4">
              Whitelist an email address. The {selectedRole} can then sign in with Google to create their account. Expires in 72 hours.
            </p>
            <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="user@example.com"
                  label="Member email address"
                  aria-label="Member email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={!email.trim() || isSubmitting}
                className="min-h-[44px] self-end"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Generate Invite
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Magic link tab */}
      {activeTab === "magic" && (
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold text-ima-text mb-1">Generate Invite Link</h2>
            <p className="text-xs text-ima-text-secondary mb-4">
              Invite links can be shared with any coach or student. Anyone with the link can register
              with the selected role. No email restriction, no expiry.
            </p>
            <Button
              type="button"
              onClick={handleCreateMagicLink}
              loading={isSubmitting}
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Generate Invite Link
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Whitelist confirmation */}
      {lastWhitelistedEmail && (
        <Card variant="accent">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-ima-success/10 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle className="h-4 w-4 text-ima-success" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-ima-text">Email whitelisted</p>
                <p className="text-xs text-ima-text-secondary mt-1">
                  <span className="font-medium">{lastWhitelistedEmail}</span> can now sign in with Google at the login page. Their account will be created automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Copy URL display */}
      {lastUrl && activeTab === "magic" && (
        <Card variant="accent">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-ima-text-secondary mb-2">Generated invite link:</p>
            <div className="flex items-center gap-2">
              <p
                className="flex-1 text-sm text-ima-text font-mono bg-ima-surface border border-ima-border rounded-lg px-3 py-2 truncate min-h-[44px] flex items-center"
                title={lastUrl}
              >
                {lastUrl}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCopy}
                className="min-h-[44px] shrink-0"
                aria-label="Copy invite link to clipboard"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite history */}
      <section>
        <h2 className="text-base font-semibold text-ima-text mb-3">Invite History</h2>
        {localInvites.length === 0 ? (
          <Card>
            <EmptyState
              icon={<UserPlus className="h-6 w-6" />}
              title="No invites sent yet"
              description="Generate an email invite above to get started."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {localInvites.map((invite) => {
              const status = getInviteStatus(invite);
              return (
                <Card key={invite.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 min-h-[44px]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ima-text truncate">{invite.email}</p>
                      <p className="text-xs text-ima-text-secondary">
                        <span className="capitalize">{invite.role}</span>
                        {" · "}Sent {formatDate(invite.created_at)}
                        {status === "active" && (
                          <span className="ml-2">
                            &middot; Expires {formatDate(invite.expires_at)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Badge
                        variant={
                          status === "used" ? "success" :
                          status === "expired" ? "warning" : "info"
                        }
                      >
                        {status === "used" ? "Used" : status === "expired" ? "Expired" : "Active"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Magic links history */}
      <section>
        <h2 className="text-base font-semibold text-ima-text mb-3">Invite Links</h2>
        {localMagicLinks.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Link2 className="h-6 w-6" />}
              title="No invite links created yet"
              description="Generate an invite link above to share with coaches or students."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {localMagicLinks.map((link) => (
              <Card key={link.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 min-h-[44px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono text-ima-text truncate" title={link.code}>
                      {link.code}
                    </p>
                    <p className="text-xs text-ima-text-secondary flex items-center gap-2 flex-wrap">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span className="capitalize">{link.role}</span>
                      <span>&middot;</span>
                      Created {formatDate(link.created_at)}
                      <span>&middot;</span>
                      <span>{link.use_count} use{link.use_count !== 1 ? "s" : ""}</span>
                      {link.max_uses !== null && <span>/ {link.max_uses}</span>}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Badge variant={link.is_active ? "success" : "default"}>
                      {link.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      type="button"
                      variant={link.is_active ? "danger" : "secondary"}
                      size="sm"
                      onClick={() => handleToggleMagicLink(link)}
                      className="min-h-[44px]"
                      aria-label={link.is_active ? `Deactivate invite link ${link.code}` : `Reactivate invite link ${link.code}`}
                    >
                      {link.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
