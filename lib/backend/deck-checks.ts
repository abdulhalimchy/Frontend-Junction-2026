import "server-only";
import type { DeckCheckResult, DeckClaim } from "@/lib/types";
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
  claims?: ApiClaim[];
};

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

export async function getDeckCheckById(id: string): Promise<DeckCheckResult> {
  const res = await backendFetch(`/deck-checks/${encodeURIComponent(id)}/`);
  if (!res.ok) throw await backendError(res);
  return toResult(await res.json());
}

/** The newest deck check, with its claims. null when nothing has been uploaded yet. */
export async function getLatestDeckCheck(): Promise<DeckCheckResult | null> {
  const res = await backendFetch("/deck-checks/?page_size=1");
  if (!res.ok) throw await backendError(res);
  const latest = ((await res.json()) as { results: ApiDeckCheck[] }).results[0];
  return latest ? getDeckCheckById(latest.id) : null;
}

export async function uploadDeck(file: File, companyName: string): Promise<DeckCheckResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (companyName) form.append("company_name", companyName);
  const res = await backendFetch("/deck-checks/", { method: "POST", body: form });
  if (!res.ok) throw await backendError(res);
  return toResult(await res.json());
}

export async function retryDeck(id: string): Promise<DeckCheckResult> {
  const res = await backendFetch(`/deck-checks/${encodeURIComponent(id)}/retry/`, { method: "POST" });
  if (!res.ok) throw await backendError(res);
  return toResult(await res.json());
}
