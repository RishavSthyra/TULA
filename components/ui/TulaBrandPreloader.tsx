"use client";

import { motion, useReducedMotion } from "framer-motion";
import PreloaderCornerLogo from "@/components/ui/PreloaderCornerLogo";

const TULA_LOGO_URL =
  "https://cdn.sthyra.com/TULA/Images/Gold%20Logo%20Compressed.avif";

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
      className="fixed inset-0 z-[9999] overflow-hidden bg-black"
      role="status"
      aria-label={`Loading exterior panoramas ${clampedProgress}%`}
    >
      <PreloaderCornerLogo />
      <div className="absolute inset-[-8%] bg-[radial-gradient(ellipse_62%_46%_at_18%_74%,rgba(34,120,70,0.28)_0%,rgba(15,60,36,0.16)_46%,transparent_74%),radial-gradient(ellipse_54%_40%_at_86%_18%,rgba(28,104,62,0.20)_0%,transparent_70%),radial-gradient(ellipse_74%_58%_at_50%_42%,rgba(34,98,57,0.31)_0%,rgba(13,45,28,0.18)_42%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_48%_at_50%_48%,transparent_0%,rgba(0,0,0,0.18)_52%,rgba(0,0,0,0.86)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.72)_0%,transparent_24%,transparent_70%,rgba(0,0,0,0.78)_100%)]" />

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
            className="select-none drop-shadow-[0_20px_52px_rgba(0,0,0,0.72)]"
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
            className="text-center font-normal uppercase leading-[1.2] tracking-[0.08em] text-[#eee7d7]/75"
            style={{
              marginTop: "clamp(0.55rem, 1.3vh, 1.25rem)",
              fontSize: "clamp(0.56rem, 0.8vw, 0.98rem)",
            }}
          >
            By Tula Properties
          </span>

          <div
            className="h-px w-full overflow-hidden bg-white/12"
            style={{ marginTop: "clamp(1rem, 2vh, 1.75rem)" }}
            aria-hidden
          >
            <motion.div
              className="h-full origin-left bg-[linear-gradient(90deg,rgba(154,126,72,0.7)_0%,#c8a96a_55%,#f0dfb5_100%)] shadow-[0_0_14px_rgba(200,169,106,0.38)]"
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
