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

export const metadata = buildPageMetadata({
  title: "Master Plan",
  description:
    "Explore the Trifecta Veranza master plan with interactive hotspot navigation, apartment discovery, and tower-level filtering.",
  keywords: [
    "Trifecta Veranza master plan",
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

  return (
    <div className="relative app-shell bg-black">
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
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
