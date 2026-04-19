import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

export default async function StudentResourcesPage() {
  await requireRole("student");
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
            Resources
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-semibold leading-[1.05] text-[#1A1A17] tracking-[-0.02em]">
            Everything in one library
          </h1>
          <p className="mt-2 max-w-[58ch] text-[15px] text-[#7A7466] leading-[1.55]">
            Links, community, and glossary curated by your coaches.
          </p>
        </header>

        <div
          className="mt-9 bg-white border border-[#EDE9E0] rounded-[14px] p-6 md:p-8 motion-safe:animate-fadeIn"
          style={{ animationDelay: "50ms" }}
        >
          <ResourcesClient role="student" coachEditorial />
        </div>
      </div>
    </div>
  );
}
