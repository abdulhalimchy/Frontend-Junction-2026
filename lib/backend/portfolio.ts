import "server-only";
import type { PortfolioAnalysis, PortfolioAnalysisKind, PortfolioCompany, PortfolioDeal, PortfolioSuggestions, Source, Startup, StartupField } from "@/lib/types";
import { backendError, backendFetch } from "./client";
import { STARTUP_FIELDS } from "./startups";

// /api/v1/portfolio/ (snake_case) ↔ the frontend's PortfolioCompany.
type ApiCompany = {
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
  invested_amount: string | null;
  currency: string;
  entry_round: string;
  invested_on: string;
  ownership: string | null;
  board_seat: boolean;
  status: PortfolioDeal["status"];
  notes: string;
  origin: PortfolioCompany["origin"];
  is_draft: boolean;
  enrichment_status: Startup["enrichment"]["status"];
  enrichment_error: string;
  enrichment_note: string;
  suggestions: Startup["suggestions"];
};

const STATUSES: PortfolioDeal["status"][] = ["active", "exited", "written_off"];

/** What the browser may write, in the backend's field names. Anything else in a request body is dropped. */
export type PortfolioInput = Partial<Record<StartupField | "domain" | "currency" | "entry_round" | "invested_on" | "notes", string>> & {
  invested_amount?: string | null;
  ownership?: string | null;
  board_seat?: boolean;
  status?: PortfolioDeal["status"];
  is_draft?: false;
};

const num = (v: string | null) => (v === null || v === "" ? null : Number(v));

function toCompany(c: ApiCompany): PortfolioCompany {
  return {
    id: c.id,
    name: c.name,
    domain: c.domain,
    description: c.description,
    founded: c.founded,
    headquarters: c.headquarters,
    employees: c.employees,
    stage: c.stage,
    industry: c.industry,
    calaCompanyId: c.cala_company_id,
    sources: c.sources ?? {},
    isDraft: c.is_draft,
    enrichment: { status: c.enrichment_status, error: c.enrichment_error, note: c.enrichment_note },
    suggestions: c.suggestions ?? {},
    investedAmount: num(c.invested_amount),
    currency: c.currency || "EUR",
    entryRound: c.entry_round,
    investedOn: c.invested_on,
    ownership: num(c.ownership),
    boardSeat: c.board_seat,
    status: c.status,
    notes: c.notes,
    origin: c.origin,
  };
}

const DECIMAL = /^\d+(\.\d+)?$/;

export function pickPortfolioInput(body: unknown): PortfolioInput {
  const src = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const out: PortfolioInput = {};
  for (const k of [...STARTUP_FIELDS, "domain", "currency", "entry_round", "invested_on", "notes"] as const)
    if (typeof src[k] === "string") out[k] = src[k] as string;
  for (const k of ["invested_amount", "ownership"] as const) {
    const v = src[k];
    if (v === null || v === "") out[k] = null;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = String(v);
    else if (typeof v === "string" && DECIMAL.test(v.trim())) out[k] = v.trim();
    else if (typeof v === "string") out[k] = v; // let the backend reject it with a readable message
  }
  if (typeof src.board_seat === "boolean") out.board_seat = src.board_seat;
  if (typeof src.status === "string" && STATUSES.includes(src.status as PortfolioDeal["status"])) out.status = src.status as PortfolioDeal["status"];
  if (src.is_draft === false) out.is_draft = false;
  return out;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await backendError(res);
  return (await res.json()) as T;
}

const send = (path: string, method: string, body?: unknown) =>
  backendFetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export async function listPortfolio(): Promise<PortfolioCompany[]> {
  const page = await json<{ results: ApiCompany[] }>(await backendFetch("/portfolio/?page_size=200"));
  return page.results.map(toCompany);
}

export async function getPortfolioCompany(id: string): Promise<PortfolioCompany> {
  return toCompany(await json<ApiCompany>(await backendFetch(`/portfolio/${encodeURIComponent(id)}/`)));
}

export async function createPortfolioCompany(input: PortfolioInput): Promise<PortfolioCompany> {
  return toCompany(await json<ApiCompany>(await send("/portfolio/", "POST", input)));
}

export async function updatePortfolioCompany(id: string, input: PortfolioInput): Promise<PortfolioCompany> {
  return toCompany(await json<ApiCompany>(await send(`/portfolio/${encodeURIComponent(id)}/`, "PATCH", input)));
}

export async function deletePortfolioCompany(id: string): Promise<void> {
  const res = await backendFetch(`/portfolio/${encodeURIComponent(id)}/`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw await backendError(res);
}

/** Start the background lookup. `quick` saves it at once (one-click add of a suggestion). */
export async function lookupPortfolioCompany(body: { domain?: string; calaId?: string; name?: string; quick?: boolean }): Promise<PortfolioCompany> {
  const res = await send("/portfolio/lookup/", "POST", {
    domain: body.domain ?? "",
    cala_id: body.calaId || null,
    name: body.name ?? "",
    quick: !!body.quick,
  });
  return toCompany(await json<ApiCompany>(res));
}

type ApiSuggestions = {
  fund: { id: string; name: string } | null;
  results: { id: string; name: string; first_reported: string | null; sources: Source[] }[];
  capped?: boolean;
};

function toSuggestions(s: ApiSuggestions): PortfolioSuggestions {
  return {
    fund: s.fund,
    capped: s.capped,
    results: s.results.map((r) => ({ id: r.id, name: r.name, firstReported: r.first_reported, sources: r.sources })),
  };
}

export async function getPortfolioSuggestions(): Promise<PortfolioSuggestions> {
  return toSuggestions(await json<ApiSuggestions>(await backendFetch("/portfolio/suggestions/")));
}

/** Link the investor's fund in Cala (null unlinks). Returns the new suggestions. */
export async function linkFund(calaId: string | null): Promise<PortfolioSuggestions> {
  return toSuggestions(await json<ApiSuggestions>(await send("/portfolio/fund/", "PUT", { cala_id: calaId })));
}

export async function dismissSuggestion(calaId: string, name: string): Promise<void> {
  const res = await send("/portfolio/dismiss/", "POST", { cala_id: calaId, name });
  if (!res.ok) throw await backendError(res);
}

// -- analyses -------------------------------------------------------------------

type ApiAnalysis = {
  company: string;
  kind: PortfolioAnalysisKind;
  status: PortfolioAnalysis["status"];
  data: Record<string, unknown>;
  error: string;
  finished_at: string | null;
};

const toAnalysis = (a: ApiAnalysis): PortfolioAnalysis => ({
  company: a.company,
  kind: a.kind,
  status: a.status,
  data: a.data ?? {},
  error: a.error,
  finishedAt: a.finished_at,
});

/** Every stored analysis for the portfolio. Reading never starts a run. */
export async function listPortfolioAnalyses(): Promise<PortfolioAnalysis[]> {
  return (await json<ApiAnalysis[]>(await backendFetch("/portfolio/analyses/"))).map(toAnalysis);
}

/** Run (or refresh) analyses in the background: `kinds` (default all) for one company (default all). */
export async function refreshPortfolioAnalyses(body: { companyId?: string; kinds?: PortfolioAnalysisKind[] }): Promise<PortfolioAnalysis[]> {
  const res = await send("/portfolio/analyses/refresh/", "POST", {
    company: body.companyId ?? null,
    ...(body.kinds?.length ? { kinds: body.kinds } : {}),
  });
  return (await json<ApiAnalysis[]>(res)).map(toAnalysis);
}
