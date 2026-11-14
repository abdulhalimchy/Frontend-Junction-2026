import "server-only";
import { backendError, backendFetch } from "./client";

// Side-event RSVPs (/api/v1/events/{slug}/rsvps/). `mine` is the signed-in user's; `counts` are anonymous
// head counts of Warmline users going to each side event.

export type RsvpSummary = { mine: string[]; counts: Record<string, number> };

async function summary(res: Response): Promise<RsvpSummary> {
  if (!res.ok) throw await backendError(res);
  return res.json() as Promise<RsvpSummary>;
}

export async function getRsvps(event: string): Promise<RsvpSummary> {
  return summary(await backendFetch(`/events/${encodeURIComponent(event)}/rsvps/`));
}

export async function addRsvp(event: string, sideEventId: string): Promise<RsvpSummary> {
  return summary(
    await backendFetch(`/events/${encodeURIComponent(event)}/rsvps/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side_event_id: sideEventId }),
    }),
  );
}

export async function removeRsvp(event: string, sideEventId: string): Promise<void> {
  const res = await backendFetch(`/events/${encodeURIComponent(event)}/rsvps/${encodeURIComponent(sideEventId)}/`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw await backendError(res);
}
