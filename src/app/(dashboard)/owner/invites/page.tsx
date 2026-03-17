import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { OwnerInvitesClient } from "@/components/owner/OwnerInvitesClient";
import { Card, CardContent } from "@/components/ui/Card";
import { UserPlus, Link2, CheckCircle, Clock } from "lucide-react";

export default async function OwnerInvitesPage() {
  const user = await requireRole("owner");
  const admin = createAdminClient();

  const [invitesResult, magicLinksResult] = await Promise.all([
    admin
      .from("invites")
      .select("id, email, code, role, used, expires_at, created_at")
      .eq("invited_by", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("magic_links")
      .select("id, code, role, is_active, use_count, max_uses, expires_at, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (invitesResult.error) {
    console.error("[owner invites] Failed to load invites:", invitesResult.error);
  }
  if (magicLinksResult.error) {
    console.error("[owner invites] Failed to load magic links:", magicLinksResult.error);
  }

  const invitesList = invitesResult.data ?? [];
  const magicLinksList = magicLinksResult.data ?? [];

  const now = new Date();
  const totalInvites = invitesList.length;
  const usedInvites = invitesList.filter((i) => i.used).length;
  const activeLinks = magicLinksList.filter((l) => l.is_active).length;
  const totalMagicLinks = magicLinksList.length;
  const expiredOrInactive =
    invitesList.filter((i) => !i.used && new Date(i.expires_at) < now).length +
    magicLinksList.filter((l) => !l.is_active).length;

  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-ima-text">Invite Members</h1>
      <p className="mt-1 text-ima-text-secondary">
        Generate invite links for new coaches and students to join the platform
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5 text-ima-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">{totalInvites}</p>
              <p className="text-xs text-ima-text-secondary">Total Invites</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-success/10 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-ima-success" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">{usedInvites}</p>
              <p className="text-xs text-ima-text-secondary">Used</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-info/10 flex items-center justify-center shrink-0">
              <Link2 className="h-5 w-5 text-ima-info" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">{activeLinks}</p>
              <p className="text-xs text-ima-text-secondary">
                Active Links{totalMagicLinks > 0 ? ` / ${totalMagicLinks} Total` : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-warning/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-ima-warning" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">{expiredOrInactive}</p>
              <p className="text-xs text-ima-text-secondary">Expired / Inactive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <OwnerInvitesClient invites={invitesList} magicLinks={magicLinksList} />
    </div>
  );
}
