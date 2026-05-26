import type { Metadata } from "next";

export const SITE_NAME = "Trifecta Veranza";
export const DEFAULT_DESCRIPTION =
  "Luxury residences, immersive walkthroughs, master plan exploration, and project details for Trifecta Veranza.";

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
