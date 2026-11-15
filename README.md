# Warmline

Sourced company data for founders and investors, built on Cala's knowledge graph. Every fact shows its sources. Slush 2026 (Helsinki, 18–19 Nov) is the first event space.

Built for Junction 2026, Cala's "Make Unicorns Real" challenge.

## Run it

```bash
npm install
cp .env.example .env.local   # USE_MOCKS=true runs the app without any API
npm run dev
```

Open http://localhost:3000 for the landing page. "Get started" goes to `/sign-up`, then onboarding: pick founder or investor, add your startup or link your fund (the same flows as My startup and Portfolio, saved on the backend), pick goals, and land on Home.

Sign-in and account creation are mocked: no email is sent, any 6-digit code works, and the account is a cookie (`lib/account.ts`) holding the name, email and goals you entered. App and onboarding pages send signed-out visitors to `/sign-in` and back afterwards (`proxy.ts`); the check is only that the cookie exists, and the `/api` routes are open. "Continue with Google" signs in as the demo founder, Anna Virtanen, in one click. Use the "View as" switch in the sidebar (or the Me page) to flip sides. On `/sign-in`, an email containing "fjord" opens the investor side.

## Stack

Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, shadcn/ui (Radix), Recharts. Supabase (auth + cache) and Vercel come in later phases.

## Layout

```
app/page.tsx           landing page
app/(onboarding)/      sign-in, sign-up and onboarding steps (OnboardingShell, no sidebar)
app/(app)/             the app (AppShell: sidebar + top bar with ⌘K)
components/warmline/   shared components: SourceChip, TrustBadge, StatCard, FactGrid,
                       FundingTimeline, DataTable, SlushTag, EmptyState, shells
components/ui/         shadcn/ui primitives
lib/cala/client.ts     typed Cala client: calls the backend's /api/v1/cala/ gateway (the key lives there), cached
lib/cala/market.ts     live market data: knowledge_query for candidates, sourced entities for every number
lib/market.ts          market aggregation (shared by live and mock data)
lib/cala/index.ts      data functions; getMarket is live, the rest still return mocks
lib/mocks/             fictional fixtures
lib/session.ts         current role/profile, alerts (cookie-based until Supabase)
lib/account.ts         the mock account cookie written by sign-in, sign-up and onboarding
lib/format.ts          money, fuzzy dates, per-currency totals
```

## Data rules

- Money always carries its currency; totals are grouped per currency, never converted.
- Grants are kept separate from equity in every total and chart.
- Companies are matched on description; industry codes are only a rough filter.
- "No funding on record" is a normal state.
- Unconfirmed deck claims are "Can't verify", never "false".
- Dates are shown at the precision on record (year, month or day).
- No fact without its source chip.

## Phases

1. Scaffold, design system, all routes on mock data (done)
2. Supabase auth and onboarding with real company matching
3. Cala client, caching, real data for briefs, Market and My startup
4. Deck check (PDF → claims → verification)
5. Alerts, Portfolio, Slush event space, polish, deploy
