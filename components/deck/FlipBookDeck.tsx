"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import Image from "next/image";
import LeafOverlay from "@/components/ui/LeafOverlay";
import MobileDeckLanding from "./MobileDeckLanding";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BrochureImagePage from "@/components/deck/BrochureImagePage";
import { scheduleBrochureImageWarmup } from "@/lib/brochure-image-preload";
import {
  BROCHURE_LAST_PAGE_SRC,
  BROCHURE_PAGE_ASPECT_RATIO,
  BROCHURE_PAGES,
  PROJECT_OVERVIEW_BACKGROUND_SRC,
  getBrochurePageWindow,
} from "@/lib/brochure-pages";

type PageFlipInstance = {
  flipNext: (corner?: "top" | "bottom") => void;
  flipPrev: (corner?: "top" | "bottom") => void;
};

type FlipBookRef = {
  pageFlip: () => PageFlipInstance | undefined;
};

type FlipBookState = "user_fold" | "fold_corner" | "flipping" | "read";

export default function FlipBookDeck() {
  const bookRef = useRef<FlipBookRef | null>(null);
  const [viewport, setViewport] = useState({
    width: 1400,
    height: 900,
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [bookState, setBookState] = useState<FlipBookState>("read");

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const pages = useMemo(() => {
    // Legacy custom brochure page components remain in components/deck/pages,
    // but the live deck now renders directly from the brochure image set.
    return BROCHURE_PAGES.map((page, index) => (
      <BrochureImagePage
        key={page.id}
        src={page.src}
        alt={page.alt}
        pageLabel={page.label}
        priority={index < 2}
      />
    ));
  }, []);

  const useStackedDeck = viewport.width < 1280;
  const lastPageIndex = pages.length - 1;

  const goToPreviousPage = () => {
    bookRef.current?.pageFlip()?.flipPrev("bottom");
  };

  const goToNextPage = () => {
    bookRef.current?.pageFlip()?.flipNext("bottom");
  };

  useEffect(() => {
    const cleanupWarmup = scheduleBrochureImageWarmup(
      BROCHURE_PAGES.map((page) => page.src),
      {
        criticalCount: useStackedDeck ? 2 : 4,
        priorityUrls: [BROCHURE_LAST_PAGE_SRC],
        concurrency: useStackedDeck ? 2 : 3,
      },
    );

    return () => {
      cleanupWarmup();
    };
  }, [useStackedDeck]);

  useEffect(() => {
    if (useStackedDeck) {
      return;
    }

    const cleanupWarmup = scheduleBrochureImageWarmup(
      getBrochurePageWindow(currentPage, { behind: 1, ahead: 5 }),
      {
        criticalCount: 6,
        concurrency: 2,
      },
    );

    return () => {
      cleanupWarmup();
    };
  }, [currentPage, useStackedDeck]);

  const desktopTopBarAllowance = 104;
  const desktopBottomPagerAllowance = 116;
  const desktopVerticalFrameAllowance = 40;

  const bookConfig = (() => {
    if (useStackedDeck) {
      return {
        width: 360,
        height: Math.round(360 / BROCHURE_PAGE_ASPECT_RATIO),
        minWidth: 280,
        maxWidth: 420,
        minHeight: 180,
        maxHeight: 780,
      };
    }

    const availableSpreadWidth = Math.max(920, viewport.width - 72);
    const availablePageWidth = Math.max(
      360,
      Math.floor(availableSpreadWidth / 2),
    );
    const availablePageHeight = Math.max(
      420,
      viewport.height -
        desktopTopBarAllowance -
        desktopBottomPagerAllowance -
        desktopVerticalFrameAllowance,
    );

    let pageWidth = availablePageWidth;
    let pageHeight = Math.round(pageWidth / BROCHURE_PAGE_ASPECT_RATIO);

    if (pageHeight > availablePageHeight) {
      pageHeight = availablePageHeight;
      pageWidth = Math.round(pageHeight * BROCHURE_PAGE_ASPECT_RATIO);
    }

    return {
      width: pageWidth,
      height: pageHeight,
      minWidth: pageWidth,
      maxWidth: pageWidth,
      minHeight: pageHeight,
      maxHeight: pageHeight,
    };
  })();

  return (
    <div
      className={`relative min-h-dvh justify-center bg-neutral-100 ${
        useStackedDeck
          ? "h-dvh overflow-y-auto overflow-x-hidden overscroll-contain bg-[linear-gradient(180deg,#d5b785_0%,#c19b64_26%,#f5ede0_62%,#f7f1e7_100%)] px-0 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-16 [-webkit-overflow-scrolling:touch] [touch-action:pan-y_pinch-zoom] sm:pt-18"
          : "flex h-dvh items-center overflow-hidden px-3 pb-6 pt-22 sm:px-4 lg:px-5 xl:px-6"
      }`}
    >
      {!useStackedDeck ? (
        <div className="absolute inset-0">
          <Image
            src={PROJECT_OVERVIEW_BACKGROUND_SRC}
            alt="Overview background"
            fill
            priority
            className="object-cover"
          />
        </div>
      ) : null}
      {!useStackedDeck ? <LeafOverlay /> : null}

      <div
        className={`relative z-10 mx-auto flex w-full max-w-full flex-col items-center ${
          useStackedDeck
            ? "min-h-full justify-start"
            : "h-full justify-center pb-8 pt-4"
        }`}
      >
        {useStackedDeck ? (
          <div className="w-full flex-none [touch-action:pan-y_pinch-zoom]">
            <MobileDeckLanding />
          </div>
        ) : (
          <div className="relative flex w-full flex-col items-center justify-center gap-5 will-change-transform xl:gap-6">
            <div className="flex w-full justify-center">
              <HTMLFlipBook
                ref={bookRef}
                width={bookConfig.width}
                height={bookConfig.height}
                size="fixed"
                minWidth={bookConfig.minWidth}
                maxWidth={bookConfig.maxWidth}
                minHeight={bookConfig.minHeight}
                maxHeight={bookConfig.maxHeight}
                drawShadow
                maxShadowOpacity={0.35}
                showCover
                mobileScrollSupport
                flippingTime={900}
                startPage={0}
                usePortrait={false}
                startZIndex={1}
                autoSize={false}
                clickEventForward
                useMouseEvents
                swipeDistance={30}
                showPageCorners
                disableFlipByClick={false}
                onFlip={(event) => {
                  setCurrentPage(event.data);
                }}
                onChangeState={(event) => {
                  setBookState(event.data as FlipBookState);
                }}
                className="mx-auto max-w-full"
                style={{}}
              >
                {pages}
              </HTMLFlipBook>
            </div>

            <div className="flex items-center justify-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e0d0ac]/75 bg-[linear-gradient(180deg,rgba(251,249,241,0.96),rgba(241,237,226,0.92))] p-1.5 text-[#4f6850] shadow-[0_14px_32px_rgba(30,46,30,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl">
                <button
                  type="button"
                  onClick={goToPreviousPage}
                  disabled={currentPage <= 0 || bookState !== "read"}
                  aria-label="Turn page left"
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-[#e0d0ac]/65 bg-[#fbf7ec]/80 px-4 text-[#4f6850] transition duration-200 hover:border-[#d2be8f] hover:bg-[#f6efde] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2.3} />
                </button>

                <div className="min-w-[5.75rem] px-2 text-center text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#6a775e]">
                  {currentPage + 1} / {pages.length}
                </div>

                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={currentPage >= lastPageIndex || bookState !== "read"}
                  aria-label="Turn page right"
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-[#e0d0ac]/65 bg-[#fbf7ec]/80 px-4 text-[#4f6850] transition duration-200 hover:border-[#d2be8f] hover:bg-[#f6efde] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRight className="h-5 w-5" strokeWidth={2.3} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
