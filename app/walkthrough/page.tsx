import { Suspense } from "react";
import InteriorPanoWalkthrough from "@/components/tour/InteriorPanoWalkthrough";
import { buildPageMetadata } from "@/lib/metadata";
import { getAssetWorkerDomain } from "@/lib/server/r2-signed-assets";

export const metadata = buildPageMetadata({
  title: "Interior Walkthrough",
  description:
    "Browse Trifecta Veranza interiors with a room-by-room panoramic walkthrough, minimap navigation, and furnished or bare-shell viewing modes.",
  keywords: [
    "interior walkthrough",
    "panoramic apartment tour",
    "room by room tour",
    "Trifecta Veranza interiors",
  ],
});

export default function Page() {
  const workerDomain = getAssetWorkerDomain();

  return (
    <main className="h-dvh w-full bg-[#0a0a0a]">
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <Suspense fallback={<div className="h-full w-full bg-[#0a0a0a]" />}>
        <InteriorPanoWalkthrough className="h-full w-full" />
      </Suspense>
    </main>
  );
}
