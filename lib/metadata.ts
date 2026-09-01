import type { Metadata } from "next";

export const SITE_NAME = "TULA Whispers of Trees";
export const DEFAULT_DESCRIPTION =
  "TULA Whispers of Trees";
export const SITE_ICON_URL =
  "https://cdn.sthyra.com/TULA/Images/Whisper_of_Tree_Logo_Gold%202.avif";

type BuildPageMetadataOptions = {
  title: string;
  description: string;
  keywords?: string[];
  robots?: Metadata["robots"];
};

export function buildPageMetadata({
  title,
  description,
  keywords = [],
  robots,
}: BuildPageMetadataOptions): Metadata {
  return {
    title,
    description,
    keywords,
    ...(robots ? { robots } : {}),
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
