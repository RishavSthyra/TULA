export const BROCHURE_PAGE_WIDTH = 2011;
export const BROCHURE_PAGE_HEIGHT = 1299;
export const BROCHURE_PAGE_ASPECT_RATIO =
  BROCHURE_PAGE_WIDTH / BROCHURE_PAGE_HEIGHT;
export const PROJECT_OVERVIEW_BACKGROUND_SRC = "/brochure 2 (1).avif";

export type BrochurePage = {
  id: string;
  src: string;
  alt: string;
  label: string;
  isClosingPage?: boolean;
};

function formatPageNumber(pageNumber: number) {
  return String(pageNumber).padStart(2, "0");
}

function createBrochurePage(src: string, index: number): BrochurePage {
  if (src.endsWith("/Last.jpg")) {
    return {
      id: "closing-page",
      src,
      alt: "Closing brochure page",
      label: "Closing page",
      isClosingPage: true,
    };
  }

  return {
    id: `brochure-page-${index + 1}`,
    src,
    alt: `Brochure page ${index + 1}`,
    label: `Page ${index + 1}`,
  };
}

const brochureImageSources = [
  `/brochure/Tula_Page_${formatPageNumber(1)}_Left.jpg`,
  ...Array.from({ length: 39 }, (_, index) => {
    const pageNumber = index + 2;
    const formattedPageNumber = formatPageNumber(pageNumber);

    return [
      `/brochure/Tula_Page_${formattedPageNumber}_Left.jpg`,
      `/brochure/Tula_Page_${formattedPageNumber}_Right.jpg`,
    ];
  }).flat(),
  "/brochure/Last.jpg",
];

export const BROCHURE_PAGES = brochureImageSources.map(createBrochurePage);

export const BROCHURE_FIRST_PAGE_SRC = BROCHURE_PAGES[0]?.src ?? "";
export const BROCHURE_LAST_PAGE_SRC =
  BROCHURE_PAGES[BROCHURE_PAGES.length - 1]?.src ?? "";
export const BROCHURE_PRIORITY_PAGE_SRCS = BROCHURE_PAGES.slice(0, 2).map(
  (page) => page.src,
);

export function getBrochurePageWindow(
  currentIndex: number,
  {
    behind = 1,
    ahead = 4,
  }: {
    behind?: number;
    ahead?: number;
  } = {},
) {
  const startIndex = Math.max(0, currentIndex - behind);
  const endIndex = Math.min(BROCHURE_PAGES.length, currentIndex + ahead + 1);

  return BROCHURE_PAGES.slice(startIndex, endIndex).map((page) => page.src);
}
