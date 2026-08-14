import HomePageClient from "@/components/HomePageClient";
import { getPublishedDeveloperRuntimeConfig } from "@/lib/developer-config";
import { buildPageMetadata } from "@/lib/metadata";
import { signR2AssetKeys } from "@/lib/server/r2-signed-assets";

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
  const home = runtimeConfig.home;
  const signedHomeCriticalAssets = signR2AssetKeys(Object.values(home));

  return <HomePageClient config={home} initialSignedAssetUrls={signedHomeCriticalAssets} />;
}
