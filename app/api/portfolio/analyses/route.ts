import { listPortfolioAnalyses } from "@/lib/backend/portfolio";
import { fail } from "../../startups/fail";

/** Every stored analysis for the portfolio. Never starts a run. */
export async function GET() {
  try {
    return Response.json(await listPortfolioAnalyses());
  } catch (e) {
    return fail(e, "Could not load the portfolio insights.");
  }
}
