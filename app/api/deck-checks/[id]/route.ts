import { BackendError } from "@/lib/backend/client";
import { getDeckCheckById } from "@/lib/backend/deck-checks";

export async function GET(_request: Request, ctx: RouteContext<"/api/deck-checks/[id]">) {
  try {
    return Response.json(await getDeckCheckById((await ctx.params).id));
  } catch (e) {
    const err = e instanceof BackendError ? e : new BackendError("Could not load the deck check.", 500);
    return Response.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 500 });
  }
}
