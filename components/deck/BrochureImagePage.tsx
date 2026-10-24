"use client";

import { forwardRef, useState } from "react";
import Image from "next/image";
import {
  BROCHURE_PAGE_HEIGHT,
  BROCHURE_PAGE_WIDTH,
} from "@/lib/brochure-pages";

type BrochureImagePageProps = {
  src: string;
  alt: string;
  pageLabel: string;
  priority?: boolean;
  mode?: "flipbook" | "stacked";
  imageFit?: "contain" | "cover";
};

const FALLBACK_CLASS_NAME =
  "flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,#f8f3ea_0%,#efe3d1_100%)] px-6 text-center text-[#5b4b37]";

const BrochureImagePage = forwardRef<HTMLDivElement, BrochureImagePageProps>(
  (
    {
      src,
      alt,
      pageLabel,
      priority = false,
      mode = "flipbook",
      imageFit = "contain",
    },
    ref,
  ) => {
    const [hasFailed, setHasFailed] = useState(false);
    const isStacked = mode === "stacked";

    return (
      <div
        ref={ref}
        className={
          isStacked
            ? "w-full overflow-hidden rounded-[28px] border border-white/55 bg-white shadow-[0_20px_60px_rgba(58,36,14,0.16)]"
            : "h-full w-full overflow-hidden bg-white"
        }
        style={
          isStacked
            ? {
                aspectRatio: `${BROCHURE_PAGE_WIDTH} / ${BROCHURE_PAGE_HEIGHT}`,
              }
            : undefined
        }
      >
        {hasFailed ? (
          <div className={FALLBACK_CLASS_NAME}>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-[#90795f]">
                Brochure page unavailable
              </p>
              <p className="mt-3 text-lg font-medium">{pageLabel}</p>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full bg-white">
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              unoptimized
              sizes={
                isStacked
                  ? "(max-width: 1279px) 100vw, 0px"
                  : "(min-width: 1280px) 46vw, 100vw"
              }
              className={`${imageFit === "cover" ? "object-cover" : "object-contain"} object-center`}
              onError={() => setHasFailed(true)}
            />
          </div>
        )}
      </div>
    );
  },
);

BrochureImagePage.displayName = "BrochureImagePage";

export default BrochureImagePage;
