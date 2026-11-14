import "server-only";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Names of markets already analysed, so the market-text guard can map new wordings onto them and reuse
// their cached reports ("mobile apps" → "mobile applications"). Kept next to the Cala cache; seeded from
// cached report summaries the first time. Phase 2 moves this to Supabase with the cache.

// Same folder as the Cala cache in client.ts (CALA_CACHE_DIR, default .cache/cala).
const CACHE_DIR = process.env.CALA_CACHE_DIR || path.join(process.cwd(), ".cache", "cala");
const FILE = path.join(CACHE_DIR, "_known-markets.json");
const MAX = 200;
const g = globalThis as unknown as { __knownMarkets?: Promise<Set<string>> };

function load(): Promise<Set<string>> {
  return (g.__knownMarkets ??= (async () => {
    try {
      return new Set<string>(JSON.parse(await readFile(FILE, "utf8")));
    } catch {
      return seedFromCache();
    }
  })());
}

/** First run: collect market names from cached report summaries (key "summary:vN:model:sector|region|year"). */
async function seedFromCache(): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    for (const f of await readdir(CACHE_DIR)) {
      if (!f.endsWith(".json") || f.startsWith("_")) continue;
      try {
        const key = (JSON.parse(await readFile(path.join(CACHE_DIR, f), "utf8")) as { key?: string }).key ?? "";
        const m = /^summary:v\d+:[^:]+:(.+?)\|/.exec(key);
        if (m) names.add(m[1]);
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // no cache folder yet
  }
  return names;
}

/** Standard names offered on the chooser; variants ("climate technology") should map onto them. */
const PRESET_MARKETS = ["mobile applications", "climate tech", "edtech", "industrial robotics", "fintech", "health tech"];

export async function knownMarkets(): Promise<string[]> {
  return [...new Set([...PRESET_MARKETS, ...(await load())])].slice(-MAX);
}

/** Remembers a market after it has been analysed. Failures to write are ignored (read-only filesystems). */
/** Only call for text the guard accepted as a market, so junk never becomes a suggestion target. */
export async function rememberMarket(name: string) {
  const set = await load();
  if (!name || set.has(name)) return;
  set.add(name);
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(FILE, JSON.stringify([...set].slice(-MAX)));
  } catch {
    // memory only
  }
}
