import { Suspense } from "react";
import InteriorPanoWalkthrough from "@/components/tour/InteriorPanoWalkthrough";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Kitchen and Foyer Interior Walkthrough",
  description:
    "Explore the TULA kitchen and foyer through an interactive panoramic walkthrough.",
  keywords: [
    "TULA interior walkthrough",
    "kitchen panorama",
    "foyer panorama",
  ],
});

export default function InteriorKitchenFoyerPage() {
  return (
    <main className="h-dvh w-full bg-[#0a0a0a]">
      <Suspense fallback={<div className="h-full w-full bg-[#0a0a0a]" />}>
        <InteriorPanoWalkthrough
          className="h-full w-full rounded-none border-0"
        />
      </Suspense>
    </main>
  );
}
