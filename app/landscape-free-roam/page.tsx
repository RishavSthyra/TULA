import LandscapeFreeRoam from "@/components/LandscapeFreeRoam";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getAssetWorkerDomain,
  signR2AssetKey,
  signR2AssetKeys,
} from "@/lib/server/r2-signed-assets";

const LANDSCAPE_MODEL_CDN_URL = "https://cdn.sthyra.com/sthyra-labs/Landscape2.glb";

export const metadata = buildPageMetadata({
  title: "Landscape Free Roam",
  description:
    "First-person free roam test page for the Landscape2.glb environment.",
  keywords: [
    "landscape free roam",
    "three.js landscape test",
    "glb first person sandbox",
  ],
  robots: {
    index: false,
    follow: false,
  },
});

export default function LandscapeFreeRoamPage() {
  const workerDomain = getAssetWorkerDomain();
  const initialSignedAssetUrls = signR2AssetKeys([LANDSCAPE_MODEL_CDN_URL]);
  const signedModelUrl = signR2AssetKey(LANDSCAPE_MODEL_CDN_URL);

  return (
    <>
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <link
        rel="preload"
        as="fetch"
        href={signedModelUrl}
        crossOrigin="anonymous"
      />
      <LandscapeFreeRoam
        initialSignedAssetUrls={initialSignedAssetUrls}
        modelAssetKey={LANDSCAPE_MODEL_CDN_URL}
      />
    </>
  );
}
