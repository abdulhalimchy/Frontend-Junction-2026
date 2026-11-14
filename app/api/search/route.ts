import { searchEntity } from "@/lib/cala";
import { calaErrorKind } from "@/lib/cala/client";

// ⌘K suggestions as you type. Browser → Next → Cala entity search, so the API key stays on the server.
// Results are cached per query (lib/cala/client.ts), so retyping the same text costs nothing.

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ hits: [] });
  try {
    const hits = await searchEntity(q, 8);
    return Response.json({ hits });
  } catch (e) {
    const kind = calaErrorKind(e);
    return Response.json({ hits: [], error: kind }, { status: kind === "missing_key" ? 503 : 502 });
  }
}
