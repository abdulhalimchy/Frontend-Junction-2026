"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_HOME } from "@/lib/account";
import { OnboardingCard } from "./onboarding-shell";

type Mode = "sign-in" | "sign-up";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// The parts of Google Identity Services (https://accounts.google.com/gsi/client) this page uses.
type GoogleId = {
  initialize(options: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup" }): void;
  renderButton(el: HTMLElement, options: Record<string, string | number>): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/**
 * Sign-in and account creation, both through Google: the first sign-in creates the account. Google's button
 * returns an ID token, which app/api/auth/google checks with the backend and turns into session cookies.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const signUp = mode === "sign-up";
  const button = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCredential = useCallback(async ({ credential }: { credential: string }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Google sign-in failed. Try again.");
      }
      const { onboarded, role } = (await res.json()) as { onboarded: boolean; role: "founder" | "investor" | null };
      // Back to the page the visitor was sent here from (proxy.ts), when it is a path on this site.
      const next = new URLSearchParams(window.location.search).get("next") ?? "";
      const home = role ? ROLE_HOME[role] : "/market";
      // A full load, so the app starts with the new session cookies. New accounts are onboarded first.
      window.location.assign(!onboarded ? "/onboarding/role" : /^\/(?![/\\])/.test(next) ? next : home);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed. Try again.");
      setBusy(false);
    }
  }, []);

  const render = useCallback(() => {
    const gis = window.google?.accounts.id;
    if (!gis || !button.current || !CLIENT_ID) return;
    gis.initialize({ client_id: CLIENT_ID, callback: onCredential, ux_mode: "popup" });
    gis.renderButton(button.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: signUp ? "signup_with" : "continue_with",
      logo_alignment: "center",
      locale: "en", // match the app, not the browser's language
      width: button.current.offsetWidth || 320,
    });
    setReady(true);
  }, [onCredential, signUp]);

  // The script may already be loaded (client-side navigation between sign-in and sign-up).
  useEffect(() => {
    if (window.google?.accounts) render();
  }, [render]);

  return (
    <div className="flex w-full flex-col items-center pt-8">
      {CLIENT_ID && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={render} />}
      <OnboardingCard
        title={signUp ? "Create your account" : "Sign in to Warmline"}
        description={signUp ? "Sign up with your Google account. Use your work account if you have one." : "Welcome back. Continue with your Google account."}
      >
        <div className="space-y-4">
          {!CLIENT_ID ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Google sign-in is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local and restart.
            </p>
          ) : (
            <div className="relative min-h-10">
              <div ref={button} className={busy ? "pointer-events-none opacity-50" : undefined} />
              {(!ready || busy) && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-md border bg-card text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {busy ? "Signing you in…" : "Loading Google sign-in…"}
                </div>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="text-center text-xs leading-relaxed text-subtle">
            By continuing you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
            .
          </p>
          <p className="pt-1 text-center text-[13px] text-muted-foreground">
            {signUp ? "Already have an account? " : "New to Warmline? "}
            <Link href={signUp ? "/sign-in" : "/sign-up"} className="font-medium text-primary hover:underline">
              {signUp ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </OnboardingCard>
    </div>
  );
}
