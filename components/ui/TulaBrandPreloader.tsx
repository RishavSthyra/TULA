"use client";

import { motion, useReducedMotion } from "framer-motion";

const TULA_LOGO_URL =
  "https://cdn.sthyra.com/TULA/Images/Whisper_of_Tree_Logo_Gold%201_01.png";

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
          className="flex w-[min(70vw,520px)] flex-col items-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="block h-auto max-h-[54vh] w-full select-none object-contain drop-shadow-[0_20px_52px_rgba(0,0,0,0.72)]"
            src={TULA_LOGO_URL}
            alt="TULA — Whisper of Trees"
            width={1152}
            height={1004}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />
          <span className="mt-[clamp(0.8rem,1.8vh,1.25rem)] text-center text-[clamp(0.72rem,1.05vw,0.98rem)] font-normal uppercase leading-[1.2] tracking-[0.08em] text-[#eee7d7]/75">
            By Tula Properties
          </span>

          <div
            className="mt-7 h-px w-full overflow-hidden bg-white/12"
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
