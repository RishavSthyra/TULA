import AmenitiesPageClient, {
  type AmenitiesPageData,
} from "@/components/amenities/AmenitiesPageClient";
import amenitiesPageData from "@/data/amenitiesPage.json";
import {
  isDirectAssetUrl,
  resolveAmenitiesFinalAssetUrl,
} from "@/lib/amenities-final-assets";
import { signR2AssetKeys } from "@/lib/server/r2-signed-assets";
import { buildPageMetadata } from "@/lib/metadata";
import { getPublishedDeveloperRuntimeConfig } from "@/lib/developer-config";

export const metadata = buildPageMetadata({
  title: "Amenities",
  description:
    "Explore the landscaped, wellness, recreation, and community amenities at Whispers of Trees.",
  keywords: [
    "Whispers of Trees amenities",
    "TULA Whispers of Trees amenities",
    "residential amenities",
    "project amenities",
  ],
});

export default async function AmenitiesPage() {
  const runtimeConfig = await getPublishedDeveloperRuntimeConfig();
  const runtimePageData = runtimeConfig.amenities.pageData as AmenitiesPageData;
  const canonicalPageData = amenitiesPageData as AmenitiesPageData;
  const typedData: AmenitiesPageData = {
    ...runtimePageData,
    ...canonicalPageData,
    items: canonicalPageData.items.map((item) => ({
      ...item,
      videoSrc: item.videoSrc
        ? resolveAmenitiesFinalAssetUrl(item.videoSrc)
        : item.videoSrc,
      thumbnailSrc: item.thumbnailSrc
        ? resolveAmenitiesFinalAssetUrl(item.thumbnailSrc)
        : item.thumbnailSrc,
    })),
  };
  const assetKeys = typedData.items.flatMap((item) =>
    [item.videoSrc, item.thumbnailSrc].filter(
      (value): value is string => Boolean(value && !isDirectAssetUrl(value)),
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
  const firstPreview = signedData.items[0]?.thumbnailSrc;

  return (
    <>
      <link rel="preconnect" href="https://cdn.sthyra.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://cdn.sthyra.com" />
      {firstPreview ? (
        <link
          rel="preload"
          as="image"
          href={firstPreview}
          type="image/avif"
          fetchPriority="high"
        />
      ) : null}
      <AmenitiesPageClient data={signedData} />
    </>
  );
}
