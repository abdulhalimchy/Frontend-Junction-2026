import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ExternalLink,
  FileSearch,
  FileText,
  Landmark,
  LineChart,
  Rocket,
  Route,
  Swords,
  Target,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClaimBadge, SlushTag } from "@/components/warmline/badges";
import { Logo } from "@/components/warmline/logo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Warmline: company data that shows its sources" },
  description:
    "Sourced company data for founders and investors: funding, competitors, investors and warm intros. Every fact links to where it was published.",
};

// The landing page. Static: it reads no cookie, so signed-in visitors see it too and use "Sign in" to get back.
// Everything described here exists in the app; the example record is the fictional founder persona's company.
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Audiences />
        <DataRules />
        <Tools />
        <DeckCheck />
        <Slush />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}

const WRAP = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";

/** Hero grid cells that light up: [column, row, delay in seconds], in 72px cells. */
const HERO_CELLS = [
  [1, 2, 0],
  [4, 5, 2.5],
  [7, 1, 4],
  [10, 4, 1.5],
  [13, 2, 5],
  [16, 6, 3],
  [3, 7, 6],
  [18, 1, 0.8],
] as const;

/* ------------------------------------------------------------------ Nav */

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-background/70 backdrop-blur-xl [border-image:linear-gradient(to_right,transparent,var(--border),transparent)_1]">
      <div className={cn(WRAP, "flex h-16 items-center gap-4 sm:gap-8")}>
        <Logo href="/" />
        <nav className="hidden items-center gap-6 text-[13px] font-medium text-muted-foreground md:flex">
          <a href="#founders" className="transition-colors hover:text-foreground">
            For founders
          </a>
          <a href="#investors" className="transition-colors hover:text-foreground">
            For investors
          </a>
          <a href="#data" className="transition-colors hover:text-foreground">
            How we treat data
          </a>
          <a href="#slush" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
            <span className="size-1.5 rounded-full bg-slush" /> Slush 2026
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" className="h-9 px-3" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button className="h-9 px-3.5" asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ Hero */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* The backdrop: a grid with a few cells that breathe, and a warm glow behind the record. */}
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0">
        {HERO_CELLS.map(([col, row, delay]) => (
          <span key={`${col}-${row}`} className="hero-cell" style={{ left: col * 72, top: row * 72, animationDelay: `${delay}s` }} />
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] size-[520px] rounded-full bg-brand/15 blur-3xl" />
      <div className={cn(WRAP, "relative grid grid-cols-[minmax(0,1fr)] items-center gap-12 pt-14 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:pt-20 lg:pb-28")}>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
          <SlushTag label="Slush 2026 event space is open · Helsinki, 18–19 Nov" />
          <h1 className="mt-5 max-w-[15ch] text-[40px] leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-[56px] lg:text-[64px]">
            Company data that shows its <span className="text-gradient">sources.</span>
          </h1>
          <p className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-muted-foreground">
            Warmline is where founders and investors look each other up before they meet: funding history, competitors,
            investors that fit and who can introduce you. Every fact links to the filing, register or article it came
            from.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2.5">
            <Button variant="cta" className="group h-11 px-5 text-[15px]" asChild>
              <Link href="/sign-up">
                Create your account <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button variant="outline" className="h-11 px-5 text-[15px]" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-[13px] text-subtle">Two minutes to set up: pick your side, add your startup or link your fund.</p>
        </div>
        <RecordCard />
      </div>
    </section>
  );
}

/** A static copy of the app's source chip (components/warmline/source-chip.tsx). */
function Chip({ n, open }: { n: number; open?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border bg-card px-2 text-[11px] font-medium",
        open ? "border-primary/40 text-primary" : "text-muted-foreground",
      )}
    >
      <FileText className="size-3" />
      {n} {n === 1 ? "source" : "sources"}
    </span>
  );
}

