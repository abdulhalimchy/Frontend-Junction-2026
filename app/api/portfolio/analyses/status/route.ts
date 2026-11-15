import { getPortfolioAnalysesStatus } from "@/lib/backend/portfolio";
import { fail } from "../../../startups/fail";

/** Polled by the Portfolio page while analyses run: counts in progress and a version that changes when one finishes. */
export async function GET() {
  try {
    return Response.json(await getPortfolioAnalysesStatus());
  } catch (e) {
    return fail(e, "Could not check progress.");
  }
}
