import { dismissSuggestion } from "@/lib/backend/portfolio";
import { fail } from "../../startups/fail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hide a suggestion: { calaId, name }. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { calaId?: unknown; name?: unknown };
  if (typeof body.calaId !== "string" || !UUID.test(body.calaId)) return Response.json({ error: "Unknown company." }, { status: 400 });
  try {
    await dismissSuggestion(body.calaId, typeof body.name === "string" ? body.name.slice(0, 255) : "");
    return new Response(null, { status: 204 });
  } catch (e) {
    return fail(e, "Could not dismiss the suggestion.");
  }
}
