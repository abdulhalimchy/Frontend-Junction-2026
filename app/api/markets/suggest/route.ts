import { listMarketAnalyses } from "@/lib/backend/markets";

// Suggestions for the market search: the user's saved reports (opening one is free) and example markets.

const EXAMPLES = [
  "climate tech in the Nordics",
  "seed-stage fintech in Finland",
  "underwater drones in Europe",
  "AI chips worldwide",
  "healthtech in Europe",
  "B2B SaaS in the Nordics",
  "quantum computing in Europe",
  "battery technology in the Nordics",
  "space tech in Europe",
  "cybersecurity in Europe",
  "gaming in Finland",
  "defence tech in Europe",
];

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100).toLowerCase();
  if (q.length < 2) return Response.json({ hits: [] });
  const rows = await listMarketAnalyses().catch(() => []);
  const saved = rows
    .filter((r) => r.status !== "failed" && [r.title, r.typed, r.sector].some((t) => t?.toLowerCase().includes(q)))
    .slice(0, 5)
    .map((r) => ({ id: r.id, name: r.title || r.typed || r.sector, subtitle: `Saved report · ${r.place}`, href: `/market/report?id=${r.id}` }));
  const taken = new Set(saved.map((s) => s.name.toLowerCase()));
  const examples = EXAMPLES.filter((t) => t.toLowerCase().includes(q) && !taken.has(t.toLowerCase()))
    .slice(0, 4)
    .map((t) => ({ id: `example:${t}`, name: t, subtitle: "Example market" }));
  return Response.json({ hits: [...saved, ...examples] });
}
