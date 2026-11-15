import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, BACKEND_API, REFRESH_COOKIE, clearSession } from "@/lib/auth";

/** Signs out: the backend blacklists the refresh token (best effort), then the session cookies go. */
export async function POST() {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (access && refresh)
    await fetch(`${BACKEND_API}/accounts/auth/logout/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    }).catch(() => null);
  const res = new NextResponse(null, { status: 204 });
  clearSession(res);
  return res;
}
