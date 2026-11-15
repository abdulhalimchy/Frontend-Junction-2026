import { linkFund } from "@/lib/backend/portfolio";
import { fail } from "../../startups/fail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Link the investor's fund in Cala ({ calaId }), or unlink it ({ calaId: null }). */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { calaId?: unknown };
  const calaId = typeof body.calaId === "string" && UUID.test(body.calaId) ? body.calaId : null;
  if (body.calaId !== null && !calaId) return Response.json({ error: "Pick the fund from the search." }, { status: 400 });
  try {
    return Response.json(await linkFund(calaId));
  } catch (e) {
    return fail(e, "Could not link the fund.");
  }
}
