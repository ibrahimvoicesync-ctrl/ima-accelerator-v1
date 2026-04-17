import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

export default async function OwnerResourcesPage() {
  await requireRole("owner");
  return (
    <div className="px-4 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-2">
          Resources
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ima-text">
          The shared library
        </h1>
        <p className="mt-2 text-sm text-ima-text-secondary leading-relaxed">
          Links, community, and glossary across the program.
        </p>
      </header>
      <ResourcesClient role="owner" />
    </div>
  );
}
