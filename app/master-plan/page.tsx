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
  filterSignableAssetKeys,
  isLocalAssetKey,
  isRemoteAssetUrl,
  toLocalPublicAssetPath,
} from "@/lib/master-plan-asset-keys";
import { getThreeDsMaxMasterPlanConfig } from "@/lib/master-plan-3dsmax-trial";
import { getOrbitPreviewMasterPlanConfig } from "@/lib/master-plan-orbit-preview";
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

type MasterPlanSearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: MasterPlanSearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function readFiniteSearchNumber(
  searchParams: MasterPlanSearchParams,
  key: string,
) {
  const value = Number(readSearchParam(searchParams, key));
  return Number.isFinite(value) ? value : undefined;
}

function resolveMasterPlanAssetUrl(
  key: string,
  signedUrls: Record<string, string>,
) {
  if (isLocalAssetKey(key)) {
    return toLocalPublicAssetPath(key);
  }

  if (isRemoteAssetUrl(key)) {
    return key;
  }

  return signedUrls[key] ?? key;
}

export default async function MasterPlanPage({
  searchParams,
}: {
  searchParams: Promise<MasterPlanSearchParams>;
}) {
  let initialApartments: InventoryApartment[] = [];

  try {
    initialApartments = await getCachedInventoryApartments();
  } catch {
    console.error("Failed to load master plan inventory.");
  }

  const workerDomain = getAssetWorkerDomain();
  const resolvedSearchParams = await searchParams;
  const allowOrbitDebug = process.env.NODE_ENV === "development";
  let masterPlan = getThreeDsMaxMasterPlanConfig();

  try {
    masterPlan = getOrbitPreviewMasterPlanConfig(
      allowOrbitDebug
        ? {
            debugModel:
              readSearchParam(resolvedSearchParams, "orbitDebug") === "1",
            fov: readFiniteSearchNumber(resolvedSearchParams, "orbitFov"),
            modelOffset: {
              x: readFiniteSearchNumber(resolvedSearchParams, "modelX"),
              y: readFiniteSearchNumber(resolvedSearchParams, "modelY"),
              z: readFiniteSearchNumber(resolvedSearchParams, "modelZ"),
            },
            modelScaleMultiplier: readFiniteSearchNumber(
              resolvedSearchParams,
              "modelScale",
            ),
            modelYawOffsetDegrees: readFiniteSearchNumber(
              resolvedSearchParams,
              "modelYaw",
            ),
          }
        : undefined,
    );
  } catch (error) {
    console.error("Failed to load the master-plan orbit configuration.", error);
  }
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
  const masterPlanFallbackUrl = resolveMasterPlanAssetUrl(
    masterPlan.fallbackImageKey,
    signedMasterPlanCriticalAssets,
  );
  const masterPlanVideoUrl = resolveMasterPlanAssetUrl(
    masterPlan.scrubVideoKey,
    signedMasterPlanCriticalAssets,
  );

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
