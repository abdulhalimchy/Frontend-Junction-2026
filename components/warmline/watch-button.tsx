import { findWatchItem } from "@/lib/backend/watchlist";
import { getRole } from "@/lib/session";
import type { WatchEntityType } from "@/lib/watchlist";
import { WatchToggle } from "./watch-toggle";

/** Server wrapper: looks up whether the entity is already watched, then renders the toggle. */
export async function WatchButton(props: { entityType: WatchEntityType; calaId: string; name: string; size?: "sm" | "default"; className?: string }) {
  const [watched, role] = await Promise.all([
    findWatchItem(props.entityType, props.calaId).then(
      (item) => ({ item, error: undefined }),
      (e: unknown) => ({ item: null, error: e instanceof Error ? e.message : "The watch list is unavailable." }),
    ),
    getRole(),
  ]);
  return <WatchToggle {...props} role={role} initial={watched.item} unavailable={watched.error} />;
}
