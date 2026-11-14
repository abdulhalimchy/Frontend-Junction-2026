import { knownMarkets } from "@/lib/cala/known-markets";
import { checkMarketText } from "@/lib/backend/markets";

// Development only: what the market-text guard decides for ?text=…, against the markets already analysed.
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const text = new URL(req.url).searchParams.get("text") ?? "";
  const known = await knownMarkets();
  return Response.json({ text, verdict: await checkMarketText(text, known), known });
}
