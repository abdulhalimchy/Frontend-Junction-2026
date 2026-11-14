import { lookupStartup } from "@/lib/backend/startups";
import { fail } from "../fail";

/** Start a startup from its domain. Poll GET /api/startups/:id until enrichment.status is completed. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { domain?: unknown };
    return Response.json(await lookupStartup(String(body.domain ?? "")), { status: 201 });
  } catch (e) {
    return fail(e, "Could not start the lookup.");
  }
}
