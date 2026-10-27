"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HeroSection from "@/components/sections/HeroSection";
import CinematicIntro from "@/components/ui/CinematicIntro";
import { scheduleAmenityVideoWarmup } from "@/lib/amenity-video-warmup";
import { preloadBrochureImageSet } from "@/lib/brochure-image-preload";
import {
  getMasterPlanFrameCdnUrl,
  getMasterPlanFramePreloadSequence,
} from "@/data/masterPlanFrameCdnUrls";
import { primeSignedAssetUrls } from "@/src/lib/signed-assets";
import { useSignedAssetUrls } from "@/src/lib/use-signed-assets";
import type { HomeDeveloperConfig } from "@/types/developer-config";
import {
  BROCHURE_PAGES,
  PROJECT_OVERVIEW_BACKGROUND_SRC,
} from "@/lib/brochure-pages";

type IdleWindow = Window &
  typeof globalThis & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
  };

const HERO_VIDEO_RETRY_INTERVAL_MS = 850;
const HERO_CRITICAL_PRELOAD_TIMEOUT_MS = 12_000;
const PROJECT_OVERVIEW_CRITICAL_IMAGES = [
  PROJECT_OVERVIEW_BACKGROUND_SRC,
  ...BROCHURE_PAGES.slice(0, 3).map((page) => page.src),
];

