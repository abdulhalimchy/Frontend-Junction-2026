import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCOUNT_COOKIE, parseAccount } from "./lib/account";
import { demoDataEnabled } from "./lib/demo";

// Signed-out visitors who open an app or onboarding page go to /sign-in, which sends them back afterwards (?next=).
// "Signed in" means the mock account cookie exists (lib/account.ts): this decides what a visitor sees and protects
// nothing, since anyone can set the cookie. Real auth replaces the check here. The /api routes are not gated.
// With DEMO_DATA=off there is no sign-in page (next.config.ts sends it to Market), so nothing is gated.
export function proxy(request: NextRequest) {
  if (!demoDataEnabled()) return NextResponse.next();
  if (parseAccount(request.cookies.get(ACCOUNT_COOKIE)?.value)?.email) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
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
    "/onboarding/:path*",
  ],
};
