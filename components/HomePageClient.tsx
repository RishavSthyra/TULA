"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HeroSection from "@/components/sections/HeroSection";
import CinematicIntro from "@/components/ui/CinematicIntro";
import { scheduleAmenityVideoWarmup } from "@/lib/amenity-video-warmup";
import {
  getMasterPlanFrameCdnUrl,
  getMasterPlanFramePreloadSequence,
  MASTER_PLAN_SCRUB_HQ_VIDEO_PATH,
} from "@/data/masterPlanFrameCdnUrls";
import { primeSignedAssetUrls } from "@/src/lib/signed-assets";
import { useSignedAssetUrls } from "@/src/lib/use-signed-assets";

type IdleWindow = Window &
  typeof globalThis & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
  };

const HERO_VIDEO_URL = "videos/01_2.mp4";
const HERO_MOBILE_STATIC_IMAGE_URL = "images/01_lastframe.avif";
const HERO_LOOP_VIDEO_URL = "videos/02.mp4";
const HERO_VIDEO_RETRY_INTERVAL_MS = 850;
const ENTRY_VIDEO_URL = "videos/Tf Fixed Final_2.mp4";
const HERO_STAGE_FALLBACK_IMAGE_URL = "images/first_frame_again.png";
const HERO_POSTER_URL = "images/hero_first_frame.avif";
const HERO_LOGO_URL = "images/Logo_Trifect_Veranza A_new.png";
const TEMPORARY_HOME_HERO_IMAGE_URL =
  "/HomeImage First Draft.jpeg";

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

