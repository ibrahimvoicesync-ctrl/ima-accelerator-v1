import Link from "next/link";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ima-bg">
      <div className="w-full max-w-md rounded-xl bg-ima-surface p-8 shadow-sm border border-ima-border text-center">
        <h1 className="text-2xl font-bold text-ima-error">No Access</h1>
        <p className="mt-2 text-ima-text-secondary">
          You do not have permission to access this page.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center min-h-[44px] px-6 rounded-lg bg-ima-primary text-white font-medium hover:bg-ima-primary-hover motion-safe:transition-colors"
        >
          Return to Login
        </Link>
      </div>
    </main>
  );
}
