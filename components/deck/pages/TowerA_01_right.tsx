"use client";

import React, { forwardRef } from "react";
import Image, { type StaticImageData } from "next/image";
import { motion } from "framer-motion";

type SpecRow = {
  name: string;
  size: string;
};

type Props = {
  number?: number;
  image3D: StaticImageData;
  specs: SpecRow[];
};

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const imageReveal = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const UnitPlanRightPage = forwardRef<HTMLDivElement, Props>(
  ({ number, image3D, specs }, ref) => {
    return (
      <div
        ref={ref}
        className="custom-scrollbar h-full w-full overflow-y-auto rounded-[2rem] bg-[#f6f1e8] xl:overflow-hidden xl:rounded-r-[2rem] xl:rounded-l-none"
      >
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative flex h-full flex-col"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.7),transparent_28%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(191,161,120,0.08),transparent_35%)]" />
          </div>

          <motion.div
            variants={fadeUp}
            className="relative z-10 border-b border-[#ddd2c6] px-4 py-3.5 sm:px-6 md:px-8 md:py-5 xl:px-6 xl:py-4 [@media(min-width:1280px)_and_(max-width:1899px)]:px-5 [@media(min-width:1280px)_and_(max-width:1899px)]:py-3.5 min-[1700px]:xl:px-8 min-[1700px]:xl:py-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.34em] text-[#8f7f6d] sm:text-[11px] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[9px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.28em]">
                  Furnished 3D View
                </p>
                <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.04em] text-[#1e1a17] sm:mt-2 sm:text-2xl md:text-[30px] xl:text-[1.7rem] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[1.35rem] min-[1700px]:xl:text-[30px]">
                  Layout Dimensions
                </h3>
                <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#6f6458] sm:mt-2 sm:text-sm [@media(min-width:1280px)_and_(max-width:1899px)]:mt-1 [@media(min-width:1280px)_and_(max-width:1899px)]:max-w-[560px] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[11px] [@media(min-width:1280px)_and_(max-width:1899px)]:leading-5">
                  A refined overview of the furnished unit plan with all key
                  space dimensions preserved for quick comparison and
                  presentation.
                </p>
              </div>

              {number ? (
                <div className="shrink-0 rounded-full border border-[#d8c9b8] bg-white/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-[#7d6d5d] backdrop-blur-sm sm:text-[11px] [@media(min-width:1280px)_and_(max-width:1899px)]:px-2.5 [@media(min-width:1280px)_and_(max-width:1899px)]:py-1 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px]">
                  Page {number}
                </div>
              ) : null}
            </div>
          </motion.div>

          <div className="relative z-10 grid min-h-0 grid-cols-1 xl:h-full xl:grid-cols-[0.96fr_1.04fr] [@media(min-width:1280px)_and_(max-width:1899px)]:grid-cols-[1.05fr_0.95fr] min-[1700px]:xl:grid-cols-[1.06fr_0.94fr]">
            <motion.div
              variants={imageReveal}
              className="flex items-center justify-center px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 xl:px-6 xl:py-6 [@media(min-width:1280px)_and_(max-width:1899px)]:px-5 [@media(min-width:1280px)_and_(max-width:1899px)]:py-5 min-[1700px]:xl:px-8 min-[1700px]:xl:py-8"
            >
              <div className="relative h-full w-full max-w-[540px] min-h-[280px] overflow-hidden rounded-[1.5rem] border border-[#ddd2c6] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,238,229,0.94))] shadow-[0_20px_60px_rgba(70,50,30,0.10)] sm:max-w-[640px] sm:min-h-[380px] sm:rounded-[1.75rem] md:min-h-[450px] xl:max-w-[520px] xl:min-h-[320px] [@media(min-width:1280px)_and_(max-width:1899px)]:min-h-[300px] [@media(min-width:1280px)_and_(max-width:1899px)]:rounded-[1.25rem] min-[1700px]:xl:max-w-[720px] min-[1700px]:xl:min-h-[450px]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.85),transparent_65%)]" />

                <div className="relative h-full w-full p-2.5 sm:p-4 md:p-6">
                  <Image
                    src={image3D}
                    alt="3D furnished unit plan"
                    fill
                    priority
                    sizes="(max-width: 640px) 92vw, (max-width: 1280px) 48vw, 42vw"
                    className="object-contain object-center scale-[1.02] sm:scale-[1.08] md:scale-[1.12] drop-shadow-[0_18px_30px_rgba(0,0,0,0.12)]"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex min-h-0 flex-col border-t border-[#ddd2c6] px-4 pb-4 pt-4 sm:px-6 sm:pb-6 md:px-8 md:pb-8 xl:border-l xl:border-t-0 xl:px-6 xl:pb-6 xl:pt-6 [@media(min-width:1280px)_and_(max-width:1899px)]:px-5 [@media(min-width:1280px)_and_(max-width:1899px)]:pb-5 [@media(min-width:1280px)_and_(max-width:1899px)]:pt-5 min-[1700px]:xl:px-8 min-[1700px]:xl:pb-8 min-[1700px]:xl:pt-8"
            >
              <div className="mb-4 flex items-start justify-between gap-4 sm:mb-5 [@media(min-width:1280px)_and_(max-width:1899px)]:mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.34em] text-[#9b7b4a] sm:text-[11px] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[9px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.28em]">
                    Unit Specifications
                  </p>
                  <p className="mt-1.5 text-[12px] text-[#74695e] sm:mt-2 sm:text-[15px] [@media(min-width:1280px)_and_(max-width:1899px)]:mt-1 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[12px]">
                    Detailed room-wise dimensions
                  </p>
                </div>

                <div className="hidden rounded-full border border-[#d8c9b8] bg-white/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-[#8b7355] sm:block [@media(min-width:1280px)_and_(max-width:1899px)]:px-2.5 [@media(min-width:1280px)_and_(max-width:1899px)]:py-1 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.22em]">
                  Premium Layout
                </div>
              </div>

              <div className="flex flex-1 min-h-0 flex-col gap-2.5 overflow-visible pr-0 sm:grid sm:grid-cols-2 sm:gap-3 xl:overflow-y-auto xl:pr-1 [@media(min-width:1280px)_and_(max-width:1899px)]:gap-2">
                {specs.map((item, index) => (
                  <motion.div
                    key={`${item.name}-${item.size}-${index}`}
                    variants={fadeUp}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.22 }}
                    className="group rounded-[1.2rem] border border-[#ddd2c6] bg-white/78 px-3.5 py-3 shadow-[0_10px_24px_rgba(90,70,40,0.04)] transition-colors duration-300 hover:border-[#ccb79f] sm:rounded-[1.35rem] sm:px-4 sm:py-3.5 xl:px-3 xl:py-2.5 [@media(min-width:1280px)_and_(max-width:1899px)]:rounded-[1rem] [@media(min-width:1280px)_and_(max-width:1899px)]:px-3 [@media(min-width:1280px)_and_(max-width:1899px)]:py-2 min-[1700px]:xl:px-4 min-[1700px]:xl:py-3.5"
                  >
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#ad9c8b] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.2em]">
                      Space
                    </p>

                    <div className="mt-2 flex items-end justify-between gap-3 sm:mt-2 sm:flex-col sm:items-start sm:gap-2 [@media(min-width:1280px)_and_(max-width:1899px)]:mt-1.5 [@media(min-width:1280px)_and_(max-width:1899px)]:gap-1.5">
                      <h4 className="min-w-0 flex-1 break-words text-[14px] font-semibold leading-[1.25] tracking-[-0.02em] text-[#221d19] sm:w-full sm:flex-none sm:text-[15px] xl:text-[13px] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[12px] min-[1700px]:xl:text-[15px]">
                        {item.name}
                      </h4>

                      <div className="shrink-0 inline-flex max-w-full items-center rounded-full border border-[#e0d5c8] bg-[#f8f3ec] px-2.5 py-1.5 text-[10px] font-medium leading-none text-[#5f5448] sm:px-3 sm:text-[12px] xl:px-2 xl:text-[10px] [@media(min-width:1280px)_and_(max-width:1899px)]:px-2 [@media(min-width:1280px)_and_(max-width:1899px)]:py-1 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[9px] min-[1700px]:xl:px-3 min-[1700px]:xl:text-[12px]">
                        {item.size}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                variants={fadeUp}
                className="mt-4 hidden items-center justify-between gap-4 border-t border-[#ddd2c6] pt-3.5 text-[10px] uppercase tracking-[0.24em] text-[#8c7d6f] sm:mt-5 sm:flex sm:pt-4 sm:text-[11px] [@media(min-width:1280px)_and_(max-width:1899px)]:mt-3 [@media(min-width:1280px)_and_(max-width:1899px)]:pt-3 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[9px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.2em]"
              >
                <span>Furnished 3D View</span>
                <span>Not to Scale</span>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }
);

UnitPlanRightPage.displayName = "UnitPlanRightPage";

export default UnitPlanRightPage;
