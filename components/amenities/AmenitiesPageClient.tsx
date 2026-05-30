"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Leaf,
  Menu,
  Sparkles,
  Trees,
  X,
} from "lucide-react";
import { scheduleAmenityVideoWarmup } from "@/lib/amenity-video-warmup";
import { useSnapListViewport } from "@/lib/useSnapListViewport";
import PhoneRotatePortraitIcon from "../ui/PhoneRotateIcon";

const displaySerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
      className={`group overflow-hidden rounded-[1.1rem] border ${
        active
          ? "border-[#e8d38c]/40 bg-[rgba(15,34,19,0.88)]"
          : "border-white/8 bg-[rgba(10,22,13,0.68)]"
      } shadow-[0_16px_34px_rgba(0,0,0,0.18)] transition duration-300`}
    >
      <div className="p-2.5">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[0.95rem] border border-white/10 bg-[#17301d]">
          {hasMediaSource(amenity.thumbnailSrc) ? (
            <Image
              src={amenity.thumbnailSrc as string}
              alt={amenity.title}
              fill
              unoptimized
              sizes="(max-width: 1024px) 78vw, 280px"
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#f5f0e3]">
              <ImageIcon className="h-7 w-7 text-[#76806d]" />
            </div>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,14,9,0.04),rgba(7,14,9,0.12)_44%,rgba(7,14,9,0.74)_100%)]" />
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-end gap-3">
            <span
              className={`shrink-0 rounded-full px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${
                active
                  ? "bg-[#ecd38b] text-[#163121]"
                  : "bg-[rgba(14,39,21,0.82)] text-[#f4e8ba] backdrop-blur-md"
              }`}
            >
              View
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-1 pb-0.5 pt-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#efdfab]/62">
              {amenity.category}
            </p>
            <p className="mt-1 truncate text-[15px] font-semibold text-[#fff7df]">
              {amenity.title}
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[#f0dd9b]">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AmenityTagPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[#f0dd9b]/24 bg-[rgba(13,31,18,0.54)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#f2e4b2] backdrop-blur-xl">
      {label}
    </span>
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
  const desktopAmenitiesViewportHeightWithBuffer = desktopAmenitiesViewportHeight
    ? Math.ceil(desktopAmenitiesViewportHeight) + 18
    : null;
  const mobileAmenitiesViewportHeightWithBuffer = mobileAmenitiesViewportHeight
    ? Math.ceil(mobileAmenitiesViewportHeight) + 18
    : null;

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
    <main className="relative h-[100dvh] max-h-[100dvh] min-h-[100dvh] overflow-hidden overscroll-none bg-[#040805] text-white">
      <div
        className="relative h-full w-full overflow-hidden bg-[#040805]"
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] bg-[linear-gradient(180deg,rgba(4,8,5,0)_0%,rgba(4,8,5,0.16)_34%,rgba(4,8,5,0.72)_100%)]" />

      <button
        type="button"
        onClick={() => router.back()}
        className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[#f0dd9b]/16 bg-[rgba(8,22,12,0.66)] text-[#f6edd0] shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-[rgba(12,28,16,0.82)] sm:left-4 sm:top-4"
        aria-label="Go back"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="fixed right-3 top-3 z-50 flex items-center gap-2 sm:right-4 sm:top-4 xl:hidden">
        <button
          type="button"
          onClick={toggleLandscape}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f0dd9b]/16 bg-[rgba(8,22,12,0.66)] text-[#f7e7b5] shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-[rgba(12,28,16,0.82)]"
          aria-label={isLandscape ? "Exit landscape mode" : "Enter landscape mode"}
        >
          <PhoneRotatePortraitIcon size={17} />
        </button>
        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f0dd9b]/16 bg-[rgba(8,22,12,0.66)] text-[#f7e7b5] shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-[rgba(12,28,16,0.82)]"
          aria-label="Open amenities guide"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
      </div>

      <section className="pointer-events-none fixed bottom-[5.25rem] left-4 right-4 z-20 sm:bottom-24 sm:left-5 sm:right-auto xl:bottom-5 xl:left-5 xl:right-auto 2xl:left-6">
        <div className="w-full rounded-[1.35rem] border border-[#dfcf9b]/14 bg-[linear-gradient(180deg,rgba(8,24,13,0.58),rgba(8,24,13,0.3))] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.26)] backdrop-blur-[18px] sm:w-[28rem] sm:p-5 2xl:w-[29rem]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#f0dd9b]/18 bg-[rgba(14,33,20,0.54)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#f1deb0]">
              <Leaf className="h-3 w-3 text-[#efcf73]" />
              {displayedAmenity.category}
            </span>
            <span className="rounded-full border border-white/8 bg-white/6 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {activeIndex + 1} of {data.items.length}
            </span>
            {displayedAmenity.statLabel && displayedAmenity.statValue ? (
              <span className="rounded-full border border-white/8 bg-white/6 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {displayedAmenity.statLabel}: {displayedAmenity.statValue}
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 max-w-3xl text-[2rem] leading-[0.94] text-[#fff7df] drop-shadow-[0_10px_24px_rgba(0,0,0,0.28)] sm:text-[2.65rem]">
            <span className={displaySerif.className}>{displayedAmenity.title}</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#f7f2e4]/82">
            {displayedAmenity.shortDescription}
          </p>

          {displayedAmenity.tags?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {displayedAmenity.tags.slice(0, 3).map((tag) => (
                <AmenityTagPill key={tag} label={tag} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:bottom-5 sm:px-5 xl:px-[22rem] 2xl:px-[23rem]">
        <div className="pointer-events-auto flex w-full max-w-[28rem] items-center gap-2 rounded-[999px] border border-[#dfcf9b]/16 bg-[linear-gradient(180deg,rgba(9,25,14,0.72),rgba(9,25,14,0.46))] px-2.5 py-2.5 shadow-[0_20px_44px_rgba(0,0,0,0.24)] backdrop-blur-[18px] sm:gap-2.5 sm:px-3">
          <button
            type="button"
            onClick={() => goToRelativeAmenity(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#f0dd9b]/18 bg-[rgba(15,34,20,0.62)] text-[#f7e7b5] transition hover:bg-[rgba(22,46,29,0.82)]"
            aria-label="Previous amenity"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>

          <div className="min-w-0 flex-1 px-1 text-center">
            <div className={`${displaySerif.className} truncate text-[1.05rem] text-[#fff7df] sm:text-[1.2rem]`}>
              {displayedAmenity.title}
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              {data.items.map((item, index) => (
                <span
                  key={item.id}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? "w-6 bg-[#efcf73] shadow-[0_0_12px_rgba(239,207,115,0.42)]"
                      : "w-1.5 bg-white/24"
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => goToRelativeAmenity(1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#f0dd9b]/18 bg-[rgba(15,34,20,0.62)] text-[#f7e7b5] transition hover:bg-[rgba(22,46,29,0.82)]"
            aria-label="Next amenity"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {isPanelCollapsed ? (
        <button
          type="button"
          onClick={() => setIsPanelCollapsed(false)}
          className="fixed right-5 top-5 z-40 hidden h-10 w-10 items-center justify-center rounded-full border border-[#f0dd9b]/16 bg-[rgba(9,25,14,0.72)] text-[#f7e7b5] shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-[14px] transition hover:bg-[rgba(14,34,20,0.88)] xl:flex"
          aria-label="Open amenities sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      ) : (
        <aside className="fixed right-5 top-1/2 z-30 hidden w-[18.75rem] -translate-y-1/2 xl:block 2xl:w-[19.5rem]">
          <div className="relative max-h-[min(70vh,36rem)] overflow-hidden rounded-[1.55rem] border border-[#dfcf9b]/14 bg-[linear-gradient(180deg,rgba(8,24,13,0.76),rgba(8,24,13,0.42))] text-white shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-[18px] 2xl:max-h-[min(74vh,39rem)]">
            <div className="relative px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#efdfab]/68">
                    <Trees className="h-3.5 w-3.5 text-[#efcf73]" />
                    Field Guide
                  </div>
                  <h3 className={`${displaySerif.className} mt-2 text-[1.55rem] leading-none text-[#fff7df]`}>
                    Amenities
                  </h3>
                  <p className="mt-2 text-[13px] leading-5 text-[#f6f0de]/62">
                    A calmer guide to the green spaces.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPanelCollapsed(true)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#f0dd9b]/16 bg-[rgba(15,34,20,0.58)] text-[#f7e7b5] transition hover:bg-[rgba(22,46,29,0.82)]"
                  aria-label="Collapse amenities sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-[1.15rem] border border-white/8 bg-[rgba(7,20,11,0.34)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#efdfab]/56">
                      Now Showing
                    </p>
                    <p className={`${displaySerif.className} mt-1 text-[1.2rem] text-[#fff7df]`}>
                      {activeAmenity.title}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/8 bg-white/6 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
                    {activeIndex + 1}/{data.items.length}
                  </div>
                </div>
                <p className="mt-2 text-[13px] leading-5 text-[#f6f0de]/64">
                  {activeAmenity.shortDescription}
                </p>
              </div>
            </div>

            <div
              ref={setDesktopAmenitiesScrollAreaNode}
              className="custom-scrollbar overflow-y-auto overscroll-contain px-3.5 pb-3 snap-y snap-mandatory"
              style={
                desktopAmenitiesViewportHeightWithBuffer
                  ? { height: `${desktopAmenitiesViewportHeightWithBuffer}px` }
                  : undefined
              }
            >
              <div
                ref={setDesktopAmenitiesListNode}
                className="space-y-2.5 pb-2"
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
                      className={`w-full snap-start snap-always rounded-[1.1rem] border p-2 text-left transition ${
                        active
                          ? "border-[#efcf73]/32 bg-[rgba(13,31,18,0.74)] shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                          : "border-white/8 bg-[rgba(7,18,10,0.44)] hover:border-[#f0dd9b]/16 hover:bg-[rgba(9,23,13,0.62)]"
                      }`}
                    >
                      <AmenityCard amenity={amenity} active={active} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      )}

      <div
        className={`fixed inset-0 z-40 bg-[rgba(2,7,4,0.56)] backdrop-blur-md transition xl:hidden ${
          isPanelOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsPanelOpen(false)}
      />
      {isPanelOpen ? (
        <aside className="fixed inset-x-3 bottom-3 z-50 overflow-hidden rounded-[1.25rem] border border-[#dfcf9b]/16 bg-[linear-gradient(180deg,rgba(8,24,13,0.9),rgba(8,24,13,0.68))] text-white shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-[20px] sm:inset-x-4 sm:bottom-4 md:left-auto md:right-4 md:top-1/2 md:w-[18.75rem] md:max-h-[min(70dvh,38rem)] md:-translate-y-1/2 md:rounded-[1.45rem]">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#efdfab]/66">
                  {data.eyebrow}
                </p>
                <p className={`${displaySerif.className} mt-2 text-[1.45rem] leading-none text-[#fff7df]`}>
                  Amenities
                </p>
                <p className="mt-2 text-[13px] leading-5 text-[#f6f0de]/62">
                  Choose the next space.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#f0dd9b]/16 bg-[rgba(15,34,20,0.6)] text-[#f7e7b5]"
                aria-label="Close amenities"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={setMobileAmenitiesScrollAreaNode}
              className="custom-scrollbar overflow-y-auto overscroll-contain px-3.5 pb-3 snap-y snap-mandatory"
              style={
                mobileAmenitiesViewportHeightWithBuffer
                  ? { height: `${mobileAmenitiesViewportHeightWithBuffer}px` }
                  : undefined
              }
            >
              <div
                ref={setMobileAmenitiesListNode}
                className="space-y-2.5 pb-2"
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
                      className={`w-full snap-start snap-always rounded-[1.05rem] border p-2 text-left transition ${
                        active
                          ? "border-[#efcf73]/32 bg-[rgba(13,31,18,0.78)]"
                          : "border-white/8 bg-[rgba(7,18,10,0.52)]"
                      }`}
                    >
                      <AmenityCard amenity={amenity} active={active} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      ) : null}
      </div>
    </main>
  );
}
