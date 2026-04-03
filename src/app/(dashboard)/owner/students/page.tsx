import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui";
import { Users } from "lucide-react";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { getTodayUTC } from "@/lib/utils";

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

  let query = admin
    .from("users")
    .select("id, name, email, status, joined_at, coach_id", { count: "estimated" })
    .eq("role", "student")
    .order("name")
    .range(from, to);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: students, count, error } = await query;

  if (error) {
    console.error("[owner students] Failed to load students:", error);
  }

  const studentIds = (students ?? []).map((s) => s.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: skipData, error: skipError } = studentIds.length > 0
    ? await (admin as any).rpc("get_weekly_skip_counts", {
        p_student_ids: studentIds,
        p_today: getTodayUTC(),
        p_current_hour: new Date().getUTCHours(),
      })
    : { data: null, error: null };

  if (skipError) {
    console.error("[owner students] Failed to load skip counts:", skipError);
  }

  const skipCountMap = new Map<string, number>();
  for (const [id, val] of Object.entries((skipData ?? {}) as Record<string, number>)) {
    if (typeof val === "number" && val > 0) {
      skipCountMap.set(id, val);
    }
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-ima-text">Students</h1>
      <p className="mt-1 text-ima-text-secondary">
        ~{count ?? 0} student{(count ?? 0) !== 1 ? "s" : ""} on the platform
      </p>

      {/* Server-side search form */}
      <form action="/owner/students" method="GET" className="mt-6">
        <label htmlFor="student-search" className="sr-only">Search students</label>
        <input
          id="student-search"
          name="search"
          type="text"
          defaultValue={search ?? ""}
          placeholder="Search by name or email..."
          aria-label="Search students by name or email"
          className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-ima-border bg-ima-bg text-ima-text placeholder:text-ima-text-secondary focus:outline-none focus:ring-2 focus:ring-ima-primary focus:border-ima-primary"
        />
      </form>

      {(students ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden="true" />}
            title="No students found"
            description={search ? "Try a different search term." : "No students have joined the platform yet."}
            action={
              !search ? (
                <Link href="/owner/invites" className={buttonVariants({ variant: "primary" })}>
                  Invite Students
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {(students ?? []).map((s) => {
              const initials = s.name
                .split(" ")
                .map((n: string) => n[0] ?? "")
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <Link key={s.id} href={`/owner/students/${s.id}`} className="min-h-[44px] block">
                  <Card interactive>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-ima-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ima-text truncate">{s.name}</p>
                        <p className="text-xs text-ima-text-secondary truncate">{s.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {(skipCountMap.get(s.id) ?? 0) > 0 && (
                          <Badge variant="warning" size="sm">
                            {skipCountMap.get(s.id)} skipped
                          </Badge>
                        )}
                        <Badge
                          variant={
                            s.status === "active"
                              ? "success"
                              : s.status === "suspended"
                              ? "warning"
                              : "default"
                          }
                          size="sm"
                        >
                          {s.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            basePath="/owner/students"
            searchParams={search ? { search } : {}}
          />
        </>
      )}
    </div>
  );
}
