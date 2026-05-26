import AmenitiesPageClient, {
  type AmenitiesPageData,
} from "@/components/amenities/AmenitiesPageClient";
import amenitiesPageData from "@/data/amenitiesPage.json";
import { signR2AssetKeys } from "@/lib/server/r2-signed-assets";
import { buildPageMetadata } from "@/lib/metadata";

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

export default function AmenitiesPage() {
  const typedData = amenitiesPageData as AmenitiesPageData;
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
