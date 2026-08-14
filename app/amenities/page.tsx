import AmenitiesPageClient, {
  type AmenitiesPageData,
} from "@/components/amenities/AmenitiesPageClient";
import { signR2AssetKeys } from "@/lib/server/r2-signed-assets";
import { buildPageMetadata } from "@/lib/metadata";
import { getPublishedDeveloperRuntimeConfig } from "@/lib/developer-config";

export const metadata = buildPageMetadata({
  title: "Amenities",
  description:
    "Explore the amenity collection at Trifecta Veranza with videos, thumbnails, and details powered by editable page data.",
  keywords: [
    "Trifecta Veranza amenities",
    "rooftop leisure deck",
    "residential amenities",
    "project amenities",
  ],
});

export default async function AmenitiesPage() {
  const runtimeConfig = await getPublishedDeveloperRuntimeConfig();
  const typedData = runtimeConfig.amenities.pageData as AmenitiesPageData;
  const assetKeys = typedData.items.flatMap((item) =>
    [item.videoSrc, item.thumbnailSrc].filter(
      (value): value is string => Boolean(value),
    ),
  );
  const signedAssetUrls = signR2AssetKeys(assetKeys);
  const signedData: AmenitiesPageData = {
    ...typedData,
    items: typedData.items.map((item) => ({
      ...item,
      thumbnailSrc: item.thumbnailSrc
        ? signedAssetUrls[item.thumbnailSrc] ?? item.thumbnailSrc
        : item.thumbnailSrc,
      videoSrc: item.videoSrc
        ? signedAssetUrls[item.videoSrc] ?? item.videoSrc
        : item.videoSrc,
    })),
  };

  return <AmenitiesPageClient data={signedData} />;
}
