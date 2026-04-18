import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

export default async function CoachResourcesPage() {
  await requireRole("coach");
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
          <h1 className="mt-3 text-[32px] md:text-[36px] font-bold leading-[1.1] text-[#1A1A17] tracking-[-0.02em]">
            Curate the shared library
          </h1>
          <p className="mt-2 text-[15px] text-[#7A7466] leading-[1.5]">
            Links, community, and glossary your students rely on.
          </p>
        </header>

        <div
          className="mt-9 bg-white border border-[#EDE9E0] rounded-[14px] p-6 md:p-8 motion-safe:animate-fadeIn"
          style={{ animationDelay: "50ms" }}
        >
          <ResourcesClient role="coach" coachEditorial />
        </div>
      </div>
    </div>
  );
}
