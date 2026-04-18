"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { JetBrains_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/client";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono-bold)" };

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Something went wrong. Try again.",
  already_registered: "You already have an account. Sign in instead.",
};

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorMessage = errorParam
    ? (ERROR_MESSAGES[errorParam] ?? "Something went wrong. Try again.")
    : null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      console.error("[login] OAuth error:", error);
      setLoading(false);
    }
  };

  return (
    <main
      className={`${jetbrainsMono.variable} min-h-screen bg-ima-bg flex items-center justify-center px-6 py-12`}
    >
      <div className="w-full max-w-md motion-safe:animate-fadeIn">
        <div className="bg-ima-surface border border-ima-border rounded-[14px] p-8 md:p-10">
          {/* Masthead */}
          <div className="flex flex-col items-center text-center">
            <p
              className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
              style={MONO}
            >
              Sign In
            </p>
            <span
              role="img"
              aria-label="IMA Accelerator"
              className="mt-5 block bg-ima-primary"
              style={{
                width: 220,
                height: 46,
                WebkitMaskImage: "url(/ima-logo.png)",
                maskImage: "url(/ima-logo.png)",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
              }}
            />
            <p className="mt-4 text-[15px] text-ima-text-secondary leading-[1.5]">
              Student performance &amp; coaching platform.
            </p>
          </div>

          {/* Divider */}
          <div className="mt-8 h-px bg-ima-border" aria-hidden="true" />

          {/* Action */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            aria-label="Sign in with Google"
            className="mt-6 flex items-center justify-center gap-3 w-full min-h-[48px] rounded-[10px] border border-ima-border bg-ima-surface px-4 text-[14px] font-semibold text-ima-text hover:bg-ima-surface-light motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5 shrink-0"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Signing in\u2026" : "Sign in with Google"}
          </button>

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 rounded-[10px] bg-ima-error/10 border border-ima-error/30 px-4 py-3 text-[13px] leading-[1.5] text-ima-error"
            >
              {errorMessage}
            </div>
          )}

          <p
            className="mt-6 text-center text-[10px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
            style={MONO}
          >
            Invite-Only Access
          </p>
        </div>

        <p className="mt-6 text-center text-[12px] text-ima-text-muted">
          Need an invite? Ask your coach.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
