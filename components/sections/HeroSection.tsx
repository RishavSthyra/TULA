"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BsArrowRight } from "react-icons/bs";
import {
  HiBuildingOffice2,
  HiHome,
  HiMapPin,
  HiPhone,
  HiSparkles,
} from "react-icons/hi2";
import { Leaf } from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import { Dock, DockIcon } from "@/components/ui/dock";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const heroSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-hero-serif",
});

const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const HERO_LOOP_RESTART_BEFORE_END_SECONDS = 0.5;
const HERO_LOOP_RESTART_AT_SECONDS = 0.04;
const HERO_PLAY_RETRY_MS = 450;
const STATIC_HERO_IMAGE_HOLD_MS = 2000;

const bottomDockItems = [
  { href: "/", icon: HiHome, label: "Home" },
  { href: "/project-overview", icon: HiBuildingOffice2, label: "Overview" },
  { href: "/amenities", icon: HiSparkles, label: "Amenities" },
  { href: "/area-map", icon: HiMapPin, label: "Location" },
  { href: "tel:+918088004411", icon: HiPhone, label: "Call" },
] as const;

type IdleCapableWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

type HeroSectionProps = {
  heroLogoSrc?: string | null;
  heroPosterSrc?: string | null;
  masterPlanScrubVideoSrc?: string | null;
  heroVideoSrc?: string | null;
  heroLoopVideoSrc?: string | null;
  staticHeroImageSrc?: string | null;
  temporaryStaticHeroImageSrc?: string | null;
  useStaticHeroIntro?: boolean;
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

export default function HeroSection({
  heroLogoSrc,
  heroPosterSrc,
  masterPlanScrubVideoSrc,
  heroVideoSrc,
  heroLoopVideoSrc,
  staticHeroImageSrc,
  temporaryStaticHeroImageSrc,
  useStaticHeroIntro = false,
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
  const isLoopSeamSeekInProgressRef = useRef(false);

  const [videoReady, setVideoReady] = useState(false);
  const [isHeroVideoPlaying, setIsHeroVideoPlaying] = useState(false);
  const [isHeroLoopVideoVisible, setIsHeroLoopVideoVisible] = useState(false);
  const isEntryVideoVisible = false;

  const line1 = "A Quiter,";
  const line2Prefix = "Kind of";
  const line2Accent = "Luxury";
  const hasTemporaryStaticHeroImage = Boolean(temporaryStaticHeroImageSrc);
  const heroPosterImage =
    temporaryStaticHeroImageSrc ??
    (useStaticHeroIntro && staticHeroImageSrc
      ? staticHeroImageSrc
      : heroPosterSrc ?? staticHeroImageSrc ?? EMPTY_IMAGE_DATA_URL);

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
    video.autoplay = true;
    video.controls = false;
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.removeAttribute("controls");
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
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
    loopVideo.load();

    let didRevealLoopVideo = false;

    const revealLoopVideo = () => {
      if (didRevealLoopVideo) {
        return;
      }

      didRevealLoopVideo = true;
      loopVideo.removeEventListener("loadeddata", revealLoopVideo);
      loopVideo.removeEventListener("canplay", revealLoopVideo);
      setIsHeroLoopVideoVisible(true);
    };

    if (loopVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      revealLoopVideo();
    } else {
      loopVideo.addEventListener("loadeddata", revealLoopVideo, { once: true });
      loopVideo.addEventListener("canplay", revealLoopVideo, { once: true });
    }

    try {
      loopVideo.currentTime = 0;
      await loopVideo.play();
      if (loopVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        revealLoopVideo();
      }
    } catch {
      loopVideo.removeEventListener("loadeddata", revealLoopVideo);
      loopVideo.removeEventListener("canplay", revealLoopVideo);
    }
  }, [
    heroLoopVideoSrc,
    isEntryVideoVisible,
    prepareHeroLoopVideo,
  ]);

  const handleHeroLoopPlaybackBoundary = useCallback(() => {
    const loopVideo = heroLoopVideoRef.current;

    if (
      !loopVideo ||
      !isHeroLoopVideoVisible ||
      isEntryVideoVisible ||
      isLoopSeamSeekInProgressRef.current
    ) {
      return;
    }

    const duration = loopVideo.duration;
    const currentTime = loopVideo.currentTime;
    const secondsUntilEnd = duration - currentTime;

    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      secondsUntilEnd > HERO_LOOP_RESTART_BEFORE_END_SECONDS
    ) {
      return;
    }

    isLoopSeamSeekInProgressRef.current = true;

    try {
      loopVideo.currentTime = HERO_LOOP_RESTART_AT_SECONDS;
      // Seek backward → video pauses. Always call play() to resume.
      // Restart before the encoded end so the browser never paints the end boundary.
      void loopVideo.play().catch(() => undefined);
    } catch {
      // Keep the last rendered frame visible if the browser rejects the seek.
    } finally {
      window.setTimeout(() => {
        isLoopSeamSeekInProgressRef.current = false;
      }, 180);
    }
  }, [isEntryVideoVisible, isHeroLoopVideoVisible]);

  const goToProjectOverview = useCallback(() => {
    if (scrollLockRef.current) return;

    scrollLockRef.current = true;
    router.push("/project-overview");
  }, [router]);

  useEffect(() => {
    const heroVideo = heroVideoRef.current;
    if (hasTemporaryStaticHeroImage) {
      setVideoReady(true);
      setIsHeroVideoPlaying(false);
      onHeroVideoProgressChange?.(1);
      return;
    }

    if (useStaticHeroIntro) {
      setVideoReady(true);
      setIsHeroVideoPlaying(false);
      onHeroVideoProgressChange?.(1);
      return;
    }

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

    const markHeroVideoNotPlaying = () => {
      setIsHeroVideoPlaying(false);
    };

    const reportProgress = () => {
      onHeroVideoProgressChange?.(getHeroVideoLoadProgress(heroVideo));
    };

    setVideoReady(false);
    setIsHeroVideoPlaying(false);
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
      void heroVideo.play().catch(() => undefined);
    };

    const handleLoadedData = () => {
      reportProgress();
      if (heroVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        markVideoReady();
        void heroVideo.play().catch(() => undefined);
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
    heroVideo.addEventListener("pause", markHeroVideoNotPlaying);
    heroVideo.addEventListener("ended", markHeroVideoNotPlaying);
    heroVideo.addEventListener("stalled", handleStateCheck);
    heroVideo.addEventListener("suspend", handleStateCheck);
    heroVideo.addEventListener("waiting", handleStateCheck);
    heroVideo.addEventListener("error", handleFallbackReady);

    heroVideo.load();
    void heroVideo.play().catch(() => undefined);

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
      heroVideo.removeEventListener("pause", markHeroVideoNotPlaying);
      heroVideo.removeEventListener("ended", markHeroVideoNotPlaying);
      heroVideo.removeEventListener("stalled", handleStateCheck);
      heroVideo.removeEventListener("suspend", handleStateCheck);
      heroVideo.removeEventListener("waiting", handleStateCheck);
      heroVideo.removeEventListener("error", handleFallbackReady);
    };
  }, [
    heroVideoSrc,
    hasTemporaryStaticHeroImage,
    onHeroVideoProgressChange,
    prepareVideoForInlinePlayback,
    useStaticHeroIntro,
  ]);

  useEffect(() => {
    onHeroReadyChange?.(videoReady);
  }, [onHeroReadyChange, videoReady]);

  useEffect(() => {
    const heroVideo = heroVideoRef.current;

    if (
      useStaticHeroIntro ||
      hasTemporaryStaticHeroImage ||
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
    hasTemporaryStaticHeroImage,
    isEntryVideoVisible,
    isHeroLoopVideoVisible,
    playIntroAnimation,
    prepareVideoForInlinePlayback,
    useStaticHeroIntro,
    videoReady,
  ]);

  useEffect(() => {
    if (
      !useStaticHeroIntro ||
      hasTemporaryStaticHeroImage ||
      !playIntroAnimation ||
      isEntryVideoVisible ||
      isHeroLoopVideoVisible
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void startHeroLoopVideo();
    }, STATIC_HERO_IMAGE_HOLD_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    isEntryVideoVisible,
    isHeroLoopVideoVisible,
    hasTemporaryStaticHeroImage,
    playIntroAnimation,
    startHeroLoopVideo,
    useStaticHeroIntro,
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
    if (!isHeroLoopVideoVisible || isEntryVideoVisible) {
      return;
    }

    let frameId: number | null = null;

    const checkLoopBoundary = () => {
      handleHeroLoopPlaybackBoundary();
      frameId = window.requestAnimationFrame(checkLoopBoundary);
    };

    frameId = window.requestAnimationFrame(checkLoopBoundary);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    handleHeroLoopPlaybackBoundary,
    isEntryVideoVisible,
    isHeroLoopVideoVisible,
  ]);

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
            ? hasTemporaryStaticHeroImage
              ? "opacity-100"
              : "opacity-0"
            : "opacity-100"
        }`}
        style={{ backgroundImage: `url('${heroPosterImage}')` }}
      />

      {temporaryStaticHeroImageSrc ? (
        <Image
          src={temporaryStaticHeroImageSrc}
          alt=""
          aria-hidden="true"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover"
        />
      ) : null}

      {!useStaticHeroIntro ? (
        <video
          ref={heroVideoRef}
          className={`hero-section-video pointer-events-none absolute inset-0 z-[2] h-full w-full object-cover transition-opacity duration-700 ${
            isHeroVideoPlaying && !isEntryVideoVisible && !isHeroLoopVideoVisible
              && !hasTemporaryStaticHeroImage
              ? "opacity-100"
              : "opacity-0"
          }`}
          src={heroVideoSrc ?? undefined}
          autoPlay
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
      ) : null}

      <video
        ref={heroLoopVideoRef}
        autoPlay
        muted
        playsInline
        preload="auto"
        className={`hero-section-video pointer-events-none absolute inset-0 z-[3] h-full w-full object-cover transition-opacity duration-500 ${
          isHeroLoopVideoVisible && !isEntryVideoVisible
            && !hasTemporaryStaticHeroImage
            ? "opacity-100"
            : "opacity-0"
        }`}
        src={heroLoopVideoSrc ?? undefined}
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
        onTimeUpdate={handleHeroLoopPlaybackBoundary}
        onCanPlay={() => {
          const video = heroLoopVideoRef.current;
          if (video && !video.paused) return;
          void video?.play().catch(() => undefined);
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

        @property --hero-liquid-angle-1 {
          syntax: "<angle>";
          inherits: false;
          initial-value: -75deg;
        }

        @property --hero-liquid-angle-2 {
          syntax: "<angle>";
          inherits: false;
          initial-value: -45deg;
        }

        .hero-liquid-wrap {
          --anim-hover-time: 400ms;
          --anim-hover-ease: cubic-bezier(0.25, 1, 0.5, 1);
          position: relative;
          z-index: 2;
          display: inline-flex;
          border-radius: 999vw;
          background: transparent;
          pointer-events: none;
          transition: transform var(--anim-hover-time) var(--anim-hover-ease);
        }

        .hero-liquid-shadow {
          --shadow-cutoff-fix: 2em;
          position: absolute;
          left: calc(0% - var(--shadow-cutoff-fix) / 2);
          top: calc(0% - var(--shadow-cutoff-fix) / 2);
          width: calc(100% + var(--shadow-cutoff-fix));
          height: calc(100% + var(--shadow-cutoff-fix));
          filter: blur(8px);
          overflow: visible;
          pointer-events: none;
        }

        .hero-liquid-shadow::after {
          content: "";
          position: absolute;
          inset: 0;
          left: calc(var(--shadow-cutoff-fix) - 0.875em);
          top: calc(var(--shadow-cutoff-fix) - 0.5em);
          width: calc(100% - var(--shadow-cutoff-fix) - 0.25em);
          height: calc(100% - var(--shadow-cutoff-fix) - 0.25em);
          box-sizing: border-box;
          border-radius: 999vw;
          padding: 0.125em;
          background: linear-gradient(180deg, rgba(7, 24, 8, 0.34), rgba(7, 24, 8, 0.12));
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          opacity: 0.9;
          transition: all var(--anim-hover-time) var(--anim-hover-ease);
        }

        .hero-liquid-button {
          --border-width: 1px;
          all: unset;
          position: relative;
          z-index: 3;
          display: inline-flex;
          min-width: 14.5rem;
          height: 52px;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          overflow: hidden;
          border-radius: 999vw;
          background:
            linear-gradient(
              -75deg,
              rgba(24, 62, 25, 0.22),
              rgba(118, 176, 88, 0.28),
              rgba(9, 34, 17, 0.3)
            );
          box-shadow:
            inset 0 0.125em 0.125em rgba(0, 0, 0, 0.16),
            inset 0 -0.125em 0.125em rgba(235, 255, 216, 0.3),
            0 0.25em 0.125em -0.125em rgba(0, 0, 0, 0.34),
            0 0 0.1em 0.18em inset rgba(180, 235, 142, 0.18),
            0 14px 34px rgba(0, 0, 0, 0.2);
          -webkit-backdrop-filter: blur(4px) saturate(1.35);
          backdrop-filter: blur(4px) saturate(1.35);
          pointer-events: auto;
          transition: all var(--anim-hover-time) var(--anim-hover-ease);
        }

        .hero-liquid-button:hover {
          transform: scale(0.975);
          -webkit-backdrop-filter: blur(0.5px) saturate(1.45);
          backdrop-filter: blur(0.5px) saturate(1.45);
          box-shadow:
            inset 0 0.125em 0.125em rgba(0, 0, 0, 0.16),
            inset 0 -0.125em 0.125em rgba(235, 255, 216, 0.48),
            0 0.15em 0.05em -0.1em rgba(0, 0, 0, 0.36),
            0 0 0.05em 0.12em inset rgba(204, 255, 172, 0.3),
            0 12px 30px rgba(0, 0, 0, 0.18);
        }

        .hero-liquid-button::before {
          content: "";
          position: absolute;
          z-index: 1;
          inset: 0;
          border-radius: 999vw;
          background:
            linear-gradient(
              var(--hero-liquid-angle-2),
              rgba(255, 255, 255, 0) 0%,
              rgba(236, 255, 212, 0.34) 40% 50%,
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

        .hero-liquid-button:hover::before {
          background-position: 25% 50%;
        }

        .hero-liquid-button::after {
          content: "";
          position: absolute;
          z-index: 2;
          inset: calc(var(--border-width) / -2);
          border-radius: 999vw;
          padding: var(--border-width);
          box-sizing: border-box;
          background:
            conic-gradient(
              from var(--hero-liquid-angle-1) at 50% 50%,
              rgba(5, 39, 11, 0.76),
              rgba(22, 74, 20, 0) 5% 40%,
              rgba(214, 255, 178, 0.5) 50%,
              rgba(22, 74, 20, 0) 60% 95%,
              rgba(5, 39, 11, 0.76)
            ),
            linear-gradient(180deg, rgba(222, 255, 194, 0.34), rgba(40, 100, 34, 0.32));
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          pointer-events: none;
          transition:
            all var(--anim-hover-time) var(--anim-hover-ease),
            --hero-liquid-angle-1 500ms ease;
        }

        .hero-liquid-button:hover::after {
          --hero-liquid-angle-1: -125deg;
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
          color: rgba(239, 255, 225, 0.94);
          text-shadow: 0 0.25em 0.08em rgba(0, 0, 0, 0.16);
          text-transform: uppercase;
          user-select: none;
          transition: all var(--anim-hover-time) var(--anim-hover-ease);
        }

        .hero-liquid-wrap:has(.hero-liquid-button:hover) .hero-liquid-shadow {
          filter: blur(4px);
        }

        .hero-liquid-wrap:has(.hero-liquid-button:hover) .hero-liquid-shadow::after {
          top: calc(var(--shadow-cutoff-fix) - 0.875em);
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
          backdrop-filter: blur(4px) saturate(1.35);
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

      {/* <div className="pointer-events-none absolute inset-0 z-[6] bg-[radial-gradient(ellipse_at_74%_36%,transparent_0%,transparent_32%,rgba(5,20,14,0.34)_72%,rgba(2,10,7,0.68)_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-[7] bg-[linear-gradient(90deg,rgba(4,18,13,0.78)_0%,rgba(7,24,17,0.54)_25%,rgba(8,20,14,0.12)_48%,transparent_72%),linear-gradient(180deg,rgba(4,12,9,0.26)_0%,transparent_34%,rgba(2,8,5,0.68)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-[42%] bg-[linear-gradient(180deg,transparent_0%,rgba(3,12,8,0.42)_48%,rgba(1,6,4,0.88)_100%)]" /> */}

      <div className="absolute left-6 top-6 z-20 opacity-0 sm:left-10 sm:top-9 lg:left-16 lg:top-12">
        <Link
          href="/"
          aria-label="Trifecta Veranza home"
          className="block w-[88px] opacity-85 drop-shadow-[0_10px_30px_rgba(0,0,0,0.34)] transition-opacity hover:opacity-100 sm:w-[112px] lg:w-[132px]"
        >
          <Image
            src={heroLogoSrc ?? EMPTY_IMAGE_DATA_URL}
            width={160}
            height={120}
            alt="Trifecta Veranza"
            unoptimized
            priority
          />
        </Link>
      </div>

      <div className="absolute inset-0 z-10 flex items-center px-6 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-28 sm:px-10 sm:pt-32 lg:px-16 xl:px-20">
        <motion.div
          variants={contentWrap}
          initial="hidden"
          animate={
            playIntroAnimation ? "show" : "hidden"
          }
          className="w-full max-w-[min(92vw,46rem)] text-left"
        >
          <motion.div variants={contentItem}>
            <h1
              className={`${heroSerif.className} text-[clamp(2.35rem,4.25vw,4.9rem)] font-normal uppercase leading-[0.98] tracking-[0.05em] text-[#f4f1e8] drop-shadow-[0_18px_46px_rgba(0,0,0,0.46)]`}
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
            className="mt-4 flex w-full max-w-[min(100%,38rem)] items-center text-[#adc087]/82"
          >
            <span className="h-px w-12 bg-[#adc087]/68" />
            <span className="mx-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#dff2b8]/20 bg-white/[0.06] backdrop-blur-md">
              <Leaf className="h-4 w-4" strokeWidth={1.4} />
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#adc087]/58 via-[#adc087]/32 to-transparent" />
          </motion.div>

          <motion.p
            variants={contentItem}
            className="mt-4 max-w-[25rem] text-[0.95rem] leading-7 tracking-[0.035em] text-[#eef2e7]/76 sm:text-base"
          >
            A quiet address shaped by open sky, layered green, and everyday calm.
          </motion.p>

          <motion.div variants={contentItem} className="mt-7">
            <div className="hero-liquid-wrap">
              <button
                className="hero-liquid-button"
                onClick={goToProjectOverview}
                type="button"
              >
                <span className="hero-liquid-text">
                  Go To Project
                  <BsArrowRight className="text-[1.05rem]" aria-hidden />
                </span>
              </button>
              <span className="hero-liquid-shadow" aria-hidden />
            </div>
          </motion.div>
        </motion.div>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 flex justify-center px-4 sm:bottom-[calc(env(safe-area-inset-bottom)+1.35rem)]"
      >
        <TooltipProvider delay={120}>
          <Dock
            direction="middle"
            iconSize={38}
            iconMagnification={58}
            iconDistance={130}
            className="hero-bottom-dock m-0 h-[52px] gap-1.5 rounded-full px-1.5 py-1.5"
          >
            {bottomDockItems.slice(0, 2).map(({ href, icon: Icon, label }) => (
              <DockIcon key={label}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                    <Link
                      href={href}
                      aria-label={label}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "hero-bottom-dock-link size-10 rounded-full hover:bg-transparent",
                      )}
                    >
                      <Icon className="hero-bottom-dock-icon" aria-hidden />
                    </Link>
                    }
                  />
                  <TooltipContent
                    side="top"
                    className="rounded-full border border-[#d6ffbe]/15 bg-[#05160c]/80 px-3 py-1.5 text-[10px] font-semibold tracking-[0.08em] text-[#f0ffe6] shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-md"
                  >
                    <p>{label}</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            ))}
            <Separator
              orientation="vertical"
              className="h-7 bg-gradient-to-b from-transparent via-[#d5ffbc]/22 to-transparent"
            />
            {bottomDockItems.slice(2).map(({ href, icon: Icon, label }) => (
              <DockIcon key={label}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                    <Link
                      href={href}
                      aria-label={label}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "hero-bottom-dock-link size-10 rounded-full hover:bg-transparent",
                      )}
                    >
                      <Icon className="hero-bottom-dock-icon" aria-hidden />
                    </Link>
                    }
                  />
                  <TooltipContent
                    side="top"
                    className="rounded-full border border-[#d6ffbe]/15 bg-[#05160c]/80 px-3 py-1.5 text-[10px] font-semibold tracking-[0.08em] text-[#f0ffe6] shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-md"
                  >
                    <p>{label}</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            ))}
          </Dock>
        </TooltipProvider>
      </nav>

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
