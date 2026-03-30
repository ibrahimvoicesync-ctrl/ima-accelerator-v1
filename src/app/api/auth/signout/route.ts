import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  // CSRF protection -- Origin header must match app host
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[signout] Failed to sign out:", error);
  }

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, { status: 302 });
}
