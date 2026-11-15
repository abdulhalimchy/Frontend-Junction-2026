"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_HOME } from "@/lib/account";
import { cn } from "@/lib/utils";
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

  // Google draws its button at a fixed pixel width (200–400px). Draw it at the slot's width, and again when
  // the slot resizes (rotating a phone, resizing a window), so it always fills the card without sticking out.
  const slot = useRef<HTMLDivElement>(null);
  const drawnWidth = useRef(0);
  const initialized = useRef(false);

  const render = useCallback(() => {
    const gis = window.google?.accounts.id;
    if (!gis || !button.current || !slot.current || !CLIENT_ID) return;
    if (!initialized.current) {
      gis.initialize({ client_id: CLIENT_ID, callback: onCredential, ux_mode: "popup" });
      initialized.current = true;
    }
    const width = Math.round(Math.min(400, Math.max(200, slot.current.clientWidth || 320)));
    drawnWidth.current = width;
    gis.renderButton(button.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: signUp ? "signup_with" : "continue_with",
      logo_alignment: "center",
      locale: "en", // match the app, not the browser's language
      width,
    });
    setReady(true);
  }, [onCredential, signUp]);

  // The script may already be loaded (client-side navigation between sign-in and sign-up).
  useEffect(() => {
    if (window.google?.accounts) render();
  }, [render]);

  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Debounced: a window drag fires many resizes; redraw once it settles.
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const width = Math.min(400, Math.max(200, el.clientWidth));
        if (window.google?.accounts && Math.abs(width - drawnWidth.current) > 2) render();
      }, 120);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [render]);

  return (
    <div className="flex w-full flex-col items-center pt-8">
      {CLIENT_ID && <Script src="https://accounts.google.com/gsi/client?hl=en" strategy="afterInteractive" onReady={render} />}
      <OnboardingCard
        centered
        title={signUp ? "Create your account" : "Sign in to Warmline"}
        description={signUp ? "Sign up with your Google account. Use your work account if you have one." : "Welcome back. Continue with your Google account."}
      >
        <div className="space-y-4">
          {!CLIENT_ID ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Google sign-in is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local and restart.
            </p>
          ) : (
            // What you see is our button, styled for the theme with Google's "G". Google's own button lies on top
            // of it, invisible, and takes the click (and keyboard focus), so sign-in runs entirely through Google.
            <div
              ref={slot}
              className="group relative h-10 overflow-hidden rounded-md focus-within:ring-3 focus-within:ring-ring/50"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2.5 rounded-md border bg-card text-sm font-medium text-foreground shadow-xs transition-colors group-hover:border-foreground/25 group-hover:bg-muted"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-muted-foreground" /> Signing you in…
                  </>
                ) : ready ? (
                  <>
                    <GoogleG /> {signUp ? "Sign up with Google" : "Continue with Google"}
                  </>
                ) : (
                  <>
                    <Loader2 className="size-4 animate-spin text-muted-foreground" /> Loading Google sign-in…
                  </>
                )}
              </div>
              <div
                ref={button}
                className={cn("absolute inset-0 flex justify-center opacity-[0.01]", (busy || !ready) && "pointer-events-none")}
              />
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

/** Google's "G" logo, in its official colors (from Google's sign-in branding guidelines). */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px] shrink-0" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
