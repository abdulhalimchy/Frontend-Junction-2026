import { lookupStartup } from "@/lib/backend/startups";
import { fail } from "../fail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Start a startup from its domain or a Cala company picked from search. Poll GET /api/startups/:id until
 * enrichment.status is completed. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { domain?: unknown; calaId?: unknown };
    const calaId = typeof body.calaId === "string" && UUID.test(body.calaId) ? body.calaId : undefined;
    const domain = typeof body.domain === "string" ? body.domain : "";
    return Response.json(await lookupStartup({ domain, calaId }), { status: 201 });
  } catch (e) {
    return fail(e, "Could not start the lookup.");
  }
}
