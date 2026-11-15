// Which startup "My startup" shows. A cookie, like the role switch, until real accounts land.
// Shared by the server (lib/session.ts) and the browser (components/warmline/startup-dialogs.tsx).
export const STARTUP_COOKIE = "wl_startup";
/**
 * Every My startup page names its startup in the URL, so pages of different startups never share a cache entry.
 * Without an id (no startup added yet) the page picks the founder's latest startup or offers to add one.
 */
export function startupHref(id: string | null, tab: "overview" | "competitors" | "investors" | "connect" | "deck" = "overview") {
  return id ? `/startup/${tab}?s=${encodeURIComponent(id)}` : `/startup/${tab}`;
}
