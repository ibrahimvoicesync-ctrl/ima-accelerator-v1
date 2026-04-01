import "server-only";
import { NextResponse } from "next/server";

/**
 * Verifies the Origin header matches the app host to prevent CSRF.
 * CSRF is NOT automatic for route handlers -- only Server Actions get it.
 *
 * Returns a 403 NextResponse if Origin is missing or mismatched.
 * Returns null if Origin is valid (caller should continue).
 *
 * Insertion point: BEFORE auth check (cheapest check first).
 * Order in mutation handlers: CSRF -> Auth -> Role -> RateLimit -> Body -> Zod -> Ownership -> Logic
 */
export function verifyOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Fallback to request Host header if env var is not set
  const expectedHost = appUrl
    ? new URL(appUrl).host
    : request.headers.get("host");

  if (!origin) {
    // All browser fetch() calls send Origin. Missing = non-browser or CSRF attempt.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const originHost = new URL(origin).host;
    if (originHost !== expectedHost) {
      console.error(
        "CSRF check: origin host mismatch",
        { originHost, expectedHost, NEXT_PUBLIC_APP_URL: appUrl }
      );
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    console.error("CSRF check: malformed Origin header", origin);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
