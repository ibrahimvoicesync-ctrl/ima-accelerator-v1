import { requireRole } from "@/lib/session";

export default async function OwnerDashboard() {
  const user = await requireRole("owner");

  return (
    <div>
      <h1 className="text-2xl font-bold text-ima-text">
        Welcome back, {user.name}
      </h1>
      <p className="mt-1 text-ima-text-secondary">
        Owner Dashboard
      </p>
      <p className="mt-4 text-sm text-ima-text-muted">
        Platform stats and management coming in Phase 8-9.
      </p>
    </div>
  );
}
