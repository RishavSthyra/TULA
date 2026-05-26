import AmenityImageGallery from "@/components/ui/AmenityImageGallery";
import {
  AMENITY_IMAGE_PLACEHOLDER_URL,
  exteriorAmenities,
} from "@/data/exteriorAmenities";
import { signR2AssetKeys } from "@/lib/server/r2-signed-assets";

const galleryAmenities = exteriorAmenities.filter(
  (amenity) => amenity.image !== AMENITY_IMAGE_PLACEHOLDER_URL,
);

export default function page() {
  const signedAmenityImageUrls = signR2AssetKeys(
    galleryAmenities.map((amenity) => amenity.image),
  );

  return (
    <AmenityImageGallery
      amenities={galleryAmenities.map((amenity) => ({
        ...amenity,
        image: signedAmenityImageUrls[amenity.image] ?? amenity.image,
      }))}
    />
  );
}
