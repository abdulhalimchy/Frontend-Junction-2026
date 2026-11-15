"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { nameFromEmail, readAccount, saveAccount } from "@/lib/account";
import { OnboardingCard } from "./onboarding-shell";
import { setRoleCookie } from "./role-switch";

type Mode = "sign-in" | "sign-up";

/** The demo persona behind "Continue with Google". */
const GOOGLE_DEMO = { name: "Anna Virtanen", email: "anna@northlight.example" };

/**
 * Sign-in and account creation, mocked: no email is sent, any 6-digit code passes, and the result is only the
 * account cookie (lib/account.ts). Real auth replaces `finish`.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"details" | "code">("details");
  const [code, setCode] = useState("");
  const signUp = mode === "sign-up";

  function finish(who: { name: string; email: string }) {
    if (signUp) {
      // A new account starts without goals; onboarding asks for the role, the company and the goals.
      saveAccount({ name: who.name.trim(), email: who.email.trim() });
      router.push("/onboarding/role");
      return;
    }
    // Returning user: keep what this browser already knows about the account, else make up a name from the email.
    const known = readAccount();
    const same = known?.email.toLowerCase() === who.email.trim().toLowerCase();
    saveAccount(same && known ? known : { name: who.name || nameFromEmail(who.email), email: who.email.trim() });
    // Demo: an email containing "fjord" opens the investor side; otherwise the role last chosen stays.
    if (who.email.includes("fjord")) setRoleCookie("investor");
    // Back to the page the visitor was sent here from (proxy.ts), when it is a path on this site.
    const next = new URLSearchParams(window.location.search).get("next") ?? "";
    router.push(/^\/(?![/\\])/.test(next) ? next : "/home");
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col items-center pt-8">
      <OnboardingCard
        title={step === "code" ? "Check your email" : signUp ? "Create your account" : "Sign in to Warmline"}
        description={
          step === "code"
            ? `We sent a 6-digit code to ${email}.`
            : signUp
              ? "Use your work email. It is how we will match you to your company or fund."
              : "Welcome back. We will email you a code, no password needed."
        }
      >
        {step === "details" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes("@")) setStep("code");
            }}
          >
            {signUp && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required autoComplete="name" placeholder="Anna Virtanen" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="anna@northlight.example"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
              />
            </div>
            <Button type="submit" className="h-10 w-full">
              <Mail /> Email me a code
            </Button>
            <div className="flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <Button type="button" variant="outline" className="h-10 w-full bg-card" onClick={() => finish(GOOGLE_DEMO)}>
              <GoogleIcon /> Continue with Google
            </Button>
            {signUp && (
              <p className="text-center text-xs leading-relaxed text-subtle">
                By creating an account you agree to the{" "}
                <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                  Privacy
                </Link>
                .
              </p>
            )}
            <p className="pt-1 text-center text-[13px] text-muted-foreground">
              {signUp ? "Already have an account? " : "New to Warmline? "}
              <Link href={signUp ? "/sign-in" : "/sign-up"} className="font-medium text-primary hover:underline">
                {signUp ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </form>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) finish({ name, email });
            }}
          >
            <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={() => finish({ name, email })} autoFocus containerClassName="justify-center">
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-11 text-base" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button type="submit" className="h-10 w-full" disabled={code.length !== 6}>
              {signUp ? "Verify and create account" : "Verify and sign in"}
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setCode("");
                  setStep("details");
                }}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3" /> Use a different email
              </button>
              <button type="button" className="text-primary hover:underline" onClick={() => toast("No email is sent in the demo. Any 6 digits work.")}>
                Resend code
              </button>
            </div>
          </form>
        )}
      </OnboardingCard>
      <p className="mt-6 max-w-md text-center text-xs text-subtle">
        Demo: sign-in is mocked. No email is sent and any 6-digit code works.
        {!signUp && " An email containing “fjord” opens the investor side."}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.6l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.3a6.6 6.6 0 0 1 0-4.2V7.3H2.2a11 11 0 0 0 0 9.8l3.6-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.3l3.6 2.8C6.7 7.4 9.1 5.4 12 5.4z" />
    </svg>
  );
}
