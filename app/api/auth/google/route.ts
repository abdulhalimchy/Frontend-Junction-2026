import { NextResponse } from "next/server";
import { ROLE_COOKIE, roleCookieOptions } from "@/lib/account";
import { BACKEND_API, setSession } from "@/lib/auth";

/**
 * Google sign-in. The browser posts the ID token from Google Identity Services ({ credential }); the backend
 * verifies it, creates the account on first sign-in and returns its JWTs, which go into httpOnly cookies.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { credential?: unknown } | null;
  if (typeof body?.credential !== "string" || !body.credential)
    return NextResponse.json({ error: "Missing Google credential." }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`${BACKEND_API}/accounts/auth/google/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: body.credential }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Cannot reach the backend. Try again in a moment." }, { status: 503 });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof data?.error?.message === "string" ? data.error.message : "Google sign-in failed. Try again.";
    return NextResponse.json({ error: message }, { status: res.status === 503 ? 503 : 401 });
  }

  const user = data.user as { email: string; full_name: string; profile?: { role?: string; is_onboarded?: boolean } };
  const role = user.profile?.role === "investor" || user.profile?.role === "founder" ? user.profile.role : null;
  // New accounts (and ones that never finished onboarding) go through onboarding first.
  const out = NextResponse.json({ ok: true, created: res.status === 201, onboarded: !!user.profile?.is_onboarded, role });
  setSession(out, { access: data.access, refresh: data.refresh }, { name: user.full_name || user.email, email: user.email });
  if (role) out.cookies.set(ROLE_COOKIE, role, roleCookieOptions);
  else out.cookies.delete(ROLE_COOKIE);
  return out;
}
