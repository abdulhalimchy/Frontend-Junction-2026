import { deletePortfolioCompany, getPortfolioCompany, pickPortfolioInput, updatePortfolioCompany } from "@/lib/backend/portfolio";
import { fail } from "../../startups/fail";

export async function GET(_request: Request, ctx: RouteContext<"/api/portfolio/[id]">) {
  try {
    return Response.json(await getPortfolioCompany((await ctx.params).id));
  } catch (e) {
    return fail(e, "Could not load the company.");
  }
}

/** Edit, or save a reviewed draft ({ ..., is_draft: false }). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/portfolio/[id]">) {
  try {
    return Response.json(await updatePortfolioCompany((await ctx.params).id, pickPortfolioInput(await request.json())));
  } catch (e) {
    return fail(e, "Could not save the company.");
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/portfolio/[id]">) {
  try {
    await deletePortfolioCompany((await ctx.params).id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return fail(e, "Could not remove the company.");
  }
}
