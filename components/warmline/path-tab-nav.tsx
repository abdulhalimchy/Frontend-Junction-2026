"use client";

import { usePathname } from "next/navigation";
import { TabNav } from "./blocks";

/**
 * TabNav that marks the active tab from the URL. For loading skeletons, which render before the page knows its
 * tab: the tab bar then looks the same while the content loads, instead of disappearing behind a skeleton.
 */
export function PathTabNav({ tabs }: { tabs: { href: string; label: string; key: string }[] }) {
  const pathname = usePathname();
  const active = tabs.find((t) => pathname === t.href.split("?")[0])?.key ?? "";
  return <TabNav tabs={tabs} active={active} />;
}
