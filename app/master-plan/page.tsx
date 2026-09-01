import { buildPageMetadata } from "@/lib/metadata";
import MasterPlanLayout from "@/components/MasterPlanLayout";
import { getInventoryApartments } from "@/lib/inventory";
import type { InventoryApartment } from "@/types/inventory";
import { unstable_cache } from "next/cache";
import {
  getAssetWorkerDomain,
  signR2AssetKeys,
} from "@/lib/server/r2-signed-assets";
import { filterSignableAssetKeys } from "@/lib/master-plan-asset-keys";
import { getThreeDsMaxMasterPlanConfig } from "@/lib/master-plan-3dsmax-trial";
import { TOWER_SELECTION_IMAGE_URL } from "@/lib/tower-selection-assets";

export const metadata = buildPageMetadata({
  title: "Master Plan",
  description:
    "Explore the TULA Whispers of Trees master plan with interactive hotspot navigation, apartment discovery, and tower-level filtering.",
  keywords: [
    "TULA Whispers of Trees master plan",
    "interactive master plan",
    "apartment explorer",
    "tower layout",
  ],
});

export const revalidate = 30;

const getCachedInventoryApartments = unstable_cache(
  getInventoryApartments,
  ["master-plan-inventory"],
  {
    revalidate: 30,
    tags: ["inventory"],
  },
);

export default async function MasterPlanPage() {
  let initialApartments: InventoryApartment[] = [];

  try {
    initialApartments = await getCachedInventoryApartments();
  } catch {
    console.error("Failed to load master plan inventory.");
  }

  const workerDomain = getAssetWorkerDomain();
  const masterPlan = getThreeDsMaxMasterPlanConfig();
  const criticalAssetKeys = filterSignableAssetKeys([
    masterPlan.fallbackImageKey,
    masterPlan.scrubVideoKey,
    masterPlan.interactionVideoKey,
    ...Object.values(masterPlan.unitViewVideos).flatMap((video) => [
      video.forwardKey,
      video.reverseKey,
    ]),
  ]);
  const signedMasterPlanCriticalAssets =
    criticalAssetKeys.length > 0 ? signR2AssetKeys(criticalAssetKeys) : {};
  const masterPlanFallbackUrl =
    signedMasterPlanCriticalAssets[masterPlan.fallbackImageKey] ??
    masterPlan.fallbackImageKey;
  const masterPlanVideoUrl =
    signedMasterPlanCriticalAssets[masterPlan.scrubVideoKey] ??
    masterPlan.scrubVideoKey;

  return (
    <div className="relative app-shell bg-black">
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <link
        rel="preload"
        as="image"
        href={masterPlanFallbackUrl}
        fetchPriority="high"
      />
      <link rel="preload" as="video" href={masterPlanVideoUrl} />
      <link
        rel="preload"
        as="image"
        href={TOWER_SELECTION_IMAGE_URL}
        fetchPriority="high"
      />
      <div className="">
        <MasterPlanLayout
          initialApartments={initialApartments}
          initialSignedAssetUrls={signedMasterPlanCriticalAssets}
          masterPlanConfig={masterPlan}
        />
      </div>
    </div>
  );
}