/** The product in one picture: a company record where each value carries its sources, one of them opened. */
function RecordCard() {
  const facts = [
    { label: "Founded", value: "May 2023", n: 1 },
    { label: "Headquarters", value: "Helsinki, Finland", n: 1 },
    { label: "Grants", value: "€350K", note: "Business Finland · kept apart from equity", n: 1 },
    { label: "Equity raised", value: "€500K", note: "Pre-seed · Nov 2023", n: 2, open: true },
  ];
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 mx-auto w-full max-w-[480px] delay-150 duration-700 fill-mode-both lg:mr-0">
      <div className="rounded-2xl border bg-card/90 p-5 shadow-lift backdrop-blur sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-sm font-semibold">NR</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-semibold">
              Northlight Robotics <SlushTag label="At Slush" />
            </div>
            <div className="text-xs text-muted-foreground">Maritime robotics · Pre-seed</div>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Builds autonomous crawler robots that inspect ship hulls and offshore structures for corrosion and biofouling.
        </p>
        <dl className="mt-4 divide-y border-t">
          {facts.map((f) => (
            <div key={f.label} className="flex items-center gap-3 py-3">
              <dt className="w-28 shrink-0 text-xs text-muted-foreground">{f.label}</dt>
              <dd className="min-w-0 flex-1">
                <span className="tabular text-sm font-medium">{f.value}</span>
                {f.note && <span className="block truncate text-[11px] text-subtle">{f.note}</span>}
              </dd>
              <Chip n={f.n} open={f.open} />
            </div>
          ))}
        </dl>
      </div>
      {/* The opened chip's popover, hanging off the last row. */}
      <div className="relative z-10 -mt-4 ml-auto w-[min(20rem,calc(100%-1.25rem))] rounded-xl border border-primary/25 bg-popover shadow-lift">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Sources, most authoritative first</div>
        <ul className="divide-y">
          {[
            { name: "Finnish Trade Register", rank: "Filing", url: "Share issue filing", date: "15 Jan 2024" },
            { name: "Northlight Robotics raises pre-seed", rank: "Press", url: "Press release", date: "21 Nov 2023" },
          ].map((s) => (
            <li key={s.name} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm leading-snug font-medium">{s.name}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{s.rank}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-primary">
                <ExternalLink className="size-3 shrink-0" /> {s.url}
              </div>
              <div className="mt-0.5 text-xs text-subtle">{s.date}</div>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-right text-[11px] text-subtle">Example record. Northlight Robotics is fictional.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Founders and investors */

type Feature = { icon: LucideIcon; title: string; text: string };

const FOUNDER: Feature[] = [
  { icon: Building2, title: "Your startup as investors see it", text: "Your public record, filled in from verified records and your website. Check it before they do." },
  { icon: Target, title: "Investors that fit", text: "Who has backed companies like yours, with the ones attending Slush marked." },
  { icon: Swords, title: "Your competitors", text: "Who else is on record in your space and what they have raised, round by round." },
  { icon: FileSearch, title: "A check of your deck", text: "Upload your deck and see which claims the record confirms before an investor looks." },
];

const INVESTOR: Feature[] = [
  { icon: BriefcaseBusiness, title: "Your portfolio from the record", text: "Link your fund and confirm the companies it invested in. Your deal terms stay private." },
  { icon: TrendingUp, title: "What happened since you invested", text: "Funding raised since your entry and the competitors that appeared, per company." },
  { icon: FileSearch, title: "Checks of founder decks", text: "Every factual claim sorted into confirmed, differs from the record, or can't verify." },
  { icon: Bookmark, title: "A watch list that reports back", text: "Follow companies and investors and see what changed on record since you last looked." },
];

function Audiences() {
  return (
    <section className={cn(WRAP, "pb-24")}>
      <div className="reveal grid gap-5 lg:grid-cols-2">
        <AudienceCard
          id="founders"
          icon={Rocket}
          kicker="For founders"
          title="Know how you look on record, and who to talk to."
          features={FOUNDER}
          cta="Start as a founder"
        />
        <AudienceCard
          id="investors"
          icon={Landmark}
          kicker="For investors"
          title="Keep your portfolio and your pipeline honest."
          features={INVESTOR}
          cta="Start as an investor"
          dark
        />
      </div>
    </section>
  );
}

function AudienceCard({
  id,
  icon: Icon,
  kicker,
  title,
  features,
  cta,
  dark,
}: {
  id: string;
  icon: LucideIcon;
  kicker: string;
  title: string;
  features: Feature[];
  cta: string;
  dark?: boolean;
}) {
  return (
    <article id={id} className={cn("hover-lift flex scroll-mt-24 flex-col rounded-2xl border p-6 shadow-panel sm:p-8", dark ? "border-primary/25 bg-linear-to-b from-brand-soft to-card" : "bg-card")}>
      <div className={cn("flex items-center gap-2 text-[13px] font-medium", dark ? "text-brand-2" : "text-primary")}>
        <Icon className="size-4" /> {kicker}
      </div>
      <h2 className="mt-3 max-w-[22ch] text-[26px] leading-tight font-semibold tracking-tight text-balance">{title}</h2>
      <ul className="mt-7 grid gap-x-6 gap-y-6 sm:grid-cols-2">
        {features.map((f) => (
          <li key={f.title}>
            <f.icon className={cn("size-4", dark ? "text-brand-2/80" : "text-primary/80")} />
            <div className="mt-2 text-sm font-semibold">{f.title}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{f.text}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex-1" />
      <Link
        href="/sign-up"
        className={cn(
          "group inline-flex items-center gap-1.5 self-start text-sm font-medium underline-offset-4 hover:underline",
          dark ? "text-brand-2" : "text-primary",
        )}
      >
        {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}

/* ------------------------------------------------------------------ Data rules */

function DataRules() {
  const rules: { title: string; text: string; example: React.ReactNode }[] = [
    {
      title: "No fact without its source",
      text: "Every value carries a chip that opens the documents behind it, most authoritative first.",
      example: <Chip n={3} />,
    },
    {
      title: "Money keeps its currency",
      text: "Totals are grouped per currency. We never convert them into one neat number.",
      example: <span className="tabular text-sm font-medium">€4.2M · $1.1M · SEK 12M</span>,
    },
    {
      title: "Grants are not equity",
      text: "They are counted and charted apart, so a grant never inflates a round.",
      example: (
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-chart-1" /> Equity
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-chart-4" /> Grants
          </span>
        </span>
      ),
    },
    {
      title: "Can't verify is not false",
      text: "A claim the record can't confirm is marked exactly that. We don't call it wrong.",
      example: <ClaimBadge status="cant_verify" />,
    },
    {
      title: "Dates as precise as the record",
      text: "A year, a month or a day: whatever the source states, and nothing made up beyond it.",
      example: <span className="tabular text-sm font-medium">2021 · May 2023 · 12 Mar 2024</span>,
    },
    {
      title: "Nothing on record is an answer",
      text: "“No funding on record” is a normal state, and we say it instead of guessing.",
      example: <span className="inline-flex h-5 items-center rounded-full border border-dashed px-2 text-[11px] text-subtle">No funding on record</span>,
    },
  ];
  return (
    <section id="data" className="scroll-mt-16 border-y bg-card/50 backdrop-blur-sm">
      <div className={cn(WRAP, "py-20 lg:py-24")}>
        <div className="reveal max-w-2xl">
          <h2 className="text-[32px] leading-tight font-semibold tracking-tight text-balance sm:text-[38px]">
            Six rules we hold the <span className="text-gradient">data</span> to.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            The data comes from Cala&apos;s knowledge graph of company filings, registers and press. These rules decide
            how it reaches your screen.
          </p>
        </div>
        <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((r) => (
            <li key={r.title} className="reveal group border-t pt-5 transition-colors hover:border-primary/50">
              <div className="flex h-6 items-center">{r.example}</div>
              <h3 className="mt-4 text-[15px] font-semibold">{r.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Tools for both sides */

function Tools() {
  const tools: Feature[] = [
    {
      icon: LineChart,
      title: "Market analysis",
      text: "Describe a market in your own words, such as “underwater drones in Europe”. You get its size, players, funding and deals, with every number linked to where it was published.",
    },
    {
      icon: Building2,
      title: "Company analysis",
      text: "Look up any company by name: its verified profile, funding history, people and the market of its competitors.",
    },
    {
      icon: Route,
      title: "Warm intros",
      text: "Name who you want to meet. We trace who can introduce you through investment records: your investors, your portfolio, your co-investors.",
    },
  ];
  return (
    <section className={cn(WRAP, "py-20 lg:py-24")}>
      <h2 className="reveal max-w-xl text-[32px] leading-tight font-semibold tracking-tight text-balance sm:text-[38px]">Whichever side you are on.</h2>
      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {tools.map((t) => (
          <li key={t.title} className="reveal hover-lift group rounded-2xl border bg-card p-6 shadow-panel">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-accent-foreground ring-1 ring-primary/20 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <t.icon className="size-4" />
            </span>
            <h3 className="mt-5 text-base font-semibold">{t.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ Deck check */

function DeckCheck() {
  const claims = [
    { claim: "Founded in 2023 in Helsinki", status: "confirmed" as const, note: "Finnish Trade Register", n: 1 },
    { claim: "Raised a €1.2M pre-seed round", status: "differs" as const, note: "The record shows €500K", n: 2 },
    { claim: "Revenue is growing 40% month on month", status: "cant_verify" as const, note: "No public source covers this", n: 0 },
  ];
  return (
    <section className={cn(WRAP, "pb-24")}>
      <div className="reveal grid items-center gap-10 rounded-2xl border bg-card p-6 shadow-panel sm:p-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium text-primary">
            <FileSearch className="size-4" /> Deck check
          </div>
          <h2 className="mt-3 text-[28px] leading-tight font-semibold tracking-tight text-balance">A pitch deck, read against the record.</h2>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
            Upload a PDF. Warmline pulls out each factual claim and checks it against verified sources. Founders see what
            an investor will find. Investors see it before the meeting.
          </p>
        </div>
        <ul className="divide-y rounded-xl border bg-background/60">
          {claims.map((c) => (
            <li key={c.claim} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
              <div className="min-w-0 flex-1 basis-56">
                <div className="text-sm font-medium">&ldquo;{c.claim}&rdquo;</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{c.note}</div>
              </div>
              <ClaimBadge status={c.status} />
              {c.n > 0 && <Chip n={c.n} />}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Slush */

function Slush() {
  const points = [
    { title: "Who is attending", text: "Companies and investors from the event's own attendee records, refreshed daily." },
    { title: "Who is new", text: "The attendees added this week, so you can catch them before their calendar fills." },
    { title: "Side events", text: "The evenings around Slush in one list. Mark the ones you are going to." },
  ];
  return (
    <section id="slush" className="relative scroll-mt-16 overflow-hidden border-y border-slush/25 bg-slush-soft/50">
      <div aria-hidden className="pointer-events-none absolute -top-32 left-[-5%] size-96 rounded-full bg-slush/15 blur-3xl" />
      <div className={cn(WRAP, "reveal relative grid gap-10 py-16 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:py-20")}>
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium text-slush-foreground">
            <CalendarDays className="size-4" /> Helsinki · 18–19 November
          </div>
          <h2 className="mt-3 text-[32px] leading-tight font-semibold tracking-tight text-slush-foreground text-balance sm:text-[38px]">
            Slush 2026 is the first event space.
          </h2>
          <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-slush-foreground/80">
            Plan who to meet before you land. Attendees carry a Slush tag everywhere in Warmline, from investor matches to
            your competitors.
          </p>
          <Button className="mt-7 h-10 px-4" asChild>
            <Link href="/sign-up">
              Open the event space <ArrowRight />
            </Link>
          </Button>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {points.map((p) => (
            <li key={p.title} className="rounded-xl border border-slush/25 bg-card/80 p-5 backdrop-blur-sm transition-colors hover:border-slush/60">
              <h3 className="text-sm font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Closing and footer */

function Closing() {
  return (
    <section className={cn(WRAP, "reveal relative py-24 text-center")}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-56 max-w-xl -translate-y-1/2 rounded-full bg-brand/15 blur-3xl" />
      <h2 className="relative mx-auto max-w-[18ch] text-[36px] leading-[1.1] font-bold tracking-[-0.03em] text-balance sm:text-[48px]">
        Look them up <span className="text-gradient">before</span> you meet them.
      </h2>
      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2.5">
        <Button variant="cta" className="h-11 px-5 text-[15px]" asChild>
          <Link href="/sign-up">
            Create your account <ArrowRight />
          </Link>
        </Button>
        <Button variant="ghost" className="h-11 px-5 text-[15px]" asChild>
          <Link href="/sign-in">I already have one</Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className={cn(WRAP, "flex flex-wrap items-center justify-between gap-4 py-6 text-[13px] text-muted-foreground")}>
        <Logo href="/" />
        <span>Built for Junction 2026 on Cala&apos;s knowledge graph.</span>
      </div>
    </footer>
  );
}
