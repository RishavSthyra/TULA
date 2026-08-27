import HomePageClient from "@/components/HomePageClient";
import { getPublishedDeveloperRuntimeConfig } from "@/lib/developer-config";
import { buildPageMetadata } from "@/lib/metadata";
import { signR2AssetKeys } from "@/lib/server/r2-signed-assets";
import { TOWER_SELECTION_IMAGE_URL } from "@/lib/tower-selection-assets";
import trialData from "@/data/master-plan-3dsmax-trial.json";

const HOME_FORWARD_VIDEO_URL =
  "https://cdn.sthyra.com/TULA/Videos/Home%20Page2.mp4";
const HOME_REVERSE_VIDEO_URL =
  "https://cdn.sthyra.com/TULA/Videos/Reverse%20Home%20Page.mp4";
const HOME_FIRST_FRAME_URL =
  "https://cdn.sthyra.com/TULA/Videos/Home%20Page2_first_frame.avif";

export const metadata = buildPageMetadata({
  title: "TULA",
  description: "TULA",
  keywords: [
    "Trifecta Veranza",
    "luxury apartments",
    "master plan",
    "project overview",
    "real estate walkthrough",
  ],
});

export default async function HomePage() {
  const runtimeConfig = await getPublishedDeveloperRuntimeConfig();
  const home = {
    ...runtimeConfig.home,
    heroVideoKey: HOME_FORWARD_VIDEO_URL,
    heroLoopVideoKey: HOME_REVERSE_VIDEO_URL,
    heroMobileFallbackKey: HOME_FIRST_FRAME_URL,
    heroStageFallbackKey: HOME_FIRST_FRAME_URL,
    heroPosterKey: HOME_FIRST_FRAME_URL,
    masterPlanWarmupVideoKey: trialData.video.assetKey,
  };
  const signedHomeCriticalAssets = signR2AssetKeys(Object.values(home));

  return (
    <>
      <link
        rel="preload"
        as="image"
        href={TOWER_SELECTION_IMAGE_URL}
        fetchPriority="high"
      />
      <HomePageClient
        config={home}
        initialSignedAssetUrls={signedHomeCriticalAssets}
      />
    </>
  );
}
