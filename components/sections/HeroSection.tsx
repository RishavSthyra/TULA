"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BsArrowRight } from "react-icons/bs";
import {
  CalendarDays,
  Leaf,
  SunMedium,
} from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import DesktopSiteRail from "@/components/DesktopSiteRail";
import { TRIFECTA_LEAD_OPEN_EVENT } from "@/lib/trifecta-remote-control";

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
const PROJECT_LATITUDE = 13.153818578384746;
const PROJECT_LONGITUDE = 77.63036955360322;
const PROJECT_WEATHER_API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${PROJECT_LATITUDE}&longitude=${PROJECT_LONGITUDE}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`;
const PROJECT_AIR_QUALITY_API_URL = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${PROJECT_LATITUDE}&longitude=${PROJECT_LONGITUDE}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi`;

type IdleCapableWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

type OpenMeteoWeatherResponse = {
  current?: {
    temperature_2m?: number;
  };
};

type OpenMeteoAirQualityResponse = {
  current?: {
    us_aqi?: number;
  };
};

function formatViewerLocalTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

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
  const [viewerLocalTime, setViewerLocalTime] = useState("--:--");
  const [projectTemperature, setProjectTemperature] = useState("--°C");
  const [projectAqi, setProjectAqi] = useState("AQI --");
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

  const openBookVisit = useCallback(() => {
    window.dispatchEvent(new CustomEvent(TRIFECTA_LEAD_OPEN_EVENT));
  }, []);

  useEffect(() => {
    const syncViewerTime = () => {
      setViewerLocalTime(formatViewerLocalTime(new Date()));
    };

    syncViewerTime();
    const intervalId = window.setInterval(syncViewerTime, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const fetchProjectConditions = async () => {
      try {
        const [weatherResponse, airQualityResponse] = await Promise.all([
          fetch(PROJECT_WEATHER_API_URL),
          fetch(PROJECT_AIR_QUALITY_API_URL),
        ]);

        if (!weatherResponse.ok || !airQualityResponse.ok) {
          throw new Error("Unable to load project conditions.");
        }

        const weatherData =
          (await weatherResponse.json()) as OpenMeteoWeatherResponse;
        const airQualityData =
          (await airQualityResponse.json()) as OpenMeteoAirQualityResponse;

        if (isCancelled) {
          return;
        }

        const temperatureValue = weatherData.current?.temperature_2m;
        const aqiValue = airQualityData.current?.us_aqi;

        setProjectTemperature(
          typeof temperatureValue === "number"
            ? `${Math.round(temperatureValue)}°C`
            : "--°C",
        );
        setProjectAqi(
          typeof aqiValue === "number" ? `AQI ${Math.round(aqiValue)}` : "AQI --",
        );
      } catch (error) {
        console.error("Failed to fetch project conditions:", error);

        if (!isCancelled) {
          setProjectTemperature("--°C");
          setProjectAqi("AQI --");
        }
      }
    };

    fetchProjectConditions();
    const intervalId = window.setInterval(fetchProjectConditions, 15 * 60_000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

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
          background: linear-gradient(180deg, rgba(38, 69, 42, 0.38), rgba(20, 39, 24, 0.14));
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
              135deg,
              rgba(55, 87, 50, 0.96),
              rgba(35, 61, 40, 0.98),
              rgba(22, 41, 29, 0.98)
            );
          box-shadow:
            inset 0 0.125em 0.125em rgba(0, 0, 0, 0.16),
            inset 0 -0.125em 0.125em rgba(255, 247, 222, 0.16),
            0 0.25em 0.125em -0.125em rgba(0, 0, 0, 0.34),
            0 0 0.1em 0.18em inset rgba(215, 187, 112, 0.18),
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
            inset 0 -0.125em 0.125em rgba(255, 247, 222, 0.28),
            0 0.15em 0.05em -0.1em rgba(0, 0, 0, 0.36),
            0 0 0.05em 0.12em inset rgba(237, 214, 152, 0.26),
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
              rgba(255, 239, 198, 0.22) 40% 50%,
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
              rgba(95, 76, 28, 0.9),
              rgba(203, 170, 93, 0) 5% 40%,
              rgba(242, 220, 164, 0.62) 50%,
              rgba(203, 170, 93, 0) 60% 95%,
              rgba(95, 76, 28, 0.9)
            ),
            linear-gradient(180deg, rgba(241, 221, 173, 0.52), rgba(108, 88, 43, 0.34));
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
          color: rgba(247, 239, 219, 0.96);
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

      <div className="pointer-events-none absolute inset-0 z-[6] bg-[radial-gradient(ellipse_at_18%_14%,rgba(255,248,230,0.26),transparent_28%),linear-gradient(180deg,rgba(6,17,8,0.08)_0%,rgba(8,18,10,0.12)_38%,rgba(7,15,9,0.38)_100%)]" />

      <DesktopSiteRail className="absolute left-5 top-1/2 z-20 -translate-y-1/2 2xl:left-7" />

      <div className="absolute inset-x-4 top-5 z-20 flex flex-col items-center gap-2.5 sm:hidden">
        <div className="flex w-full max-w-[20rem] items-center justify-center rounded-full border border-[#dfcfaa]/70 bg-[linear-gradient(180deg,rgba(251,249,241,0.96),rgba(241,237,226,0.92))] px-3 py-1.5 text-[#4d5f4d] shadow-[0_12px_28px_rgba(30,46,30,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <SunMedium className="h-[0.85rem] w-[0.85rem] text-[#b29349]" strokeWidth={1.8} />
            <span className="text-[0.76rem] font-medium">{viewerLocalTime}</span>
          </div>
          <span className="mx-3 h-6 w-px bg-[#dbcba7]" />
          <div className="text-[0.76rem] font-semibold">{projectTemperature}</div>
          <span className="mx-3 h-6 w-px bg-[#dbcba7]" />
          <div className="min-w-0 text-[0.76rem] font-semibold text-[#415541]">
            {projectAqi}
          </div>
        </div>

        <button
          type="button"
          onClick={openBookVisit}
          className="group relative inline-flex w-full max-w-[15.5rem] items-center justify-center gap-2 overflow-hidden rounded-full px-[1px] py-[1px] shadow-[0_16px_34px_rgba(23,43,24,0.18)]"
        >
          <span className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f1e0ac_0%,#b68f43_44%,#f0ddb2_100%)]" />
          <span className="relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#3f5d38_0%,#24422b_52%,#183224_100%)] px-4 py-2.5 text-[0.82rem] font-semibold text-[#f7f1de]">
            <CalendarDays className="h-4 w-4 text-[#e3c57c]" strokeWidth={1.9} />
            Book a Visit
          </span>
        </button>
      </div>

      <div className="absolute left-1/2 top-8 z-20 hidden -translate-x-1/2 sm:block">
        <div className="flex items-center rounded-full border border-[#dfcfaa]/70 bg-[linear-gradient(180deg,rgba(251,249,241,0.96),rgba(241,237,226,0.92))] px-4 py-2 text-[#4d5f4d] shadow-[0_12px_28px_rgba(30,46,30,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <SunMedium className="h-4 w-4 text-[#b29349]" strokeWidth={1.8} />
            <span className="text-[0.88rem] font-medium">{viewerLocalTime}</span>
          </div>
          <span className="mx-4 h-7 w-px bg-[#dbcba7]" />
          <div className="text-[0.88rem] font-semibold">{projectTemperature}</div>
          <span className="mx-4 h-7 w-px bg-[#dbcba7]" />
          <div className="text-[0.88rem] font-semibold text-[#415541]">
            {projectAqi}
          </div>
        </div>
      </div>

      <div className="absolute right-8 top-8 z-20 hidden sm:block lg:right-12 xl:right-12 2xl:right-16">
        <button
          type="button"
          onClick={openBookVisit}
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-[1px] py-[1px] shadow-[0_16px_34px_rgba(23,43,24,0.18)]"
        >
          <span className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f1e0ac_0%,#b68f43_44%,#f0ddb2_100%)]" />
          <span className="relative inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#3f5d38_0%,#24422b_52%,#183224_100%)] px-5 py-2.5 text-[0.92rem] font-semibold text-[#f7f1de]">
            <CalendarDays className="h-4 w-4 text-[#e3c57c]" strokeWidth={1.9} />
            Book a Visit
          </span>
        </button>
      </div>

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
            className="mt-4 ml-auto flex w-full max-w-[min(100%,32rem)] items-center text-[#d9c28a]/82"
          >
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d9c28a]/32 to-[#d9c28a]/58" />
            <span className="mx-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#dff2b8]/20 bg-white/[0.06] backdrop-blur-md">
              <Leaf className="h-4 w-4" strokeWidth={1.4} />
            </span>
            <span className="h-px w-12 bg-[#d9c28a]/68" />
          </motion.div>

          <motion.p
            variants={contentItem}
            className="mt-4 ml-auto max-w-[26rem] text-[0.95rem] leading-7 tracking-[0.035em] text-[#eef2e7]/78 sm:text-base"
          >
            A quiet address shaped by open sky, layered green, and everyday calm.
          </motion.p>

          <motion.div variants={contentItem} className="mt-7">
            <div className="hero-liquid-wrap ml-auto">
              <button
                className="hero-liquid-button"
                onClick={goToProjectOverview}
                type="button"
              >
                <span className="hero-liquid-text">
                  Explore The Project
                  <BsArrowRight className="text-[1.05rem]" aria-hidden />
                </span>
              </button>
              <span className="hero-liquid-shadow" aria-hidden />
            </div>
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
