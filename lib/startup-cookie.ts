// Which startup "My startup" shows. A cookie, like the role switch, until real accounts land.
// Shared by the server (lib/session.ts) and the browser (components/warmline/startup-dialogs.tsx).
export const STARTUP_COOKIE = "wl_startup";
/** The demo persona's company (mock data). Always listed; cannot be renamed or deleted. */
export const DEMO_STARTUP_ID = "demo";

/** Every My startup page names its startup in the URL, so pages of different startups never share a cache entry. */
export function startupHref(id: string, tab: "overview" | "competitors" | "investors" | "deck" = "overview") {
  return `/startup/${tab}?s=${encodeURIComponent(id)}`;
}
