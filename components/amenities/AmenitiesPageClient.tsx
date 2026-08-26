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
  Orbit,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
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
  brandName?: string;
  brandSubline?: string;
  onExplore3D?: (amenity: AmenityPageItem) => void;
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
const COMPACT_UI_AUTO_HIDE_MS = 2000;
const COMPACT_UI_MEDIA_QUERY = "(max-width: 1279px)";

function hasMediaSource(value?: string) {
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

function BrandTreeMark() {
  return (
    <svg
      viewBox="0 0 58 70"
      aria-hidden="true"
      fill="none"
      className="h-[46px] w-[38px] shrink-0 drop-shadow-[0_5px_18px_rgba(0,0,0,0.34)] sm:h-[58px] sm:w-[48px]"
    >
      <path d="M29 66V17" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M29 15C24 21 20 27 18 34M29 15C34 21 38 27 40 34M29 23C20 26 13 31 8 38M29 23C38 26 45 31 50 38M29 31C18 35 10 42 5 50M29 31C40 35 48 42 53 50M29 39C18 43 11 50 8 58M29 39C40 43 47 50 50 58"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M29 5C24 9 22 13 22 18M29 5C34 9 36 13 36 18M21 11C16 14 13 18 12 23M37 11C42 14 45 18 46 23M14 19C9 23 7 28 7 33M44 19C49 23 51 28 51 33"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M14 62C20 59 24 58 29 58C34 58 38 59 44 62"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
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
        className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_65%_26%,rgba(219,191,112,0.23),transparent_38%),linear-gradient(135deg,#263229,#0a110d)] text-2xl text-[#e5d39b]"
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
          className={`group relative block shrink-0 overflow-hidden rounded-[7px] bg-[#101712] text-left transition-[width,height,border-color,box-shadow] duration-[580ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4c56e] ${sizeClass} ${
            isActive
              ? "z-10 border border-[#e8ca72]/95 shadow-[0_0_0_1px_rgba(239,213,132,0.18),0_16px_34px_rgba(0,0,0,0.46),0_0_24px_rgba(220,188,95,0.13)]"
              : "border border-white/10 shadow-[0_12px_26px_rgba(0,0,0,0.32)]"
          }`}
        >
          <AmenityThumbnail amenity={item.amenity} priority={isActive} />
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_42%,rgba(1,4,2,0.36)_100%)]" />
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
      seekInputRef.current.style.background = `linear-gradient(to right, #d7b767 0%, #d7b767 ${progressPercent}%, rgba(255,255,255,0.16) ${progressPercent}%, rgba(255,255,255,0.16) 100%) center / 100% 2px no-repeat`;
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
        className="grid h-[48px] w-[48px] place-items-center rounded-full border border-[#e7d397]/[0.52] bg-[#0d130e]/[0.25] text-[#ead59a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_34px_rgba(0,0,0,0.24)] backdrop-blur-xl transition hover:border-[#f5e09e]/[0.85] hover:bg-[#182118]/[0.50] disabled:cursor-default disabled:opacity-[0.45] sm:h-[56px] sm:w-[56px]"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 fill-current stroke-[1.5]" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 h-5 w-5 fill-current stroke-[1.5]" aria-hidden="true" />
        )}
      </button>

      <div className="hidden items-center gap-2 whitespace-nowrap text-[14px] tabular-nums text-[#f7efd8]/[0.92] sm:flex">
        <span>{formatTime(currentTime)}</span>
        <span className="text-[#f7efd8]/[0.30]">/</span>
        <span className="text-[#f7efd8]/[0.42]">{formatTime(duration)}</span>
      </div>

      <div className="relative h-6 min-w-0">
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 z-[1] h-[2px] w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.16]"
        >
          <span
            ref={progressFillRef}
            className="absolute inset-0 origin-left scale-x-0 bg-[#d7b767] will-change-transform"
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
          className="absolute inset-0 z-[2] h-full w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default disabled:opacity-[0.45] [&::-moz-range-thumb]:h-[10px] [&::-moz-range-thumb]:w-[10px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#d9b968] [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(215,183,103,0.08),0_0_14px_rgba(215,183,103,0.34)] [&::-moz-range-track]:h-[2px] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-[2px] [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-[10px] [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#d9b968] [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(215,183,103,0.08),0_0_14px_rgba(215,183,103,0.34)]"
        />
      </div>

      <button
        type="button"
        onClick={onToggleMuted}
        disabled={!hasVideo}
        aria-label={isMuted ? "Unmute video" : "Mute video"}
        className="grid h-[48px] w-[48px] place-items-center rounded-full border border-[#e7d397]/[0.52] bg-[#0d130e]/[0.25] text-[#ead59a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_34px_rgba(0,0,0,0.24)] backdrop-blur-xl transition hover:border-[#f5e09e]/[0.85] hover:bg-[#182118]/[0.50] disabled:cursor-default disabled:opacity-[0.45] sm:h-[56px] sm:w-[56px]"
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

