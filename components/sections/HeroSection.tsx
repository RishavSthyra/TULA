"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import { BsArrowRight } from "react-icons/bs";
import { Leaf } from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import DesktopSiteRail from "@/components/DesktopSiteRail";

const heroSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-hero-serif",
});

const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const HERO_PLAY_RETRY_MS = 450;

type IdleCapableWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

function HeroMagneticButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <div className="hero-liquid-wrap ml-auto">
      <button
        className="hero-liquid-button"
        onClick={onClick}
        type="button"
      >
        <span className="hero-liquid-text">
          Explore The Project
          <BsArrowRight className="text-[1.05rem] text-[#91bd78]" aria-hidden />
        </span>
      </button>
    </div>
  );
}

type HeroSectionProps = {
  heroLogoSrc?: string | null;
  heroPosterSrc?: string | null;
  masterPlanScrubVideoSrc?: string | null;
  heroVideoSrc?: string | null;
  heroLoopVideoSrc?: string | null;
  staticHeroImageSrc?: string | null;
  onHeroReadyChange?: (ready: boolean) => void;
  onHeroVideoProgressChange?: (progress: number) => void;
  playIntroAnimation?: boolean;
};

function getHeroVideoLoadProgress(video: HTMLVideoElement) {
  const duration = video.duration;

  if (Number.isFinite(duration) && duration > 0 && video.buffered.length > 0) {
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    return Math.max(0, Math.min(1, bufferedEnd / duration));
  }

  if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
    return 1;
  }

  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return 0.84;
  }

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return 0.58;
  }

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return 0.26;
  }

  return 0.08;
}

function afterNextVideoFrame(
  video: HTMLVideoElement,
  callback: () => void,
) {
  if (typeof video.requestVideoFrameCallback === "function") {
    video.requestVideoFrameCallback(() => callback());
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback);
  });
}

