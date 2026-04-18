import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkTrackerClient } from "@/components/student/WorkTrackerClient";
import type { Database } from "@/lib/types";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

type WorkSession = Database["public"]["Tables"]["work_sessions"]["Row"];
type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];

export default async function StudentDiyWorkPage() {
  const user = await requireRole("student_diy");
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: sessions, error } = await admin
    .from("work_sessions")
    .select("*")
    .eq("student_id", user.id)
    .eq("date", today)
    .order("cycle_number", { ascending: true });

  if (error) {
    console.error("[student_diy work page] Failed to load sessions:", error);
  }

  const { data: plan, error: planError } = await admin
    .from("daily_plans")
    .select("*")
    .eq("student_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (planError) {
    console.error("[student_diy work page] Failed to load daily plan:", planError);
  }

  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-ima-bg`}
    >
      <div className="mx-auto max-w-3xl px-6 md:px-14 pt-10 md:pt-14 pb-20">
        {/* student_diy amplifies scale — larger hero title; WorkTrackerClient keeps the focal hours metric */}
        <header className="motion-safe:animate-fadeIn">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            Work Tracker
          </p>
          <h1 className="mt-3 text-4xl md:text-6xl font-bold leading-[1.0] text-ima-text tracking-[-0.02em]">
            Today&apos;s focus.
          </h1>
          <p className="mt-3 text-[15px] md:text-base text-ima-text-secondary leading-[1.5]">
            Plan it, run it, log it.
          </p>
        </header>

        <div
          className="mt-10 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <WorkTrackerClient
            initialSessions={(sessions ?? []) as WorkSession[]}
            initialPlan={(plan ?? null) as DailyPlan | null}
          />
        </div>
      </div>
    </div>
  );
}
