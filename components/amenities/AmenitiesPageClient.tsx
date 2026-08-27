"use client";

import {
  type ChangeEvent,
  type RefObject,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Map,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import CloudinaryHlsVideo from "@/components/CloudinaryHlsVideo";
import { isHlsAssetUrl } from "@/lib/amenities-final-assets";
import { scheduleAmenityVideoWarmup } from "@/lib/amenity-video-warmup";

const displaySerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const interfaceSans = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export type AmenityPageItem = {
  id: string;
  title: string;
  category: string;
  shortDescription: string;
  details: string;
  videoSrc?: string;
  thumbnailSrc?: string;
  tags?: string[];
  statLabel?: string;
  statValue?: string;
};

export type AmenitiesPageData = {
  eyebrow: string;
  title: string;
  description: string;
  summary?: string;
  items: AmenityPageItem[];
};

type AmenitiesPageClientProps = {
  data: AmenitiesPageData;
};

type OrientationLockValue =
  | "any"
  | "natural"
  | "landscape"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary"
  | "landscape-primary"
  | "landscape-secondary";

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: OrientationLockValue) => Promise<void>;
};

type CarouselItem = {
  amenity: AmenityPageItem;
  offset: number;
  dataIndex: number;
};

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: unknown) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const CAROUSEL_OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const;
const CAROUSEL_TRANSITION_MS = 580;
const DECK_AUTO_HIDE_MS = 2000;

