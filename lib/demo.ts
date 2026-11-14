// Demo data switch. With DEMO_DATA=off the app hides everything that runs on fixtures (the demo personas,
// mock pages, mock entities in ⌘K) so only live Cala features are visible. Default: on.
// Read on the server only; restart the dev server after changing it.
export function demoDataEnabled() {
  return process.env.DEMO_DATA !== "off";
}

/** Pages that only exist on mock data; with demo data off they redirect to Market. Deck check and Alerts are live (backend). */
export const MOCK_ONLY_PATHS = [
  "/home", "/startup", "/portfolio", "/met", "/events", "/me", "/sign-in", "/onboarding",
];