export default function HeroSection({
  heroPosterSrc,
  masterPlanScrubVideoSrc,
  heroVideoSrc,
  heroLoopVideoSrc,
  staticHeroImageSrc,
  onHeroReadyChange,
  onHeroVideoProgressChange,
  playIntroAnimation = false,
}: HeroSectionProps) {
  const router = useRouter();
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const heroLoopVideoRef = useRef<HTMLVideoElement | null>(null);
  const idleWarmVideoRef = useRef<HTMLVideoElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollLockRef = useRef(false);

  const [videoReady, setVideoReady] = useState(false);
  const [isHeroVideoPlaying, setIsHeroVideoPlaying] = useState(false);
  const [isHeroLoopVideoVisible, setIsHeroLoopVideoVisible] = useState(false);
  const isEntryVideoVisible = false;

  const line1 = "A Quiter,";
  const line2Prefix = "Kind of";
  const line2Accent = "Luxury";
  const heroPosterImage =
    heroPosterSrc ?? staticHeroImageSrc ?? EMPTY_IMAGE_DATA_URL;

  const contentWrap: Variants = {
    hidden: {
      transition: {
        staggerChildren: 0,
      },
    },
    show: {
      transition: {
        staggerChildren: 0.08,
      },
    },
    exit: {
      transition: {
        staggerChildren: 0.09,
        staggerDirection: -1,
      },
    },
  };

  const contentItem: Variants = {
    hidden: {
      opacity: 0,
      y: 18,
      filter: "blur(8px)",
      transition: {
        duration: 0.24,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
    exit: {
      opacity: 0,
      y: -56,
      filter: "blur(14px)",
      transition: {
        duration: 0.75,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    },
  };

  const prepareVideoForInlinePlayback = useCallback((video: HTMLVideoElement) => {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = false;
    video.controls = false;
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.removeAttribute("controls");
    video.setAttribute("muted", "");
    video.removeAttribute("autoplay");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("x5-playsinline", "");
    video.setAttribute("x5-video-player-type", "h5-page");
    video.setAttribute("x-webkit-airplay", "deny");
  }, []);

  const prepareHeroLoopVideo = useCallback(
    (video: HTMLVideoElement) => {
      if (!heroLoopVideoSrc) {
        return;
      }

      prepareVideoForInlinePlayback(video);

      if (video.src !== heroLoopVideoSrc) {
        video.src = heroLoopVideoSrc;
      }

      video.preload = "auto";
    },
    [heroLoopVideoSrc, prepareVideoForInlinePlayback],
  );

  const startHeroLoopVideo = useCallback(async () => {
    const loopVideo = heroLoopVideoRef.current;

    if (!loopVideo || !heroLoopVideoSrc || isEntryVideoVisible) {
      return;
    }

    prepareHeroLoopVideo(loopVideo);

    try {
      loopVideo.currentTime = 0;
      await loopVideo.play();
      afterNextVideoFrame(loopVideo, () => {
        setIsHeroLoopVideoVisible(true);

        window.requestAnimationFrame(() => {
          heroVideoRef.current?.pause();
          setIsHeroVideoPlaying(false);
        });
      });
    } catch {
      // Keep the forward video's last painted frame visible if reverse fails.
    }
  }, [
    heroLoopVideoSrc,
    isEntryVideoVisible,
    prepareHeroLoopVideo,
  ]);

  const startHeroVideo = useCallback(async () => {
    const heroVideo = heroVideoRef.current;

    if (!heroVideo || !heroVideoSrc || isEntryVideoVisible) {
      return;
    }

    prepareVideoForInlinePlayback(heroVideo);

    try {
      heroVideo.currentTime = 0;
      await heroVideo.play();
      afterNextVideoFrame(heroVideo, () => {
        setIsHeroVideoPlaying(true);

        window.requestAnimationFrame(() => {
          heroLoopVideoRef.current?.pause();
          setIsHeroLoopVideoVisible(false);
        });
      });
    } catch {
      // Keep the reverse video's last painted frame visible if forward fails.
    }
  }, [heroVideoSrc, isEntryVideoVisible, prepareVideoForInlinePlayback]);

  const goToProjectOverview = useCallback(() => {
    if (scrollLockRef.current) return;

    scrollLockRef.current = true;
    router.push("/project-overview");
  }, [router]);

  useEffect(() => {
    const heroVideo = heroVideoRef.current;
    if (!heroVideo || !heroVideoSrc) {
      onHeroVideoProgressChange?.(0.08);
      return;
    }

    let readyFrameId: number | null = null;
    let rafId: number | null = null;

    const markVideoReady = () => {
      setVideoReady(true);
    };

    const markVideoFallbackReady = () => {
      setVideoReady(true);
    };

    const markHeroVideoPlaying = () => {
      setIsHeroVideoPlaying(true);
    };

    const reportProgress = () => {
      onHeroVideoProgressChange?.(getHeroVideoLoadProgress(heroVideo));
    };

    prepareVideoForInlinePlayback(heroVideo);
    heroVideo.preload = "auto";

    if (heroVideo.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      onHeroVideoProgressChange?.(1);
      readyFrameId = window.requestAnimationFrame(markVideoReady);
      return () => {
        if (readyFrameId !== null) {
          window.cancelAnimationFrame(readyFrameId);
        }
      };
    }

    reportProgress();

    const handleCanPlay = () => {
      reportProgress();
      markVideoReady();
    };

    const handleLoadedData = () => {
      reportProgress();
      if (heroVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        markVideoReady();
      }
    };

    const handleProgress = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        reportProgress();
      });
    };

    const handleFallbackReady = () => {
      onHeroVideoProgressChange?.(1);
      markVideoFallbackReady();
    };

    const handleStateCheck = () => {
      reportProgress();

      if (heroVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        markVideoReady();
      }
    };

    heroVideo.addEventListener("loadedmetadata", handleProgress);
    heroVideo.addEventListener("loadeddata", handleLoadedData);
    heroVideo.addEventListener("progress", handleProgress);
    heroVideo.addEventListener("canplay", handleCanPlay);
    heroVideo.addEventListener("canplaythrough", handleCanPlay);
    heroVideo.addEventListener("playing", handleStateCheck);
    heroVideo.addEventListener("playing", markHeroVideoPlaying);
    heroVideo.addEventListener("play", markHeroVideoPlaying);
    heroVideo.addEventListener("stalled", handleStateCheck);
    heroVideo.addEventListener("suspend", handleStateCheck);
    heroVideo.addEventListener("waiting", handleStateCheck);
    heroVideo.addEventListener("error", handleFallbackReady);

    heroVideo.load();

    return () => {
      if (readyFrameId !== null) {
        window.cancelAnimationFrame(readyFrameId);
      }

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }

      heroVideo.removeEventListener("loadedmetadata", handleProgress);
      heroVideo.removeEventListener("loadeddata", handleLoadedData);
      heroVideo.removeEventListener("progress", handleProgress);
      heroVideo.removeEventListener("canplay", handleCanPlay);
      heroVideo.removeEventListener("canplaythrough", handleCanPlay);
      heroVideo.removeEventListener("playing", handleStateCheck);
      heroVideo.removeEventListener("playing", markHeroVideoPlaying);
      heroVideo.removeEventListener("play", markHeroVideoPlaying);
      heroVideo.removeEventListener("stalled", handleStateCheck);
      heroVideo.removeEventListener("suspend", handleStateCheck);
      heroVideo.removeEventListener("waiting", handleStateCheck);
      heroVideo.removeEventListener("error", handleFallbackReady);
    };
  }, [
    heroVideoSrc,
    onHeroVideoProgressChange,
    prepareVideoForInlinePlayback,
  ]);

  useEffect(() => {
    onHeroReadyChange?.(videoReady);
  }, [onHeroReadyChange, videoReady]);

  useEffect(() => {
    const heroVideo = heroVideoRef.current;

    if (
      !heroVideo ||
      !heroVideoSrc ||
      !playIntroAnimation ||
      !videoReady ||
      isEntryVideoVisible ||
      isHeroLoopVideoVisible
    ) {
      return;
    }

    prepareVideoForInlinePlayback(heroVideo);

    const playHeroVideo = () => {
      if (
        document.visibilityState === "hidden" ||
        isEntryVideoVisible ||
        isHeroLoopVideoVisible
      ) {
        return;
      }

      void heroVideo.play().catch(() => undefined);
    };

    playHeroVideo();
    const retryTimeout = window.setTimeout(playHeroVideo, 120);
    const retryInterval = window.setInterval(() => {
      if (!heroVideo.paused && heroVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setIsHeroVideoPlaying(true);
        window.clearInterval(retryInterval);
        return;
      }

      playHeroVideo();
    }, HERO_PLAY_RETRY_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        playHeroVideo();
      }
    };

    window.addEventListener("focus", playHeroVideo);
    window.addEventListener("pageshow", playHeroVideo);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(retryTimeout);
      window.clearInterval(retryInterval);
      window.removeEventListener("focus", playHeroVideo);
      window.removeEventListener("pageshow", playHeroVideo);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    heroVideoSrc,
    isEntryVideoVisible,
    isHeroLoopVideoVisible,
    playIntroAnimation,
    prepareVideoForInlinePlayback,
    videoReady,
  ]);

  useEffect(() => {
    const loopVideo = heroLoopVideoRef.current;

    if (!loopVideo || !heroLoopVideoSrc) {
      return;
    }

    prepareHeroLoopVideo(loopVideo);
    loopVideo.load();
  }, [heroLoopVideoSrc, prepareHeroLoopVideo]);

  useEffect(() => {
    router.prefetch("/master-plan");
  }, [router]);

  useEffect(() => {
    if (!videoReady) return;

    let timeoutId: TimeoutHandle | null = null;
    let idleId: number | null = null;
    const idleWindow = window as IdleCapableWindow;

    const warmMasterPlan = () => {
      router.prefetch("/master-plan");
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(warmMasterPlan, {
        timeout: 1200,
      });
    } else {
      timeoutId = globalThis.setTimeout(warmMasterPlan, 400);
    }

    return () => {
      if (
        idleId !== null &&
        typeof idleWindow.cancelIdleCallback === "function"
      ) {
        idleWindow.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [router, videoReady]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY <= 20) return;
      if (scrollLockRef.current) return;

      e.preventDefault();
      goToProjectOverview();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [goToProjectOverview]);

  return (
    <section
      ref={sectionRef}
      className="relative app-screen w-full overflow-hidden bg-black text-white"
    >
      <div
        className={`absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-700 ${
          isHeroVideoPlaying || isEntryVideoVisible || isHeroLoopVideoVisible
            ? "opacity-0"
            : "opacity-100"
        }`}
        style={{ backgroundImage: `url('${heroPosterImage}')` }}
      />

      <video
        ref={heroVideoRef}
        className={`hero-section-video pointer-events-none absolute inset-0 z-[2] h-full w-full object-cover ${
          isHeroVideoPlaying && !isEntryVideoVisible && !isHeroLoopVideoVisible
            ? "opacity-100"
            : "opacity-0"
        }`}
        src={heroVideoSrc ?? undefined}
        muted
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
        onEnded={() => {
          void startHeroLoopVideo();
        }}
      />

      <video
        ref={heroLoopVideoRef}
        muted
        playsInline
        preload="auto"
        className={`hero-section-video pointer-events-none absolute inset-0 z-[3] h-full w-full object-cover ${
          isHeroLoopVideoVisible && !isEntryVideoVisible
            ? "opacity-100"
            : "opacity-0"
        }`}
        src={heroLoopVideoSrc ?? undefined}
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
        onEnded={() => {
          void startHeroVideo();
        }}
      />

      <video
        ref={idleWarmVideoRef}
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      >
        {masterPlanScrubVideoSrc ? (
          <source src={masterPlanScrubVideoSrc} type="video/mp4" />
        ) : null}
      </video>

      <style jsx global>{`
        .hero-section-video::-webkit-media-controls,
        .hero-section-video::-webkit-media-controls-panel,
        .hero-section-video::-webkit-media-controls-play-button,
        .hero-section-video::-webkit-media-controls-start-playback-button {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
          -webkit-appearance: none !important;
        }

        .hero-liquid-wrap {
          position: relative;
          z-index: 2;
          display: inline-flex;
          overflow: visible;
        }

        .hero-liquid-button {
          all: unset;
          position: relative;
          display: inline-flex;
          min-width: 14.5rem;
          height: 52px;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          overflow: hidden;
          border-radius: 999vw;
          border: 1px solid rgba(116, 174, 94, 0.64);
          background: rgba(5, 8, 6, 0.48);
          box-shadow: none;
          -webkit-backdrop-filter: blur(20px) saturate(1.16);
          backdrop-filter: blur(20px) saturate(1.16);
          transition: border-color 260ms ease;
        }

        .hero-liquid-button:hover {
          border-color: rgba(143, 205, 117, 0.9);
          background: rgba(5, 8, 6, 0.48);
          box-shadow: none;
        }

        .hero-liquid-text {
          position: relative;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          padding-inline: 1.5rem;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: rgba(241, 247, 239, 0.96);
          text-shadow: 0 1px 0 rgba(7, 16, 10, 0.22);
          text-transform: uppercase;
          user-select: none;
          transition:
            color 260ms ease,
            text-shadow 260ms ease;
        }

        .hero-liquid-button:hover .hero-liquid-text {
          color: rgba(247, 250, 245, 1);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.34);
        }

        .hero-bottom-dock {
          --anim-hover-time: 400ms;
          --anim-hover-ease: cubic-bezier(0.25, 1, 0.5, 1);
          --border-width: 1px;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border-radius: 999px;
          border: 0;
          background:
            linear-gradient(
              -75deg,
              rgba(24, 62, 25, 0.16),
              rgba(118, 176, 88, 0.2),
              rgba(9, 34, 17, 0.2)
            );
          box-shadow:
            inset 0 0.125em 0.125em rgba(0, 0, 0, 0.16),
            inset 0 -0.125em 0.125em rgba(235, 255, 216, 0.28),
            0 0.25em 0.125em -0.125em rgba(0, 0, 0, 0.28),
            0 0 0.1em 0.18em inset rgba(180, 235, 142, 0.14),
            0 14px 34px rgba(0, 0, 0, 0.18);
          -webkit-backdrop-filter: blur(4px) saturate(1.35);
          backdrop-filter: blur(0.5px) saturate(1.35);
          transition: all var(--anim-hover-time) var(--anim-hover-ease);
        }

        .hero-bottom-dock:hover {
          -webkit-backdrop-filter: blur(0.5px) saturate(1.45);
          backdrop-filter: blur(0.5px) saturate(1.45);
          box-shadow:
            inset 0 0.125em 0.125em rgba(0, 0, 0, 0.16),
            inset 0 -0.125em 0.125em rgba(235, 255, 216, 0.42),
            0 0.15em 0.05em -0.1em rgba(0, 0, 0, 0.3),
            0 0 0.05em 0.12em inset rgba(204, 255, 172, 0.24),
            0 12px 30px rgba(0, 0, 0, 0.16);
        }

        .hero-bottom-dock::before {
          content: "";
          position: absolute;
          z-index: 1;
          inset: 0;
          border-radius: inherit;
          background:
            linear-gradient(
              var(--hero-liquid-angle-2),
              rgba(255, 255, 255, 0) 0%,
              rgba(236, 255, 212, 0.28) 40% 50%,
              rgba(255, 255, 255, 0) 55%
            );
          background-size: 200% 200%;
          background-position: 0% 50%;
          mix-blend-mode: screen;
          pointer-events: none;
          transition:
            background-position 500ms var(--anim-hover-ease),
            --hero-liquid-angle-2 500ms var(--anim-hover-ease);
        }

        .hero-bottom-dock:hover::before {
          background-position: 25% 50%;
        }

        .hero-bottom-dock::after {
          content: "";
          position: absolute;
          z-index: 2;
          inset: calc(var(--border-width) / -2);
          border-radius: inherit;
          padding: var(--border-width);
          box-sizing: border-box;
          background:
            conic-gradient(
              from var(--hero-liquid-angle-1) at 50% 50%,
              rgba(5, 39, 11, 0.62),
              rgba(22, 74, 20, 0) 5% 40%,
              rgba(214, 255, 178, 0.42) 50%,
              rgba(22, 74, 20, 0) 60% 95%,
              rgba(5, 39, 11, 0.62)
            ),
            linear-gradient(180deg, rgba(222, 255, 194, 0.28), rgba(40, 100, 34, 0.24));
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          pointer-events: none;
          transition:
            all var(--anim-hover-time) var(--anim-hover-ease),
            --hero-liquid-angle-1 500ms ease;
        }

        .hero-bottom-dock:hover::after {
          --hero-liquid-angle-1: -125deg;
        }

        .hero-bottom-dock > * {
          position: relative;
          z-index: 3;
        }

        .hero-bottom-dock-link {
          position: relative;
          color: rgba(229, 249, 216, 0.88);
          transition:
            background-color 180ms cubic-bezier(0.25, 1, 0.5, 1),
            color 180ms cubic-bezier(0.25, 1, 0.5, 1);
        }

        .hero-bottom-dock-link:hover,
        .hero-bottom-dock-link:focus-visible {
          color: rgba(244, 255, 235, 1);
          background: rgba(202, 255, 169, 0.1);
          box-shadow:
            inset 0 1px 0 rgba(239, 255, 224, 0.18),
            inset 0 -1px 0 rgba(0, 0, 0, 0.18),
            0 8px 20px rgba(0, 0, 0, 0.18);
        }

        .hero-bottom-dock-icon {
          width: 1.05rem;
          height: 1.05rem;
          filter: drop-shadow(0 0.18em 0.08em rgba(0, 0, 0, 0.26));
        }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{
          background: [
            "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 15%, rgba(0,0,0,0) 36%)",
            "radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.42) 30%, rgba(0,0,0,0.14) 53%, rgba(0,0,0,0) 72%)",
            "linear-gradient(270deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.2) 28%, rgba(0,0,0,0) 62%)",
            "linear-gradient(0deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 36%)",
          ].join(", "),
        }}
      />

      <DesktopSiteRail className="absolute left-5 top-1/2 z-20 -translate-y-1/2 2xl:left-7" />

      <div className="absolute inset-0 z-10 flex items-end justify-end px-6 pb-[calc(env(safe-area-inset-bottom)+2.25rem)] pt-28 sm:px-10 sm:pb-12 sm:pt-32 lg:px-16 xl:px-20 2xl:px-24">
        <motion.div
          variants={contentWrap}
          initial="hidden"
          animate={
            playIntroAnimation ? "show" : "hidden"
          }
          className="ml-auto w-full max-w-[min(92vw,42rem)] text-right"
        >
          <motion.div variants={contentItem}>
            <h1
              className={`${heroSerif.className} text-[clamp(2.35rem,4.25vw,4.9rem)] font-normal uppercase leading-[0.98] tracking-[0.05em] text-[#f4f1e8] opacity-85 drop-shadow-[0_18px_46px_rgba(0,0,0,0.46)]`}
            >
              <span className="block whitespace-nowrap">{line1}</span>
              <span className="mt-2 block whitespace-nowrap">
                {line2Prefix}{" "}
                <span className="text-[#9fbf71] drop-shadow-[0_0_24px_rgba(159,191,113,0.2)]">
                  {line2Accent}
                </span>
              </span>
            </h1>
          </motion.div>

          <motion.div
            variants={contentItem}
            className="mt-4 ml-auto flex w-full max-w-[min(100%,32rem)] items-center text-[#d9c28a]/70"
          >
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d9c28a]/32 to-[#d9c28a]/58" />
            <span className="mx-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#dff2b8]/20 bg-white/[0.06] backdrop-blur-md">
              <Leaf className="h-4 w-4" strokeWidth={1.4} />
            </span>
            <span className="h-px w-12 bg-[#d9c28a]/68" />
          </motion.div>

          <motion.p
            variants={contentItem}
            className="mt-4 ml-auto max-w-[26rem] text-[0.95rem] leading-7 tracking-[0.035em] text-[#eef2e7]/70 sm:text-base"
          >
            A quiet address shaped by open sky, layered green, and everyday calm.
          </motion.p>

          <motion.div variants={contentItem} className="mt-7">
            <HeroMagneticButton onClick={goToProjectOverview} />
          </motion.div>
        </motion.div>
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          h1 {
            font-size: clamp(2rem, 11vw, 3.35rem);
            letter-spacing: 0.025em;
          }
        }
      `}</style>
    </section>
  );
}
