"use client";

import { ArrowLeft, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { OnboardingCard } from "@/components/warmline/onboarding-shell";
import { setRoleCookie } from "@/components/warmline/role-switch";

// Phase 1: no real auth. Phase 2 wires this to Supabase email OTP and Google.
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");

  function finish(addr: string) {
    // Demo: the email domain decides which side of the app you see.
    setRoleCookie(addr.includes("fjord") ? "investor" : "founder");
    router.push("/onboarding/company");
  }

  return (
    <div className="flex w-full flex-col items-center pt-8">
      <OnboardingCard
        title={step === "email" ? "Sign in to Warmline" : "Check your email"}
        description={
          step === "email"
            ? "Sourced company data for founders and investors. Use your work email so we can match your company."
            : `We sent a 6-digit code to ${email}.`
        }
      >
        {step === "email" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes("@")) setStep("code");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" required placeholder="anna@northlight.example" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
            </div>
            <Button type="submit" className="h-10 w-full">
              <Mail /> Email me a code
            </Button>
            <div className="flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <Button type="button" variant="outline" className="h-10 w-full bg-card" onClick={() => finish("anna@northlight.example")}>
              <GoogleIcon /> Continue with Google
            </Button>
          </form>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) finish(email);
            }}
          >
            <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={() => finish(email)} autoFocus containerClassName="justify-center">
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-11 text-base" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button type="submit" className="h-10 w-full" disabled={code.length !== 6}>
              Verify and continue
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => setStep("email")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3" /> Use a different email
              </button>
              <button type="button" className="text-primary hover:underline">
                Resend code
              </button>
            </div>
          </form>
        )}
      </OnboardingCard>
      <p className="mt-6 max-w-md text-center text-xs text-subtle">
        Demo tip: an email containing “fjord” signs you in as an investor (Jonas Berg, Fjord Ventures). Anything else signs you in as Anna Virtanen.
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
