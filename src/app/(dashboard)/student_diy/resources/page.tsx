import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

export default async function StudentDiyResourcesPage() {
  await requireRole("student_diy");
  return (
    <div className="px-4 max-w-5xl mx-auto">
      {/* Editorial-restrained header — matches Work Tracker stitch-blend treatment */}
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-3">
          Resources
        </p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-ima-text leading-[0.95]">
          Everything in one library.
        </h1>
        <p className="mt-3 text-sm md:text-base text-ima-text-secondary max-w-2xl">
          Links, community, and glossary curated by your coaches.
        </p>
      </header>
      <ResourcesClient role="student_diy" />
    </div>
  );
}
