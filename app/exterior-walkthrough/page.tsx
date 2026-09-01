import ExteriorPanoWalkthrough from "@/components/tour/ExteriorPanoWalkthrough";
import { exteriorAmenities as canonicalExteriorAmenities } from "@/data/exteriorAmenities";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getAssetWorkerDomain,
  signR2AssetKey,
} from "@/lib/server/r2-signed-assets";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import { getPublishedDeveloperRuntimeConfig } from "@/lib/developer-config";
import {
  EXTERIOR_INITIAL_PREVIEW_KEY,
  EXTERIOR_PANO_CDN_BASE_PATH,
} from "@/lib/exterior-tour/assets";

function isIgnoredExteriorPano(node: ExteriorPanoNodeSource) {
  return (
    /\.0000(?:\.[^/.]+)?$/i.test(node.id) ||
    /\.0000(?:\.[^/.]+)?$/i.test(node.image_filename)
  );
}

export const metadata = buildPageMetadata({
  title: "Exterior Walkthrough",
  description:
    "Experience the exterior panoramic walkthrough for TULA Whispers of Trees with directional navigation and fast node-to-node transitions.",
  keywords: [
    "exterior walkthrough",
    "panorama tour",
    "site walkthrough",
    "TULA Whispers of Trees exterior",
  ],
});

function ExteriorWalkthroughHead({ initialPreviewKey }: { initialPreviewKey?: string }) {
  const workerDomain = getAssetWorkerDomain();
  const initialPreviewUrl = initialPreviewKey ? signR2AssetKey(initialPreviewKey) : null;

  return (
    <>
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <link
        rel="preload"
        as="image"
        href="https://cdn.sthyra.com/TULA/Images/Whisper_of_Tree_Logo_Gold%201_01.png"
        fetchPriority="high"
      />
      {initialPreviewUrl ? <link
        rel="preload"
        as="image"
        href={initialPreviewUrl}
        fetchPriority="high"
      /> : null}
    </>
  );
}

export default async function ExteriorTourPage() {
  const runtimeConfig = await getPublishedDeveloperRuntimeConfig();
  const exterior = {
    ...runtimeConfig.exterior,
    panoBasePath: EXTERIOR_PANO_CDN_BASE_PATH,
    initialPreviewKey: EXTERIOR_INITIAL_PREVIEW_KEY,
  };
  const exteriorTourNodes = exterior.nodes.filter((node) => !isIgnoredExteriorPano(node));
  const preferredInitialNodeId =
    (exterior.initialNodeId && exteriorTourNodes.find((node) => node.id === exterior.initialNodeId)?.id) ??
    exteriorTourNodes[0]?.id;
  const signedExteriorMenuAssets = Object.fromEntries(
    canonicalExteriorAmenities.map((amenity) => [
      amenity.image,
      signR2AssetKey(amenity.image),
    ]),
  );

  return (
    <main className="relative h-[100svh] min-h-[100svh] w-full overflow-hidden bg-[#040608]">
      <ExteriorWalkthroughHead initialPreviewKey={exterior.initialPreviewKey} />

      <div className="absolute inset-0">
        <ExteriorPanoWalkthrough
          nodes={exteriorTourNodes}
          cdnBaseUrl={exterior.panoBasePath}
          initialNodeId={preferredInitialNodeId}
          initialSignedAssetUrls={signedExteriorMenuAssets}
          amenities={canonicalExteriorAmenities}
          className="h-full w-full rounded-none"
          title={exterior.title}
          subtitle={exterior.subtitle}
        />
      </div>
    </main>
  );
}
