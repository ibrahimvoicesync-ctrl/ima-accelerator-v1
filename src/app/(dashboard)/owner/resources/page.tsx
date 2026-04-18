import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

export default async function OwnerResourcesPage() {
  await requireRole("owner");
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
            The shared library
          </h1>
          <p className="mt-2 text-[15px] text-[#7A7466] leading-[1.5]">
            Links, community, and glossary across the program.
          </p>
        </header>

        <section
          aria-label="Library overview"
          className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-[14px] motion-safe:animate-fadeIn"
          style={{ animationDelay: "50ms" }}
        >
          <div className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px]">
            <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 bg-[#E8EEFF]">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4A6CF7]"
                style={{ fontFamily: "var(--font-mono-bold)" }}
                aria-hidden="true"
              >
                URL
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-tight text-[#1A1A17] truncate">
                Links
              </p>
              <p className="mt-[6px] text-[12px] text-[#8A8474]">
                Templates & playbooks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px]">
            <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 bg-[#E2F5E9]">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#16A34A]"
                style={{ fontFamily: "var(--font-mono-bold)" }}
                aria-hidden="true"
              >
                Live
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-tight text-[#1A1A17] truncate">
                Community
              </p>
              <p className="mt-[6px] text-[12px] text-[#8A8474]">
                Discord conversation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px]">
            <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 bg-[#F1EEE6]">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A7466]"
                style={{ fontFamily: "var(--font-mono-bold)" }}
                aria-hidden="true"
              >
                Abc
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-tight text-[#1A1A17] truncate">
                Glossary
              </p>
              <p className="mt-[6px] text-[12px] text-[#8A8474]">
                Define the vocabulary
              </p>
            </div>
          </div>
        </section>

        <div
          className="mt-8 bg-white border border-[#EDE9E0] rounded-[14px] p-6 md:p-8 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <ResourcesClient role="owner" coachEditorial />
        </div>
      </div>
    </div>
  );
}
