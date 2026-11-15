// Mock account. Until real sign-in exists, "signing in" only writes this cookie: who you said you are and the
// goals you picked. Nothing is checked and the backend still runs as the shared demo account (lib/backend/client.ts).
// Shared by the server (lib/session.ts) and the browser (sign-in, sign-up, onboarding, sign out).

export const ACCOUNT_COOKIE = "wl_account";

export type Account = { name: string; email: string; goals?: string[] };

export function parseAccount(raw: string | undefined): Account | null {
  if (!raw) return null;
  for (const text of [raw, safeDecode(raw)]) {
    try {
      const v = JSON.parse(text) as Partial<Account>;
      if (v && typeof v === "object")
        return {
          name: typeof v.name === "string" ? v.name : "",
          email: typeof v.email === "string" ? v.email : "",
          goals: Array.isArray(v.goals) ? v.goals.filter((g): g is string => typeof g === "string") : undefined,
        };
    } catch {
      /* try the decoded form next */
    }
  }
  return null;
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** "anna.virtanen@northlight.example" → "Anna Virtanen": a stand-in name for sign-in, where we only ask for the email. */
export function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

// -- browser only ---------------------------------------------------------------

export function saveAccount(account: Account) {
  document.cookie = `${ACCOUNT_COOKIE}=${encodeURIComponent(JSON.stringify(account))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function readAccount(): Account | null {
  const prefix = `${ACCOUNT_COOKIE}=`;
  return parseAccount(document.cookie.split("; ").find((c) => c.startsWith(prefix))?.slice(prefix.length));
}

export function clearAccount() {
  document.cookie = `${ACCOUNT_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
