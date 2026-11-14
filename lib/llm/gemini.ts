import "server-only";

// Minimal Gemini client (REST, generateContent) for structured JSON output. Server-only: the key never
// reaches the browser. Model is configurable with LLM_MODEL; older Gemini models are closed to new keys.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const LLM_MODEL = process.env.LLM_MODEL || "gemini-4-hydrogen";

export class LlmError extends Error {}

export type TokenUsage = { input: number; output: number; thinking: number; total: number };

/** Gemini tokens used since the server started (shared process-wide, like the Cala counter). */
const g = globalThis as unknown as { __llmUsage?: TokenUsage & { calls: number } };
export const llmUsage = (g.__llmUsage ??= { calls: 0, input: 0, output: 0, thinking: 0, total: 0 });

export function llmConfigured() {
  return Boolean(process.env.LLM_API_KEY);
}

/**
 * Asks Gemini for JSON matching `schema`. Low thinking keeps latency at a few seconds; the work here is
 * extraction and summarising from given facts, not open-ended reasoning.
 */
export async function generateJson<T>(opts: { system: string; prompt: string; schema: object }): Promise<{ data: T; usage: TokenUsage }> {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new LlmError("LLM_API_KEY is not set");

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: opts.schema,
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: "low" },
    },
  });

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/${LLM_MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body,
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await res.body?.cancel();
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    const json = (await res.json().catch(() => null)) as GeminiResponse | null;
    if (!res.ok || !json) throw new LlmError(`Gemini returned ${res.status}: ${json?.error?.message ?? "no body"}`);
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const u = json.usageMetadata ?? {};
    const usage: TokenUsage = {
      input: u.promptTokenCount ?? 0,
      output: u.candidatesTokenCount ?? 0,
      thinking: u.thoughtsTokenCount ?? 0,
      total: u.totalTokenCount ?? 0,
    };
    llmUsage.calls++;
    llmUsage.input += usage.input;
    llmUsage.output += usage.output;
    llmUsage.thinking += usage.thinking;
    llmUsage.total += usage.total;
    if (process.env.CALA_LOG === "1") console.log(`[llm] ${LLM_MODEL} tokens in=${usage.input} out=${usage.output} thinking=${usage.thinking}`);
    try {
      return { data: JSON.parse(text) as T, usage };
    } catch {
      throw new LlmError(`Gemini did not return valid JSON (finish reason: ${json.candidates?.[0]?.finishReason ?? "unknown"})`);
    }
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  error?: { message?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
};