function shouldUseMobileHeroVideo() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(max-width: 1279px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export default function HomePageClient({
  initialSignedAssetUrls = {},
}: {
  initialSignedAssetUrls?: Record<string, string>;
}) {
  primeSignedAssetUrls(initialSignedAssetUrls);
  const loaderStartedAtRef = useRef(0);
  const heroReadyRef = useRef(false);
  const heroObjectUrlRef = useRef<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [heroVideoSrc, setHeroVideoSrc] = useState<string | null>(null);
  const [useStaticHeroIntro, setUseStaticHeroIntro] = useState(() =>
    typeof window !== "undefined" ? shouldUseMobileHeroVideo() : false,
  );
  const signedAssetUrls = useSignedAssetUrls([
    ENTRY_VIDEO_URL,
    HERO_LOOP_VIDEO_URL,
    HERO_MOBILE_STATIC_IMAGE_URL,
    HERO_STAGE_FALLBACK_IMAGE_URL,
    HERO_VIDEO_URL,
    MASTER_PLAN_SCRUB_HQ_VIDEO_PATH,
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
    signedAssetUrls[MASTER_PLAN_SCRUB_HQ_VIDEO_PATH] ??
    initialSignedAssetUrls[MASTER_PLAN_SCRUB_HQ_VIDEO_PATH] ??
    null;
  const signedHeroPosterUrl =
    initialSignedAssetUrls[HERO_POSTER_URL] ?? null;
  const signedHeroLogoUrl =
    initialSignedAssetUrls[HERO_LOGO_URL] ?? null;

  useEffect(() => {
    loaderStartedAtRef.current =
      typeof window !== "undefined" ? window.performance.now() : Date.now();
  }, []);

  useEffect(() => {
    heroReadyRef.current = heroReady;
  }, [heroReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactViewportMedia = window.matchMedia("(max-width: 1279px)");
    const coarsePointerMedia = window.matchMedia("(pointer: coarse)");
    const syncStaticHeroIntro = () => {
      setUseStaticHeroIntro(
        compactViewportMedia.matches || coarsePointerMedia.matches,
      );
    };

    syncStaticHeroIntro();
    compactViewportMedia.addEventListener("change", syncStaticHeroIntro);
    coarsePointerMedia.addEventListener("change", syncStaticHeroIntro);

    return () => {
      compactViewportMedia.removeEventListener("change", syncStaticHeroIntro);
      coarsePointerMedia.removeEventListener("change", syncStaticHeroIntro);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (heroObjectUrlRef.current) {
        URL.revokeObjectURL(heroObjectUrlRef.current);
        heroObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!heroReady) {
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
  }, [heroReady]);

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
      if (heroReadyRef.current) {
        return 100;
      }

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

  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true);
  }, []);

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
    let currentHeroWarmVideo: HTMLVideoElement | null = null;
    const heroWarmVideoCleanups: Array<() => void> = [];
    let disposed = false;

    const updateLoaderProgress = (nextProgress: number) => {
      setProgress((currentProgress) => {
        if (heroReadyRef.current) {
          return 100;
        }

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
    ) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = as;
      link.href = href;

      if (crossOrigin) {
        link.crossOrigin = crossOrigin;
      }

      document.head.appendChild(link);
      createdLinks.push(link);
    };

    const appendPreloadLinksPaced = (
      links: Array<{
        href: string;
        as: "fetch" | "image" | "video";
        crossOrigin?: "anonymous";
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
        appendPreloadLink(link.href, link.as, link.crossOrigin);
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

    const initialHeroVideoSource = useStaticHeroIntro
      ? null
      : signedHeroVideoUrl;

    appendPreloadLinksPaced(
      [
      {
        href: useStaticHeroIntro
          ? signedHeroMobileStaticImageUrl
          : signedHeroStageFallbackImageUrl,
        as: "image",
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
        ? [{
        href: signedMasterPlanScrubVideoUrl,
        as: "video",
      }]
        : []),
      { href: "/models/forglb.glb", as: "fetch" },
      { href: "/models/forglb%20-%20Copy.glb", as: "fetch" },
    ].filter((link): link is {
        href: string;
        as: "fetch" | "image" | "video";
        crossOrigin?: "anonymous";
      } => Boolean(link.href)),
    );

    if (signedEntryVideoUrl) {
      warmVideoSource(signedEntryVideoUrl);
    }
    if (signedHeroLoopVideoUrl) {
      warmVideoSource(signedHeroLoopVideoUrl);
    }
    if (signedMasterPlanScrubVideoUrl) {
      warmVideoSource(signedMasterPlanScrubVideoUrl);
    }

    const warmHeroVideoFromMediaElement = initialHeroVideoSource
      ? warmVideoSource(initialHeroVideoSource)
      : null;
    currentHeroWarmVideo = warmHeroVideoFromMediaElement;

    const reportHeroProgressFromMediaElement = () => {
      const warmVideo = currentHeroWarmVideo;

      if (!warmVideo) {
        return;
      }

      updateLoaderProgress(getVideoLoadProgress(warmVideo) * 100);
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
        video.removeEventListener("loadedmetadata", handleHeroWarmMediaProgress);
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
    signedHeroStageFallbackImageUrl,
    signedHeroVideoUrl,
    signedMasterPlanScrubVideoUrl,
    useStaticHeroIntro,
  ]);

  return (
    <>
      {!introComplete ? (
        <CinematicIntro
          progress={heroReady ? 100 : progress}
          readyToComplete={!loading}
          onComplete={handleIntroComplete}
        />
      ) : null}
      <main
        aria-hidden={loading || !introComplete}
        className={`app-screen overflow-hidden bg-neutral-950 text-white transition-opacity duration-300 ${
          loading ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <HeroSection
          heroLogoSrc={signedHeroLogoUrl}
          heroPosterSrc={signedHeroPosterUrl}
          masterPlanScrubVideoSrc={signedMasterPlanScrubVideoUrl}
          heroVideoSrc={heroVideoSrc}
          heroLoopVideoSrc={signedHeroLoopVideoUrl}
          staticHeroImageSrc={signedHeroMobileStaticImageUrl}
          temporaryStaticHeroImageSrc={TEMPORARY_HOME_HERO_IMAGE_URL}
          useStaticHeroIntro={useStaticHeroIntro}
          playIntroAnimation={!loading}
          onHeroReadyChange={setHeroReady}
          onHeroVideoProgressChange={handleHeroVideoProgressChange}
        />
      </main>
    </>
  );
}
