import { refreshPortfolioAnalyses } from "@/lib/backend/portfolio";
import type { PortfolioAnalysisKind } from "@/lib/types";
import { fail } from "../../../startups/fail";

const KINDS: PortfolioAnalysisKind[] = ["rounds", "competitors", "investors"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Run (or refresh) insights: { companyId?, kinds? }. They run one after another in the background. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { companyId?: unknown; kinds?: unknown };
  const companyId = typeof body.companyId === "string" && UUID.test(body.companyId) ? body.companyId : undefined;
  const kinds = Array.isArray(body.kinds) ? body.kinds.filter((k): k is PortfolioAnalysisKind => KINDS.includes(k)) : undefined;
  try {
    return Response.json(await refreshPortfolioAnalyses({ companyId, kinds }), { status: 202 });
  } catch (e) {
    return fail(e, "Could not start the analysis.");
  }
}
