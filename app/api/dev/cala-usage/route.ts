import { calaUsage } from "@/lib/cala/client";
import { llmUsage } from "@/lib/llm/gemini";

// Development only: real Cala calls per endpoint and Gemini tokens since the server started. DELETE resets them.
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const total = Object.values(calaUsage).reduce((a, b) => a + b, 0);
  return Response.json({ cala: { total, byEndpoint: calaUsage }, gemini: llmUsage });
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  for (const k of Object.keys(calaUsage)) delete calaUsage[k];
  Object.assign(llmUsage, { calls: 0, input: 0, output: 0, thinking: 0, total: 0 });
  return Response.json({ reset: true });
}
