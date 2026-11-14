import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/warmline/profile-card";
import { buildCard } from "@/lib/cards";
import { getProfile } from "@/lib/session";

export const metadata = { title: "Your card" };

export default async function CardPage() {
  const card = await buildCard(await getProfile());
  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Your Warmline card is ready</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Show the QR at Slush. Everything on it comes from Cala, with sources anyone can open.
        </p>
      </div>
      <ProfileCard data={card} size="lg" />
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" className="h-10 bg-card" asChild>
          <Link href="/onboarding/you">Edit details</Link>
        </Button>
        <Button className="h-10 px-6" asChild>
          <Link href="/home">Go to Warmline</Link>
        </Button>
      </div>
    </div>
  );
}
