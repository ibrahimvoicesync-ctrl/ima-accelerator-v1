import { requireRole } from "@/lib/session";
import { ResourcesClient } from "@/components/resources/ResourcesClient";

export default async function StudentDiyResourcesPage() {
  await requireRole("student_diy");
  return (
    <div className="px-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ima-text">Resources</h1>
        <p className="text-sm text-ima-text-secondary mt-1">
          Links, community, and glossary shared by your coaches
        </p>
      </div>
      <ResourcesClient role="student_diy" />
    </div>
  );
}
