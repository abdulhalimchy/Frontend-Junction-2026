import { BackendError } from "@/lib/backend/client";
import { retryDeck } from "@/lib/backend/deck-checks";

export async function POST(_request: Request, ctx: RouteContext<"/api/deck-checks/[id]/retry">) {
  try {
    return Response.json(await retryDeck((await ctx.params).id), { status: 202 });
  } catch (e) {
    const err = e instanceof BackendError ? e : new BackendError("Could not retry.", 500);
    return Response.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 500 });
  }
}