function getVideoLoadProgress(video: HTMLVideoElement) {
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

export default function HomePageClient({
  config,
  initialSignedAssetUrls = {},
}: {
  config: HomeDeveloperConfig;
  initialSignedAssetUrls?: Record<string, string>;
}) {
  const {
    entryVideoKey: ENTRY_VIDEO_URL,
    heroVideoKey: HERO_VIDEO_URL,
    heroLoopVideoKey: HERO_LOOP_VIDEO_URL,
    heroMobileFallbackKey: HERO_MOBILE_STATIC_IMAGE_URL,
    heroStageFallbackKey: HERO_STAGE_FALLBACK_IMAGE_URL,
    heroPosterKey: HERO_POSTER_URL,
    heroLogoKey: HERO_LOGO_URL,
    masterPlanWarmupVideoKey,
  } = config;
  primeSignedAssetUrls(initialSignedAssetUrls);
  const loaderStartedAtRef = useRef(0);
  const heroReadyRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [criticalHeroAssetsReady, setCriticalHeroAssetsReady] = useState(false);
  const [projectOverviewAssetsReady, setProjectOverviewAssetsReady] =
    useState(false);
  const [heroVideoSrc, setHeroVideoSrc] = useState<string | null>(null);
  const signedAssetUrls = useSignedAssetUrls([
    ENTRY_VIDEO_URL,
    HERO_LOOP_VIDEO_URL,
    HERO_MOBILE_STATIC_IMAGE_URL,
    HERO_STAGE_FALLBACK_IMAGE_URL,
    HERO_VIDEO_URL,
    masterPlanWarmupVideoKey,
  ]);
  const signedEntryVideoUrl =
    signedAssetUrls[ENTRY_VIDEO_URL] ??
    initialSignedAssetUrls[ENTRY_VIDEO_URL] ??
    null;
  const signedHeroLoopVideoUrl =
    signedAssetUrls[HERO_LOOP_VIDEO_URL] ??
    initialSignedAssetUrls[HERO_LOOP_VIDEO_URL] ??
    null;
  const signedHeroMobileStaticImageUrl =
    signedAssetUrls[HERO_MOBILE_STATIC_IMAGE_URL] ??
    initialSignedAssetUrls[HERO_MOBILE_STATIC_IMAGE_URL] ??
    null;
  const signedHeroStageFallbackImageUrl =
    signedAssetUrls[HERO_STAGE_FALLBACK_IMAGE_URL] ??
    initialSignedAssetUrls[HERO_STAGE_FALLBACK_IMAGE_URL] ??
    null;
  const signedHeroVideoUrl =
    signedAssetUrls[HERO_VIDEO_URL] ??
    initialSignedAssetUrls[HERO_VIDEO_URL] ??
    null;
  const signedMasterPlanScrubVideoUrl =
    signedAssetUrls[masterPlanWarmupVideoKey] ??
    initialSignedAssetUrls[masterPlanWarmupVideoKey] ??
    null;
  const signedHeroPosterUrl = initialSignedAssetUrls[HERO_POSTER_URL] ?? null;
  const signedHeroLogoUrl = initialSignedAssetUrls[HERO_LOGO_URL] ?? null;

  useEffect(() => {
    loaderStartedAtRef.current =
      typeof window !== "undefined" ? window.performance.now() : Date.now();
  }, []);

  useEffect(() => {
    heroReadyRef.current = heroReady;
  }, [heroReady]);

  useEffect(() => {
    if (!heroReady || !criticalHeroAssetsReady || !projectOverviewAssetsReady) {
      return;
    }

    const now =
      typeof window !== "undefined" ? window.performance.now() : Date.now();
    const elapsed = now - loaderStartedAtRef.current;
    const remainingVisibleMs = Math.max(0, 1450 - elapsed);
    const timer = window.setTimeout(() => {
      setLoading(false);
    }, remainingVisibleMs + 260);

    return () => {
      window.clearTimeout(timer);
    };
  }, [criticalHeroAssetsReady, heroReady, projectOverviewAssetsReady]);

  useEffect(() => {
    if (typeof window === "undefined" || !loading) {
      return;
    }

    let cancelled = false;

    void preloadBrochureImageSet(PROJECT_OVERVIEW_CRITICAL_IMAGES, {
      priorityUrls: PROJECT_OVERVIEW_CRITICAL_IMAGES,
      concurrency: 4,
      onProgress: (completed, total) => {
        if (cancelled || total === 0) {
          return;
        }

        setProgress((currentProgress) =>
          Math.max(
            currentProgress,
            Math.min(96, Math.round((completed / total) * 96)),
          ),
        );
      },
    }).then(() => {
      if (!cancelled) {
        setProjectOverviewAssetsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loading]);

  useEffect(() => {
    if (!heroReady || typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      scheduleAmenityVideoWarmup({ profile: "home" });
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [heroReady]);

  const handleHeroVideoProgressChange = useCallback((nextProgress: number) => {
    setProgress((currentProgress) => {
      const targetValue = Math.round(
        Math.max(currentProgress, Math.min(nextProgress * 100, 96)),
      );
      const dampedStep = Math.max(
        1,
        Math.round((targetValue - currentProgress) * 0.45),
      );

      return Math.min(targetValue, currentProgress + dampedStep);
    });
  }, []);

  const handleIntroComplete = useCallback(
    (reason: "played" | "already-seen") => {
      if (reason === "already-seen") {
        setHeroVideoSrc(signedHeroVideoUrl ?? HERO_VIDEO_URL);
        setProgress(100);
        setLoading(false);
      }

      setIntroComplete(true);
    },
    [HERO_VIDEO_URL, signedHeroVideoUrl],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !loading) {
      return;
    }

    const idleWindow = window as IdleWindow;
    const createdLinks: HTMLLinkElement[] = [];
    const warmVideos: HTMLVideoElement[] = [];
    const abortController = new AbortController();
    let heroProgressAnimationFrame: number | null = null;
    let heroProgressInterval: number | null = null;
    let preloadAnimationFrame: number | null = null;
    let heroPlayRetryInterval: number | null = null;
    let criticalPreloadTimeout: number | null = null;
    let currentHeroWarmVideo: HTMLVideoElement | null = null;
    const heroWarmVideoCleanups: Array<() => void> = [];
    let disposed = false;

    const updateLoaderProgress = (nextProgress: number) => {
      setProgress((currentProgress) => {
        const targetValue = Math.round(
          Math.max(currentProgress, Math.min(nextProgress, 96)),
        );
        const dampedStep = Math.max(
          1,
          Math.round((targetValue - currentProgress) * 0.45),
        );

        return Math.min(targetValue, currentProgress + dampedStep);
      });
    };

    const appendPreloadLink = (
      href: string,
      as: "fetch" | "image" | "video",
      crossOrigin?: "anonymous",
      fetchPriority?: "high" | "low" | "auto",
    ) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = as;
      link.href = href;

      if (crossOrigin) {
        link.crossOrigin = crossOrigin;
      }
      if (fetchPriority) {
        link.fetchPriority = fetchPriority;
      }

      document.head.appendChild(link);
      createdLinks.push(link);
    };

    const appendPreloadLinksPaced = (
      links: Array<{
        href: string;
        as: "fetch" | "image" | "video";
        crossOrigin?: "anonymous";
        fetchPriority?: "high" | "low" | "auto";
      }>,
    ) => {
      let index = 0;

      const appendNext = () => {
        if (disposed || index >= links.length) {
          preloadAnimationFrame = null;
          return;
        }

        const link = links[index];
        index += 1;
        appendPreloadLink(
          link.href,
          link.as,
          link.crossOrigin,
          link.fetchPriority,
        );
        preloadAnimationFrame = window.requestAnimationFrame(appendNext);
      };

      preloadAnimationFrame = window.requestAnimationFrame(appendNext);
    };

    const warmVideoSource = (src: string) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.src = src;
      video.load();
      warmVideos.push(video);
      return video;
    };

    const initialHeroVideoSource = signedHeroVideoUrl;
    const criticalPosterSource =
      signedHeroPosterUrl ??
      signedHeroStageFallbackImageUrl ??
      signedHeroMobileStaticImageUrl;

    appendPreloadLinksPaced(
      [
        ...PROJECT_OVERVIEW_CRITICAL_IMAGES.map((href) => ({
          href,
          as: "image" as const,
          fetchPriority: "high" as const,
        })),
        {
          href: criticalPosterSource,
          as: "image",
          fetchPriority: "high",
        },
        ...(initialHeroVideoSource
          ? [{ href: initialHeroVideoSource, as: "video" as const }]
          : []),
        ...(signedHeroLoopVideoUrl
          ? [{ href: signedHeroLoopVideoUrl, as: "video" as const }]
          : []),
        ...(signedEntryVideoUrl
          ? [{ href: signedEntryVideoUrl, as: "video" as const }]
          : []),
        ...(signedMasterPlanScrubVideoUrl
          ? [
              {
                href: signedMasterPlanScrubVideoUrl,
                as: "video" as const,
              },
            ]
          : []),
        { href: "/models/forglb.glb", as: "fetch" },
        { href: "/models/forglb%20-%20Copy.glb", as: "fetch" },
      ].filter(
        (
          link,
        ): link is {
          href: string;
          as: "fetch" | "image" | "video";
          crossOrigin?: "anonymous";
          fetchPriority?: "high" | "low" | "auto";
        } => Boolean(link.href),
      ),
    );

    const criticalVideoStates = new Map<
      HTMLVideoElement,
      { progress: number; settled: boolean }
    >();
    let criticalTrackingInitialized = false;
    let posterProgress = criticalPosterSource ? 0 : 1;
    let posterSettled = !criticalPosterSource;

    const reportCriticalPreloadState = () => {
      const videoStates = [...criticalVideoStates.values()];
      const totalProgress =
        posterProgress +
        videoStates.reduce((sum, state) => sum + state.progress, 0);
      const itemCount = videoStates.length + 1;

      updateLoaderProgress((totalProgress / itemCount) * 100);

      if (
        criticalTrackingInitialized &&
        posterSettled &&
        videoStates.every((state) => state.settled) &&
        !disposed
      ) {
        if (criticalPreloadTimeout !== null) {
          window.clearTimeout(criticalPreloadTimeout);
          criticalPreloadTimeout = null;
        }
        setCriticalHeroAssetsReady(true);
      }
    };

    const trackCriticalVideo = (video: HTMLVideoElement) => {
      const state = {
        progress: getVideoLoadProgress(video),
        settled: video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA,
      };
      criticalVideoStates.set(video, state);

      const updateProgress = () => {
        state.progress = Math.max(state.progress, getVideoLoadProgress(video));
        reportCriticalPreloadState();
      };
      const settleVideo = () => {
        state.progress = 1;
        state.settled = true;
        reportCriticalPreloadState();
      };

      video.addEventListener("loadedmetadata", updateProgress);
      video.addEventListener("loadeddata", updateProgress);
      video.addEventListener("progress", updateProgress);
      video.addEventListener("canplay", settleVideo, { once: true });
      video.addEventListener("error", settleVideo, { once: true });

      heroWarmVideoCleanups.push(() => {
        video.removeEventListener("loadedmetadata", updateProgress);
        video.removeEventListener("loadeddata", updateProgress);
        video.removeEventListener("progress", updateProgress);
        video.removeEventListener("canplay", settleVideo);
        video.removeEventListener("error", settleVideo);
      });
    };

    if (criticalPosterSource) {
      const posterImage = new window.Image();
      posterImage.decoding = "async";
      posterImage.fetchPriority = "high";

      const settlePoster = () => {
        posterProgress = 1;
        posterSettled = true;
        reportCriticalPreloadState();
      };

      posterImage.onload = settlePoster;
      posterImage.onerror = settlePoster;
      posterImage.src = criticalPosterSource;
      void posterImage
        .decode()
        .then(settlePoster)
        .catch(() => undefined);

      heroWarmVideoCleanups.push(() => {
        posterImage.onload = null;
        posterImage.onerror = null;
      });
    }

    if (signedEntryVideoUrl) {
      warmVideoSource(signedEntryVideoUrl);
    }
    const warmReverseHeroVideo = signedHeroLoopVideoUrl
      ? warmVideoSource(signedHeroLoopVideoUrl)
      : null;
    if (signedMasterPlanScrubVideoUrl) {
      warmVideoSource(signedMasterPlanScrubVideoUrl);
    }

    const warmHeroVideoFromMediaElement = initialHeroVideoSource
      ? warmVideoSource(initialHeroVideoSource)
      : null;
    currentHeroWarmVideo = warmHeroVideoFromMediaElement;

    if (warmHeroVideoFromMediaElement) {
      trackCriticalVideo(warmHeroVideoFromMediaElement);
    }
    if (warmReverseHeroVideo) {
      trackCriticalVideo(warmReverseHeroVideo);
    }

    criticalTrackingInitialized = true;
    criticalPreloadTimeout = window.setTimeout(() => {
      if (!disposed) {
        updateLoaderProgress(96);
        setCriticalHeroAssetsReady(true);
      }
    }, HERO_CRITICAL_PRELOAD_TIMEOUT_MS);
    reportCriticalPreloadState();

    const reportHeroProgressFromMediaElement = () => {
      criticalVideoStates.forEach((state, video) => {
        state.progress = Math.max(state.progress, getVideoLoadProgress(video));
      });
      reportCriticalPreloadState();
    };

    const publishHeroVideoSource = () => {
      if (!disposed) {
        setHeroVideoSrc(initialHeroVideoSource);
      }
    };

    const tryPlayCurrentHeroVideo = () => {
      const warmVideo = currentHeroWarmVideo;

      if (!warmVideo || disposed || heroReadyRef.current) {
        return;
      }

      warmVideo.load();
      void warmVideo.play().catch(() => undefined);
    };

    const publishCurrentHeroVideoSource = () => {
      publishHeroVideoSource();
    };

    const handleHeroWarmMediaError = () => {
      publishHeroVideoSource();
    };

    const handleHeroWarmMediaProgress = () => {
      if (heroProgressAnimationFrame !== null) {
        return;
      }

      heroProgressAnimationFrame = window.requestAnimationFrame(() => {
        heroProgressAnimationFrame = null;
        reportHeroProgressFromMediaElement();
      });
    };

    function addWarmHeroVideoListeners(video: HTMLVideoElement) {
      video.addEventListener("loadedmetadata", handleHeroWarmMediaProgress);
      video.addEventListener("loadeddata", handleHeroWarmMediaProgress);
      video.addEventListener("canplay", publishCurrentHeroVideoSource, {
        once: true,
      });
      video.addEventListener("progress", handleHeroWarmMediaProgress);
      video.addEventListener("stalled", handleHeroWarmMediaProgress);
      video.addEventListener("suspend", handleHeroWarmMediaProgress);
      video.addEventListener("waiting", handleHeroWarmMediaProgress);
      video.addEventListener("error", handleHeroWarmMediaError, { once: true });

      heroWarmVideoCleanups.push(() => {
        video.removeEventListener(
          "loadedmetadata",
          handleHeroWarmMediaProgress,
        );
        video.removeEventListener("loadeddata", handleHeroWarmMediaProgress);
        video.removeEventListener("canplay", publishCurrentHeroVideoSource);
        video.removeEventListener("progress", handleHeroWarmMediaProgress);
        video.removeEventListener("stalled", handleHeroWarmMediaProgress);
        video.removeEventListener("suspend", handleHeroWarmMediaProgress);
        video.removeEventListener("waiting", handleHeroWarmMediaProgress);
        video.removeEventListener("error", handleHeroWarmMediaError);
      });
    }

    if (warmHeroVideoFromMediaElement) {
      addWarmHeroVideoListeners(warmHeroVideoFromMediaElement);

      heroProgressInterval = window.setInterval(() => {
        reportHeroProgressFromMediaElement();
      }, 250);

      tryPlayCurrentHeroVideo();
      publishHeroVideoSource();

      heroPlayRetryInterval = window.setInterval(
        tryPlayCurrentHeroVideo,
        HERO_VIDEO_RETRY_INTERVAL_MS,
      );
    } else {
      const frameId = window.requestAnimationFrame(() => {
        setHeroVideoSrc(null);
      });
      updateLoaderProgress(96);

      heroWarmVideoCleanups.push(() => {
        window.cancelAnimationFrame(frameId);
      });
    }

    const warmMasterPlanAssets = () => {
      const frameUrls = getMasterPlanFramePreloadSequence(1, 10).map((frame) =>
        getMasterPlanFrameCdnUrl(frame),
      );

      frameUrls.forEach((url) => {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
      });

      void fetch("/models/forglb.glb", {
        cache: "force-cache",
        signal: abortController.signal,
      }).catch(() => undefined);
      void fetch("/models/forglb%20-%20Copy.glb", {
        cache: "force-cache",
        signal: abortController.signal,
      }).catch(() => undefined);
    };

    let cleanupIdle: (() => void) | undefined;

    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleId = idleWindow.requestIdleCallback(warmMasterPlanAssets, {
        timeout: 900,
      });
      cleanupIdle = () => {
        idleWindow.cancelIdleCallback?.(idleId);
      };
    } else {
      const timerId = window.setTimeout(warmMasterPlanAssets, 300);
      cleanupIdle = () => {
        window.clearTimeout(timerId);
      };
    }

    return () => {
      disposed = true;
      abortController.abort();
      cleanupIdle?.();
      if (heroProgressAnimationFrame !== null) {
        window.cancelAnimationFrame(heroProgressAnimationFrame);
      }
      if (preloadAnimationFrame !== null) {
        window.cancelAnimationFrame(preloadAnimationFrame);
      }
      if (heroProgressInterval !== null) {
        window.clearInterval(heroProgressInterval);
      }
      if (heroPlayRetryInterval !== null) {
        window.clearInterval(heroPlayRetryInterval);
      }
      if (criticalPreloadTimeout !== null) {
        window.clearTimeout(criticalPreloadTimeout);
      }
      heroWarmVideoCleanups.forEach((cleanup) => cleanup());
      createdLinks.forEach((link) => link.remove());
      warmVideos.forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
    };
  }, [
    loading,
    signedEntryVideoUrl,
    signedHeroLoopVideoUrl,
    signedHeroMobileStaticImageUrl,
    signedHeroPosterUrl,
    signedHeroStageFallbackImageUrl,
    signedHeroVideoUrl,
    signedMasterPlanScrubVideoUrl,
  ]);

  return (
    <>
      {!introComplete ? (
        <CinematicIntro
          progress={
            heroReady && criticalHeroAssetsReady && projectOverviewAssetsReady
              ? 100
              : progress
          }
          readyToComplete={!loading}
          onComplete={handleIntroComplete}
        />
      ) : null}
      <main
        aria-hidden={!introComplete}
        className={`app-screen overflow-hidden bg-neutral-950 text-white transition-opacity duration-300 ${
          introComplete ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <HeroSection
          heroLogoSrc={signedHeroLogoUrl}
          heroPosterSrc={signedHeroPosterUrl}
          masterPlanScrubVideoSrc={signedMasterPlanScrubVideoUrl}
          heroVideoSrc={heroVideoSrc}
          heroLoopVideoSrc={signedHeroLoopVideoUrl}
          staticHeroImageSrc={signedHeroMobileStaticImageUrl}
          playIntroAnimation={!loading}
          onHeroReadyChange={setHeroReady}
          onHeroVideoProgressChange={handleHeroVideoProgressChange}
        />
      </main>
    </>
  );
}
