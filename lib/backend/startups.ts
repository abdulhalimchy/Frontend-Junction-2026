import "server-only";
import type { Analysis, AnalysisKind, CalaCandidate, Startup, StartupField } from "@/lib/types";
import { backendError, backendFetch } from "./client";

// /api/v1/startups/ (snake_case) ↔ the frontend's Startup.
type ApiStartup = {
  id: string;
  name: string;
  domain: string;
  description: string;
  founded: string;
  headquarters: string;
  employees: string;
  stage: string;
  industry: string;
  cala_company_id: string;
  sources: Startup["sources"];
  is_draft: boolean;
  enrichment_status: Startup["enrichment"]["status"];
  enrichment_error: string;
  enrichment_note: string;
  suggestions: Startup["suggestions"];
};

export const STARTUP_FIELDS: StartupField[] = ["name", "description", "founded", "headquarters", "employees", "stage", "industry"];

/** What the browser may write. Anything else in a request body is dropped. */
export type StartupInput = Partial<Record<StartupField | "domain", string>> & { is_draft?: false };

function toStartup(s: ApiStartup): Startup {
  return {
    id: s.id,
    name: s.name,
    domain: s.domain,
    description: s.description,
    founded: s.founded,
    headquarters: s.headquarters,
    employees: s.employees,
    stage: s.stage,
    industry: s.industry,
    calaCompanyId: s.cala_company_id,
    sources: s.sources ?? {},
    isDraft: s.is_draft,
    enrichment: { status: s.enrichment_status, error: s.enrichment_error, note: s.enrichment_note },
    suggestions: s.suggestions ?? {},
  };
}

export function pickInput(body: unknown): StartupInput {
  const src = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const out: StartupInput = {};
  for (const k of [...STARTUP_FIELDS, "domain"] as const) if (typeof src[k] === "string") out[k] = src[k] as string;
  if (src.is_draft === false) out.is_draft = false;
  return out;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await backendError(res);
  return (await res.json()) as T;
}

export async function listStartups(): Promise<Startup[]> {
  const page = await json<{ results: ApiStartup[] }>(await backendFetch("/startups/?page_size=100"));
  return page.results.map(toStartup);
}

export async function getStartup(id: string): Promise<Startup> {
  return toStartup(await json<ApiStartup>(await backendFetch(`/startups/${encodeURIComponent(id)}/`)));
}

export async function createStartup(input: StartupInput): Promise<Startup> {
  const res = await backendFetch("/startups/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return toStartup(await json<ApiStartup>(res));
}

/** Starts the background lookup from a domain, a Cala company picked from search, or both. Returns a draft
 * whose suggestions fill in as the lookup runs. */
export async function lookupStartup({ domain, calaId }: { domain?: string; calaId?: string }): Promise<Startup> {
  const res = await backendFetch("/startups/lookup/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain: domain ?? "", cala_id: calaId || null }),
  });
  return toStartup(await json<ApiStartup>(res));
}

/** Companies in Cala named like `q`, for the user to pick from when adding a startup by name. */
export async function searchCalaCompanies(q: string): Promise<CalaCandidate[]> {
  const res = await backendFetch(`/startups/search/?${new URLSearchParams({ q })}`);
  return (await json<{ results: CalaCandidate[] }>(res)).results;
}

export async function updateStartup(id: string, input: StartupInput): Promise<Startup> {
  const res = await backendFetch(`/startups/${encodeURIComponent(id)}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return toStartup(await json<ApiStartup>(res));
}

export async function deleteStartup(id: string): Promise<void> {
  const res = await backendFetch(`/startups/${encodeURIComponent(id)}/`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw await backendError(res);
}

/** The stored analysis for a tab. Reading never starts a run. */
export async function getAnalysis(id: string, kind: AnalysisKind): Promise<Analysis<unknown>> {
  return json(await backendFetch(`/startups/${encodeURIComponent(id)}/analyses/${kind}/`));
}

/** Run (or refresh) a tab's analysis in the background. Poll getAnalysis while status is "loading". */
export async function startAnalysis(id: string, kind: AnalysisKind): Promise<Analysis<unknown>> {
  return json(await backendFetch(`/startups/${encodeURIComponent(id)}/analyses/${kind}/`, { method: "POST" }));
}
