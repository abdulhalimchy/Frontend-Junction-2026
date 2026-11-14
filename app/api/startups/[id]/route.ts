import { deleteStartup, getStartup, pickInput, updateStartup } from "@/lib/backend/startups";
import { fail } from "../fail";

export async function GET(_request: Request, ctx: RouteContext<"/api/startups/[id]">) {
  try {
    return Response.json(await getStartup((await ctx.params).id));
  } catch (e) {
    return fail(e, "Could not load the startup.");
  }
}

/** Rename, edit, or save a reviewed draft ({ ..., is_draft: false }). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/startups/[id]">) {
  try {
    return Response.json(await updateStartup((await ctx.params).id, pickInput(await request.json())));
  } catch (e) {
    return fail(e, "Could not save the startup.");
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/startups/[id]">) {
  try {
    await deleteStartup((await ctx.params).id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return fail(e, "Could not delete the startup.");
  }
}
