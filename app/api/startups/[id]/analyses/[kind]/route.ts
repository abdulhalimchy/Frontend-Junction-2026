import { getAnalysis, startAnalysis } from "@/lib/backend/startups";
import type { AnalysisKind } from "@/lib/types";
import { fail } from "../../../fail";

const KINDS: AnalysisKind[] = ["competitors", "investors"];

async function params(ctx: RouteContext<"/api/startups/[id]/analyses/[kind]">) {
  const { id, kind } = await ctx.params;
  return KINDS.includes(kind as AnalysisKind) ? { id, kind: kind as AnalysisKind } : null;
}

/** The stored result. Never starts a run. */
export async function GET(_request: Request, ctx: RouteContext<"/api/startups/[id]/analyses/[kind]">) {
  const p = await params(ctx);
  if (!p) return Response.json({ error: "Unknown analysis." }, { status: 404 });
  try {
    return Response.json(await getAnalysis(p.id, p.kind));
  } catch (e) {
    return fail(e, "Could not load the analysis.");
  }
}

/** Run it now, or refresh it (the user clicked the button). */
export async function POST(_request: Request, ctx: RouteContext<"/api/startups/[id]/analyses/[kind]">) {
  const p = await params(ctx);
  if (!p) return Response.json({ error: "Unknown analysis." }, { status: 404 });
  try {
    return Response.json(await startAnalysis(p.id, p.kind), { status: 202 });
  } catch (e) {
    return fail(e, "Could not start the analysis.");
  }
}
