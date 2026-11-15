import "server-only";
import { backendError, backendFetch } from "./client";

/**
 * Permanently deletes the backend account and everything it owns (startups, deck checks and their PDFs,
 * portfolio, market history, watch list, alerts, RSVPs). The backend asks for the password again.
 *
 * Phase 1: the app runs as the shared demo account (lib/backend/client.ts), so the password is the demo one
 * from the server's env. The next backend request registers a fresh, empty demo account. When real sign-in
 * lands, pass the password the user typed instead.
 */
export async function deleteAccount() {
  const res = await backendFetch("/accounts/me/delete/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.BACKEND_DEMO_PASSWORD ?? "" }),
  });
  if (!res.ok) throw await backendError(res);
}
