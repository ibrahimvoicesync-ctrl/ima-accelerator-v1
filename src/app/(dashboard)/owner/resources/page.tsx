import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

export default async function OwnerResourcesPage() {
  await requireRole("owner");
  return (
    <div className="px-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ima-text">Resources</h1>
        <p className="text-sm text-ima-text-secondary mt-1">
          Links, community, and glossary for your students
        </p>
      </div>
      <ResourcesClient role="owner" />
    </div>
  );
}
