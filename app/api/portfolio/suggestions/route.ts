import { getPortfolioSuggestions } from "@/lib/backend/portfolio";
import { fail } from "../../startups/fail";

export async function GET() {
  try {
    return Response.json(await getPortfolioSuggestions());
  } catch (e) {
    return fail(e, "Could not load suggestions.");
  }
}