function hasMediaSource(value?: string): value is string {
  return Boolean(value && value.trim().length > 0);
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function getFiniteMediaDuration(video: HTMLVideoElement) {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration;
  }

  if (video.seekable.length > 0) {
    const seekableEnd = video.seekable.end(video.seekable.length - 1);
    return Number.isFinite(seekableEnd) && seekableEnd > 0 ? seekableEnd : 0;
  }

  return 0;
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function AmenityThumbnail({
  amenity,
  priority = false,
}: {
  amenity: AmenityPageItem;
  priority?: boolean;
}) {
  if (!hasMediaSource(amenity.thumbnailSrc)) {
    return (
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_65%_26%,rgba(120,201,149,0.16),transparent_38%),linear-gradient(135deg,#111713,#030504)] text-2xl text-white/85"
      >
        {amenity.title.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={amenity.thumbnailSrc as string}
      alt={amenity.title}
      fill
      priority={priority}
      unoptimized
      sizes="(max-width: 767px) 150px, 190px"
      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
    />
  );
}

function FilmstripThumbnail({
  item,
  onSelect,
}: {
  item: CarouselItem;
  onSelect: (id: string) => void;
}) {
  const distance = Math.abs(item.offset);
  const isActive = item.offset === 0;

  const visibilityClass =
    distance === 3
      ? "hidden lg:block"
      : distance === 2
        ? "hidden md:block"
        : "block";

  const sizeClass = isActive
    ? "h-[96px] w-[168px] sm:h-[110px] sm:w-[196px] xl:h-[124px] xl:w-[222px]"
    : distance === 1
      ? "h-[62px] w-[90px] sm:h-[76px] sm:w-[114px] xl:h-[84px] xl:w-[124px]"
      : distance === 2
        ? "h-[72px] w-[108px] xl:h-[80px] xl:w-[118px]"
        : "h-[70px] w-[104px] xl:h-[76px] xl:w-[112px]";

  const slotClass =
    item.offset === 0
      ? "[--deck-x:0px]"
      : item.offset === -1
        ? "[--deck-x:-139px] sm:[--deck-x:-167px] xl:[--deck-x:-187px]"
        : item.offset === 1
          ? "[--deck-x:139px] sm:[--deck-x:167px] xl:[--deck-x:187px]"
          : item.offset === -2
            ? "[--deck-x:-248px] sm:[--deck-x:-290px] xl:[--deck-x:-322px]"
            : item.offset === 2
              ? "[--deck-x:248px] sm:[--deck-x:290px] xl:[--deck-x:322px]"
              : item.offset < 0
                ? "[--deck-x:-354px] sm:[--deck-x:-408px] xl:[--deck-x:-451px]"
                : "[--deck-x:354px] sm:[--deck-x:408px] xl:[--deck-x:451px]";

  const targetOpacity = isActive
    ? 1
    : distance === 1
      ? 0.9
      : distance === 2
        ? 0.65
        : 0.4;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: targetOpacity }}
      exit={{ opacity: 0 }}
      className={`absolute bottom-0 left-1/2 will-change-transform ${visibilityClass} ${slotClass}`}
      style={{
        transform: "translate3d(var(--deck-x), 0, 0)",
        transition: "transform 580ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div className="-translate-x-1/2">
        <motion.button
          whileHover={{ y: -4, opacity: 1 }}
          type="button"
          onClick={() => onSelect(item.amenity.id)}
          aria-current={isActive ? "true" : undefined}
          aria-label={
            isActive
              ? `Currently showing ${item.amenity.title}`
              : `Open ${item.amenity.title}`
          }
          className={`group relative block shrink-0 overflow-hidden rounded-[7px] bg-black/80 text-left transition-[width,height,border-color,box-shadow] duration-[580ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78c995] ${sizeClass} ${
            isActive
              ? "z-10 border border-[#78c995]/90 shadow-[0_0_0_1px_rgba(120,201,149,0.12),0_16px_34px_rgba(0,0,0,0.52),0_0_22px_rgba(120,201,149,0.14)]"
              : "border border-white/14 shadow-[0_12px_26px_rgba(0,0,0,0.38)]"
          }`}
        >
          <AmenityThumbnail amenity={item.amenity} priority={isActive} />
        </motion.button>
      </div>
    </motion.div>
  );
}

const VideoPlayerControls = memo(function VideoPlayerControls({
  videoRef,
  mediaKey,
  hasVideo,
  isPlaying,
  isMuted,
  onTogglePlayback,
  onToggleMuted,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  mediaKey: string;
  hasVideo: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  onTogglePlayback: () => void;
  onToggleMuted: () => void;
}) {
  const progressFillRef = useRef<HTMLSpanElement | null>(null);
  const seekInputRef = useRef<HTMLInputElement | null>(null);
  const lastRenderedSecondRef = useRef(-1);
  const lastRenderedDurationRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const syncPlaybackProgress = useCallback((time: number, total: number) => {
    const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
    const safeTime = Number.isFinite(time)
      ? Math.min(Math.max(time, 0), safeTotal || 0)
      : 0;
    const progress = safeTotal > 0 ? safeTime / safeTotal : 0;

    if (progressFillRef.current) {
      progressFillRef.current.style.transform = `scaleX(${progress})`;
    }

    if (seekInputRef.current) {
      const progressPercent = progress * 100;
      seekInputRef.current.max = String(Math.max(safeTotal, 0.01));
      seekInputRef.current.value = String(safeTime);
      seekInputRef.current.style.background = `linear-gradient(to right, #050706 0%, #050706 ${progressPercent}%, rgba(0,0,0,0.34) ${progressPercent}%, rgba(0,0,0,0.34) 100%) center / 100% 2px no-repeat`;
    }
  }, []);

  const syncRenderedPlaybackState = useCallback(
    (video: HTMLVideoElement, force = false) => {
      const nextTime = video.currentTime || 0;
      const nextDuration = getFiniteMediaDuration(video);
      syncPlaybackProgress(nextTime, nextDuration);

      if (
        force ||
        Math.abs(nextDuration - lastRenderedDurationRef.current) > 0.01
      ) {
        lastRenderedDurationRef.current = nextDuration;
        setDuration(nextDuration);
      }

      const nextSecond = Math.floor(nextTime);
      if (force || nextSecond !== lastRenderedSecondRef.current) {
        lastRenderedSecondRef.current = nextSecond;
        setCurrentTime(nextTime);
      }
    },
    [syncPlaybackProgress],
  );

  const handleSeek = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextTime = Number(event.target.value);
      const video = videoRef.current;

      if (!video || !Number.isFinite(nextTime)) {
        return;
      }

      video.currentTime = nextTime;
      lastRenderedSecondRef.current = Math.floor(nextTime);
      setCurrentTime(nextTime);
      syncPlaybackProgress(nextTime, getFiniteMediaDuration(video));
    },
    [syncPlaybackProgress, videoRef],
  );

  useEffect(() => {
    const video = videoRef.current as VideoWithFrameCallback | null;
    let videoFrameHandle: number | null = null;
    let animationFrameHandle: number | null = null;
    let cancelled = false;

    const cancelScheduledFrame = () => {
      if (
        videoFrameHandle !== null &&
        typeof video?.cancelVideoFrameCallback === "function"
      ) {
        video.cancelVideoFrameCallback(videoFrameHandle);
        videoFrameHandle = null;
      }

      if (animationFrameHandle !== null) {
        window.cancelAnimationFrame(animationFrameHandle);
        animationFrameHandle = null;
      }
    };

    const scheduleNextFrame = () => {
      if (cancelled || !isPlaying || !video) {
        return;
      }

      if (typeof video.requestVideoFrameCallback === "function") {
        videoFrameHandle = video.requestVideoFrameCallback(() => {
          videoFrameHandle = null;
          syncRenderedPlaybackState(video);
          scheduleNextFrame();
        });
        return;
      }

      animationFrameHandle = window.requestAnimationFrame(() => {
        animationFrameHandle = null;
        syncRenderedPlaybackState(video);
        scheduleNextFrame();
      });
    };

    const syncFromMediaEvent = () => {
      if (video) {
        syncRenderedPlaybackState(video, true);
      }
    };

    const syncPausedTime = () => {
      if (video?.paused) {
        syncRenderedPlaybackState(video, true);
      }
    };

    if (video) {
      video.addEventListener("loadedmetadata", syncFromMediaEvent);
      video.addEventListener("durationchange", syncFromMediaEvent);
      video.addEventListener("seeked", syncFromMediaEvent);
      video.addEventListener("timeupdate", syncPausedTime);
    }

    const initialSyncFrame = window.requestAnimationFrame(() => {
      lastRenderedSecondRef.current = -1;
      lastRenderedDurationRef.current = 0;

      if (video && hasVideo) {
        syncRenderedPlaybackState(video, true);
        scheduleNextFrame();
      } else {
        setCurrentTime(0);
        setDuration(0);
        syncPlaybackProgress(0, 0);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(initialSyncFrame);
      cancelScheduledFrame();

      if (video) {
        video.removeEventListener("loadedmetadata", syncFromMediaEvent);
        video.removeEventListener("durationchange", syncFromMediaEvent);
        video.removeEventListener("seeked", syncFromMediaEvent);
        video.removeEventListener("timeupdate", syncPausedTime);
      }
    };
  }, [
    hasVideo,
    isPlaying,
    mediaKey,
    syncPlaybackProgress,
    syncRenderedPlaybackState,
    videoRef,
  ]);

  return (
    <div className="absolute bottom-[12px] left-4 right-4 z-30 grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-3 sm:bottom-[17px] sm:left-[34px] sm:right-[38px] sm:grid-cols-[56px_126px_minmax(0,1fr)_56px] sm:gap-4">
      <button
        type="button"
        onClick={onTogglePlayback}
        disabled={!hasVideo}
        aria-label={isPlaying ? "Pause video" : "Play video"}
        className="grid h-[48px] w-[48px] place-items-center rounded-full border border-white/15 bg-black/60 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_34px_rgba(0,0,0,0.3)] backdrop-blur-xl transition hover:border-[#78c995]/75 hover:bg-black/75 hover:text-[#8bd3a7] disabled:cursor-default disabled:opacity-[0.45] sm:h-[56px] sm:w-[56px]"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 fill-current stroke-[1.5]" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 h-5 w-5 fill-current stroke-[1.5]" aria-hidden="true" />
        )}
      </button>

      <div className="hidden items-center gap-2 whitespace-nowrap text-[14px] tabular-nums text-white/90 sm:flex">
        <span>{formatTime(currentTime)}</span>
        <span className="text-white/30">/</span>
        <span className="text-white/45">{formatTime(duration)}</span>
      </div>

      <div className="relative h-6 min-w-0">
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 z-[1] h-[2px] w-full -translate-y-1/2 overflow-hidden rounded-full bg-black/35"
        >
          <span
            ref={progressFillRef}
            className="absolute inset-0 origin-left scale-x-0 bg-[#050706] will-change-transform"
          />
        </span>
        <input
          ref={seekInputRef}
          type="range"
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.01}
          defaultValue={0}
          onChange={handleSeek}
          disabled={!hasVideo}
          aria-label="Video progress"
          className="absolute inset-0 z-[2] h-full w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default disabled:opacity-[0.45] [&::-moz-range-thumb]:h-[10px] [&::-moz-range-thumb]:w-[10px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/45 [&::-moz-range-thumb]:bg-[#050706] [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(0,0,0,0.12),0_0_12px_rgba(0,0,0,0.34)] [&::-moz-range-track]:h-[2px] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-[2px] [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-[10px] [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/45 [&::-webkit-slider-thumb]:bg-[#050706] [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(0,0,0,0.12),0_0_12px_rgba(0,0,0,0.34)]"
        />
      </div>

      <button
        type="button"
        onClick={onToggleMuted}
        disabled={!hasVideo}
        aria-label={isMuted ? "Unmute video" : "Mute video"}
        className="grid h-[48px] w-[48px] place-items-center rounded-full border border-white/15 bg-black/60 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_34px_rgba(0,0,0,0.3)] backdrop-blur-xl transition hover:border-[#78c995]/75 hover:bg-black/75 hover:text-[#8bd3a7] disabled:cursor-default disabled:opacity-[0.45] sm:h-[56px] sm:w-[56px]"
      >
        {isMuted ? (
          <VolumeX className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
        ) : (
          <Volume2 className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});

export default function AmenitiesPageClient({ data }: AmenitiesPageClientProps) {
  const router = useRouter();
  const stageRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transitionTokenRef = useRef(0);
  const carouselTransitionLockedRef = useRef(false);
  const carouselUnlockTimerRef = useRef<number | null>(null);
  const deckHideTimerRef = useRef<number | null>(null);

  const [activeId, setActiveId] = useState(data.items[0]?.id ?? "");
  const [displayedAmenityId, setDisplayedAmenityId] = useState(
    data.items[0]?.id ?? "",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isDeckVisible, setIsDeckVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  const clearDeckHideTimer = useCallback(() => {
    if (deckHideTimerRef.current === null) {
      return;
    }

    window.clearTimeout(deckHideTimerRef.current);
    deckHideTimerRef.current = null;
  }, []);

  const revealDeck = useCallback(() => {
    clearDeckHideTimer();
    setIsDeckVisible(true);
    deckHideTimerRef.current = window.setTimeout(() => {
      setIsDeckVisible(false);
      deckHideTimerRef.current = null;
    }, DECK_AUTO_HIDE_MS);
  }, [clearDeckHideTimer]);

  const activeIndex = useMemo(() => {
    const index = data.items.findIndex((item) => item.id === activeId);
    return index >= 0 ? index : 0;
  }, [activeId, data.items]);

  const activeAmenity = data.items[activeIndex] ?? data.items[0];
  const displayedAmenity =
    data.items.find((item) => item.id === displayedAmenityId) ?? activeAmenity;

  const carouselItems = useMemo<CarouselItem[]>(() => {
    const total = data.items.length;

    if (!total) {
      return [];
    }

    if (total >= CAROUSEL_OFFSETS.length) {
      return CAROUSEL_OFFSETS.map((offset) => {
        const dataIndex = (activeIndex + offset + total) % total;
        return {
          amenity: data.items[dataIndex],
          offset,
          dataIndex,
        };
      });
    }

    const half = Math.floor(total / 2);
    return Array.from({ length: total }, (_, position) => {
      const offset = position - half;
      const dataIndex = (activeIndex + offset + total) % total;

      return {
        amenity: data.items[dataIndex],
        offset,
        dataIndex,
      };
    });
  }, [activeIndex, data.items]);

  const beginCarouselTransition = useCallback(() => {
    if (carouselTransitionLockedRef.current) {
      return false;
    }

    carouselTransitionLockedRef.current = true;
    carouselUnlockTimerRef.current = window.setTimeout(() => {
      carouselTransitionLockedRef.current = false;
      carouselUnlockTimerRef.current = null;
    }, CAROUSEL_TRANSITION_MS);

    return true;
  }, []);

  const selectAmenity = useCallback(
    (id: string) => {
      if (id === activeId || !beginCarouselTransition()) {
        return;
      }

      setActiveId(id);
    },
    [activeId, beginCarouselTransition],
  );

  const goToRelativeAmenity = useCallback(
    (offset: number) => {
      if (!data.items.length) {
        return;
      }

      if (!beginCarouselTransition()) {
        return;
      }

      const nextIndex =
        (activeIndex + offset + data.items.length) % data.items.length;
      setActiveId(data.items[nextIndex].id);
    },
    [activeIndex, beginCarouselTransition, data.items],
  );

  useEffect(() => {
    return () => {
      if (carouselUnlockTimerRef.current !== null) {
        window.clearTimeout(carouselUnlockTimerRef.current);
      }

      clearDeckHideTimer();
    };
  }, [clearDeckHideTimer]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(revealDeck);

    return () => {
      window.cancelAnimationFrame(frameId);
      clearDeckHideTimer();
    };
  }, [activeId, clearDeckHideTimer, revealDeck]);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      const element = stageRef.current ?? document.documentElement;
      await element.requestFullscreen();

      const orientation = screen.orientation as
        | ScreenOrientationWithLock
        | undefined;
      await orientation?.lock?.("landscape").catch(() => undefined);
    } catch {
      // Fullscreen and orientation locking are browser/permission dependent.
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    video.pause();
    setIsPlaying(false);
  }, []);

  const toggleMuted = useCallback(() => {
    const video = videoRef.current;
    const nextMuted = !isMuted;

    setIsMuted(nextMuted);
    if (video) {
      video.muted = nextMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    scheduleAmenityVideoWarmup({
      profile: "amenities",
      currentAmenityId: activeId,
    });
  }, [activeId]);

  useEffect(() => {
    const previewImages = data.items.flatMap((item, index) => {
      if (!hasMediaSource(item.thumbnailSrc)) {
        return [];
      }

      const image = new window.Image();
      image.decoding = "async";
      image.fetchPriority = index === 0 ? "high" : index < 3 ? "auto" : "low";
      image.src = item.thumbnailSrc;
      void image.decode().catch(() => undefined);

      return [image];
    });

    return () => {
      previewImages.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [data.items]);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100dvh";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.height = previousBodyHeight;
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        goToRelativeAmenity(-1);
      }

      if (event.key === "ArrowRight") {
        goToRelativeAmenity(1);
      }

      if (event.code === "Space" && event.target === document.body) {
        event.preventDefault();
        void togglePlayback();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goToRelativeAmenity, togglePlayback]);

  useEffect(() => {
    if (!activeAmenity || activeAmenity.id === displayedAmenityId) {
      return;
    }

    if (
      !hasMediaSource(activeAmenity.videoSrc) ||
      isHlsAssetUrl(activeAmenity.videoSrc)
    ) {
      const frameId = window.requestAnimationFrame(() => {
        setDisplayedAmenityId(activeAmenity.id);
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const token = transitionTokenRef.current + 1;
    transitionTokenRef.current = token;

    const preloadVideo = document.createElement("video");
    preloadVideo.preload = "auto";
    preloadVideo.muted = true;
    preloadVideo.defaultMuted = true;
    preloadVideo.playsInline = true;
    preloadVideo.crossOrigin = "anonymous";
    preloadVideo.setAttribute("muted", "");
    preloadVideo.setAttribute("playsinline", "");
    preloadVideo.setAttribute("webkit-playsinline", "");
    preloadVideo.src = activeAmenity.videoSrc as string;

    const revealAmenity = () => {
      if (transitionTokenRef.current === token) {
        setDisplayedAmenityId(activeAmenity.id);
      }
    };

    preloadVideo.addEventListener("loadeddata", revealAmenity, { once: true });
    preloadVideo.addEventListener("canplay", revealAmenity, { once: true });
    preloadVideo.addEventListener("error", revealAmenity, { once: true });
    preloadVideo.load();

    return () => {
      preloadVideo.pause();
      preloadVideo.removeAttribute("src");
      preloadVideo.load();
    };
  }, [activeAmenity, displayedAmenityId]);

  useEffect(() => {
    if (isHlsAssetUrl(displayedAmenity?.videoSrc)) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const video = videoRef.current;

      if (!video) {
        setIsPlaying(false);
        return;
      }

      void video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [displayedAmenity?.videoSrc, displayedAmenityId]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  if (!activeAmenity || !displayedAmenity) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#050706] text-white">
        <p>No amenities found.</p>
      </main>
    );
  }

  const activePosition = twoDigits(activeIndex + 1);
  const totalPosition = twoDigits(data.items.length);
  const hasVideo = hasMediaSource(displayedAmenity.videoSrc);

  return (
    <main
      ref={stageRef}
      onPointerDown={revealDeck}
      className={`${interfaceSans.className} relative isolate h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[#050706] text-white`}
    >
      {/* Full-screen amenity media */}
      <div className="absolute inset-0" aria-hidden="true">
        {hasMediaSource(displayedAmenity.videoSrc) ? (
          <CloudinaryHlsVideo
            ref={videoRef}
            key={displayedAmenity.videoSrc}
            className="h-full w-full object-cover object-center"
            src={displayedAmenity.videoSrc}
            poster={
              hasMediaSource(displayedAmenity.thumbnailSrc)
                ? displayedAmenity.thumbnailSrc
                : undefined
            }
            autoPlay
            muted={isMuted}
            loop
            playsInline
            preload="auto"
            preferHighestQuality
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : hasMediaSource(displayedAmenity.thumbnailSrc) ? (
          <Image
            key={displayedAmenity.thumbnailSrc}
            src={displayedAmenity.thumbnailSrc as string}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover object-center"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_72%_26%,rgba(120,201,149,0.12),transparent_31%),linear-gradient(135deg,#101511,#030504_58%)]">
            <span className={`${displaySerif.className} text-5xl text-white/80 sm:text-8xl`}>
              {displayedAmenity.title}
            </span>
          </div>
        )}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[34%] bg-[linear-gradient(180deg,transparent_0%,rgba(2,4,3,0.05)_30%,rgba(2,4,3,0.38)_68%,rgba(2,4,3,0.68)_100%)]"
      />

      {/* Header */}
      <header className="absolute left-5 right-5 top-4 z-20 flex min-h-[58px] items-center sm:left-[34px] sm:right-[38px] sm:top-[24px]">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="inline-flex shrink-0 items-center bg-transparent p-0 transition hover:opacity-90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://cdn.sthyra.com/TULA/Images/Whisper_of_Tree_Logo_Gold%201.avif"
            alt="Whisper of Trees"
            width={512}
            height={220}
            loading="eager"
            decoding="async"
            draggable={false}
            className="h-[2.75rem] w-auto max-w-[8.5rem] select-none object-contain brightness-0 invert opacity-95 drop-shadow-[0_5px_18px_rgba(0,0,0,0.4)] sm:h-[3.75rem] sm:max-w-[11rem]"
          />
        </button>

        <span className="mx-4 h-[40px] w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.28),transparent)] sm:ml-[26px] sm:mr-[38px] sm:h-[51px]" />

        <span
          className={`${displaySerif.className} hidden text-[28px] tracking-[0.015em] text-white/92 drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)] sm:block lg:text-[32px]`}
        >
          {data.title || "Amenities"}
        </span>

        <div className="ml-auto flex items-center gap-2.5 sm:gap-[13px]">
          <button
            type="button"
            onClick={() => router.push("/master-plan")}
            aria-label="View masterplan"
            className="inline-flex h-[44px] items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 text-[13px] font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_34px_rgba(0,0,0,0.3)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#78c995]/75 hover:bg-black/75 hover:text-[#8bd3a7] sm:h-[48px] sm:gap-2.5 sm:px-[21px] sm:text-[14px]"
          >
            <Map className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" />
            <span className="hidden sm:inline">View Masterplan</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="grid h-[44px] w-[44px] place-items-center rounded-full border border-white/15 bg-black/60 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_34px_rgba(0,0,0,0.3)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#78c995]/75 hover:bg-black/75 hover:text-[#8bd3a7] sm:h-[48px] sm:w-[48px]"
          >
            {isFullscreen ? (
              <Minimize2 className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Flat filmstrip carousel — replaces the old rounded 3D deck */}
      <motion.section
        className="absolute bottom-[72px] left-1/2 z-20 h-[204px] w-[calc(100vw-20px)] sm:bottom-[76px] sm:w-[min(1120px,88vw)] xl:w-[min(1320px,90vw)]"
        aria-label="Amenity carousel"
        aria-hidden={!isDeckVisible}
        inert={!isDeckVisible ? true : undefined}
        initial={false}
        animate={{
          opacity: isDeckVisible ? 1 : 0,
          x: "-50%",
          y: !isDeckVisible && !prefersReducedMotion ? 132 : 0,
        }}
        transition={{
          duration: prefersReducedMotion ? 0.2 : 0.68,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          pointerEvents: isDeckVisible ? "auto" : "none",
          willChange: "transform, opacity",
        }}
      >
        <button
          type="button"
          onClick={() => goToRelativeAmenity(-1)}
          aria-label="Previous carousel item"
          className="absolute left-1/2 top-[62px] z-20 -ml-4 grid h-8 w-8 -translate-x-[190px] place-items-center bg-transparent text-white/75 transition hover:scale-110 hover:text-[#8bd3a7] sm:-translate-x-[515px] xl:-translate-x-[565px]"
        >
          <ChevronLeft className="h-[22px] w-[22px] stroke-[1.65]" aria-hidden="true" />
        </button>

        <MotionConfig
          reducedMotion="user"
          transition={{
            opacity: { duration: 0.28 },
          }}
        >
          <div className="absolute left-10 right-10 top-0 h-[132px] sm:left-12 sm:right-12 xl:left-16 xl:right-16">
            <AnimatePresence initial={false}>
              {carouselItems.map((item) => (
                <FilmstripThumbnail
                  key={item.amenity.id}
                  item={item}
                  onSelect={selectAmenity}
                />
              ))}
            </AnimatePresence>
          </div>
        </MotionConfig>

        <button
          type="button"
          onClick={() => goToRelativeAmenity(1)}
          aria-label="Next carousel item"
          className="absolute left-1/2 top-[62px] z-20 -ml-4 grid h-8 w-8 translate-x-[190px] place-items-center bg-transparent text-white/75 transition hover:scale-110 hover:text-[#8bd3a7] sm:translate-x-[515px] xl:translate-x-[565px]"
        >
          <ChevronRight className="h-[22px] w-[22px] stroke-[1.65]" aria-hidden="true" />
        </button>

        <div className="absolute left-1/2 top-[134px] -translate-x-1/2 text-center drop-shadow-[0_4px_16px_rgba(0,0,0,0.72)] sm:top-[136px]">
          <p className="text-[10px] font-medium tracking-[0.12em] text-white/72 sm:text-[11px]">
            {activePosition}
            <span className="mx-2 text-white/30">/</span>
            {totalPosition}
          </p>
          <p
            className="mt-[2px] max-w-[320px] truncate text-[17px] font-medium leading-none text-white/94 sm:text-[19px]"
          >
            {activeAmenity.title}
          </p>
        </div>

        <div className="absolute bottom-[2px] left-1/2 flex max-w-[88vw] -translate-x-1/2 items-center justify-center gap-[7px] sm:gap-[8px]">
          {data.items.map((item, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectAmenity(item.id)}
                aria-label={`Open ${item.title}`}
                aria-current={isActive ? "true" : undefined}
                className={`h-[3px] rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#78c995] ${
                  isActive
                    ? "w-[16px] bg-[#78c995] shadow-[0_0_10px_rgba(120,201,149,0.46)]"
                    : "w-[13px] bg-white/[0.16] hover:bg-white/[0.32]"
                }`}
              />
            );
          })}
        </div>
      </motion.section>

      <VideoPlayerControls
        videoRef={videoRef}
        mediaKey={displayedAmenity.id}
        hasVideo={hasVideo}
        isPlaying={isPlaying}
        isMuted={isMuted}
        onTogglePlayback={togglePlayback}
        onToggleMuted={toggleMuted}
      />

      {!isDeckVisible ? (
        <button
          type="button"
          onPointerDown={revealDeck}
          className="absolute inset-0 z-40 cursor-default bg-transparent"
          aria-label="Show amenity details and carousel"
        />
      ) : null}
    </main>
  );
}
