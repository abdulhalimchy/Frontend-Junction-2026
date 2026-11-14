import { assertCalaKey, calaErrorKind, knowledgeSearch } from "@/lib/cala/client";
import { cite } from "@/lib/cala/citations";
import { fetchCompanyProfile } from "@/lib/cala/company";

// "Ask about this company" on the company brief. Browser → Next → Cala knowledge search, so the API key
// stays on the server. The company name comes from its Cala profile (cached), not from the browser.

export const maxDuration = 120; // knowledge search takes 45–60s

export type AskSource = { name: string; url: string };
export type AskAnswer = { question: string; answer: string; sources: AskSource[] };

const MAX_QUESTION = 300;

export async function POST(request: Request) {
  let body: { companyId?: unknown; question?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a question." }, { status: 400 });
  }
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  const question = typeof body.question === "string" ? body.question.trim().slice(0, MAX_QUESTION) : "";
  if (!companyId || !question) return Response.json({ error: "Send a company and a question." }, { status: 400 });

  try {
    assertCalaKey();
    const profile = await fetchCompanyProfile(companyId);
    const place = profile.hq?.value ?? profile.countries[0];
    const subject = place ? `${profile.name} (${place})` : profile.name;
    const res = await knowledgeSearch(`About the company ${subject}: ${question}`);

    // Inline markers "[n](#cite-n)" point at the numbered sources, numbered in the order they are cited.
    const { answer, sources } = cite(res.content, res.context ?? [], profile.name);
    return Response.json({ question, answer, sources } satisfies AskAnswer);
  } catch (e) {
    const kind = calaErrorKind(e);
    const message =
      kind === "missing_key"
        ? "Cala is not configured on this server."
        : kind === "no_credit"
          ? "Cala credit balance is empty. Try again later."
          : kind === "rate_limited"
            ? "Too many questions at once. Try again in a minute."
            : "Could not get an answer from Cala. Try again.";
    return Response.json({ error: message }, { status: kind === "invalid_request" ? 400 : 502 });
  }
}
