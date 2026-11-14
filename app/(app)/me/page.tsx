import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/warmline/blocks";
import { PrivacySettings } from "@/components/warmline/privacy-settings";
import { RoleSwitch } from "@/components/warmline/role-switch";
import { getProfile } from "@/lib/session";

export const metadata: Metadata = { title: "Me" };

export default async function MePage() {
  const profile = await getProfile();

  return (
    <>
      <PageHeader title="Me" description="Your account, your role and what others can see." />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Panel title="Privacy" description="You control what other Warmline users see. Public records about your company are public either way.">
            <PrivacySettings initial={profile.privacy} />
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
          <Button variant="outline" className="w-full bg-card" asChild>
            <Link href="/sign-in">Sign out</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
