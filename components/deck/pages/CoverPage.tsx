"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import SignedImage from "@/src/components/common/SignedImage";

type Props = {
  number?: number;
};

const titleFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.16,
      delayChildren: 0.14,
    },
  },
};

const textReveal = {
  hidden: {
    opacity: 0,
    x: -32,
    filter: "blur(8px)",
  },
  show: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.82,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const imageReveal = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 1.04,
    filter: "blur(10px)",
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 1.15,
      delay: 0.28,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const shadowReveal = {
  hidden: {
    opacity: 0,
    scale: 0.94,
  },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 1.15,
      delay: 0.4,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const lineReveal = {
  hidden: {
    opacity: 0,
    scaleX: 0,
    transformOrigin: "left center",
  },
  show: {
    opacity: 1,
    scaleX: 1,
    transition: {
      duration: 0.9,
      delay: 0.18,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const titleContainer = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.18,
      staggerChildren: 0.024,
    },
  },
};

const titleLetter = {
  hidden: {
    opacity: 0,
    y: "0.78em",
  },
  show: {
    opacity: 1,
    y: "0em",
    transition: {
      duration: 0.62,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};
const COVER_IMAGE_URL = "images/bros.webp";
const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const CoverPage = forwardRef<HTMLDivElement, Props>(({ number: _number }, ref) => {
  void _number;
  const titleLines = ["The New Standard", "of Refined Urban", "Living"];

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden rounded-[20px] bg-[#f6f1e8] shadow-[0_25px_80px_rgba(0,0,0,0.16)] sm:rounded-[30px]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#faf7f2_0%,#f3ece1_40%,#eadfce_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.88),transparent_28%),radial-gradient(circle_at_84%_12%,rgba(214,190,153,0.18),transparent_24%),radial-gradient(circle_at_50%_82%,rgba(188,156,112,0.12),transparent_30%)]" />
      <div className="absolute inset-[10px] rounded-[16px] border border-white/45 sm:inset-[14px] sm:rounded-[24px]" />

      <div className="absolute -left-20 top-[-120px] h-[280px] w-[280px] rounded-full bg-white/70 blur-3xl" />
      <div className="absolute right-[-50px] top-[-40px] h-[220px] w-[220px] rounded-full bg-[#d7c0a0]/25 blur-3xl" />
      <div className="absolute bottom-[-70px] left-1/2 h-[220px] w-[320px] -translate-x-1/2 rounded-full bg-[#b99663]/12 blur-3xl" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-20 flex h-full flex-col justify-between px-5 pb-5 pt-8 sm:px-10 sm:pb-10 sm:pt-12 xl:px-7 xl:pb-7 xl:pt-9 [@media(min-width:1280px)_and_(max-width:1899px)]:px-6 [@media(min-width:1280px)_and_(max-width:1899px)]:pt-8 min-[1700px]:xl:px-10 min-[1700px]:xl:pb-10 min-[1700px]:xl:pt-12"
      >
        <div className="relative z-30 max-w-[54%] sm:max-w-[50%] lg:max-w-[74%] xl:max-w-[76%] [@media(min-width:1280px)_and_(max-width:1899px)]:max-w-[82%] min-[1700px]:xl:max-w-[72%] 2xl:max-w-[88%]">
          <motion.p
            variants={textReveal}
            className={`mb-3 text-[10px] uppercase tracking-[0.42em] text-[#6f6457] sm:mb-4 sm:text-xs sm:tracking-[0.5em] ${bodyFont.className}`}
          >
           TRIFECTA VERANZA
          </motion.p>

          <motion.h1
            variants={titleContainer}
            initial="hidden"
            animate="show"
            className={`${titleFont.className} max-w-[500px] font-semibold leading-[0.88] pb-3  tracking-[-0.04em] text-[#1f1b16] text-[2rem] sm:max-w-[500px] sm:text-[3.3rem] lg:max-w-full lg:text-[2.4rem] xl:text-[2.52rem] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[2.18rem] min-[1700px]:xl:text-[3.45rem] 2xl:text-[4.2rem]`}
          >
            {titleLines.map((line) => (
              <div key={line} className="flex overflow-hidden whitespace-nowrap">
                {line.split("").map((char, index) => (
                  <motion.span
                    key={`${line}-${index}`}
                    variants={titleLetter}
                    className="inline-block  pb-2.5"
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </div>
            ))}
          </motion.h1>

          <motion.div
            variants={lineReveal}
            className="h-px w-[120px] bg-[linear-gradient(90deg,rgba(170,137,90,0.95),rgba(170,137,90,0.35),transparent)] sm:w-[170px]"
          />

          <motion.p
            variants={textReveal}
            className={`mt-4 max-w-[290px] text-[11px] font-medium leading-[1.7] text-[#6d6256] sm:mt-5 sm:max-w-[360px] sm:text-[13px] lg:max-w-[390px] xl:max-w-[340px] xl:text-[12px] [@media(min-width:1280px)_and_(max-width:1899px)]:mt-3 [@media(min-width:1280px)_and_(max-width:1899px)]:max-w-[320px] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[11px] min-[1700px]:xl:max-w-[390px] min-[1700px]:xl:text-[13px] ${bodyFont.className}`}
          >
            Curated spaces, elevated comfort, timeless metropolitan sophistication.
          </motion.p>
        </div>
      </motion.div>

      <motion.div
        variants={imageReveal}
        initial="hidden"
        animate="show"
        className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center"
      >
        <div className="relative flex h-full w-full items-end justify-center overflow-visible">
          <motion.div
            variants={shadowReveal}
            initial="hidden"
            animate="show"
            className="absolute bottom-[7%] left-1/2 h-[34%] w-[68%] -translate-x-1/2 rounded-[999px] bg-black/14 blur-3xl sm:h-[36%] sm:w-[62%]"
          />

          {/* <div className="absolute bottom-[18%] left-1/2 h-[42%] w-[58%] -translate-x-1/2 rounded-[999px] bg-[radial-gradient(circle,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0.12)_38%,transparent_72%)] blur-2xl" /> */}

          <SignedImage
            src={COVER_IMAGE_URL}
            placeholderSrc={EMPTY_IMAGE_DATA_URL}
            alt="Project cover"
            width={1280}
            height={1600}
            className="relative z-10 h-[75%] w-auto max-w-none object-contain object-bottom xl:h-[66%] [@media(min-width:1280px)_and_(max-width:1899px)]:h-[63%] min-[1700px]:xl:h-[72%] 2xl:h-[75%]"
          />
        </div>
      </motion.div>

      {/* <div className="absolute inset-y-0 left-0 z-[12] w-[52%] bg-[linear-gradient(90deg,rgba(246,241,232,0.99)_0%,rgba(246,241,232,0.92)_38%,rgba(246,241,232,0.55)_68%,transparent_100%)] sm:w-[50%] lg:w-[48%]" />

      <div className="absolute bottom-0 left-0 right-0 z-[13] h-24 bg-gradient-to-t from-[#f6f1e8]/52 to-transparent sm:h-44 sm:from-[#f6f1e8]/30" /> */}
    </div>
  );
});

CoverPage.displayName = "CoverPage";

export default CoverPage;
