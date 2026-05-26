"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Menu,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { scheduleAmenityVideoWarmup } from "@/lib/amenity-video-warmup";
import { useSnapListViewport } from "@/lib/useSnapListViewport";
import PhoneRotatePortraitIcon from "../ui/PhoneRotateIcon";

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

function hasMediaSource(value?: string) {
  return Boolean(value && value.trim().length > 0);
}

function AmenityPlaceholder({ title }: { title: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-white text-zinc-950">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(24,24,27,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.055)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute left-[16%] top-[18%] h-32 w-32 rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="absolute bottom-[18%] right-[20%] h-36 w-36 rounded-full bg-amber-100/80 blur-3xl" />
      <div className="relative px-6 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.10)]">
          <Sparkles className="h-7 w-7 text-emerald-700" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-zinc-500">
          Media placeholder
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
          {title}
        </h1>
      </div>
    </div>
  );
}

function AmenityCard({
  amenity,
  active,
}: {
  amenity: AmenityPageItem;
  active: boolean;
}) {
  return (
    <div
      className={`relative aspect-[16/10] overflow-hidden rounded-[0.95rem] border ${
        active ? "border-white/55" : "border-white/10"
      } bg-white/8`}
    >
      {hasMediaSource(amenity.thumbnailSrc) ? (
        <Image
          src={amenity.thumbnailSrc as string}
          alt={amenity.title}
          fill
          unoptimized
          sizes="(max-width: 1024px) 78vw, 280px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/92">
          <ImageIcon className="h-7 w-7 text-zinc-300" />
        </div>
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/68 via-black/12 to-transparent" />
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold text-white">
          {amenity.title}
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            active
              ? "bg-white text-zinc-950"
              : "bg-white/14 text-white backdrop-blur-md"
          }`}
        >
          {active ? "Active" : "View"}
        </span>
      </div>
    </div>
  );
}

export default function AmenitiesPageClient({ data }: AmenitiesPageClientProps) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(data.items[0]?.id ?? "");
  const [displayedAmenityId, setDisplayedAmenityId] = useState(
    data.items[0]?.id ?? "",
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const transitionTokenRef = useRef(0);
  const {
    setFirstItemNode: setDesktopAmenitiesFirstItemNode,
    setListNode: setDesktopAmenitiesListNode,
    setScrollAreaNode: setDesktopAmenitiesScrollAreaNode,
    viewportHeight: desktopAmenitiesViewportHeight,
  } = useSnapListViewport({
    itemCount: data.items.length,
    targetVisibleCards: 2.1,
  });
  const {
    setFirstItemNode: setMobileAmenitiesFirstItemNode,
    setListNode: setMobileAmenitiesListNode,
    setScrollAreaNode: setMobileAmenitiesScrollAreaNode,
    viewportHeight: mobileAmenitiesViewportHeight,
  } = useSnapListViewport({
    itemCount: data.items.length,
    targetVisibleCards: 2.1,
  });

  const activeIndex = useMemo(
    () => Math.max(0, data.items.findIndex((item) => item.id === activeId)),
    [activeId, data.items],
  );
  const activeAmenity = data.items[activeIndex] ?? data.items[0];
  const displayedAmenity =
    data.items.find((item) => item.id === displayedAmenityId) ?? activeAmenity;

  const selectAmenity = (id: string) => {
    setActiveId(id);
    setIsPanelOpen(false);
  };

  const goToRelativeAmenity = (offset: number) => {
    if (!data.items.length) {
      return;
    }

    const nextIndex =
      (activeIndex + offset + data.items.length) % data.items.length;
    setActiveId(data.items[nextIndex].id);
  };

  const shouldForceLandscape =
    isLandscape && viewportSize.height > viewportSize.width;

  const toggleLandscape = async () => {
    if (isLandscape) {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      setIsLandscape(false);
    } else {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen().catch(() => {});
      }
      const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
      if (orientation?.lock) {
        await orientation.lock("landscape").catch(() => {});
      }
      setIsLandscape(true);
    }
  };

  useEffect(() => {
    scheduleAmenityVideoWarmup({
      profile: "amenities",
      currentAmenityId: activeId,
    });
  }, [activeId]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

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
    if (typeof window === "undefined") {
      return;
    }

    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    window.addEventListener("orientationchange", updateViewportSize);

    return () => {
      window.removeEventListener("resize", updateViewportSize);
      window.removeEventListener("orientationchange", updateViewportSize);
    };
  }, []);

  useEffect(() => {
    if (!activeAmenity) {
      return;
    }

    if (activeAmenity.id === displayedAmenityId) {
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
      if (transitionTokenRef.current !== token) {
        return;
      }

      setDisplayedAmenityId(activeAmenity.id);
    };

    preloadVideo.addEventListener("loadeddata", revealAmenity, { once: true });
    preloadVideo.addEventListener("canplay", revealAmenity, { once: true });
    preloadVideo.addEventListener(
      "error",
      () => {
        if (transitionTokenRef.current !== token) {
          return;
        }

        setDisplayedAmenityId(activeAmenity.id);
      },
      { once: true },
    );
    preloadVideo.load();

    return () => {
      preloadVideo.pause();
      preloadVideo.removeAttribute("src");
      preloadVideo.load();
    };
  }, [activeAmenity, displayedAmenityId]);

  if (!activeAmenity) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-950">
        No amenities found.
      </main>
    );
  }

  return (
    <main className="relative h-[100dvh] max-h-[100dvh] min-h-[100dvh] overflow-hidden overscroll-none bg-black text-white">
      <div
        className="relative h-full w-full overflow-hidden bg-black"
        style={
          shouldForceLandscape
            ? {
                position: "absolute",
                top: 0,
                left: "100dvw",
                width: "100dvh",
                height: "100dvw",
                transform: "rotate(90deg)",
                transformOrigin: "top left",
              }
            : undefined
        }
      >
      {hasMediaSource(displayedAmenity.videoSrc) ? (
        <video
          key={displayedAmenity.videoSrc}
          className="absolute inset-0 h-full w-full object-cover"
          src={displayedAmenity.videoSrc}
          poster={
            hasMediaSource(displayedAmenity.thumbnailSrc)
              ? displayedAmenity.thumbnailSrc
              : undefined
          }
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      ) : hasMediaSource(displayedAmenity.thumbnailSrc) ? (
        <Image
          src={displayedAmenity.thumbnailSrc as string}
          alt={displayedAmenity.title}
          fill
          sizes="100vw"
          unoptimized
          className="object-cover"
          priority
        />
      ) : (
        <AmenityPlaceholder title={displayedAmenity.title} />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black via-black/5 to-transparent" />

      <section className="pointer-events-none absolute bottom-8 left-5 right-5 z-10 pr-0 sm:bottom-10 sm:left-8 sm:right-8 lg:right-[24rem]">
        <div className="max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/18 bg-black/18 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            {displayedAmenity.category}
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white drop-shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:text-6xl lg:text-7xl">
            {displayedAmenity.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/82 sm:text-base">
            {displayedAmenity.shortDescription}
          </p>
        </div>
      </section>

      <div className="absolute bottom-8 left-5 z-20 hidden items-center gap-2 xl:flex sm:bottom-10 lg:left-auto lg:right-[25rem]">
        <button
          type="button"
          onClick={() => goToRelativeAmenity(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/24 text-white shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-white hover:text-zinc-950"
          aria-label="Previous amenity"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => goToRelativeAmenity(1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/24 text-white shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-white hover:text-zinc-950"
          aria-label="Next amenity"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-black/58 text-white shadow-[0_14px_34px_rgba(0,0,0,0.26)] backdrop-blur-xl transition hover:bg-black/72 sm:left-4 sm:top-4 md:h-11 md:w-11 xl:hidden"
        aria-label="Go back"
      >
        <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
      </button>

      <button
        type="button"
        onClick={toggleLandscape}
        className="fixed right-3 top-[3.95rem] z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-black/58 text-white shadow-[0_14px_34px_rgba(0,0,0,0.26)] backdrop-blur-xl transition hover:bg-black/72 sm:right-4 sm:top-[4.5rem] md:h-11 md:w-11 md:top-[4.75rem] xl:hidden"
        aria-label={isLandscape ? "Exit landscape mode" : "Enter landscape mode"}
      >
        <PhoneRotatePortraitIcon size={17} />
      </button>

      {isPanelCollapsed ? (
        <button
          type="button"
          onClick={() => setIsPanelCollapsed(false)}
          className="fixed right-5 top-5 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-black/68 text-white shadow-[0_16px_34px_rgba(0,0,0,0.28)] backdrop-blur-[18px] transition hover:bg-black/80 xl:flex"
          aria-label="Open amenities sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      ) : (
        <aside className="fixed right-5 top-1/2 z-30 hidden max-h-[min(76vh,46rem)] w-[21rem] -translate-y-1/2 xl:block">
          <div className="relative flex max-h-[min(76vh,46rem)] flex-col overflow-hidden rounded-[1.55rem] border border-white/14 bg-[linear-gradient(180deg,rgba(20,26,34,0.42),rgba(8,12,18,0.2))] text-white shadow-[0_30px_90px_rgba(0,0,0,0.36)] backdrop-blur-[30px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(142,197,255,0.14),transparent_24%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_28%,rgba(255,255,255,0.01)_100%)]" />
            <div className="relative flex items-center justify-between gap-3 px-5 pb-3 pt-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/50">
                  {data.eyebrow}
                </p>
                <h2 className="truncate text-xl font-semibold">
                  {data.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsPanelCollapsed(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/52 text-white shadow-[0_10px_22px_rgba(0,0,0,0.16)] transition hover:bg-black/72"
                aria-label="Collapse amenities sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 pb-3">
              <p className="line-clamp-2 text-sm leading-6 text-white/62">
                {activeAmenity.details}
              </p>
              <p className="mt-3 text-xs text-white/42">
                {activeIndex + 1} of {data.items.length}
              </p>
            </div>

            <div
              ref={setDesktopAmenitiesScrollAreaNode}
              className="custom-scrollbar overflow-y-auto overscroll-contain px-4 pt-1 snap-y snap-mandatory"
              style={
                desktopAmenitiesViewportHeight
                  ? { height: `${desktopAmenitiesViewportHeight}px` }
                  : undefined
              }
            >
              <div
                ref={setDesktopAmenitiesListNode}
                className="space-y-3 pb-3"
              >
                {data.items.map((amenity, index) => {
                  const active = amenity.id === activeAmenity.id;

                  return (
                    <button
                      key={amenity.id}
                      ref={
                        index === 0
                          ? setDesktopAmenitiesFirstItemNode
                          : undefined
                      }
                      type="button"
                      onClick={() => selectAmenity(amenity.id)}
                      className={`w-full snap-start snap-always rounded-[1.15rem] border p-2.5 text-left transition ${
                        active
                          ? "border-white/28 bg-black/64 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                          : "border-white/8 bg-black/38 hover:border-white/18 hover:bg-black/52"
                      }`}
                    >
                      <AmenityCard amenity={amenity} active={active} />
                      <div className="px-1.5 pb-1 pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
                          {amenity.category}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {amenity.title}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      )}

      <div
        className={`fixed inset-0 z-40 bg-black/42 backdrop-blur-sm transition xl:hidden ${
          isPanelOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsPanelOpen(false)}
      />
      {isPanelOpen ? (
        <aside className="fixed right-2 top-1/2 z-50 w-[min(16.75rem,calc(100vw-1rem))] max-h-[min(58dvh,31rem)] -translate-y-1/2 overflow-hidden rounded-[1.15rem] border border-white/14 bg-black/84 text-white shadow-[0_26px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl transition duration-300 sm:right-3 sm:w-[min(18.25rem,calc(100vw-1.75rem))] sm:max-h-[min(60dvh,33rem)] sm:rounded-[1.25rem] md:right-4 md:w-[min(19.5rem,calc(100vw-3rem))] md:max-h-[min(63dvh,35rem)] md:rounded-[1.3rem] xl:hidden">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-3 sm:px-4 sm:py-3.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/48">
                  {data.eyebrow}
                </p>
                <p className="text-base font-semibold sm:text-lg">{data.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-black/52 sm:h-9 sm:w-9"
                aria-label="Close amenities"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={setMobileAmenitiesScrollAreaNode}
              className="custom-scrollbar overflow-y-auto overscroll-contain px-3.5 pt-3.5 snap-y snap-mandatory sm:px-4 sm:pt-4"
              style={
                mobileAmenitiesViewportHeight
                  ? { height: `${mobileAmenitiesViewportHeight}px` }
                  : undefined
              }
            >
              <div
                ref={setMobileAmenitiesListNode}
                className="space-y-3 pb-3"
              >
                {data.items.map((amenity, index) => {
                  const active = amenity.id === activeAmenity.id;

                  return (
                    <button
                      key={amenity.id}
                      ref={
                        index === 0
                          ? setMobileAmenitiesFirstItemNode
                          : undefined
                      }
                      type="button"
                      onClick={() => selectAmenity(amenity.id)}
                      className={`w-full snap-start snap-always rounded-[1rem] border p-2 text-left transition sm:rounded-[1.1rem] sm:p-2.5 ${
                        active
                          ? "border-white/28 bg-black/64"
                          : "border-white/8 bg-black/38"
                      }`}
                    >
                      <AmenityCard amenity={amenity} active={active} />
                      <div className="px-1 pb-1 pt-2.5 sm:pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/75">
                          {amenity.category}
                        </p>
                        <p className="pt-1 text-[13px] font-semibold text-white sm:text-sm">
                          {amenity.title}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          className="fixed right-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-black/68 text-white shadow-[0_16px_34px_rgba(0,0,0,0.28)] backdrop-blur-[18px] transition hover:bg-black/80 sm:right-4 sm:top-4 xl:hidden"
          aria-label="Open amenities sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      </div>
    </main>
  );
}
