import { buildPageMetadata } from "@/lib/metadata";
import MasterPlanLayout from "@/components/MasterPlanLayout";
import { getInventoryApartments } from "@/lib/inventory";
import type { InventoryApartment } from "@/types/inventory";
import { unstable_cache } from "next/cache";
import {
  getAssetWorkerDomain,
  signR2AssetKeys,
} from "@/lib/server/r2-signed-assets";
import {
  MASTER_PLAN_SCRUB_HQ_VIDEO_PATH,
  MASTER_PLAN_SCRUB_INTERACTION_VIDEO_PATH,
} from "@/data/masterPlanFrameCdnUrls";

const MASTER_PLAN_CRITICAL_ASSET_KEYS = [
  "images/first_frame_again.png",
  MASTER_PLAN_SCRUB_HQ_VIDEO_PATH,
  MASTER_PLAN_SCRUB_INTERACTION_VIDEO_PATH,
  "videos/Unit  View.mp4",
  "videos/Unit View 3S Reversed New_Compressed.mp4",
  "videos/Unit  View4sec.mp4",
  "videos/Unit_View4sec_reversed_SMALL.mp4",
] as const;

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
  const signedMasterPlanCriticalAssets = signR2AssetKeys([
    ...MASTER_PLAN_CRITICAL_ASSET_KEYS,
  ]);

  return (
    <div className="relative app-shell bg-black">
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <div className="">
        <MasterPlanLayout
          initialApartments={initialApartments}
          initialSignedAssetUrls={signedMasterPlanCriticalAssets}
        />
      </div>
    </div>
  );
}
