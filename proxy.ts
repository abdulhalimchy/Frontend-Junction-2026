import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSession, cookieOptions, isFresh, refreshTokens } from "./lib/auth";

// Sign-in gate and token refresh, in front of every app page and /api route (not /api/auth).
// - A fresh access token: the request goes through.
// - An expired one with a valid refresh token: new tokens are fetched, set on this request (so the page or route
//   handler sends the new one to the backend) and on the response (so the browser keeps them).
// - No valid session: pages go to /sign-in, which sends the visitor back afterwards (?next=); /api answers 401.
// A signed-in visitor who opens /sign-in or /sign-up goes to Market.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (isFresh(access)) return isAuthPage ? NextResponse.redirect(new URL("/market", request.url)) : NextResponse.next();

  const tokens = refresh ? await refreshTokens(refresh) : null;
  if (tokens) {
    if (isAuthPage) {
      const res = NextResponse.redirect(new URL("/market", request.url));
      res.cookies.set(ACCESS_COOKIE, tokens.access, cookieOptions);
      res.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions);
      return res;
    }
    request.cookies.set(ACCESS_COOKIE, tokens.access);
    request.cookies.set(REFRESH_COOKIE, tokens.refresh);
    const res = NextResponse.next({ request: { headers: request.headers } });
    res.cookies.set(ACCESS_COOKIE, tokens.access, cookieOptions);
    res.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions);
    return res;
  }

  if (isAuthPage) {
    const res = NextResponse.next();
    if (access || refresh) clearSession(res);
    return res;
  }
  const res = isApi
    ? NextResponse.json({ error: "Your session has ended. Sign in again." }, { status: 401 })
    : NextResponse.redirect(signInUrl(request, pathname + search));
  if (access || refresh) clearSession(res);
  return res;
}

function signInUrl(request: NextRequest, next: string) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", next);
  return url;
}

export const config = {
  matcher: [
    "/sign-in",
    "/sign-up",
    "/home/:path*",
    "/market/:path*",
    "/intros/:path*",
    "/startup/:path*",
    "/portfolio/:path*",
    "/deck-check/:path*",
    "/watchlist/:path*",
    "/alerts/:path*",
    "/events/:path*",
    "/company/:path*",
    "/investor/:path*",
    "/me/:path*",
    "/cala/:path*",
    "/onboarding/:path*",
    // Every API route except sign-in and sign-out, which run without a session.
    "/api/((?!auth/).*)",
  ],
};
