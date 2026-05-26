"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent,
  type WheelEvent,
} from "react";
import Image from "next/image";
import {
  Apple,
  Baby,
  Bike,
  Binoculars,
  BriefcaseBusiness,
  Building2,
  Dumbbell,
  Flame,
  Flower2,
  Landmark,
  Leaf,
  LocateFixed,
  Minus,
  MoonStar,
  PartyPopper,
  PawPrint,
  Plus,
  Sofa,
  Sparkles,
  SunMedium,
  TentTree,
  Trees,
  Trophy,
  WavesLadder,
} from "lucide-react";
import amenitiesCoordinatesData from "@/data/AminetiesCoordinates.json";
import { cn } from "@/lib/utils";

type AmenityCoordinate = {
  x: number;
  y: number;
  z: number;
};

type AmenityMarker = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
};

type Point = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

type AmenityIcon = ComponentType<React.SVGProps<SVGSVGElement> & { className?: string }>;

const IMAGE_WIDTH = 5460;
const IMAGE_HEIGHT = 3072;
const IMAGE_ASPECT_RATIO = IMAGE_WIDTH / IMAGE_HEIGHT;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.35;
const MANUAL_X_OFFSET_PERCENT = 1.9;
const AMENITY_GREEN = "#174c3f";

// Anchors supplied for mapping Unreal relative coordinates onto the exported master plan image.
const WORLD_TOP_LEFT = {
  x: -18766.631048,
  y: -11078.276278,
};

const WORLD_BOTTOM_RIGHT = {
  x: 14405.359863,
  y: 9903.154576,
};

