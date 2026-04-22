import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { ReferralCard } from "@/components/student/ReferralCard";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

export default async function StudentDiyReferralPage() {
  await requireRole("student_diy");

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
            Referral
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-semibold leading-[1.05] text-[#1A1A17] tracking-[-0.02em]">
            Partner Program
          </h1>
          <p className="mt-2 max-w-[58ch] text-[15px] text-[#7A7466] leading-[1.55]">
            Share your unique link. Earn $500 for every friend who joins IMA Accelerator.
          </p>
        </header>

        <div
          className="mt-9 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <ReferralCard />
        </div>
      </div>
    </div>
  );
}
