import type { Metadata } from "next";
import { LegalHeader, LegalSection } from "@/components/warmline/legal";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using Warmline, a Junction 2026 project.",
};

// Kept short on purpose: Warmline is a Junction 2026 hackathon project.

export default function TermsPage() {
  return (
    <>
      <LegalHeader title="Terms">
        <p>
          Warmline is a project built at Junction 2026 for <strong className="font-semibold text-foreground">Make Unicorns Real</strong>, a
          challenge by{" "}
          <a href="https://www.cala.ai/" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
            Cala
          </a>
          . By using it you agree to the points below.
        </p>
      </LegalHeader>

      <LegalSection id="terms" title="In short">
        <ul>
          <li>Warmline is provided as it is, while we keep building it. Features may change or stop working.</li>
          <li>
            Its data comes from public sources and can be incomplete or out of date. <strong>It is not investment, legal or
            financial advice</strong>: check the linked sources before you decide anything.
          </li>
          <li>Only upload material you have the right to share, and use Warmline fairly.</li>
        </ul>
      </LegalSection>
    </>
  );
}
