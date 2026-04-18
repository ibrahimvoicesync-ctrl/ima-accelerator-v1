import { JetBrains_Mono } from "next/font/google";
import { UserPlus, Link2, CheckCircle } from "lucide-react";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CoachInvitesClient } from "@/components/coach/CoachInvitesClient";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

export default async function CoachInvitesPage() {
  const user = await requireRole("coach");
  const admin = createAdminClient();

  const [invitesResult, magicLinksResult] = await Promise.all([
    admin
      .from("invites")
      .select("id, email, code, role, used, used_at, expires_at, created_at")
      .eq("invited_by", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("magic_links")
      .select("id, code, role, is_active, use_count, max_uses, expires_at, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (invitesResult.error) {
    console.error("[coach invites] Failed to load invites:", invitesResult.error);
  }
  if (magicLinksResult.error) {
    console.error("[coach invites] Failed to load magic links:", magicLinksResult.error);
  }

  const now = new Date();
  const HISTORY_VISIBLE_MS = 24 * 60 * 60 * 1000;

  // Active invites always show. Once they turn Used or Expired, keep them
  // visible for 24h from the moment the status changed, then drop them.
  const invitesList = (invitesResult.data ?? []).filter((i) => {
    if (i.used) {
      if (!i.used_at) return false;
      return now.getTime() - new Date(i.used_at).getTime() < HISTORY_VISIBLE_MS;
    }
    const expiresAt = new Date(i.expires_at);
    if (expiresAt >= now) return true;
    return now.getTime() - expiresAt.getTime() < HISTORY_VISIBLE_MS;
  });
  const magicLinksList = (magicLinksResult.data ?? []).filter(
    (l) => l.is_active && (l.max_uses === null || l.use_count < l.max_uses),
  );

  const totalInvites = invitesList.length;
  const usedInvites = invitesList.filter((i) => i.used).length;
  const activeLinks = magicLinksList.length;

  const stats = [
    {
      label: "Total Invites",
      value: String(totalInvites),
      icon: UserPlus,
      iconBg: "bg-[#E8EEFF]",
      iconColor: "text-[#4A6CF7]",
    },
    {
      label: "Used",
      value: String(usedInvites),
      icon: CheckCircle,
      iconBg: "bg-[#E2F5E9]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: "Active Links",
      value: String(activeLinks),
      icon: Link2,
      iconBg: "bg-[#FDF3E0]",
      iconColor: "text-[#D97706]",
    },
  ];

  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-[#FAFAF7]`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20">
        {/* Header */}
        <header className="motion-safe:animate-fadeIn">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            Invites
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-bold leading-[1.1] text-[#1A1A17] tracking-[-0.02em]">
            Invite Students
          </h1>
          <p className="mt-2 text-[15px] text-[#7A7466] leading-[1.5]">
            Whitelist emails and generate invite links for new students.
          </p>
        </header>

        {/* Stats */}
        <section
          aria-label="Invite totals"
          className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-[14px] motion-safe:animate-fadeIn"
          style={{ animationDelay: "50ms" }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px]"
            >
              <div
                className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${s.iconBg}`}
              >
                <s.icon className={`h-[18px] w-[18px] ${s.iconColor}`} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[24px] font-bold leading-none tabular-nums text-[#1A1A17]">
                  {s.value}
                </p>
                <p className="mt-[6px] text-[12px] text-[#8A8474]">{s.label}</p>
              </div>
            </div>
          ))}
        </section>

        <div
          className="mt-8 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <CoachInvitesClient invites={invitesList} magicLinks={magicLinksList} />
        </div>
      </div>
    </div>
  );
}
