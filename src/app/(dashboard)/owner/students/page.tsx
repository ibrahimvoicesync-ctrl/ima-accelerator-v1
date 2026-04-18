import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui";
import { Users, Activity, GraduationCap, Search } from "lucide-react";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { getTodayUTC } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

const PAGE_SIZE = 25;

export default async function OwnerStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await requireRole("owner");
  const { search, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const admin = createAdminClient();

  let studentsQuery = admin
    .from("users")
    .select(
      "id, name, email, role, status, joined_at, coach_id",
      { count: "estimated" },
    )
    .in("role", ["student", "student_diy"])
    .order("name")
    .range(from, to);

  if (search) {
    studentsQuery = studentsQuery.or(
      `name.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }

  const [studentsResult, activeCountResult, diyCountResult] = await Promise.all(
    [
      studentsQuery,
      admin
        .from("users")
        .select("id", { count: "exact", head: true })
        .in("role", ["student", "student_diy"])
        .eq("status", "active"),
      admin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "student_diy"),
    ],
  );

  const { data: students, count, error } = studentsResult;

  if (error) {
    console.error("[owner students] Failed to load students:", error);
  }
  if (activeCountResult.error) {
    console.error(
      "[owner students] Failed to load active count:",
      activeCountResult.error,
    );
  }
  if (diyCountResult.error) {
    console.error(
      "[owner students] Failed to load DIY count:",
      diyCountResult.error,
    );
  }

  const studentIds = (students ?? []).map((s) => s.id);

  const skipResult =
    studentIds.length > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).rpc("get_weekly_skip_counts", {
          p_student_ids: studentIds,
          p_today: getTodayUTC(),
          p_current_hour: new Date().getUTCHours(),
        })
      : { data: null, error: null };
  const { data: skipData, error: skipError } = skipResult;

  if (skipError) {
    console.error("[owner students] Failed to load skip counts:", skipError);
  }

  const skipCountMap = new Map<string, number>();
  for (const [id, val] of Object.entries(
    (skipData ?? {}) as Record<string, number>,
  )) {
    if (typeof val === "number" && val > 0) {
      skipCountMap.set(id, val);
    }
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const totalStudents = count ?? 0;
  const activeStudents = activeCountResult.count ?? 0;
  const diyStudents = diyCountResult.count ?? 0;

  const statCards = [
    {
      label: "Total Students",
      value: String(totalStudents),
      icon: Users,
      iconBg: "bg-[#E8EEFF]",
      iconColor: "text-[#4A6CF7]",
    },
    {
      label: "Active",
      value: String(activeStudents),
      icon: Activity,
      iconBg: "bg-[#E2F5E9]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: "Student DIY",
      value: String(diyStudents),
      icon: GraduationCap,
      iconBg: "bg-[#FDF3E0]",
      iconColor: "text-[#D97706]",
    },
  ];

  function initials(name: string): string {
    return name
      .split(" ")
      .map((n: string) => n[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function statusPillCls(status: string): string {
    if (status === "active")
      return "bg-[#E2F5E9] border-[#BBE5CA] text-[#16A34A]";
    if (status === "suspended")
      return "bg-[#FDF3E0] border-[#F0DFB3] text-[#9A6B1F]";
    return "bg-[#F1EEE6] border-[#EDE9E0] text-[#7A7466]";
  }

  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-[#FAFAF7]`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20">
        {/* Masthead */}
        <header className="motion-safe:animate-fadeIn">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            Students
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-bold leading-[1.1] text-[#1A1A17] tracking-[-0.02em]">
            Everyone in the program
          </h1>
          <p className="mt-2 text-[15px] text-[#7A7466] leading-[1.5]">
            ~{totalStudents} student{totalStudents !== 1 ? "s" : ""} on the
            platform
          </p>
        </header>

        {/* Stats row */}
        <section
          aria-label="Student overview"
          className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-[14px] motion-safe:animate-fadeIn"
          style={{ animationDelay: "50ms" }}
        >
          {statCards.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px]"
            >
              <div
                className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${s.iconBg}`}
              >
                <s.icon
                  className={`h-[18px] w-[18px] ${s.iconColor}`}
                  aria-hidden="true"
                />
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

        {/* Search */}
        <form
          action="/owner/students"
          method="GET"
          className="mt-8 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <label htmlFor="student-search" className="sr-only">
            Search students
          </label>
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A8474]"
              aria-hidden="true"
            />
            <input
              id="student-search"
              name="search"
              type="text"
              defaultValue={search ?? ""}
              placeholder="Search by name or email…"
              aria-label="Search students by name or email"
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-[10px] border border-[#EDE9E0] bg-white text-[13px] text-[#1A1A17] placeholder:text-[#8A8474] focus:outline-none focus:ring-2 focus:ring-[#4A6CF7] focus:ring-offset-1 hover:border-[#D8D2C4] motion-safe:transition-colors"
            />
          </div>
        </form>

        {/* Student grid */}
        {(students ?? []).length === 0 ? (
          <div
            className="mt-6 bg-white border border-[#EDE9E0] rounded-[14px] p-6 motion-safe:animate-fadeIn"
            style={{ animationDelay: "150ms" }}
          >
            <EmptyState
              icon={<Users className="h-6 w-6" aria-hidden="true" />}
              title="No students found"
              description={
                search
                  ? "Try a different search term."
                  : "No students have joined the platform yet."
              }
              action={
                !search ? (
                  <Link
                    href="/owner/invites"
                    className={buttonVariants({ variant: "primary" })}
                  >
                    Invite Students
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div
            className="motion-safe:animate-fadeIn"
            style={{ animationDelay: "150ms" }}
          >
            <ul
              className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-[14px]"
              role="list"
            >
              {(students ?? []).map((s) => {
                const skipped = skipCountMap.get(s.id) ?? 0;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/owner/students/${s.id}`}
                      aria-label={`${s.name} — ${s.status}`}
                      className="block rounded-[14px] border border-[#EDE9E0] bg-white p-5 min-h-[88px] motion-safe:transition-[transform,border-color] hover:-translate-y-[1px] hover:border-[#D8D2C4] focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#F1EEE6] border border-[#EDE9E0] flex items-center justify-center text-[12px] font-semibold text-[#5A5648] shrink-0">
                          {initials(s.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-[#1A1A17] truncate leading-tight">
                            {s.name}
                          </p>
                          <p className="mt-[3px] text-[12px] text-[#7A7466] truncate">
                            {s.email}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {skipped > 0 && (
                            <span className="inline-flex items-center px-2 py-[2px] rounded-full bg-[#FDF3E0] border border-[#F0DFB3] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9A6B1F]">
                              {skipped} skipped
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            {s.role === "student_diy" && (
                              <span className="inline-flex items-center px-2 py-[2px] rounded-full bg-[#E8EEFF] border border-[#C9D5FF] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4A6CF7]">
                                DIY
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center px-2 py-[2px] rounded-full border text-[10px] font-semibold uppercase tracking-[0.08em] ${statusPillCls(s.status)}`}
                            >
                              {s.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              basePath="/owner/students"
              searchParams={search ? { search } : {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}
