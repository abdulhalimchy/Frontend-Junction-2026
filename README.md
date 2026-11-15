# Warmline

Sourced company data for founders and investors, built on Cala's knowledge graph. Every fact links to the
filing, register or article it came from. Slush 2026 (Helsinki, 18–19 Nov) is the first event space.

Built for Junction 2026, Cala's "Make Unicorns Real" challenge. This is the Next.js frontend; the Django API is
in `../Backend-Junction-2026`, and every Cala and LLM call goes through it.

## Run it

The backend must be running first (see its README): `python manage.py runserver` on port 8000.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open http://localhost:3000. Other scripts: `npm run build`, `npm run start`, `npm run lint`.

| Variable | What it is |
|---|---|
| `BACKEND_URL` | The Django API, `http://localhost:8000` in development |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth web client ID. Same value as `GOOGLE_CLIENT_ID` in the backend; add `http://localhost:3000` (and the production URL) to its Authorized JavaScript origins. Public by design |
| `CALA_GATEWAY_KEY` | Shared secret for Cala lookups through the backend. Same value as the backend's; any long random string |
| `USE_MOCKS` | `false` (default): live data. `true`: fixtures from `lib/mocks`, without the backend or Cala credits |

Optional: `CALA_LOG=1` logs every Cala call, `CALA_CACHE_DIR` moves the Cala cache (default `.cache/cala`).
Restart `npm run dev` after changing `NEXT_PUBLIC_*` values.

## How it works

**Sign-in is Google only.** Our button on `/sign-in` and `/sign-up` (themed, with Google's G) has Google's real
button invisibly on top. Google returns an ID token; `app/api/auth/google` sends it to the backend, which verifies
it and creates the account on first sign-in. The backend's JWTs are kept in httpOnly cookies (`lib/auth.ts`), so
the browser's scripts never see them.

**`proxy.ts`** guards every app page and `/api` route: signed-out visitors go to `/sign-in` and come back after
(`?next=`), `/api` answers 401, and the access token is refreshed shortly before it expires. Signed-in visitors
on `/sign-in` go to Market.

**Requests run as the signed-in user.** Pages and the route handlers under `app/api/` call the backend with the
user's token (`lib/backend/client.ts`). Cala lookups go through the backend's Cala gateway with
`CALA_GATEWAY_KEY` (`lib/cala/client.ts`); their results are shared across users and cached in memory and on disk.

**Onboarding.** A new account picks founder or investor, adds its startup or links its fund, and picks goals;
all of it is saved on the backend profile. The founder/investor switch in the sidebar changes the menu and is
saved too.

## Pages

| Page | Path | Who |
|---|---|---|
| Landing | `/` | Everyone |
| Sign in, sign up | `/sign-in`, `/sign-up` | Signed out |
| Onboarding | `/onboarding/role`, `/onboarding/company`, `/onboarding/goals` | New accounts |
| My startup | `/startup/{overview,competitors,investors,connect,deck}` | Founders |
| Portfolio | `/portfolio` | Investors |
| Deck check | `/deck-check` | Investors (founders check their deck under My startup) |
| Market and company analysis | `/market`, `/market/report`, `/market/company`, `/market/history` | Everyone |
| Connect (who can introduce you) | `/intros` | Everyone |
| Watch list | `/watchlist` | Everyone |
| Slush 2026 | `/events/slush-2026/{overview,attendees,investors,side-events}` | Everyone |
| Company and investor pages | `/company/{id}`, `/investor/{id}` (Cala ids) | Everyone |
| Data by Cala | `/cala` | Everyone |
| Account settings | `/me` (profile, role, sign out, delete account) | Everyone |
| Privacy, Terms | `/privacy`, `/terms` | Everyone |

`/home` redirects to Market, and `/alerts` to the watch list.

## Layout

```
app/page.tsx              landing page
app/(onboarding)/         sign-in, sign-up and onboarding steps (OnboardingShell, no sidebar)
app/(app)/                the app (AppShell: role-based sidebar, top bar with ⌘K search)
app/(legal)/              privacy and terms
app/api/                  route handlers: auth (Google sign-in, sign-out), profile, account deletion, and
                          proxies for startups, portfolio, deck checks, search and analyses
components/warmline/      app components: shells, sidebar, auth form, source chips, tables, charts, ...
components/ui/            shadcn/ui primitives
lib/auth.ts               session cookies and token refresh (used by proxy.ts and the auth routes)
lib/account.ts            account and role cookie names, where each side lands (ROLE_HOME)
lib/session.ts            the signed-in account, role and the user's backend data for pages
lib/backend/              typed calls to the Django API, one file per area
lib/cala/                 Cala data: the gateway client and cache, market, company, investor, Slush, intros
lib/market.ts             market aggregation (shared by live and fixture data)
lib/mocks/                fictional fixtures for USE_MOCKS=true
lib/legal.ts              last-updated date and privacy contact for the legal pages
lib/format.ts             money, fuzzy dates, per-currency totals
proxy.ts                  sign-in gate and token refresh
```

## Stack

Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Radix),
Recharts, next-themes (dark by default, with a light/dark toggle).

## Data rules

- Money always carries its currency; totals are grouped per currency, never converted.
- Grants are kept separate from equity in every total and chart.
- Companies are matched on description; industry codes are only a rough filter.
- "No funding on record" is a normal state.
- Unconfirmed deck claims are "Can't verify", never "false".
- Dates are shown at the precision on record (year, month or day).
- No fact without its source chip.
