import { listMarketAnalyses } from "@/lib/backend/markets";
import { searchEntity } from "@/lib/cala";

// Suggestions for the two analysis searches. Both list the user's saved reports of that kind (opening one is free).
// ?kind=market (default) adds example markets; ?kind=company adds companies matching the name, and picking one
// opens its analysis at /market/company without the "which one do you mean?" step.

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
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") === "company" ? "company" : "market";
  const typed = (params.get("q") ?? "").trim().slice(0, 100);
  const q = typed.toLowerCase();
  if (q.length < 2) return Response.json({ hits: [] });
  const [rows, found] = await Promise.all([listMarketAnalyses().catch(() => []), kind === "company" ? searchEntity(typed, 6).catch(() => []) : []]);
  const mine = rows.filter((r) => r.kind === kind && r.status !== "failed" && [r.title, r.typed, r.sector].some((t) => t?.toLowerCase().includes(q))).slice(0, 5);
  const saved = mine.map((r) => ({
    id: r.id,
    name: r.title || r.typed || r.sector,
    subtitle: `Saved report · ${r.place}`,
    href: `/market/${kind === "company" ? "company" : "report"}?id=${r.id}`,
  }));
  if (kind === "company") {
    // A company with a saved report is listed once, as the report.
    const analysed = new Set(mine.map((r) => r.entityId));
    const companies = found
      .filter((h) => h.type === "company" && !analysed.has(h.id))
      .slice(0, 6)
      .map((h) => ({
        id: h.id,
        name: h.name,
        subtitle: h.subtitle,
        href: `/market/company?${new URLSearchParams({ entity: h.id, name: h.name, description: (h.subtitle ?? "").slice(0, 400), q: typed })}`,
      }));
    return Response.json({ hits: [...saved, ...companies] });
  }
  const taken = new Set(saved.map((s) => s.name.toLowerCase()));
  const examples = EXAMPLES.filter((t) => t.toLowerCase().includes(q) && !taken.has(t.toLowerCase()))
    .slice(0, 4)
    .map((t) => ({ id: `example:${t}`, name: t, subtitle: "Example market" }));
  return Response.json({ hits: [...saved, ...examples] });
}
