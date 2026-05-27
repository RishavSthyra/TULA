import HomePageClient from "@/components/HomePageClient";
import { buildPageMetadata } from "@/lib/metadata";
import { signR2AssetKeys } from "@/lib/server/r2-signed-assets";

const HOME_CRITICAL_ASSET_KEYS = [
  "videos/Tf Fixed Final_2.mp4",
  "videos/02.mp4",
  "images/01_lastframe.avif",
  "images/first_frame_again.png",
  "videos/01_2.mp4",
  "videos/360_scrub_optimized_g3.mp4",
  "images/hero_first_frame.avif",
  "images/Logo_Trifect_Veranza A_new.png",
] as const;

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

export default function HomePage() {
  const signedHomeCriticalAssets = signR2AssetKeys([
    ...HOME_CRITICAL_ASSET_KEYS,
  ]);

  return <HomePageClient initialSignedAssetUrls={signedHomeCriticalAssets} />;
}
