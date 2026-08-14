import ExteriorPanoWalkthrough from "@/components/tour/ExteriorPanoWalkthrough";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getAssetWorkerDomain,
  signR2AssetKey,
} from "@/lib/server/r2-signed-assets";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import { getPublishedDeveloperRuntimeConfig } from "@/lib/developer-config";

function isIgnoredExteriorPano(node: ExteriorPanoNodeSource) {
  return (
    /\.0000(?:\.[^/.]+)?$/i.test(node.id) ||
    /\.0000(?:\.[^/.]+)?$/i.test(node.image_filename)
  );
}

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

function ExteriorWalkthroughHead({ initialPreviewKey }: { initialPreviewKey?: string }) {
  const workerDomain = getAssetWorkerDomain();
  const initialPreviewUrl = initialPreviewKey ? signR2AssetKey(initialPreviewKey) : null;

  return (
    <>
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
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
  const exterior = runtimeConfig.exterior;
  const exteriorTourNodes = exterior.nodes.filter((node) => !isIgnoredExteriorPano(node));
  const preferredInitialNodeId =
    (exterior.initialNodeId && exteriorTourNodes.find((node) => node.id === exterior.initialNodeId)?.id) ??
    exteriorTourNodes[0]?.id;
  const signedExteriorMenuAssets = Object.fromEntries(
    runtimeConfig.amenities.exteriorAmenities.map((amenity) => [amenity.image, signR2AssetKey(amenity.image)]),
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
          amenities={runtimeConfig.amenities.exteriorAmenities}
          className="h-full w-full rounded-none"
          title={exterior.title}
          subtitle={exterior.subtitle}
        />
      </div>
    </main>
  );
}
