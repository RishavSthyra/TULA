import FlipBookDeck from "@/components/deck/FlipBookDeck";
import {
  BROCHURE_LAST_PAGE_SRC,
  BROCHURE_PRIORITY_PAGE_SRCS,
} from "@/lib/brochure-pages";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Project Overview",
  description:
    "Review the TULA Whispers of Trees project overview deck with curated highlights and presentation-ready storytelling.",
  keywords: [
    "project overview",
    "real estate presentation",
    "TULA Whispers of Trees deck",
    "project highlights",
  ],
});

export default function DeckPage() {
  return (
    <>
      {BROCHURE_PRIORITY_PAGE_SRCS.map((src) => (
        <link key={src} rel="preload" as="image" href={src} />
      ))}
      <link rel="preload" as="image" href={BROCHURE_LAST_PAGE_SRC} />
      <FlipBookDeck />
    </>
  );
}
