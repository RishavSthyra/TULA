"use client";

import { motion, useReducedMotion } from "framer-motion";
import PreloaderCornerLogo from "@/components/ui/PreloaderCornerLogo";

const TULA_LOGO_URL =
  "https://cdn.sthyra.com/TULA/Images/Green%20Whisper%20Tula%20Logo.avif";

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
      className="fixed inset-0 z-[9999] overflow-hidden bg-[#f3eddd]"
      role="status"
      aria-label={`Loading exterior panoramas ${clampedProgress}%`}
    >
      <div className="[&_img]:brightness-0 [&_img]:opacity-55">
        <PreloaderCornerLogo />
      </div>
      <div className="absolute inset-[-8%] bg-[radial-gradient(ellipse_62%_46%_at_18%_74%,rgba(151,157,101,0.16)_0%,rgba(191,184,139,0.10)_46%,transparent_74%),radial-gradient(ellipse_54%_40%_at_86%_18%,rgba(132,143,83,0.12)_0%,transparent_70%),radial-gradient(ellipse_74%_58%_at_50%_42%,rgba(255,252,240,0.72)_0%,rgba(244,237,216,0.34)_42%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_68%_54%_at_50%_48%,transparent_0%,rgba(111,118,72,0.04)_58%,rgba(92,98,59,0.10)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,252,241,0.32)_0%,transparent_28%,transparent_72%,rgba(194,184,148,0.12)_100%)]" />

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="select-none drop-shadow-[0_18px_42px_rgba(56,70,37,0.16)]"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              maxHeight: "clamp(220px, 42vh, 540px)",
              objectFit: "contain",
            }}
            src={TULA_LOGO_URL}
            alt="TULA — Whisper of Trees"
            width={1152}
            height={1004}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />
          <span
            className="text-center font-normal uppercase leading-[1.2] tracking-[0.08em] text-[#4d5b35]/75"
            style={{
              marginTop: "clamp(0.55rem, 1.3vh, 1.25rem)",
              fontSize: "clamp(0.56rem, 0.8vw, 0.98rem)",
            }}
          >
            By Tula Properties
          </span>

          <div
            className="h-px w-full overflow-hidden bg-[#7b8448]/20"
            style={{ marginTop: "clamp(1rem, 2vh, 1.75rem)" }}
            aria-hidden
          >
            <motion.div
              className="h-full origin-left bg-[#7b8448] shadow-[0_0_12px_rgba(123,132,72,0.34)]"
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
