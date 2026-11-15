import type { Metadata } from "next";
import Link from "next/link";
import { LegalHeader, LegalSection } from "@/components/warmline/legal";
import { PRIVACY_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Warmline, a Junction 2026 project, handles your data.",
};

// Written to cover what GDPR art. 13 asks for, in plain words. Every line here must stay true of the code.
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
          . The Warmline team decides how your data is used, and this page explains how.
        </p>
      </LegalHeader>

      <LegalSection id="collect" title="What we keep">
        <ul>
          <li>
            <strong>From Google, when you sign in:</strong> your name and your verified email address. We never see your Google password.
          </li>
          <li>
            <strong>What you give us:</strong> whether you are a founder or an investor, your goals, and what you add: startups, portfolio
            companies, pitch decks (the PDF and its checks), market and company analyses, your watch list and alerts.
          </li>
          <li>
            <strong>To keep you signed in:</strong> sign-in tokens and the time of your last sign-in. The server&apos;s logs record requests
            (such as IP address and time) to keep the service secure and fix errors.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="why" title="Why, and on what basis">
        <ul>
          <li>We use your data only to run Warmline for you: this is needed to provide the service you signed up for (GDPR art. 6(1)(b)).</li>
          <li>Logs and sign-in tokens keep the service secure, which is our legitimate interest (art. 6(1)(f)).</li>
          <li>We don&apos;t sell your data, use it for ads, or profile you. No decision with legal or similar effect is made by a machine.</li>
        </ul>
      </LegalSection>

      <LegalSection id="who" title="Who else handles it">
        <ul>
          <li>
            <strong>Google</strong> runs the sign-in. Its script on the sign-in page can set Google&apos;s own cookies, under{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
              Google&apos;s privacy policy
            </a>
            .
          </li>
          <li>
            <strong>An AI model</strong> (Google Gemini, or Anthropic Claude) reads uploaded decks to check their claims, and writes summaries of
            market analyses. It gets the deck or the analysis, not your account details.
          </li>
          <li>
            <strong>
              <Link href="/cala">Cala</Link>
            </strong>{" "}
            answers lookups about companies, investors and markets. It gets the names you search for, not your account details.
          </li>
          <li>
            Some of these providers process data outside the EU. They do so under GDPR safeguards such as the EU–US Data Privacy Framework or
            standard contractual clauses.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>
          Warmline sets only the cookies it needs to work: your sign-in (wl_access, wl_refresh, wl_account), the founder or investor view
          (wl_role), the startup you last opened (wl_startup) and your details for intro requests (wl_intro_from). There are no analytics or
          tracking cookies, so there is nothing to consent to.
        </p>
      </LegalSection>

      <LegalSection id="keep" title="How long">
        <ul>
          <li>We keep your data while you have an account.</li>
          <li>
            When you delete your account, everything above is deleted right away, uploaded PDFs included, and every session is signed out. You
            can sign up again later with the same Google account, starting from scratch.
          </li>
          <li>Sign-in tokens expire after 7 days.</li>
        </ul>
      </LegalSection>

      <LegalSection id="rights" title="Your rights">
        <ul>
          <li>
            <strong>See your data:</strong> your profile is under <Link href="/me">Account settings</Link>. Ask us for a full copy of
            everything we keep about you, as a file you can take elsewhere
            {PRIVACY_CONTACT ? (
              <>
                {" "}
                (<a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>)
              </>
            ) : null}
            .
          </li>
          <li>
            <strong>Correct it:</strong> change your role and goals in Account settings. Your name and email come from Google; change them there
            and sign in again.
          </li>
          <li>
            <strong>Delete it:</strong> delete your account and everything in it any time under <Link href="/me">Account settings</Link>.
          </li>
          <li>
            <strong>Object or restrict</strong> how we use your data, or ask anything about it
            {PRIVACY_CONTACT ? (
              <>
                {" "}
                by writing to <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>
              </>
            ) : null}
            .
          </li>
          <li>
            <strong>Complain</strong> to a data protection authority. In Finland that is the{" "}
            <a href="https://tietosuoja.fi/en" target="_blank" rel="noreferrer">
              Data Protection Ombudsman
            </a>
            .
          </li>
        </ul>
        <p>Warmline is for founders and investors, and is not meant for anyone under 16.</p>
      </LegalSection>
    </>
  );
}
