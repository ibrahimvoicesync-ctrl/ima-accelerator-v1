import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnnouncementsFeed } from "@/components/announcements/AnnouncementsFeed";
import type { Announcement } from "@/components/announcements/announcement-types";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

const PAGE_SIZE = 25;
const EDITED_TOLERANCE_MS = 2000;

export default async function OwnerAnnouncementsPage() {
  const user = await requireRole("owner");
  const admin = createAdminClient();

  const { data, error, count } = await admin
    .from("announcements")
    .select(
      "*, author:users!announcements_author_id_fkey(id, name, role)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (error) {
    console.error("[owner/announcements] Initial fetch failed:", error);
  }

  type RowShape = {
    id: string;
    author_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    author: { id: string; name: string; role: string } | null;
  };

  const rows = (data ?? []) as unknown as RowShape[];
  const initialItems: Announcement[] = rows.map((row) => {
    const createdMs = new Date(row.created_at).getTime();
    const updatedMs = new Date(row.updated_at).getTime();
    return {
      id: row.id,
      author_id: row.author_id,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_edited: updatedMs - createdMs > EDITED_TOLERANCE_MS,
      author: row.author
        ? {
            id: row.author.id,
            name: row.author.name,
            role:
              row.author.role === "owner" || row.author.role === "coach"
                ? row.author.role
                : "owner",
          }
        : null,
    };
  });

  const total = count ?? 0;
  const initialHasMore = initialItems.length < total;
  const totalLabel = String(total);

  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-[#FAFAF7]`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20">
        <header className="motion-safe:animate-fadeIn">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            Announcements
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-bold leading-[1.1] text-[#1A1A17] tracking-[-0.02em]">
            Broadcast to the program
          </h1>
          <p className="mt-2 text-[15px] text-[#7A7466] leading-[1.5]">
            Post updates for coaches and students. Everyone with access sees
            them immediately.
          </p>
        </header>

        <section
          aria-label="Announcements totals"
          className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-[14px] motion-safe:animate-fadeIn"
          style={{ animationDelay: "50ms" }}
        >
          <div className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px]">
            <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 bg-[#E8EEFF]">
              <span
                className="text-[13px] font-bold text-[#4A6CF7] tabular-nums"
                style={{ fontFamily: "var(--font-mono-bold)" }}
                aria-hidden="true"
              >
                #
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[24px] font-bold leading-none tabular-nums text-[#1A1A17]">
                {totalLabel}
              </p>
              <p className="mt-[6px] text-[12px] text-[#8A8474]">Total posts</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px]">
            <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 bg-[#E2F5E9]">
              <span
                className="text-[13px] font-bold text-[#16A34A] tabular-nums"
                style={{ fontFamily: "var(--font-mono-bold)" }}
                aria-hidden="true"
              >
                •
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[24px] font-bold leading-none tabular-nums text-[#1A1A17]">
                Live
              </p>
              <p className="mt-[6px] text-[12px] text-[#8A8474]">
                Visible to all
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px]">
            <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 bg-[#F1EEE6]">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A7466]"
                style={{ fontFamily: "var(--font-mono-bold)" }}
                aria-hidden="true"
              >
                You
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-tight text-[#1A1A17] truncate">
                {user.name.split(" ")[0]}
              </p>
              <p className="mt-[6px] text-[12px] text-[#8A8474]">
                Posting as owner
              </p>
            </div>
          </div>
        </section>

        <section
          aria-label="Announcements feed"
          className="mt-8 bg-white border border-[#EDE9E0] rounded-[14px] p-6 md:p-8 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <AnnouncementsFeed
            role="owner"
            currentUserId={user.id}
            initialItems={initialItems}
            initialHasMore={initialHasMore}
          />
        </section>
      </div>
    </div>
  );
}
