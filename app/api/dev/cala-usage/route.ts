import { calaUsage } from "@/lib/cala/client";

// Development only: real Cala calls per endpoint since the server started. DELETE resets the counters.
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const total = Object.values(calaUsage).reduce((a, b) => a + b, 0);
  return Response.json({ total, byEndpoint: calaUsage });
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  for (const k of Object.keys(calaUsage)) delete calaUsage[k];
  return Response.json({ reset: true });
}
