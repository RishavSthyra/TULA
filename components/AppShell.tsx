"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import DevtoolsGuard from "@/components/DevtoolsGuard";
import RouteChrome from "@/components/RouteChrome";
import TrifectaRemoteControlBridge from "@/components/TrifectaRemoteControlBridge";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The developer editor is an operational tool, not part of the immersive
  // visitor experience. Keep it completely outside the site shell so it owns
  // its document height and scrolling behavior.
  if (pathname.startsWith("/developer")) {
    return <>{children}</>;
  }

  return (
    <div className="relative app-shell w-full overflow-x-hidden">
      <DevtoolsGuard />
      <TrifectaRemoteControlBridge />
      <RouteChrome />
      <main className="app-shell w-full">{children}</main>
    </div>
  );
}
