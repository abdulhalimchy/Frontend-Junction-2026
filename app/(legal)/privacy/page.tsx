import type { Metadata } from "next";
import Link from "next/link";
import { LegalHeader, LegalSection } from "@/components/warmline/legal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Warmline, a Junction 2026 project, handles your data.",
};

// Kept short on purpose: Warmline is a Junction 2026 hackathon project. Every line here must stay true of the code.
// Bump LEGAL_UPDATED in lib/legal.ts when it changes.

export default function PrivacyPage() {
  return (
    <>
      <LegalHeader title="Privacy">
        <p>
          Warmline is a project built at Junction 2026 for <strong className="font-semibold text-foreground">Make Unicorns Real</strong>, a
          challenge by{" "}
          <a href="https://www.cala.ai/" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
            Cala
          </a>
          .
        </p>
      </LegalHeader>

      <LegalSection id="data" title="Your data">
        <ul>
          <li>We keep only what you give us: your account details and what you add, such as startups, decks and your watch list.</li>
          <li>We use it only to run Warmline. We don&apos;t sell it or use it for ads, and we use no tracking cookies.</li>
          <li>
            Company data comes from public sources through <Link href="/cala">Cala</Link>. Uploaded decks are read by an AI
            model to check their claims.
          </li>
          <li>
            You can delete your account and everything in it any time under <Link href="/me">Account settings</Link>.
          </li>
        </ul>
      </LegalSection>
    </>
  );
}
