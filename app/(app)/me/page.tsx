import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/warmline/blocks";
import { DeleteAccount } from "@/components/warmline/delete-account";
import { RoleSwitch } from "@/components/warmline/role-switch";
import { SignOutButton } from "@/components/warmline/sign-out-button";
import { getProfile } from "@/lib/session";

export const metadata: Metadata = { title: "Account settings" };

export default async function MePage() {
  const profile = await getProfile();

  return (
    <>
      <PageHeader title="Account settings" description="Your account and your role." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Panel
            title="Delete account"
            description="Permanently deletes your account and everything you added to Warmline. It can't be undone."
            className="border-destructive/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">
                See what we keep on the{" "}
                <Link href="/privacy" className="font-medium text-primary hover:underline">
                  privacy page
                </Link>
                .
              </p>
              <DeleteAccount />
            </div>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Account">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="font-medium">{profile.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="font-medium">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Goals</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {profile.goals.map((g) => (
                    <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {g}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Role" description="Switch to see the app as a founder or an investor (demo).">
            <RoleSwitch role={profile.role} />
          </Panel>
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
