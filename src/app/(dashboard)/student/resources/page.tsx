import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

export default async function StudentResourcesPage() {
  await requireRole("student");
  return (
    <div className="px-4 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-2">
          Resources
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ima-text">
          Everything in one library
        </h1>
        <p className="mt-2 text-sm text-ima-text-secondary leading-relaxed">
          Links, community, and glossary curated by your coaches.
        </p>
      </header>
      <ResourcesClient role="student" />
    </div>
  );
}
