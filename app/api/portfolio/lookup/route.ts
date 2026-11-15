import { lookupPortfolioCompany } from "@/lib/backend/portfolio";
import { fail } from "../../startups/fail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Start a company from its domain or a Cala company. `quick` saves it at once (a suggestion added in one
 * click). Poll GET /api/portfolio/:id until enrichment.status is completed. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const calaId = typeof body.calaId === "string" && UUID.test(body.calaId) ? body.calaId : undefined;
    const domain = typeof body.domain === "string" ? body.domain : "";
    const name = typeof body.name === "string" ? body.name.slice(0, 200) : "";
    return Response.json(await lookupPortfolioCompany({ domain, calaId, name, quick: body.quick === true }), { status: 201 });
  } catch (e) {
    return fail(e, "Could not start the lookup.");
  }
}
