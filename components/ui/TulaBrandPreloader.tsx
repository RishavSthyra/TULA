"use client";

import { motion, useReducedMotion } from "framer-motion";
import PreloaderCornerLogo from "@/components/ui/PreloaderCornerLogo";

const TULA_LOGO_URL =
  "https://cdn.sthyra.com/TULA/Images/Tula%20Logo.avif";
const TULA_LOGO_FILTER_ID = "tula-loader-logo-cream";

type TulaBrandPreloaderProps = {
  progress?: number;
};

export default function TulaBrandPreloader({
  progress = 0,
}: TulaBrandPreloaderProps) {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      data-tula-brand-preloader
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: reduceMotion ? 0.15 : 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="fixed inset-0 z-[9999] overflow-hidden bg-[#293820]"
      role="status"
      aria-label={`Loading exterior panoramas ${clampedProgress}%`}
    >
      <div className="[&_img]:brightness-0 [&_img]:invert [&_img]:opacity-70 [&_img]:sepia">
        <PreloaderCornerLogo />
      </div>
      <div className="absolute inset-[-8%] bg-[radial-gradient(ellipse_62%_46%_at_18%_74%,rgba(111,128,69,0.26)_0%,rgba(78,96,50,0.15)_46%,transparent_74%),radial-gradient(ellipse_54%_40%_at_86%_18%,rgba(94,112,58,0.18)_0%,transparent_70%),radial-gradient(ellipse_74%_58%_at_50%_42%,rgba(77,96,51,0.28)_0%,rgba(37,52,29,0.16)_42%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_68%_54%_at_50%_48%,transparent_0%,rgba(18,29,15,0.14)_58%,rgba(12,21,11,0.38)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,23,11,0.24)_0%,transparent_28%,transparent_72%,rgba(13,22,11,0.30)_100%)]" />

      <div className="relative flex min-h-screen items-center justify-center px-7">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: reduceMotion ? 0.2 : 0.85,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex flex-col items-center"
          style={{ width: "clamp(200px, 34vw, 520px)" }}
        >
          <svg
            className="select-none drop-shadow-[0_18px_42px_rgba(22,31,18,0.34)]"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              maxHeight: "clamp(220px, 42vh, 540px)",
            }}
            viewBox="0 0 1296 1176"
            role="img"
            aria-label="TULA — Whisper of Trees"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter
                id={TULA_LOGO_FILTER_ID}
                x="-5%"
                y="-5%"
                width="110%"
                height="110%"
                colorInterpolationFilters="sRGB"
              >
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0.953
                          0 0 0 0 0.929
                          0 0 0 0 0.867
                          0.2126 0.7152 0.0722 0 0"
                />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="4" intercept="0" />
                </feComponentTransfer>
              </filter>
            </defs>
            <image
              href={TULA_LOGO_URL}
              width="1296"
              height="1176"
              preserveAspectRatio="xMidYMid meet"
              filter={`url(#${TULA_LOGO_FILTER_ID})`}
            />
          </svg>
          <span
            className="text-center font-normal uppercase leading-[1.2] tracking-[0.08em] text-[#f3eddd]/78"
            style={{
              marginTop: "clamp(0.55rem, 1.3vh, 1.25rem)",
              fontSize: "clamp(0.56rem, 0.8vw, 0.98rem)",
            }}
          >
            By Tula Properties
          </span>

          <div
            className="h-px w-full overflow-hidden bg-[#f3eddd]/20"
            style={{ marginTop: "clamp(1rem, 2vh, 1.75rem)" }}
            aria-hidden
          >
            <motion.div
              className="h-full origin-left bg-[#f3eddd] shadow-[0_0_12px_rgba(243,237,221,0.38)]"
              initial={false}
              animate={{ scaleX: clampedProgress / 100 }}
              transition={{
                duration: reduceMotion ? 0.15 : 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
