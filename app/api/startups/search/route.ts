import { searchCalaCompanies } from "@/lib/backend/startups";
import { fail } from "../fail";

/** Companies in Cala named like ?q=, to pick from when adding a startup by name. */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ results: [] });
  try {
    return Response.json({ results: await searchCalaCompanies(q) });
  } catch (e) {
    return fail(e, "Could not search Cala.");
  }
}
