import { requireRole } from "@/lib/session";

export default async function CoachDashboard() {
  const user = await requireRole("coach");

  return (
    <div>
      <h1 className="text-2xl font-bold text-ima-text">
        Welcome back, {user.name}
      </h1>
      <p className="mt-1 text-ima-text-secondary">
        Coach Dashboard
      </p>
      <p className="mt-4 text-sm text-ima-text-muted">
        Student overview and report review coming in Phase 6-7.
      </p>
    </div>
  );
}