export default function AmenitiesPageClient({
  data,
  brandName = "Whispers",
  brandSubline = "of the Pines",
  onExplore3D,
}: AmenitiesPageClientProps) {
  const router = useRouter();
  const stageRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transitionTokenRef = useRef(0);
  const carouselTransitionLockedRef = useRef(false);
  const carouselUnlockTimerRef = useRef<number | null>(null);
  const compactUiHideTimerRef = useRef<number | null>(null);

  const [activeId, setActiveId] = useState(data.items[0]?.id ?? "");
  const [displayedAmenityId, setDisplayedAmenityId] = useState(
    data.items[0]?.id ?? "",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isCompactUiVisible, setIsCompactUiVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  const clearCompactUiHideTimer = useCallback(() => {
    if (compactUiHideTimerRef.current === null) {
      return;
    }

    window.clearTimeout(compactUiHideTimerRef.current);
    compactUiHideTimerRef.current = null;
  }, []);

  const revealCompactUi = useCallback(() => {
    if (!isCompactViewport) {
      return;
    }

    clearCompactUiHideTimer();
    setIsCompactUiVisible(true);
    compactUiHideTimerRef.current = window.setTimeout(() => {
      setIsCompactUiVisible(false);
      compactUiHideTimerRef.current = null;
    }, COMPACT_UI_AUTO_HIDE_MS);
  }, [clearCompactUiHideTimer, isCompactViewport]);

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

      clearCompactUiHideTimer();
    };
  }, [clearCompactUiHideTimer]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_UI_MEDIA_QUERY);
    const syncCompactViewport = () => {
      setIsCompactViewport(mediaQuery.matches);

      if (!mediaQuery.matches) {
        clearCompactUiHideTimer();
        setIsCompactUiVisible(true);
      }
    };

    syncCompactViewport();
    mediaQuery.addEventListener("change", syncCompactViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncCompactViewport);
    };
  }, [clearCompactUiHideTimer]);

  useEffect(() => {
    if (!isCompactViewport) {
      return;
    }

    const frameId = window.requestAnimationFrame(revealCompactUi);

    return () => {
      window.cancelAnimationFrame(frameId);
      clearCompactUiHideTimer();
    };
  }, [activeId, clearCompactUiHideTimer, isCompactViewport, revealCompactUi]);

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

  const handleExplore3D = useCallback(() => {
    if (!activeAmenity) {
      return;
    }

    if (onExplore3D) {
      onExplore3D(activeAmenity);
      return;
    }

    window.dispatchEvent(
      new CustomEvent("amenity:explore3d", {
        detail: activeAmenity,
      }),
    );
  }, [activeAmenity, onExplore3D]);

  useEffect(() => {
    scheduleAmenityVideoWarmup({
      profile: "amenities",
      currentAmenityId: activeId,
    });
  }, [activeId]);

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

    if (!hasMediaSource(activeAmenity.videoSrc)) {
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
  }, [displayedAmenityId]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  if (!activeAmenity || !displayedAmenity) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#050907] text-[#f7efd8]">
        <p>No amenities found.</p>
      </main>
    );
  }

  const activePosition = twoDigits(activeIndex + 1);
  const totalPosition = twoDigits(data.items.length);
  const heroEyebrow = activeAmenity.category || data.eyebrow || "Amenity";
  const hasVideo = hasMediaSource(displayedAmenity.videoSrc);

  return (
    <main
      ref={stageRef}
      onPointerDown={revealCompactUi}
      className={`${interfaceSans.className} relative isolate h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[#050907] text-[#f7efd8]`}
    >
      {/* Full-screen amenity media */}
      <div className="absolute inset-0" aria-hidden="true">
        {hasMediaSource(displayedAmenity.videoSrc) ? (
          <video
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
          <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_72%_26%,rgba(178,153,83,0.18),transparent_31%),linear-gradient(135deg,#142118,#050907_58%)]">
            <span className={`${displaySerif.className} text-5xl text-[#f3e7c4]/80 sm:text-8xl`}>
              {displayedAmenity.title}
            </span>
          </div>
        )}
      </div>

      {/* Cinematic gradients: no visible UI container */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(2,5,3,0.64)_0%,rgba(2,5,3,0.15)_15%,transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(2,5,3,0.82)_0%,rgba(2,5,3,0.55)_18%,rgba(2,5,3,0.12)_34%,transparent_51%)]" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_112%,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.48)_39%,transparent_66%),linear-gradient(180deg,transparent_53%,rgba(2,5,3,0.12)_66%,rgba(2,5,3,0.86)_100%)]" />

      {/* Header */}
      <header className="absolute left-5 right-5 top-4 z-20 flex min-h-[58px] items-center sm:left-[34px] sm:right-[38px] sm:top-[24px]">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="inline-flex items-center gap-2.5 bg-transparent p-0 text-[#efdda5] transition hover:text-[#fff0bd] sm:gap-3"
        >
          <BrandTreeMark />
          <span className="flex min-w-[104px] flex-col items-start leading-[0.86] text-left sm:min-w-[136px]">
            <span
              className={`${displaySerif.className} text-[24px] tracking-[0.01em] drop-shadow-[0_4px_18px_rgba(0,0,0,0.4)] sm:text-[31px]`}
            >
              {brandName}
            </span>
            <span
              className={`${displaySerif.className} mt-[6px] text-[13px] tracking-[0.035em] drop-shadow-[0_4px_18px_rgba(0,0,0,0.4)] sm:mt-[7px] sm:text-[17px]`}
            >
              {brandSubline}
            </span>
          </span>
        </button>

        <span className="mx-4 h-[40px] w-px bg-[linear-gradient(180deg,transparent,rgba(234,217,166,0.46),transparent)] sm:ml-[26px] sm:mr-[38px] sm:h-[51px]" />

        <span
          className={`${displaySerif.className} hidden text-[28px] italic tracking-[0.015em] text-[#d9bd73] drop-shadow-[0_4px_18px_rgba(0,0,0,0.38)] sm:block lg:text-[32px]`}
        >
          {data.title || "Amenities"}
        </span>

        <div className="ml-auto flex items-center gap-2.5 sm:gap-[13px]">
          <button
            type="button"
            onClick={() => router.push("/master-plan")}
            aria-label="View masterplan"
            className="inline-flex h-[44px] items-center gap-2 rounded-full border border-[#e7d397]/50 bg-[#0d130e]/[0.25] px-4 text-[13px] font-medium text-[#ead59a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_34px_rgba(0,0,0,0.21)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#f5e09e]/80 hover:bg-[#182118]/[0.50] sm:h-[48px] sm:gap-2.5 sm:px-[21px] sm:text-[14px]"
          >
            <Map className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" />
            <span className="hidden sm:inline">View Masterplan</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="grid h-[44px] w-[44px] place-items-center rounded-full border border-[#e7d397]/50 bg-[#0d130e]/[0.25] text-[#ead59a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_34px_rgba(0,0,0,0.21)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#f5e09e]/80 hover:bg-[#182118]/[0.50] sm:h-[48px] sm:w-[48px]"
          >
            {isFullscreen ? (
              <Minimize2 className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Hero copy — directly on media, no card/container */}
      <motion.section
        className="absolute bottom-[280px] left-5 z-10 w-[calc(100vw-40px)] sm:bottom-auto sm:left-[34px] sm:top-[33.5%] sm:w-[calc(100vw-72px)]"
        aria-live="polite"
        aria-hidden={isCompactViewport && !isCompactUiVisible}
        inert={isCompactViewport && !isCompactUiVisible ? true : undefined}
        initial={false}
        animate={{
          opacity: isCompactViewport && !isCompactUiVisible ? 0 : 1,
          x:
            isCompactViewport && !isCompactUiVisible && !prefersReducedMotion
              ? -72
              : 0,
        }}
        transition={{
          duration: prefersReducedMotion ? 0.2 : 0.62,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          pointerEvents:
            isCompactViewport && !isCompactUiVisible ? "none" : "auto",
          willChange: isCompactViewport ? "transform, opacity" : "auto",
        }}
      >
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#f2ead5]/[0.88] drop-shadow-[0_4px_18px_rgba(0,0,0,0.7)] sm:mb-[17px] sm:text-[13px]">
          {heroEyebrow}
        </p>

        <h1
          className="m-0 whitespace-nowrap text-[clamp(2.05rem,7.6vw,4.75rem)] font-medium leading-[0.95] tracking-[-0.04em] text-[#efdda2] drop-shadow-[0_18px_48px_rgba(0,0,0,0.48)] sm:text-[clamp(3.25rem,4.6vw,5.6rem)]"
        >
          {activeAmenity.title}
        </h1>

        <span className="mt-6 block h-[2px] w-[39px] bg-[#d7b767] shadow-[0_0_12px_rgba(215,183,103,0.25)] sm:mt-[27px]" />

        <p className="mt-5 max-w-[440px] text-[14px] leading-[1.55] text-[#faf5e7]/[0.92] drop-shadow-[0_4px_16px_rgba(0,0,0,0.62)] sm:mt-[20px] sm:text-[17px]">
          {activeAmenity.shortDescription}
        </p>

        <button
          type="button"
          onClick={handleExplore3D}
          className="mt-6 inline-flex items-center gap-3 bg-transparent p-0 text-[14px] font-medium text-[#e7cb79] drop-shadow-[0_4px_15px_rgba(0,0,0,0.6)] transition hover:-translate-y-0.5 hover:text-[#ffe6a0] sm:mt-[27px] sm:text-[15px]"
        >
          <Orbit className="h-[24px] w-[24px] stroke-[1.5]" aria-hidden="true" />
          <span>Explore in 3D</span>
        </button>
      </motion.section>

      {/* Flat filmstrip carousel — replaces the old rounded 3D deck */}
      <motion.section
        className="absolute bottom-[72px] left-1/2 z-20 h-[204px] w-[calc(100vw-20px)] sm:bottom-[76px] sm:w-[min(1120px,88vw)] xl:w-[min(1320px,90vw)]"
        aria-label="Amenity carousel"
        aria-hidden={isCompactViewport && !isCompactUiVisible}
        inert={isCompactViewport && !isCompactUiVisible ? true : undefined}
        initial={false}
        animate={{
          opacity: isCompactViewport && !isCompactUiVisible ? 0 : 1,
          x: "-50%",
          y:
            isCompactViewport && !isCompactUiVisible && !prefersReducedMotion
              ? 132
              : 0,
        }}
        transition={{
          duration: prefersReducedMotion ? 0.2 : 0.68,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          pointerEvents:
            isCompactViewport && !isCompactUiVisible ? "none" : "auto",
          willChange: isCompactViewport ? "transform, opacity" : "auto",
        }}
      >
        <button
          type="button"
          onClick={() => goToRelativeAmenity(-1)}
          aria-label="Previous carousel item"
          className="absolute left-1/2 top-[62px] z-20 -ml-4 grid h-8 w-8 -translate-x-[190px] place-items-center bg-transparent text-[#e6c86e] transition hover:scale-110 hover:text-[#ffe6a0] sm:-translate-x-[515px] xl:-translate-x-[565px]"
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
          className="absolute left-1/2 top-[62px] z-20 -ml-4 grid h-8 w-8 translate-x-[190px] place-items-center bg-transparent text-[#e6c86e] transition hover:scale-110 hover:text-[#ffe6a0] sm:translate-x-[515px] xl:translate-x-[565px]"
        >
          <ChevronRight className="h-[22px] w-[22px] stroke-[1.65]" aria-hidden="true" />
        </button>

        <div className="absolute left-1/2 top-[134px] -translate-x-1/2 text-center drop-shadow-[0_4px_16px_rgba(0,0,0,0.72)] sm:top-[136px]">
          <p className="text-[10px] font-medium tracking-[0.12em] text-[#e8d18c]/[0.90] sm:text-[11px]">
            {activePosition}
            <span className="mx-2 text-[#f5ead2]/[0.35]">/</span>
            {totalPosition}
          </p>
          <p
            className="mt-[2px] max-w-[320px] truncate text-[17px] font-medium leading-none text-[#f5ead1] sm:text-[19px]"
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
                className={`h-[3px] rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f0d27d] ${
                  isActive
                    ? "w-[16px] bg-[#e6c86d] shadow-[0_0_10px_rgba(230,200,109,0.5)]"
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

      {isCompactViewport && !isCompactUiVisible ? (
        <button
          type="button"
          onPointerDown={revealCompactUi}
          className="absolute inset-0 z-40 cursor-default bg-transparent"
          aria-label="Show amenity details and carousel"
        />
      ) : null}
    </main>
  );
}
