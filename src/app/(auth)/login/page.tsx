export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ima-bg">
      <div className="w-full max-w-md rounded-xl bg-ima-surface p-8 shadow-sm border border-ima-border text-center">
        <h1 className="text-2xl font-bold text-ima-text">IMA Accelerator</h1>
        <p className="mt-2 text-ima-text-secondary">Sign in to continue</p>
        <p className="mt-4 text-sm text-ima-text-muted">
          Google OAuth login will be implemented in Phase 2
        </p>
      </div>
    </main>
  );
}
