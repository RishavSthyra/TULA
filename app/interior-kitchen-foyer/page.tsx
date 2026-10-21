import { Suspense } from "react";
import InteriorPanoWalkthrough from "@/components/tour/InteriorPanoWalkthrough";
import kitchenFoyerNavData from "@/data/Interior Kitchen and Foyer_Pano_pano_walkthrough_data.json";
import { buildPageMetadata } from "@/lib/metadata";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import type { InteriorDeveloperConfig } from "@/types/developer-config";

const KITCHEN_FOYER_PANO_BASE_PATH =
  "TULA/Panos/interior-kitchen-foyer-v1/";

const KITCHEN_FOYER_BLOCKED_NAVIGATION_PAIRS = [
  ["spline_pano_01_F0006", "spline_pano_05_F0025"],
  ["spline_pano_01_F0007", "spline_pano_05_F0025"],
  ["spline_pano_01_F0008", "spline_pano_01_F0012"],
  ["spline_pano_01_F0008", "spline_pano_05_F0024"],
  ["spline_pano_01_F0009", "spline_pano_01_F0012"],
  ["spline_pano_01_F0010", "spline_pano_04_F0023"],
  ["spline_pano_03_F0017", "spline_pano_04_F0021"],
] as const;

const KITCHEN_FOYER_ADDITIONAL_NAVIGATION_PAIRS = [
  ["spline_pano_01_F0006", "spline_pano_01_F0007"],
  ["spline_pano_03_F0018", "spline_pano_04_F0019"],
] as const;

const KITCHEN_FOYER_EXCLUDED_NODE_IDS = new Set([
  "spline_pano_02_F0015",
]);

const KITCHEN_FOYER_NAVIGATION_YAW_OVERRIDES = [
  ["spline_pano_03_F0018", "spline_pano_04_F0019", 0],
  ["spline_pano_04_F0019", "spline_pano_03_F0018", 180],
] as const;

const kitchenFoyerConfig: InteriorDeveloperConfig = {
  furnishedPanoBasePath: KITCHEN_FOYER_PANO_BASE_PATH,
  bareShellPanoBasePath: KITCHEN_FOYER_PANO_BASE_PATH,
  balconyPanoBasePath: KITCHEN_FOYER_PANO_BASE_PATH,
  furnishedNodes: (kitchenFoyerNavData as ExteriorPanoNodeSource[]).filter(
    ({ id }) => !KITCHEN_FOYER_EXCLUDED_NODE_IDS.has(id),
  ),
  bareShellNodes: [],
  furnishedInitialNodeId: "spline_pano_03_F0018",
};

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
          config={kitchenFoyerConfig}
          initialNodeId="spline_pano_03_F0018"
          additionalNavigationPairs={KITCHEN_FOYER_ADDITIONAL_NAVIGATION_PAIRS}
          blockedNavigationPairs={KITCHEN_FOYER_BLOCKED_NAVIGATION_PAIRS}
          navigationYawOverrides={KITCHEN_FOYER_NAVIGATION_YAW_OVERRIDES}
          panoOnly
          preserveViewDirection
        />
      </Suspense>
    </main>
  );
}
