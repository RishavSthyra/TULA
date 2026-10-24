"use client";

import { useEffect } from "react";
import BrochureImagePage from "@/components/deck/BrochureImagePage";
import { scheduleBrochureImageWarmup } from "@/lib/brochure-image-preload";
import {
  BROCHURE_LAST_PAGE_SRC,
  BROCHURE_PAGES,
} from "@/lib/brochure-pages";

export default function MobileDeckLanding() {
  useEffect(() => {
    const cleanupWarmup = scheduleBrochureImageWarmup(
      BROCHURE_PAGES.map((page) => page.src),
      {
        criticalCount: 2,
        priorityUrls: [BROCHURE_LAST_PAGE_SRC],
        concurrency: 2,
      },
    );

    return () => {
      cleanupWarmup();
    };
  }, []);

  return (
    <div className="w-full px-3 pb-[max(env(safe-area-inset-bottom),2.5rem)] pt-18 [touch-action:pan-y_pinch-zoom] sm:px-4 sm:pt-20 md:px-6">
      <div className="mx-auto w-full max-w-[960px]">
        <div className="mb-5 px-1 text-center sm:mb-6">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-[#7a6246]">
            Trifecta Veranza brochure
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5d4b37] sm:text-[0.96rem]">
            Every page is shown in its original brochure ratio for a clean,
            uncropped reading flow.
          </p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {BROCHURE_PAGES.map((page, index) => (
            <BrochureImagePage
              key={page.id}
              src={page.src}
              alt={page.alt}
              pageLabel={page.label}
              priority={index < 2}
              mode="stacked"
              imageFit={page.imageFit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
