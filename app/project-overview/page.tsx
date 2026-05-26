import FlipBookDeck from "@/components/deck/FlipBookDeck";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getAssetWorkerDomain,
  signR2AssetKeys,
} from "@/lib/server/r2-signed-assets";

const PROJECT_OVERVIEW_CRITICAL_ASSET_KEYS = [
  "images/bros.webp",
  "images/bros_1.webp",
  "images/first_frame_overview.jpg",
  "images/credai.png",
  "images/first_frame_again.png",
  "AADHYA SERENE/images/still-life-with-indoor-plants (1).png",
  "AADHYA SERENE/images/hanging-golden-pothos-marble-pot-lush-indoor-greenery (1).png",
] as const;

export const metadata = buildPageMetadata({
  title: "Project Overview",
  description:
    "Review the Trifecta Veranza project overview deck with curated highlights and presentation-ready storytelling.",
  keywords: [
    "project overview",
    "real estate presentation",
    "Trifecta Veranza deck",
    "project highlights",
  ],
});

export default function DeckPage() {
  const workerDomain = getAssetWorkerDomain();
  const signedProjectOverviewAssets = signR2AssetKeys([
    ...PROJECT_OVERVIEW_CRITICAL_ASSET_KEYS,
  ]);

  return (
    <>
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <FlipBookDeck initialSignedAssetUrls={signedProjectOverviewAssets} />
    </>
  );
}
