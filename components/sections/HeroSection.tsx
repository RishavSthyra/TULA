"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const HERO_LOOP_RESTART_BEFORE_END_SECONDS = 0.5;
const HERO_LOOP_RESTART_AT_SECONDS = 0.04;
const HERO_PLAY_RETRY_MS = 450;
const STATIC_HERO_IMAGE_HOLD_MS = 2000;

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

  const line1 = "Open to Sky,";
  const line2 = "Rooted in Green";
  const heroPosterImage =
    useStaticHeroIntro && staticHeroImageSrc
      ? staticHeroImageSrc
      : heroPosterSrc ?? staticHeroImageSrc ?? EMPTY_IMAGE_DATA_URL;

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.035,
        delayChildren: 0.2,
      },
    },
  };

  const letter: Variants = {
    hidden: {
      y: 40,
      opacity: 0,
    },
    show: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  };

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
      y: 24,
      filter: "blur(10px)",
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
        duration: 0.55,
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
    useStaticHeroIntro,
    videoReady,
  ]);

  useEffect(() => {
    if (
      !useStaticHeroIntro ||
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
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${
          isHeroVideoPlaying || isEntryVideoVisible || isHeroLoopVideoVisible
            ? "opacity-0"
            : "opacity-100"
        }`}
        style={{ backgroundImage: `url('${heroPosterImage}')` }}
      />

      {!useStaticHeroIntro ? (
        <video
          ref={heroVideoRef}
          className={`hero-section-video pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            isHeroVideoPlaying && !isEntryVideoVisible && !isHeroLoopVideoVisible
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
        className={`hero-section-video pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          isHeroLoopVideoVisible && !isEntryVideoVisible
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
      `}</style>

      {/* Bottom mask for aesthetic look */}
      <div className="absolute inset-0 z-7 pointer-events-none bg-linear-to-t from-black/80 via-black/20 to-transparent" />

      <div className="hidden absolute left-0 right-0 top-0 z-20 lg:flex items-center justify-between px-6 py-5 md:px-10">
        <button className="text-xs uppercase tracking-[0.25em] text-white/80">
          <Link href={"/"}>
            <Image
              src={heroLogoSrc ?? EMPTY_IMAGE_DATA_URL}
              width={140}
              height={100}
              alt="Trifecta Logo"
              unoptimized
            />
          </Link>
        </button>
        <Link href={"/admin/login"}>
       
        <button className="text-xs uppercase cursor-pointer tracking-[0.25em] text-white/80">
          Login
        </button>
         </Link>
      </div>

      <div className="absolute inset-0 z-10 flex items-end justify-end px-5 pb-[calc(env(safe-area-inset-bottom)+8.5rem)] sm:px-8 sm:pb-[calc(env(safe-area-inset-bottom)+6.5rem)] lg:pb-16 xl:px-16 xl:pb-24">
        <motion.div
          variants={contentWrap}
          initial="hidden"
          animate={
            playIntroAnimation ? "show" : "hidden"
          }
          className="max-w-2xl text-right"
        >
          <motion.p
            variants={contentItem}
            className="mb-6 text-[11px] uppercase tracking-[0.4em] text-white/70 md:mb-7 md:text-xs"
          >
            Trifecta Veranza
          </motion.p>

          <motion.div variants={contentItem}>
            <motion.h1
              variants={container}
              initial="hidden"
              animate={playIntroAnimation ? "show" : "hidden"}
              className="text-[2.15rem] font-light uppercase tracking-[0.01em] sm:text-[3.2rem] md:text-[4.1rem] md:leading-[0.94] lg:text-[4.85rem] xl:text-7xl"
            >
              <div className="flex flex-wrap justify-end overflow-hidden">
              {line1.split("").map((char, i) => (
                <motion.span
                  key={`l1-${i}`}
                  variants={letter}
                  className="inline-block"
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
              </div>

              <div className="mt-2 flex flex-wrap justify-end overflow-hidden sm:mt-3">
              {line2.split("").map((char, i) => (
                <motion.span
                  key={`l2-${i}`}
                  variants={letter}
                  className="inline-block"
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
              </div>
            </motion.h1>
          </motion.div>

          <motion.p
            variants={contentItem}
            className="mt-6 max-w-[24rem] text-sm text-white/80 sm:max-w-[30rem] md:max-w-[36rem] md:text-[15px] lg:max-w-[40rem] lg:text-base"
          >
            Expansive skyrise residences set across 6+ acres with 2 iconic
            towers, rising G+36 floors and offering 444 exclusive homes designed
            for elevated living.
          </motion.p>

          <motion.div
            variants={contentItem}
            className="mt-8 flex flex-col items-end gap-4 md:flex-row md:justify-end"
          >
            <button
              onClick={goToProjectOverview}
              className="cursor-pointer border border-white/40 bg-white/10 px-7 py-3 text-xs uppercase tracking-[0.25em] backdrop-blur-sm transition hover:bg-white hover:text-black"
            >
              Explore Project
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
