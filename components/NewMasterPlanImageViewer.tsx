"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import NextImage from "next/image";

const MASTER_PLAN_IMAGES = [
  "/new_masterplan_images/4.avif",
  "/new_masterplan_images/3.avif",
  "/new_masterplan_images/2.jpg",
  "/new_masterplan_images/1.avif",
] as const;

const IMAGE_FADE_DURATION_MS = 1150;

export default function NewMasterPlanImageViewer() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const activeIndexRef = useRef(0);
  const fadeTimeoutRef = useRef<number | null>(null);

  const changeImage = useCallback((direction: -1 | 1) => {
    const currentIndex = activeIndexRef.current;
    const nextIndex =
      (currentIndex + direction + MASTER_PLAN_IMAGES.length) %
      MASTER_PLAN_IMAGES.length;

    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current);
    }

    setPreviousIndex(currentIndex);
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);

    fadeTimeoutRef.current = window.setTimeout(() => {
      setPreviousIndex(null);
      fadeTimeoutRef.current = null;
    }, IMAGE_FADE_DURATION_MS + 80);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changeImage(1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        changeImage(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      if (fadeTimeoutRef.current !== null) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [changeImage]);

  return (
    <section className="app-screen relative isolate overflow-hidden bg-black">
      <div className="absolute inset-0 bg-black">
        {MASTER_PLAN_IMAGES.map((src, index) => {
          const isActive = index === activeIndex;
          const isPrevious = index === previousIndex;

          return (
            <NextImage
              key={src}
              src={src}
              alt={`TULA master plan view ${MASTER_PLAN_IMAGES.length - index}`}
              aria-hidden={!isActive}
              draggable={false}
              fill
              sizes="100vw"
              unoptimized
              loading="eager"
              fetchPriority={index === 0 ? "high" : "auto"}
              className={`gpu-layer pointer-events-none select-none object-cover object-center transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                isActive || isPrevious ? "opacity-100" : "opacity-0"
              }`}
              style={{
                transitionDuration: `${IMAGE_FADE_DURATION_MS}ms`,
                zIndex: isActive ? 2 : isPrevious ? 1 : 0,
              }}
            />
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-24 z-30 flex justify-center px-4 sm:top-28 md:top-30">
        <div
          data-master-plan-stage-controls
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.42),rgba(255,255,255,0.14))] p-2 shadow-[0_18px_46px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
        >
          <button
            type="button"
            onClick={() => changeImage(1)}
            onContextMenu={(event) => event.preventDefault()}
            className="group inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border border-white/45 bg-white/72 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(15,23,42,0.12)] transition duration-300 hover:-translate-x-0.5 hover:bg-white/88 active:scale-[0.98] sm:h-11 sm:w-11"
            aria-label="Previous master plan view"
          >
            <ArrowLeft className="h-4 w-4 transition duration-300 group-hover:-translate-x-0.5" />
          </button>

          <div className="h-7 w-px bg-gradient-to-b from-white/0 via-white/35 to-white/0 sm:h-8" />

          <button
            type="button"
            onClick={() => changeImage(-1)}
            onContextMenu={(event) => event.preventDefault()}
            className="group inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border border-white/45 bg-white/72 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(15,23,42,0.12)] transition duration-300 hover:translate-x-0.5 hover:bg-white/88 active:scale-[0.98] sm:h-11 sm:w-11"
            aria-label="Next master plan view"
          >
            <ArrowRight className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Master plan view {MASTER_PLAN_IMAGES.length - activeIndex} of 4
      </p>
    </section>
  );
}
