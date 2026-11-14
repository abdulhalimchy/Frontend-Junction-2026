import "server-only";
import { memoCala } from "@/lib/cala/client";
import { generateJson, llmConfigured } from "./gemini";

// Guard against spending Cala credit on text that is not a market ("fix python code", "asdf", a question).
// One small Gemini call (~200 tokens), cached for 24h per text. If Gemini is unavailable the search goes
// ahead: the guard saves credit, it must never block real work.

export type GuardVerdict = {
  kind: "market" | "company" | "not_market";
  reason: string;
  /** Short market descriptions the user may have meant (empty when the text is a market). */
  suggestions: string[];
};

const PASS: GuardVerdict = { kind: "market", reason: "", suggestions: [] };

export async function checkMarketText(text: string): Promise<GuardVerdict> {
  if (!llmConfigured()) return PASS;
  const key = text.trim().replace(/\s+/g, " ").toLowerCase();
  try {
    return await memoCala(`guard:v1:${key}`, async () => {
      const { data } = await generateJson<GuardVerdict>({ system: SYSTEM, prompt: `Text: ${JSON.stringify(text.slice(0, 120))}`, schema: SCHEMA });
      return { kind: data.kind, reason: data.reason ?? "", suggestions: (data.suggestions ?? []).slice(0, 3) };
    });
  } catch {
    return PASS;
  }
}

const SYSTEM = `You classify text typed into a market-analysis search box, before a paid data lookup runs.
- "market": an industry, sector, technology, product category or customer segment, optionally with a place
  or qualifier. Examples: "edtech", "underwater drones", "B2B payments in Germany", "vertical farming", "AI chips".
- "company": the name of one specific company, brand or product (e.g. "GE HealthCare", "Spotify", "Figma").
- "not_market": anything else: tasks, questions, instructions, code, people's names, gibberish, single
  generic words that name no market ("help", "test", "money").
Be generous: niche or emerging markets are markets. Only say not_market when no reasonable market is described.
reason: one short sentence for the user. suggestions: when the kind is not "market", up to 3 short market
descriptions the user may have meant (none if nothing sensible); when it is "market", an empty list.`;

const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["market", "company", "not_market"] },
    reason: { type: "string" },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["kind", "reason", "suggestions"],
};
