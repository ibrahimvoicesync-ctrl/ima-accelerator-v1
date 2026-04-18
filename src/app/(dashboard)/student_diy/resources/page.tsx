import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

export default async function StudentDiyResourcesPage() {
  await requireRole("student_diy");
  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-ima-bg`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20">
        {/* Amplified masthead for student_diy */}
        <header className="motion-safe:animate-fadeIn">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            Resources
          </p>
          <h1 className="mt-3 text-4xl md:text-6xl font-bold leading-[1.0] text-ima-text tracking-[-0.02em]">
            Everything in one library.
          </h1>
          <p className="mt-3 text-[15px] md:text-base text-ima-text-secondary leading-[1.5] max-w-2xl">
            Links, community, and glossary curated by your coaches.
          </p>
        </header>

        <div
          className="mt-10 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <ResourcesClient role="student_diy" />
        </div>
      </div>
    </div>
  );
}
