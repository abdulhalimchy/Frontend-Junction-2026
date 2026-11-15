import "server-only";
import type { DeckCheckResult, DeckCheckSummary, DeckClaim } from "@/lib/types";
import { backendError, backendFetch } from "./client";

// Shapes returned by /api/v1/deck-checks/ (snake_case). Sources already match the frontend's Source type.
type ApiClaim = Omit<DeckClaim, "onRecord"> & { on_record: string };
type ApiDeckCheck = {
  id: string;
  file_name: string;
  company_name: string;
  pages: number | null;
  status: DeckCheckResult["status"];
  error: string;
  created_at: string;
  checked_at: string | null;
  confirmed_count?: number;
  differs_count?: number;
  cant_verify_count?: number;
  claims?: ApiClaim[];
};

const HISTORY_SIZE = 50;

export function toResult(d: ApiDeckCheck): DeckCheckResult {
  return {
    id: d.id,
    status: d.status,
    error: d.error || null,
    fileName: d.file_name,
    companyName: d.company_name,
    pages: d.pages,
    checkedAt: d.checked_at ?? d.created_at,
    claims: (d.claims ?? []).map(({ on_record, ...c }) => ({ ...c, onRecord: on_record || undefined })),
  };
}

function toSummary(d: ApiDeckCheck): DeckCheckSummary {
  const result: Partial<DeckCheckResult> = toResult(d);
  delete result.claims;
  return { ...(result as Omit<DeckCheckResult, "claims">), counts: { confirmed: d.confirmed_count ?? 0, differs: d.differs_count ?? 0, cant_verify: d.cant_verify_count ?? 0 } };
}

/**
 * Past deck checks, newest first, without their claims.
 * startupId scopes it to one startup (null: decks with no startup); undefined: any deck.
 */
export async function listDeckChecks(startupId?: string | null): Promise<DeckCheckSummary[]> {
  const scope = startupId === undefined ? "" : `&startup=${encodeURIComponent(startupId ?? "none")}`;
  const res = await backendFetch(`/deck-checks/?page_size=${HISTORY_SIZE}${scope}`);
  if (!res.ok) throw await backendError(res);
  return ((await res.json()) as { results: ApiDeckCheck[] }).results.map(toSummary);
}

export async function deleteDeck(id: string): Promise<void> {
  const res = await backendFetch(`/deck-checks/${encodeURIComponent(id)}/`, { method: "DELETE" });
  if (!res.ok) throw await backendError(res);
}

export async function getDeckCheckById(id: string): Promise<DeckCheckResult> {
  const res = await backendFetch(`/deck-checks/${encodeURIComponent(id)}/`);
  if (!res.ok) throw await backendError(res);
  return toResult(await res.json());
}

/**
 * The newest deck check, with its claims. null when nothing has been uploaded yet.
 * startupId scopes it to one startup (null: decks with no startup); undefined: any deck.
 */
export async function getLatestDeckCheck(startupId?: string | null): Promise<DeckCheckResult | null> {
  const scope = startupId === undefined ? "" : `&startup=${encodeURIComponent(startupId ?? "none")}`;
  const res = await backendFetch(`/deck-checks/?page_size=1${scope}`);
  if (!res.ok) throw await backendError(res);
  const latest = ((await res.json()) as { results: ApiDeckCheck[] }).results[0];
  return latest ? getDeckCheckById(latest.id) : null;
}

export async function uploadDeck(file: File, companyName: string, startupId?: string): Promise<DeckCheckResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (companyName) form.append("company_name", companyName);
  if (startupId) form.append("startup", startupId);
  const res = await backendFetch("/deck-checks/", { method: "POST", body: form });
  if (!res.ok) throw await backendError(res);
  return toResult(await res.json());
}

export async function retryDeck(id: string): Promise<DeckCheckResult> {
  const res = await backendFetch(`/deck-checks/${encodeURIComponent(id)}/retry/`, { method: "POST" });
  if (!res.ok) throw await backendError(res);
  return toResult(await res.json());
}
