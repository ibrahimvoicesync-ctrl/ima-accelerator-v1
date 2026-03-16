import { getSessionUser } from "@/lib/session";

export default async function StudentDashboard() {
  const user = await getSessionUser();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ima-text">
        Welcome back, {user.name}
      </h1>
      <p className="mt-1 text-ima-text-secondary">
        Student Dashboard
      </p>
      <p className="mt-4 text-sm text-ima-text-muted">
        Work tracker, roadmap, and daily reports coming in Phase 3-5.
      </p>
    </div>
  );
}
