import exteriorNodes from "@/data/trifecta_pano_walkthrough_data_Exterior1.json";
import ExteriorPanoWalkthrough from "@/components/tour/ExteriorPanoWalkthrough";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getAssetWorkerDomain,
  signR2AssetKeys,
  signR2AssetKey,
} from "@/lib/server/r2-signed-assets";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import {
  EXTERIOR_MINIMAP_IMAGE_URL,
  exteriorAmenities,
} from "@/data/exteriorAmenities";

function isIgnoredExteriorPano(node: ExteriorPanoNodeSource) {
  return (
    /\.0000(?:\.[^/.]+)?$/i.test(node.id) ||
    /\.0000(?:\.[^/.]+)?$/i.test(node.image_filename)
  );
}

const exteriorTourNodes = (exteriorNodes as ExteriorPanoNodeSource[]).filter(
  (node) => !isIgnoredExteriorPano(node),
);

const preferredInitialNodeId =
  exteriorTourNodes.find((node) => node.id === "BP_panoPath_Exterior_GateEntry_F0000")?.id ??
  exteriorTourNodes[0]?.id;
const EXTERIOR_PANO_BASE = "exterior-panos-trifecta";
const INITIAL_PREVIEW_KEY =
  "exterior-panos-trifecta/LS_BP_panoPath_Exterior_GateEntry_F0000/preview.jpg";

export const metadata = buildPageMetadata({
  title: "Exterior Walkthrough",
  description:
    "Experience the exterior panoramic walkthrough for Trifecta Veranza with directional navigation and fast node-to-node transitions.",
  keywords: [
    "exterior walkthrough",
    "panorama tour",
    "site walkthrough",
    "Trifecta Veranza exterior",
  ],
});

function ExteriorWalkthroughHead() {
  const workerDomain = getAssetWorkerDomain();
  const initialPreviewUrl = signR2AssetKey(INITIAL_PREVIEW_KEY);

  return (
    <>
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <link
        rel="preload"
        as="image"
        href={initialPreviewUrl}
        fetchPriority="high"
      />
    </>
  );
}

export default function ExteriorTourPage() {
  const signedExteriorMenuAssets = signR2AssetKeys([
    EXTERIOR_MINIMAP_IMAGE_URL,
    ...exteriorAmenities.map((amenity) => amenity.image),
  ]);

  return (
    <main className="relative h-[100svh] min-h-[100svh] w-full overflow-hidden bg-[#040608]">
      <ExteriorWalkthroughHead />

      <div className="absolute inset-0">
        <ExteriorPanoWalkthrough
          nodes={exteriorTourNodes}
          cdnBaseUrl={EXTERIOR_PANO_BASE}
          initialNodeId={preferredInitialNodeId}
          initialSignedAssetUrls={signedExteriorMenuAssets}
          className="h-full w-full rounded-none"
          title="Trifecta Exterior Walkthrough"
          subtitle="Fast panoramic browsing with directional node navigation tuned for a lighter exterior experience."
        />
      </div>
    </main>
  );
}
