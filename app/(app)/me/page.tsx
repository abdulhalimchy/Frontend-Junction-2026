import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { PageHeader, Panel } from "@/components/warmline/blocks";
import { DeleteAccount } from "@/components/warmline/delete-account";
import { RoleSwitch } from "@/components/warmline/role-switch";
import { SignOutButton } from "@/components/warmline/sign-out-button";
import { getMe } from "@/lib/backend/account";
import { formatDay } from "@/lib/format";
import { getAccount, getRole } from "@/lib/session";

export const metadata: Metadata = { title: "Account settings" };

export default function MePage() {
  return (
    <>
      <PageHeader title="Account settings" description="Your profile and your account." />
      <Suspense fallback={<Loading />}>
        <MeContent />
      </Suspense>
    </>
  );
}

async function MeContent() {
  const [me, account, role] = await Promise.all([
    getMe().then(
      (me) => ({ me, error: null }),
      (e: unknown) => ({ me: null, error: e instanceof Error ? e.message : "Could not load your profile." }),
    ),
    getAccount(),
    getRole(),
  ]);
  const user = me.me;
  const goals = user?.profile.goals ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Panel title="Profile" description="What Warmline stores about you. Name and email come from your Google account.">
          {me.error && <p className="mb-3 text-sm text-destructive">{me.error}</p>}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <Field label="Name">{user?.full_name || account?.name || "—"}</Field>
            <Field label="Email">{user?.email || account?.email || "—"}</Field>
            <Field label="Signed in with">Google</Field>
            <Field label="Member since">{user ? formatDay(user.date_joined) : "—"}</Field>
            <Field label="Last sign-in">{user?.last_login ? formatDay(user.last_login) : "—"}</Field>
            <Field label="Onboarding">
              {user?.profile.onboarding_completed_at ? `Finished ${formatDay(user.profile.onboarding_completed_at)}` : "Not finished"}
            </Field>
            <div className="sm:col-span-2">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                Goals
                <Link href="/onboarding/goals" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Pencil className="size-3" /> Edit
                </Link>
              </dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {goals.length ? (
                  goals.map((g) => (
                    <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {g}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">None picked yet</span>
                )}
              </dd>
            </div>
          </dl>
        </Panel>


        <Panel
          title="Delete account"
          description="Permanently deletes your account and everything you added to Warmline. It can't be undone. You can sign up again later with the same Google account; you start from scratch."
          className="border-destructive/30"
        >
          <div className="flex justify-end">
            <DeleteAccount />
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="View as" description="Founders and investors see different pages. Switch any time.">
          <RoleSwitch role={(user?.profile.role || role) as typeof role} />
        </Panel>
        <SignOutButton />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