const amenitiesCoordinates = amenitiesCoordinatesData as Record<string, AmenityCoordinate>;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatAmenityLabel(label: string) {
  return label
    .replace(/_/g, " ")
    .replace(/&/g, " & ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCoordinate(value: number, min: number, max: number) {
  if (max === min) {
    return 0;
  }

  return ((value - min) / (max - min)) * 100;
}

function getAmenityIcon(name: string): AmenityIcon {
  const key = name.toLowerCase();

  if (key.includes("business")) {
    return BriefcaseBusiness;
  }

  if (key.includes("poolbar") || key.includes("lounge")) {
    return Sofa;
  }

  if (key.includes("pool") || key.includes("ledge")) {
    return WavesLadder;
  }

  if (key.includes("club")) {
    return Building2;
  }

  if (key.includes("campfire")) {
    return Flame;
  }

  if (key.includes("pet")) {
    return PawPrint;
  }

  if (key.includes("gym") || key.includes("calisthenics")) {
    return Dumbbell;
  }

  if (
    key.includes("court") ||
    key.includes("stadium") ||
    key.includes("skating") ||
    key.includes("cycling") ||
    key.includes("frisbee") ||
    key.includes("game")
  ) {
    return key.includes("cycling") ? Bike : Trophy;
  }

  if (key.includes("children") || key.includes("kids") || key.includes("sandpit")) {
    return Baby;
  }

  if (key.includes("bird")) {
    return Binoculars;
  }

  if (key.includes("party") || key.includes("amphi")) {
    return PartyPopper;
  }

  if (key.includes("picnic") || key.includes("hammock")) {
    return TentTree;
  }

  if (key.includes("fruit")) {
    return Apple;
  }

  if (key.includes("butterfly") || key.includes("play lawn")) {
    return Sparkles;
  }

  if (key.includes("flower") || key.includes("rock") || key.includes("lilly")) {
    return Flower2;
  }

  if (
    key.includes("forest") ||
    key.includes("woods") ||
    key.includes("garden") ||
    key.includes("island") ||
    key.includes("path")
  ) {
    return key.includes("zen") ? Leaf : Trees;
  }

  return Landmark;
}

export default function ProjectLayoutMap() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPan: Point;
  } | null>(null);
  const skipBackgroundClickRef = useRef(false);

  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 });
  const [isNightMode, setIsNightMode] = useState(false);
  const [isTouchViewport, setIsTouchViewport] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeAmenityId, setActiveAmenityId] = useState<string | null>(null);

  const markers = useMemo<AmenityMarker[]>(() => {
    return Object.entries(amenitiesCoordinates)
      .map(([name, coordinate]) => ({
        id: name,
        label: formatAmenityLabel(name),
        xPercent: clamp(
          normalizeCoordinate(
            coordinate.x,
            WORLD_TOP_LEFT.x,
            WORLD_BOTTOM_RIGHT.x,
          ) + MANUAL_X_OFFSET_PERCENT,
          0,
          100,
        ),
        yPercent: normalizeCoordinate(
          coordinate.y,
          WORLD_TOP_LEFT.y,
          WORLD_BOTTOM_RIGHT.y,
        ),
      }))
      .filter(
        (marker) =>
          marker.xPercent >= 0 &&
          marker.xPercent <= 100 &&
          marker.yPercent >= 0 &&
          marker.yPercent <= 100,
      );
  }, []);

  const coverMapRect = useMemo(() => {
    const { width, height } = viewportSize;

    if (!width || !height) {
      return { width: 0, height: 0, left: 0, top: 0 };
    }

    const viewportAspectRatio = width / height;

    if (viewportAspectRatio > IMAGE_ASPECT_RATIO) {
      const coverWidth = width;
      const coverHeight = coverWidth / IMAGE_ASPECT_RATIO;

      return {
        width: coverWidth,
        height: coverHeight,
        left: 0,
        top: (height - coverHeight) / 2,
      };
    }

    const coverHeight = height;
    const coverWidth = coverHeight * IMAGE_ASPECT_RATIO;

    return {
      width: coverWidth,
      height: coverHeight,
      left: (width - coverWidth) / 2,
      top: 0,
    };
  }, [viewportSize]);

  const clampPan = useCallback(
    (nextPan: Point, nextZoom = zoom) => {
      if (nextZoom <= MIN_ZOOM + 0.01 && !isTouchViewport) {
        return { x: 0, y: 0 };
      }

      const maxPanX = Math.max(
        0,
        ((coverMapRect.width * nextZoom) - viewportSize.width) / 2,
      );
      const maxPanY = Math.max(
        0,
        ((coverMapRect.height * nextZoom) - viewportSize.height) / 2,
      );

      return {
        x: clamp(nextPan.x, -maxPanX, maxPanX),
        y: clamp(nextPan.y, -maxPanY, maxPanY),
      };
    },
    [
      coverMapRect.height,
      coverMapRect.width,
      isTouchViewport,
      viewportSize.height,
      viewportSize.width,
      zoom,
    ],
  );

  const applyZoom = useCallback(
    (nextZoom: number) => {
      const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      setZoom(clampedZoom);
      setPan((currentPan) => clampPan(currentPan, clampedZoom));
    },
    [clampPan],
  );

  useEffect(() => {
    const node = viewportRef.current;

    if (!node) {
      return;
    }

    const syncViewportSize = () => {
      setViewportSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    syncViewportSize();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncViewportSize);

    observer?.observe(node);
    window.addEventListener("resize", syncViewportSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncViewportSize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const touchViewportMedia = window.matchMedia("(max-width: 1366px)");

    const syncTouchViewport = () => {
      setIsTouchViewport(
        touchViewportMedia.matches && window.navigator.maxTouchPoints > 0,
      );
    };

    syncTouchViewport();
    touchViewportMedia.addEventListener("change", syncTouchViewport);

    return () => {
      touchViewportMedia.removeEventListener("change", syncTouchViewport);
    };
  }, []);

  const constrainedPan = useMemo(() => clampPan(pan, zoom), [clampPan, pan, zoom]);

  const handleZoomIn = useCallback(() => {
    applyZoom(zoom + ZOOM_STEP);
  }, [applyZoom, zoom]);

  const handleZoomOut = useCallback(() => {
    applyZoom(zoom - ZOOM_STEP);
  }, [applyZoom, zoom]);

  const handleResetView = useCallback(() => {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (zoom <= MIN_ZOOM + 0.01 && !isTouchViewport) {
        return;
      }

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPan: constrainedPan,
      };

      skipBackgroundClickRef.current = false;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [constrainedPan, isTouchViewport, zoom],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        skipBackgroundClickRef.current = true;
      }

      setPan(
        clampPan(
          {
            x: dragState.startPan.x + deltaX,
            y: dragState.startPan.y + deltaY,
          },
          zoom,
        ),
      );
    },
    [clampPan, zoom],
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();

      const zoomDelta = event.deltaY < 0 ? ZOOM_STEP / 2 : -ZOOM_STEP / 2;
      applyZoom(zoom + zoomDelta);
    },
    [applyZoom, zoom],
  );

  const isZoomedIn = zoom > MIN_ZOOM + 0.01;

  return (
    <section className="relative app-screen overflow-hidden bg-[#d7dde3] text-white">
      <div
        ref={viewportRef}
        className="absolute inset-0 overflow-hidden"
        style={{
          touchAction: "none",
          cursor: isDragging ? "grabbing" : isZoomedIn ? "grab" : "default",
        }}
        onClick={() => {
          if (skipBackgroundClickRef.current) {
            skipBackgroundClickRef.current = false;
            return;
          }

          setActiveAmenityId(null);
        }}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_38%),linear-gradient(180deg,rgba(20,24,31,0.14),rgba(20,24,31,0.3))]" />

        <div
          className="absolute will-change-transform"
          style={{
            width: coverMapRect.width,
            height: coverMapRect.height,
            left: coverMapRect.left,
            top: coverMapRect.top,
            transform: `translate3d(${constrainedPan.x}px, ${constrainedPan.y}px, 0) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <div className="relative h-full w-full select-none">
            <Image
              src="/map/Master_Plan.jpg.jpeg"
              alt="Project layout day view"
              fill
              priority
              draggable={false}
              sizes="100vw"
              className={cn(
                "pointer-events-none object-cover transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isNightMode ? "opacity-0" : "opacity-100",
              )}
            />
            <Image
              src="/map/Master_plan_Night.jpg.jpeg"
              alt="Project layout night view"
              fill
              priority
              draggable={false}
              sizes="100vw"
              className={cn(
                "pointer-events-none object-cover transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isNightMode ? "opacity-100" : "opacity-0",
              )}
            />

            <div className="absolute inset-0">
              {markers.map((marker) => {
                const isActive = activeAmenityId === marker.id;
                const Icon = getAmenityIcon(marker.id);

                return (
                  <button
                    key={marker.id}
                    type="button"
                    aria-label={marker.label}
                    className="group absolute"
                    style={{
                      left: `${marker.xPercent}%`,
                      top: `${marker.yPercent}%`,
                      transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                      transformOrigin: "center center",
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveAmenityId((currentId) =>
                        currentId === marker.id ? null : marker.id,
                      );
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <span
                      className={cn(
                        "absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-full border border-white/45 bg-black/42 px-3 py-1.5 text-[10px] font-medium tracking-[0.18em] text-white/92 shadow-[0_18px_36px_rgba(10,14,20,0.24)] backdrop-blur-xl transition-all duration-300 whitespace-nowrap",
                        isActive
                          ? "translate-y-0 opacity-100"
                          : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100",
                      )}
                    >
                      {marker.label}
                    </span>

                    <span
                      className={cn(
                        "relative flex h-7 w-7 items-center justify-center rounded-full border border-white/44 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(196,205,210,0.16))] shadow-[0_12px_28px_rgba(15,23,42,0.18)] backdrop-blur-xl transition duration-300 group-hover:border-[#2e7d67] group-hover:bg-[#174c3f] group-hover:shadow-[0_14px_28px_rgba(23,76,63,0.34)]",
                        isActive
                          ? "scale-115 border-[#2e7d67]"
                          : "group-hover:scale-110",
                      )}
                      style={{
                        backgroundColor: isActive ? AMENITY_GREEN : undefined,
                        boxShadow: isActive
                          ? "0 14px 28px rgba(23,76,63,0.34)"
                          : undefined,
                      }}
                      >
                      <span
                        className={cn(
                          "absolute inset-[7px] rounded-full blur-[4px] transition-opacity duration-300",
                          isActive ? "bg-white/36 opacity-100" : "bg-white/28 opacity-0 group-hover:opacity-100",
                        )}
                      />
                      <span
                        className={cn(
                          "absolute inset-[1.5px] rounded-full border backdrop-blur-xl transition-colors duration-300",
                          isActive
                            ? "border-white/14 bg-white/8"
                            : "border-white/34 bg-white/12 group-hover:border-white/14 group-hover:bg-white/8",
                        )}
                      />
                      <Icon
                        className={cn(
                          "relative h-3.5 w-3.5 transition-colors duration-300",
                          isActive ? "text-white" : "text-white/94 group-hover:text-white",
                        )}
                        style={{
                          filter: isActive
                            ? "drop-shadow(0 0 8px rgba(255,255,255,0.9))"
                            : "drop-shadow(0 0 4px rgba(255,255,255,0.42))",
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-4 top-1/2 z-20 -translate-y-1/2 sm:left-6">
        <div className="flex flex-col rounded-[22px] border border-white/28 bg-white/18 p-1.5 shadow-[0_20px_40px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-11 w-11 items-center justify-center rounded-[16px] text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="mx-2 h-px bg-white/18" />
          <button
            type="button"
            aria-label="Zoom out"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-11 w-11 items-center justify-center rounded-[16px] text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Minus className="h-5 w-5" />
          </button>
          <div className="mx-2 h-px bg-white/18" />
          <button
            type="button"
            aria-label="Reset zoom"
            onClick={handleResetView}
            disabled={zoom <= MIN_ZOOM + 0.01 && !isTouchViewport}
            className="flex h-11 w-11 items-center justify-center rounded-[16px] text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-4 sm:bottom-8">
        <div className="relative inline-flex rounded-full border border-white/28 bg-white/18 p-1.5 shadow-[0_20px_40px_rgba(15,23,42,0.2)] backdrop-blur-2xl">
          <span
            className={cn(
              "absolute top-1.5 bottom-1.5 rounded-full bg-white/92 shadow-[0_16px_28px_rgba(255,255,255,0.18)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isNightMode ? "translate-x-full" : "translate-x-0",
            )}
            style={{ left: 6, width: "calc(50% - 6px)" }}
          />

          <button
            type="button"
            aria-pressed={!isNightMode}
            onClick={() => setIsNightMode(false)}
            className={cn(
              "relative flex min-w-28 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors",
              isNightMode ? "text-white/76" : "text-slate-900",
            )}
          >
            <SunMedium className="h-4 w-4" />
            Day
          </button>
          <button
            type="button"
            aria-pressed={isNightMode}
            onClick={() => setIsNightMode(true)}
            className={cn(
              "relative flex min-w-28 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors",
              isNightMode ? "text-slate-900" : "text-white/76",
            )}
          >
            <MoonStar className="h-4 w-4" />
            Night
          </button>
        </div>
      </div>
    </section>
  );
}
