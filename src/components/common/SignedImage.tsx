"use client";

import Image, { type ImageProps } from "next/image";
import { useSignedAssetUrl } from "@/src/lib/use-signed-assets";

const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export type SignedImageProps = Omit<ImageProps, "src" | "unoptimized"> & {
  placeholderSrc?: string | null;
  src?: string | null;
};

export default function SignedImage({
  alt,
  placeholderSrc = EMPTY_IMAGE_DATA_URL,
  src,
  ...props
}: SignedImageProps) {
  const signedSrc = useSignedAssetUrl(src ?? undefined);
  const resolvedSrc = signedSrc ?? placeholderSrc;

  if (!resolvedSrc) {
    return null;
  }

  return <Image {...props} alt={alt} src={resolvedSrc} unoptimized />;
}
