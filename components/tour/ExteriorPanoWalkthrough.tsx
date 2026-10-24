"use client";

import { Cache, Viewer } from "@photo-sphere-viewer/core";
import { AutorotatePlugin } from "@photo-sphere-viewer/autorotate-plugin";
import { EquirectangularTilesAdapter } from "@photo-sphere-viewer/equirectangular-tiles-adapter";
import "@photo-sphere-viewer/core/index.css";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import TulaBrandPreloader from "@/components/ui/TulaBrandPreloader";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Clipboard,
  Maximize2,
  Menu,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { primeSignedAssetUrls } from "@/src/lib/signed-assets";
import { useSignedAssetUrls } from "@/src/lib/use-signed-assets";
import {
  exteriorAmenities,
  type ExteriorAmenity,
} from "@/data/exteriorAmenities";
import {
  EXTERIOR_MINIMAP_BOUNDS,
  EXTERIOR_MINIMAP_IMAGE_LAYOUT,
  EXTERIOR_MINIMAP_IMAGE_URL,
  EXTERIOR_MINIMAP_LOCATIONS,
  EXTERIOR_PANO_WORLD_UNITS_PER_METRE,
  type ExteriorMinimapLocation,
} from "@/data/exteriorMinimap";
import {
  clamp,
  degToRad,
  dotPlanar,
  negativeVec3,
  normalizePlanar,
  perpendicularRight,
  subVec3,
  wrapAngleRad,
  type Vec3,
} from "@/lib/exterior-tour/math";
import { useSnapListViewport } from "@/lib/useSnapListViewport";
import {
  buildExteriorTourGraph,
  getSequentialNodeIds,
  preserveViewYawBetweenNodes,
} from "@/lib/exterior-tour/nodes";
import {
  buildTileDescriptors,
  buildPhotoSpherePanorama,
  canUseTiledPanorama,
  PanoAssetStore,
  getResolvedPreviewUrl,
  selectPriorityTiles,
  type ExteriorPanoramaSource,
} from "@/lib/exterior-tour/pano";
import type {
  ExteriorPanoNodeSource,
  ExteriorTourGraph,
  ExteriorTourNode,
  NavigationDirection,
  PanoLoadState,
  PanoMeta,
  PanoTileDescriptor,
} from "@/lib/exterior-tour/types";

const editorialFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const uiFont = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const DEFAULT_ZOOM = 0;
const MIN_PITCH = -Math.PI / 2 + 0.08;
const MAX_PITCH = Math.PI / 2 - 0.08;
const EXTERIOR_SPHERE_RESOLUTION = 128;
const EXTERIOR_COMPACT_SPHERE_RESOLUTION = 64;
const EXTERIOR_APPLE_TOUCH_SPHERE_RESOLUTION = 64;
const EXTERIOR_MIN_FOV = 36;
const EXTERIOR_MAX_FOV = 74;
const IOS_PREVIEW_OVERLAY_FADE_MS = 180;
const PANO_TRANSITION_MS = 200;
const REDUCED_MOTION_CROSSFADE_MS = 120;
const RESOLVED_PANO_CACHE_LIMIT = 10;
const CACHE_MAX_ITEMS = 320;
const CACHE_TTL_MS = 1000 * 60 * 10;
const AUTOROTATE_IDLE_MS = 4000;
const TRAIL_ADVANCE_MS = 15000;
const DIRECTIONS: NavigationDirection[] = ["forward", "left", "right", "backward"];
const VIEW_DIRECTION_ALIGNMENT_FLOOR = 0.08;
// Dev pano angle tool is intentionally hard-disabled; keep the JSX below for
// future tuning without running debug state updates during walkthrough use.
const EXTERIOR_PANO_DEV_TOOL_ENABLED = false;
const TRACKPAD_PANO_YAW_RADIANS_PER_PIXEL = 0.0032;
const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const LOCAL_EXTERIOR_MINIMAP_IMAGE_URL = "/images/exterior-minimap-fallback.jpg";
// Single calibration value aligning world heading with the minimap image's north.
const EXTERIOR_MINIMAP_HEADING_OFFSET_DEG = -90;
const EXTERIOR_COMPACT_MINIMAP_ZOOM = 1.32;
const PREMIUM_OLIVE_GRADIENT = "walkthrough-glass-accent";
const PREMIUM_PANEL_SURFACE = "walkthrough-glass-panel";
const PREMIUM_PILL_SURFACE = "walkthrough-glass-chip";

function getExteriorPanoNodeId(frame: number) {
  return `PANO_Spline_F${String(frame).padStart(4, "0")}`;
}

function getPublicExteriorAssetBase(cdnBaseUrl: string) {
  if (/^https?:\/\//i.test(cdnBaseUrl)) {
    return cdnBaseUrl.replace(/\/+$/, "");
  }

  return `https://cdn.sthyra.com/${cdnBaseUrl.replace(/^\/+|\/+$/g, "")}`;
}

function getAmenityMenuImageSrc(
  image: string,
  signedAssetUrls: Record<string, string>,
) {
  return (
    signedAssetUrls[image] ??
    (/^(?:https?:\/\/|\/)/i.test(image) ? image : EMPTY_IMAGE_DATA_URL)
  );
}

const DESKTOP_WARMUP_PROFILE = {
  activeFocusLimit: 20,
  activeFocusConcurrency: 6,
  activeSweepLimit: 12,
  activeSweepConcurrency: 3,
  neighborNodeLimit: 2,
  neighborFocusLimit: 8,
  neighborFocusConcurrency: 3,
  transitionSpeed: 520,
};
const COMPACT_WARMUP_PROFILE = {
  activeFocusLimit: 12,
  activeFocusConcurrency: 3,
  activeSweepLimit: 6,
  activeSweepConcurrency: 2,
  neighborNodeLimit: 1,
  neighborFocusLimit: 4,
  neighborFocusConcurrency: 2,
  transitionSpeed: 360,
};
const IOS_WARMUP_PROFILE = {
  activeFocusLimit: 12,
  activeFocusConcurrency: 2,
  activeSweepLimit: 4,
  activeSweepConcurrency: 1,
  neighborNodeLimit: 1,
  neighborFocusLimit: 4,
  neighborFocusConcurrency: 1,
  transitionSpeed: 300,
};

type ExteriorPanoWalkthroughProps = {
  nodes: ExteriorPanoNodeSource[];
  cdnBaseUrl: string;
  initialNodeId?: string;
  initialSignedAssetUrls?: Record<string, string>;
  amenities?: ExteriorAmenity[];
  className?: string;
  title?: string;
  subtitle?: string;
  forceSequentialForwardBack?: boolean;
};

type ResolvedPano = {
  nodeId: string;
  panoId: string;
  meta: PanoMeta | null;
  panorama: ExteriorPanoramaSource;
  previewUrl: string;
  mode: "tiles" | "preview";
};

type ViewSnapshot = {
  yaw: number;
  pitch: number;
  zoom: number;
};

type FlythroughPhase = "idle" | "swap";

type MinimapPoint = {
  leftPercent: number;
  topPercent: number;
};

type ExteriorMinimapMarker = ExteriorMinimapLocation &
  MinimapPoint & {
    amenity: ExteriorAmenity | null;
  };

function waitForMotion(milliseconds: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => {
    globalThis.requestAnimationFrame(() => resolve());
  });
}

function createLoadState(
  phase: PanoLoadState["phase"],
  message: string,
  detailProgress = 0,
): PanoLoadState {
  return { phase, message, detailProgress };
}

function radToDeg(value: number) {
  return (value * 180) / Math.PI;
}

function roundDebugDegrees(value: number) {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function isAppleTouchPanoramaDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent ?? "";
  const platform = navigator.platform ?? "";
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const isiPhoneOrIPad = /iPad|iPhone|iPod/i.test(userAgent);
  const isiPadOSDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;

  return isiPhoneOrIPad || isiPadOSDesktopMode;
}

function formatDebugNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(4).replace(/\.?0+$/, "");
}

function getExteriorPreloaderProgress(
  loadState: PanoLoadState,
  hasFallbackPreview: boolean,
) {
  switch (loadState.phase) {
    case "idle":
      return 8;
    case "preview":
      return hasFallbackPreview ? 72 : 34;
    case "detail":
      return Math.round(40 + clamp(loadState.detailProgress, 0, 1) * 54);
    case "ready":
      return 100;
    case "error":
      return hasFallbackPreview ? 100 : 92;
    default:
      return 20;
  }
}

function getWheelPixelDelta(event: WheelEvent) {
  const scale =
    event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? window.innerWidth
        : 1;

  return {
    x: event.deltaX * scale,
    y: event.deltaY * scale,
  };
}

function scheduleIdle(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const hostWindow = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

  if (typeof hostWindow.requestIdleCallback === "function") {
    const id = hostWindow.requestIdleCallback(() => callback(), { timeout: 800 });
    return () => hostWindow.cancelIdleCallback?.(id);
  }

  const id = globalThis.setTimeout(callback, 160);
  return () => globalThis.clearTimeout(id);
}

function waitForIdle() {
  return new Promise<void>((resolve) => {
    scheduleIdle(resolve);
  });
}

async function preloadTileBatch(
  assetStore: PanoAssetStore,
  tiles: PanoTileDescriptor[],
  concurrency: number,
  fetchPriority: "high" | "low" | "auto" = "low",
  shouldContinue: () => boolean = () => true,
) {
  if (tiles.length === 0 || !shouldContinue()) {
    return;
  }

  const signedTiles = await assetStore.resolveSignedTiles(tiles);
  if (!shouldContinue()) {
    return;
  }

  let index = 0;
  const workerCount = Math.max(1, Math.min(concurrency, signedTiles.length));

  await Promise.allSettled(
    Array.from({ length: workerCount }, async () => {
      while (index < signedTiles.length && shouldContinue()) {
        const currentIndex = index;
        index += 1;
        const tile = signedTiles[currentIndex];
        if (!tile) {
          return;
        }

        if (currentIndex > 0 && currentIndex % workerCount === 0) {
          await waitForIdle();
        }

        if (!shouldContinue()) {
          return;
        }

        await assetStore.preloadImage(tile.url, fetchPriority);
      }
    }),
  );
}

function buildSweepTiles(
  panoId: string,
  meta: PanoMeta,
  baseUrl: string,
  excludeKeys: Set<string>,
  limit: number,
) {
  if (limit <= 0) {
    return [] as PanoTileDescriptor[];
  }

  const rows = meta.actualRows ?? meta.rows;
  const horizon = (rows - 1) / 2;

  return buildTileDescriptors(panoId, meta, baseUrl)
    .filter((tile) => !excludeKeys.has(tile.key))
    .sort((a, b) => {
      const aRowScore = Math.abs(a.row - horizon);
      const bRowScore = Math.abs(b.row - horizon);
      if (aRowScore !== bRowScore) {
        return aRowScore - bRowScore;
      }

      const aSpread = (a.col * 17 + a.row * 13) % 31;
      const bSpread = (b.col * 17 + b.row * 13) % 31;
      return aSpread - bSpread;
    })
    .slice(0, limit);
}

function getWarmupProfile(isCompactExperience: boolean) {
  if (isAppleTouchPanoramaDevice()) {
    return IOS_WARMUP_PROFILE;
  }

  return isCompactExperience ? COMPACT_WARMUP_PROFILE : DESKTOP_WARMUP_PROFILE;
}

function getViewForwardVector(node: ExteriorTourNode, yaw: number): Vec3 {
  const heading = Math.atan2(node.forward.y, node.forward.x) + yaw;

  return normalizePlanar(
    {
      x: Math.cos(heading),
      y: Math.sin(heading),
      z: 0,
    },
    node.forward,
  );
}

function getViewDirectionAxis(direction: NavigationDirection, viewForward: Vec3) {
  switch (direction) {
    case "left":
      return perpendicularRight(viewForward);
    case "right":
      return negativeVec3(perpendicularRight(viewForward));
    case "backward":
      return negativeVec3(viewForward);
    case "forward":
    default:
      return viewForward;
  }
}

/**
 * Double-clicking follows the way the visitor is currently looking.  The tour
 * path itself is deliberately sequential, but a visitor who turns around
 * should be able to retrace it without first pressing the on-screen back
 * arrow.
 */
function getSequentialDirectionForView(
  graph: ExteriorTourGraph,
  nodeId: string,
  currentYaw: number,
): Extract<NavigationDirection, "forward" | "backward"> {
  const node = graph.byId[nodeId];
  if (!node) {
    return "forward";
  }

  const { nextId, previousId } = getSequentialNodeIds(graph, nodeId);
  const viewForward = getViewForwardVector(node, currentYaw);
  const getAlignment = (targetId: string | null) => {
    const target = targetId ? graph.byId[targetId] : null;
    if (!target) {
      return Number.NEGATIVE_INFINITY;
    }

    return dotPlanar(
      normalizePlanar(subVec3(target.rawPosition, node.rawPosition), node.forward),
      viewForward,
    );
  };

  return getAlignment(previousId) > getAlignment(nextId)
    ? "backward"
    : "forward";
}

function getViewDirectionalCandidates(
  graph: ExteriorTourGraph,
  nodeId: string,
  direction: NavigationDirection,
  currentYaw: number,
  forceSequentialForwardBack = false,
) {
  const node = graph.byId[nodeId];
  if (!node) {
    return [] as Array<{ node: ExteriorTourNode; score: number }>;
  }

  if (
    forceSequentialForwardBack &&
    (direction === "forward" || direction === "backward")
  ) {
    const sequential = getSequentialNodeIds(graph, nodeId);
    const targetId =
      direction === "forward" ? sequential.nextId : sequential.previousId;
    const target = targetId ? graph.byId[targetId] : null;

    return target ? [{ node: target, score: 1 }] : [];
  }

  const viewForward = getViewForwardVector(node, currentYaw);
  const axis = getViewDirectionAxis(direction, viewForward);
  const neighborIds = new Set(node.neighbors.map((neighbor) => neighbor.id));
  const distanceScale = Math.max(graph.medianNearestDistance * 4, node.nearestDistance * 4, 1);

  const rankCandidates = (
    candidates: ExteriorTourNode[],
    alignmentFloor: number,
  ) =>
    candidates
    .map((candidate) => {
      const delta = subVec3(candidate.rawPosition, node.rawPosition);
      const candidateDirection = normalizePlanar(delta, axis);
      const alignment = dotPlanar(candidateDirection, axis);
      const distance = Math.hypot(delta.x, delta.y);
      const distanceBias = 1 - clamp(distance / distanceScale, 0, 1);
      const isNeighbor = neighborIds.has(candidate.id);
      const neighborBonus = isNeighbor ? 0.7 : 0;
      const farPenalty = isNeighbor ? 0 : 0.3;

      return {
        node: candidate,
        score: alignment * 1.8 + distanceBias * 0.42 + neighborBonus - farPenalty,
        alignment,
        distance,
      };
    })
    .filter((candidate) => candidate.alignment > alignmentFloor)
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (Math.abs(scoreDelta) > 0.035) {
        return scoreDelta;
      }

      return a.distance - b.distance;
    });

  const neighborCandidates = rankCandidates(
    node.neighbors
      .map((neighbor) => graph.byId[neighbor.id])
      .filter((candidate): candidate is ExteriorTourNode => Boolean(candidate)),
    VIEW_DIRECTION_ALIGNMENT_FLOOR,
  );

  if (neighborCandidates.length > 0) {
    return neighborCandidates;
  }

  const nearbyDistanceLimit = Math.max(
    graph.medianNearestDistance * 2.8,
    node.nearestDistance * 3.2,
    1,
  );

  return rankCandidates(
    graph.nodes.filter((candidate) => {
      if (candidate.id === node.id || neighborIds.has(candidate.id)) {
        return false;
      }

      const delta = subVec3(candidate.rawPosition, node.rawPosition);
      return Math.hypot(delta.x, delta.y) <= nearbyDistanceLimit;
    }),
    Math.max(VIEW_DIRECTION_ALIGNMENT_FLOOR, 0.18),
  );
}

function buildPreviewOnlyFallback(
  panorama: ExteriorPanoramaSource,
  previewUrl: string | null | undefined,
): ExteriorPanoramaSource | null {
  if (!previewUrl) {
    return null;
  }

  if (typeof panorama === "string" || !("tileUrl" in panorama)) {
    return previewUrl;
  }

  return {
    ...panorama,
    baseUrl: previewUrl,
    tileUrl: () => null,
  };
}

function ArrowButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`walkthrough-direction-button walkthrough-glass-button group flex h-10 w-10 touch-manipulation items-center justify-center rounded-full text-white/84 transition duration-200 active:scale-95 sm:h-11 sm:w-11 disabled:cursor-not-allowed disabled:opacity-28 ${PREMIUM_PILL_SURFACE}`}
    >
      <Icon className="h-4 w-4 stroke-[1.65] transition duration-200 group-hover:text-[#8bd3a7] sm:h-4.5 sm:w-4.5" />
    </button>
  );
}

function clampMinimapOffset(
  offset: { x: number; y: number },
  width: number,
  height: number,
  zoom: number,
) {
  if (zoom <= 1) {
    return { x: 0, y: 0 };
  }

  const maxX = ((zoom - 1) * width) / 2;
  const maxY = ((zoom - 1) * height) / 2;

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

const AmenityCard = forwardRef<
  HTMLButtonElement,
  {
    amenity: ExteriorAmenity;
    imageSrc: string;
    isActive: boolean;
    onClick: () => void;
    compact?: boolean;
  }
>(function AmenityCard(
  {
    amenity,
    imageSrc,
    isActive,
    onClick,
    compact,
  },
  ref,
) {
  const isCompact = compact ?? false;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`walkthrough-glass-card group w-full snap-start snap-always rounded-[1.45rem] text-left transition duration-200 ${
        isActive
          ? "walkthrough-glass-card-active text-[#1d3327]"
          : "text-[#20382b]"
      }`}
    >
      <div className="flex items-center gap-3 p-2.5">
        <div
          className={`relative h-16 w-[5.4rem] shrink-0 overflow-hidden rounded-[1rem] border border-white/22 bg-white/[0.12] sm:h-[5rem] sm:w-[7.1rem] ${
            isActive
              ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_26px_rgba(44,78,58,0.08)]"
              : "shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
          }`}
        >
          <Image
            src={imageSrc}
            alt={amenity.name}
            fill
            unoptimized
            sizes={isCompact ? "96px" : "130px"}
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          {/* <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.08)_0%,rgba(8,10,14,0.16)_100%)]" /> */}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className={`pr-2 text-[15px] font-semibold leading-[1.25] sm:text-[17px] ${
                  isActive ? "text-white" : "text-white/92"
                }`}
              >
                {amenity.name}
              </div>
              {!isCompact ? (
                <div
                  className={`mt-1 text-[13px] leading-5 ${
                    isActive ? "text-white/76" : "text-white/68"
                  }`}
                >
                  {amenity.summary}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
});

function CurrentAmenityPanel({
  name,
  description,
  className = "",
}: {
  name: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={`${uiFont.className} pointer-events-auto relative isolate px-3 py-4 text-white ${className}`}
    >
      <div className="pointer-events-none absolute inset-[-2.5rem] -z-10 bg-[radial-gradient(ellipse_at_28%_62%,rgba(0,0,0,0.68)_0%,rgba(0,0,0,0.36)_36%,transparent_72%)] blur-[10px]" />

      <div className="text-[9px] font-bold uppercase tracking-[0.34em] text-white/68 sm:text-[10px]">
        You are here
      </div>
      <h2
        className={`${editorialFont.className} mt-2 truncate text-[2.35rem] font-medium leading-[0.96] tracking-[-0.025em] text-white sm:text-[2.7rem]`}
      >
        {name}
      </h2>
      <span className="mt-4 block h-[2px] w-11 rounded-full bg-[#78c995] shadow-[0_0_12px_rgba(120,201,149,0.24)]" />
      <p
        className="mt-4 max-w-[17rem] text-[13px] font-medium leading-[1.7] text-white/74 sm:text-[14px]"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
          overflow: "hidden",
        }}
      >
        {description}
      </p>
    </div>
  );
}

function ExteriorMinimapGraphic({
  variant,
  signedMinimapImageUrl,
  fallbackMinimapImageUrl,
  minimapZoom,
  minimapOffset,
  isMinimapDragging,
  handleMinimapWheel,
  handleMinimapPointerDown,
  handleMinimapPointerMove,
  handleMinimapPointerUp,
  minimapDots,
  activeAmenityId,
  activeMinimapPoint,
  jumpToAmenity,
  onOpenCompact,
  className,
}: {
  variant: "compact" | "expanded";
  signedMinimapImageUrl: string;
  fallbackMinimapImageUrl: string;
  minimapZoom: number;
  minimapOffset: { x: number; y: number };
  isMinimapDragging: boolean;
  handleMinimapWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  handleMinimapPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleMinimapPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleMinimapPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  minimapDots: ExteriorMinimapMarker[];
  activeAmenityId: string | null;
  activeMinimapPoint: MinimapPoint;
  jumpToAmenity: (amenity: ExteriorAmenity) => Promise<boolean>;
  onOpenCompact?: () => void;
  className?: string;
}) {
  const minimapImageSrc =
    signedMinimapImageUrl && signedMinimapImageUrl !== EMPTY_IMAGE_DATA_URL
      ? signedMinimapImageUrl
      : fallbackMinimapImageUrl;
  const isCompact = variant === "compact";
  const compactTranslateX = (0.5 - activeMinimapPoint.leftPercent) * 100;
  const compactTranslateY = (0.5 - activeMinimapPoint.topPercent) * 100;

  const mapContents = (
    <div className="relative h-full w-full overflow-hidden bg-[#101612]">
      <Image
        src={minimapImageSrc}
        alt="Whispers of Trees exterior amenity minimap"
        unoptimized
        width={EXTERIOR_MINIMAP_IMAGE_LAYOUT.width}
        height={EXTERIOR_MINIMAP_IMAGE_LAYOUT.height}
        sizes={isCompact ? "176px" : "(max-width: 640px) 94vw, 72rem"}
        draggable={false}
        className="pointer-events-none absolute inset-0 block h-full w-full select-none object-cover brightness-[0.78] contrast-[1.08] saturate-[0.78]"
      />

      {minimapDots.map((marker) => (
        <button
          key={marker.id}
          type="button"
          aria-label={
            marker.amenity
              ? `Go to ${marker.name}`
              : `${marker.name} location`
          }
          title={marker.name}
          tabIndex={isCompact ? -1 : 0}
          disabled={!marker.amenity}
          onClick={(event) => {
            event.stopPropagation();
            if (!isCompact && marker.amenity) {
              void jumpToAmenity(marker.amenity);
            }
          }}
          className={`group absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition ${
            isCompact
              ? "pointer-events-none"
              : marker.amenity
                ? "hover:scale-110"
                : "cursor-default"
          } ${
            activeAmenityId === marker.id
              ? "border-white/90 bg-[#8bd3a7] shadow-[0_0_0_3px_rgba(120,201,149,0.2),0_0_12px_rgba(120,201,149,0.34)]"
              : "border-white/76 bg-white/82 shadow-[0_0_0_2px_rgba(0,0,0,0.18)]"
          }`}
          style={{
            left: `${marker.leftPercent * 100}%`,
            top: `${marker.topPercent * 100}%`,
          }}
        />
      ))}
    </div>
  );

  if (isCompact) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Expand minimap"
        onClick={onOpenCompact}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenCompact?.();
          }
        }}
        className={`walkthrough-compact-minimap relative aspect-square cursor-pointer overflow-hidden rounded-full border border-white/16 bg-black/72 shadow-[0_18px_44px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.1)] outline-none transition focus-visible:ring-2 focus-visible:ring-[#78c995]/80 ${className ?? ""}`}
        style={{ touchAction: "manipulation" }}
      >
        <div
          className="walkthrough-minimap-heading-layer absolute left-1/2 top-1/2 w-[225%] will-change-transform"
          style={{
            aspectRatio: `${EXTERIOR_MINIMAP_IMAGE_LAYOUT.width} / ${EXTERIOR_MINIMAP_IMAGE_LAYOUT.height}`,
          }}
        >
          <div
            className="relative h-full w-full will-change-transform"
            style={{
              transform: `translate(${compactTranslateX}%, ${compactTranslateY}%) scale(${EXTERIOR_COMPACT_MINIMAP_ZOOM})`,
              transformOrigin: "center center",
            }}
          >
            {mapContents}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,transparent_48%,rgba(0,0,0,0.34)_82%,rgba(0,0,0,0.66)_100%)] shadow-[inset_0_0_0_5px_rgba(2,4,3,0.42)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2">
          <span className="walkthrough-minimap-player-pulse absolute inset-0 rounded-full border border-[#86f3a9]/70 bg-[#78e89a]/18 shadow-[0_0_20px_rgba(120,232,154,0.46)]" />
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-[#86f3a9] shadow-[0_0_0_3px_rgba(39,119,62,0.4),0_0_16px_rgba(134,243,169,0.95)]" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`walkthrough-glass-map relative overflow-hidden rounded-[1.45rem] transition-[width,height,transform,opacity] duration-300 ${
        minimapZoom > 1
          ? isMinimapDragging
            ? "cursor-grabbing"
            : "cursor-grab"
          : "cursor-default"
      } ${className ?? ""}`}
      onWheelCapture={handleMinimapWheel}
      onPointerDown={handleMinimapPointerDown}
      onPointerMove={handleMinimapPointerMove}
      onPointerUp={handleMinimapPointerUp}
      onPointerCancel={handleMinimapPointerUp}
      style={{
        touchAction: "none",
        aspectRatio: `${EXTERIOR_MINIMAP_IMAGE_LAYOUT.width} / ${EXTERIOR_MINIMAP_IMAGE_LAYOUT.height}`,
      }}
    >
      <div
        className="absolute inset-0 transition-transform duration-150 ease-out"
        style={{
          transform: `translate(${minimapOffset.x}px, ${minimapOffset.y}px) scale(${minimapZoom})`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        {mapContents}
      </div>
    </div>
  );
}

function ExteriorMinimapPanel({
  isExpanded,
  onToggleExpanded,
  signedMinimapImageUrl,
  fallbackMinimapImageUrl,
  minimapZoom,
  minimapOffset,
  isMinimapDragging,
  handleMinimapWheel,
  handleMinimapPointerDown,
  handleMinimapPointerMove,
  handleMinimapPointerUp,
  minimapDots,
  activeAmenityId,
  activeMinimapPoint,
  jumpToAmenity,
  className,
  mapClassName,
}: {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  signedMinimapImageUrl: string;
  fallbackMinimapImageUrl: string;
  minimapZoom: number;
  minimapOffset: { x: number; y: number };
  isMinimapDragging: boolean;
  handleMinimapWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  handleMinimapPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleMinimapPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleMinimapPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  minimapDots: ExteriorMinimapMarker[];
  activeAmenityId: string | null;
  activeMinimapPoint: MinimapPoint;
  jumpToAmenity: (amenity: ExteriorAmenity) => Promise<boolean>;
  className?: string;
  mapClassName: string;
}) {
  if (!isExpanded) {
    return (
      <div className={`${uiFont.className} relative text-white ${className ?? ""}`}>
        <div className="relative ml-auto w-fit">
          <ExteriorMinimapGraphic
            variant="compact"
            signedMinimapImageUrl={signedMinimapImageUrl}
            fallbackMinimapImageUrl={fallbackMinimapImageUrl}
            minimapZoom={minimapZoom}
            minimapOffset={minimapOffset}
            isMinimapDragging={isMinimapDragging}
            handleMinimapWheel={handleMinimapWheel}
            handleMinimapPointerDown={handleMinimapPointerDown}
            handleMinimapPointerMove={handleMinimapPointerMove}
            handleMinimapPointerUp={handleMinimapPointerUp}
            minimapDots={minimapDots}
            activeAmenityId={activeAmenityId}
            activeMinimapPoint={activeMinimapPoint}
            jumpToAmenity={jumpToAmenity}
            onOpenCompact={onToggleExpanded}
            className={mapClassName}
          />
          <button
            type="button"
            aria-label="Expand minimap"
            onClick={onToggleExpanded}
            className={`walkthrough-glass-button absolute -right-1 -top-1 z-30 flex h-8 w-8 items-center justify-center rounded-full text-white/86 transition hover:text-[#8bd3a7] active:scale-95 ${PREMIUM_PILL_SURFACE}`}
          >
            <Maximize2 className="h-3.5 w-3.5 stroke-[1.7]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[1.85rem] ${PREMIUM_PANEL_SURFACE} ${className ?? ""}`}
    >
      <div className="relative z-10">
        <div className={`${uiFont.className} flex items-start justify-between gap-3 px-4 pb-3 pt-4 text-white`}>
          <div className="min-w-0">
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.26em] text-white/62">
              Amenity Map
            </div>
            <div className={`${editorialFont.className} mt-1 text-[1.55rem] leading-none text-white`}>
              Exterior Route
            </div>
          </div>
          <button
            type="button"
            aria-label={isExpanded ? "Collapse minimap" : "Expand minimap"}
            onClick={onToggleExpanded}
            className={`walkthrough-glass-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/86 transition hover:scale-105 active:scale-95 ${PREMIUM_PILL_SURFACE}`}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="px-4 pb-4">
          {/* <div className="mb-3 flex items-center justify-between gap-3">
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/78 ${PREMIUM_PILL_SURFACE}`}>
              {isExpanded ? "Tap outside to close" : "Expand for detail"}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/56">
              Scroll to zoom
            </span>
          </div> */}

          <ExteriorMinimapGraphic
            variant="expanded"
            signedMinimapImageUrl={signedMinimapImageUrl}
            fallbackMinimapImageUrl={fallbackMinimapImageUrl}
            minimapZoom={minimapZoom}
            minimapOffset={minimapOffset}
            isMinimapDragging={isMinimapDragging}
            handleMinimapWheel={handleMinimapWheel}
            handleMinimapPointerDown={handleMinimapPointerDown}
            handleMinimapPointerMove={handleMinimapPointerMove}
            handleMinimapPointerUp={handleMinimapPointerUp}
            minimapDots={minimapDots}
            activeAmenityId={activeAmenityId}
            activeMinimapPoint={activeMinimapPoint}
            jumpToAmenity={jumpToAmenity}
            className={mapClassName}
          />
        </div>
      </div>
    </div>
  );
}

export default function ExteriorPanoWalkthrough({
  nodes,
  cdnBaseUrl,
  initialNodeId,
  initialSignedAssetUrls = {},
  amenities = exteriorAmenities,
  className,
  title = "Exterior Walkthrough",
  subtitle = "Fast sphere-based exterior navigation",
  forceSequentialForwardBack = false,
}: ExteriorPanoWalkthroughProps) {
  primeSignedAssetUrls(initialSignedAssetUrls);
  const graph = useMemo(() => buildExteriorTourGraph(nodes), [nodes]);
  const quickNavigationAmenities = useMemo<ExteriorAmenity[]>(() => {
    const amenityMetadataById = new Map(
      amenities.map((amenity) => [amenity.id, amenity]),
    );
    const publicAssetBase = getPublicExteriorAssetBase(cdnBaseUrl);

    return EXTERIOR_MINIMAP_LOCATIONS.flatMap((location) => {
      const nodeIds = location.panoFrames
        .map(getExteriorPanoNodeId)
        .filter((nodeId) => Boolean(graph.byId[nodeId]));
      const preferredStartingNodeId = getExteriorPanoNodeId(
        location.startingPanoFrame,
      );
      const primaryNodeId = graph.byId[preferredStartingNodeId]
        ? preferredStartingNodeId
        : nodeIds[0];

      if (!primaryNodeId) {
        return [];
      }

      const primaryNode = graph.byId[primaryNodeId];
      const metadata = location.exteriorAmenityId
        ? amenityMetadataById.get(location.exteriorAmenityId)
        : null;
      const image =
        metadata?.image ??
        `${publicAssetBase}/${primaryNode.panoId}/preview.jpg`;

      return [
        {
          id: location.id,
          name: location.name,
          image,
          description:
            metadata?.description ??
            `Jump directly to the ${location.name} exterior walkthrough.`,
          nodeIds,
          primaryNodeId,
          startingPano: {
            name: primaryNode.panoId,
            nodeId: primaryNodeId,
            yaw: primaryNode.yaw,
            pitch: primaryNode.pitch,
            roll: primaryNode.roll,
            facingAxis: primaryNode.facingAxis,
            angle: primaryNode.yaw,
            viewYaw: primaryNode.yaw,
            viewPitch: primaryNode.pitch,
          },
          coordinate: {
            ...location.coordinate,
            z: 0,
          },
          summary: `${nodeIds.length} pano ${
            nodeIds.length === 1 ? "stop" : "stops"
          }`,
        },
      ];
    });
  }, [amenities, cdnBaseUrl, graph]);
  const signedAssetUrls = useSignedAssetUrls(
    quickNavigationAmenities
      .map((amenity) => amenity.image)
      .filter((image) => !/^(?:https?:\/\/|\/)/i.test(image)),
  );
  const initialRequestedNodeId =
    (initialNodeId && graph.byId[initialNodeId] ? initialNodeId : null) ??
    graph.nodes[0]?.id ??
    "";

  const [activeNodeId, setActiveNodeId] = useState(initialRequestedNodeId);
  const [loadState, setLoadState] = useState<PanoLoadState>(
    createLoadState("idle", "Preparing panorama"),
  );
  const [hasCompletedInitialPano, setHasCompletedInitialPano] = useState(false);
  const [isInitialPanoReady, setIsInitialPanoReady] = useState(false);
  const [isMinimapExpanded, setIsMinimapExpanded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobileAmenitiesOpen, setIsMobileAmenitiesOpen] = useState(false);
  const [isTrailPlaying, setIsTrailPlaying] = useState(false);
  const [flythroughPhase, setFlythroughPhase] =
    useState<FlythroughPhase>("idle");
  const [historyDepth, setHistoryDepth] = useState(0);
  const [trailSecondsRemaining, setTrailSecondsRemaining] = useState(
    Math.ceil(TRAIL_ADVANCE_MS / 1000),
  );
  const [minimapZoom, setMinimapZoom] = useState(1);
  const [minimapOffset, setMinimapOffset] = useState({ x: 0, y: 0 });
  const [isMinimapDragging, setIsMinimapDragging] = useState(false);
  const [isAppleTouchFallbackMode] = useState(false);
  const [fallbackPreviewUrl, setFallbackPreviewUrl] = useState<string | null>(null);
  const [previewOverlayUrl, setPreviewOverlayUrl] = useState<string | null>(null);
  const [isPreviewOverlayVisible, setIsPreviewOverlayVisible] = useState(false);
  const [copiedDebugPanoId, setCopiedDebugPanoId] = useState<string | null>(null);
  const [copiedDebugSnippetPanoId, setCopiedDebugSnippetPanoId] = useState<
    string | null
  >(null);
  const [liveDebugView, setLiveDebugView] = useState<ViewSnapshot>({
    yaw: 0,
    pitch: 0,
    zoom: DEFAULT_ZOOM,
  });
  const minimapDragRef = useRef<{
    pointerId: number | null;
    lastX: number;
    lastY: number;
    dragging: boolean;
  }>({
    pointerId: null,
    lastX: 0,
    lastY: 0,
    dragging: false,
  });

  const assetStore = useMemo(() => new PanoAssetStore(cdnBaseUrl), [cdnBaseUrl]);
  const walkthroughRootRef = useRef<HTMLElement | null>(null);
  const viewerHostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const navigationLockRef = useRef(false);
  const autorotatePluginRef = useRef<AutorotatePlugin | null>(null);
  const trailProgressFillRef = useRef<HTMLDivElement | null>(null);
  const nodeHistoryRef = useRef<string[]>([]);
  const panoTapRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    lastTapAt: number;
    lastTapX: number;
    lastTapY: number;
    lastDirection: NavigationDirection | null;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
    lastDirection: null,
  });
  const cacheRef = useRef(new Map<string, ResolvedPano>());
  const availabilityRef = useRef(new Map<string, "available" | "missing">());
  const availabilityPromiseRef = useRef(new Map<string, Promise<ResolvedPano>>());
  const viewRef = useRef<ViewSnapshot>({
    yaw: 0,
    pitch: 0,
    zoom: DEFAULT_ZOOM,
  });
  const activeNodeIdRef = useRef(activeNodeId);
  activeNodeIdRef.current = activeNodeId;
  const prefersCoarsePointerRef = useRef(false);
  const isCompactExperienceRef = useRef(false);
  const fallbackPreviewLoadIdRef = useRef(0);
  const previewOverlayLoadIdRef = useRef(0);
  const warmupRunIdRef = useRef(0);
  const previewOverlayHideTimeoutRef = useRef<
    ReturnType<typeof globalThis.setTimeout> | null
  >(null);
  const flythroughRunIdRef = useRef(0);
  const flythroughPhaseRef = useRef<FlythroughPhase>("idle");
  const prefersReducedMotionRef = useRef(false);
  const minimapHeadingFrameRef = useRef<number | null>(null);
  const minimapHeadingRotationRef = useRef(0);
  const minimapHeadingStateRef = useRef<{
    lastRawHeading: number | null;
    continuousHeading: number;
  }>({
    lastRawHeading: null,
    continuousHeading: 0,
  });

  const activeNode = graph.byId[activeNodeId];
  const sequential = useMemo(
    () => getSequentialNodeIds(graph, activeNodeId),
    [activeNodeId, graph],
  );
  const nextTrailNodeId = sequential.nextId ?? graph.order[0] ?? null;
  const activeAmenity = useMemo(
    () =>
      quickNavigationAmenities.find((amenity) =>
        amenity.nodeIds.includes(activeNodeId),
      ) ?? null,
    [activeNodeId, quickNavigationAmenities],
  );
  const signedMinimapImageUrl = EXTERIOR_MINIMAP_IMAGE_URL;
  const fallbackMinimapImageUrl = LOCAL_EXTERIOR_MINIMAP_IMAGE_URL;
  const activeAmenityId = useMemo(
    () => activeAmenity?.id ?? null,
    [activeAmenity],
  );
  const activeAmenityDescription =
    activeAmenity?.description ??
    "Explore the exterior route through gardens, arrivals, play courts, and community spaces.";
  const firstPanoPreloaderProgress = getExteriorPreloaderProgress(
    loadState,
    Boolean(fallbackPreviewUrl || previewOverlayUrl),
  );
  const exteriorPreloaderProgress = firstPanoPreloaderProgress;
  const visibleExteriorAmenities = useMemo(
    () => quickNavigationAmenities,
    [quickNavigationAmenities],
  );
  const {
    setFirstItemNode: setExteriorMenuFirstItemNode,
    setListNode: setExteriorMenuListNode,
    setScrollAreaNode: setExteriorMenuScrollAreaNode,
    viewportHeight: exteriorMenuViewportHeight,
  } = useSnapListViewport({
    itemCount: visibleExteriorAmenities.length,
    targetVisibleCards: 4,
  });
  const {
    setFirstItemNode: setMobileExteriorMenuFirstItemNode,
    setListNode: setMobileExteriorMenuListNode,
    setScrollAreaNode: setMobileExteriorMenuScrollAreaNode,
    viewportHeight: mobileExteriorMenuViewportHeight,
  } = useSnapListViewport({
    itemCount: visibleExteriorAmenities.length,
    targetVisibleCards: 4,
  });
  const projectMinimapPoint = useCallback(
    (coordinate: { x: number; y: number }) => {
      const horizontal = {
        x:
          EXTERIOR_MINIMAP_BOUNDS.topRight.x -
          EXTERIOR_MINIMAP_BOUNDS.topLeft.x,
        y:
          EXTERIOR_MINIMAP_BOUNDS.topRight.y -
          EXTERIOR_MINIMAP_BOUNDS.topLeft.y,
      };
      const vertical = {
        x:
          EXTERIOR_MINIMAP_BOUNDS.bottomRight.x -
          EXTERIOR_MINIMAP_BOUNDS.topRight.x,
        y:
          EXTERIOR_MINIMAP_BOUNDS.bottomRight.y -
          EXTERIOR_MINIMAP_BOUNDS.topRight.y,
      };
      const delta = {
        x: coordinate.x - EXTERIOR_MINIMAP_BOUNDS.topLeft.x,
        y: coordinate.y - EXTERIOR_MINIMAP_BOUNDS.topLeft.y,
      };
      const determinant =
        horizontal.x * vertical.y - horizontal.y * vertical.x;

      if (Math.abs(determinant) < Number.EPSILON) {
        return { leftPercent: 0.5, topPercent: 0.5 };
      }

      return {
        leftPercent: clamp(
          (delta.x * vertical.y - delta.y * vertical.x) / determinant,
          0,
          1,
        ),
        topPercent: clamp(
          (horizontal.x * delta.y - horizontal.y * delta.x) / determinant,
          0,
          1,
        ),
      };
    },
    [],
  );
  const activeMinimapPoint = useMemo<MinimapPoint>(() => {
    if (!activeNode) {
      return { leftPercent: 0.5, topPercent: 0.5 };
    }

    return projectMinimapPoint({
      x: activeNode.rawPosition.x / EXTERIOR_PANO_WORLD_UNITS_PER_METRE,
      y: -activeNode.rawPosition.y / EXTERIOR_PANO_WORLD_UNITS_PER_METRE,
    });
  }, [activeNode, projectMinimapPoint]);
  const updateMinimapHeading = useCallback(
    (yaw: number) => {
      const node = graph.byId[activeNodeIdRef.current];
      if (!node) {
        return;
      }

      const forward = getViewForwardVector(node, yaw);
      const rawHeading = Math.atan2(-forward.y, forward.x);
      const headingState = minimapHeadingStateRef.current;

      if (headingState.lastRawHeading === null) {
        headingState.continuousHeading = rawHeading;
      } else {
        headingState.continuousHeading += wrapAngleRad(
          rawHeading - headingState.lastRawHeading,
        );
      }

      headingState.lastRawHeading = rawHeading;
      minimapHeadingRotationRef.current =
        EXTERIOR_MINIMAP_HEADING_OFFSET_DEG -
        radToDeg(headingState.continuousHeading);

      if (minimapHeadingFrameRef.current !== null) {
        return;
      }

      minimapHeadingFrameRef.current = globalThis.requestAnimationFrame(() => {
        minimapHeadingFrameRef.current = null;
        walkthroughRootRef.current?.style.setProperty(
          "--exterior-minimap-rotation",
          `${minimapHeadingRotationRef.current}deg`,
        );
      });
    },
    [graph.byId],
  );
  const minimapDots = useMemo(() => {
    const amenityById = new Map(
      quickNavigationAmenities.map((amenity) => [amenity.id, amenity]),
    );

    return EXTERIOR_MINIMAP_LOCATIONS.map((location) => ({
      ...location,
      amenity: amenityById.get(location.id) ?? null,
      ...projectMinimapPoint(location.coordinate),
    }));
  }, [projectMinimapPoint, quickNavigationAmenities]);

  useEffect(() => {
    const fallbackYaw = activeNode ? degToRad(activeNode.yaw) : 0;
    const viewerYaw = viewerRef.current?.getPosition().yaw;
    updateMinimapHeading(viewerYaw ?? fallbackYaw);
  }, [activeNode, updateMinimapHeading]);

  useEffect(() => {
    return () => {
      if (minimapHeadingFrameRef.current !== null) {
        globalThis.cancelAnimationFrame(minimapHeadingFrameRef.current);
        minimapHeadingFrameRef.current = null;
      }
    };
  }, []);
  const exteriorMenuViewportHeightWithBuffer = exteriorMenuViewportHeight
    ? Math.ceil(exteriorMenuViewportHeight) + 16
    : null;
  const mobileExteriorMenuViewportHeightWithBuffer = mobileExteriorMenuViewportHeight
    ? Math.ceil(mobileExteriorMenuViewportHeight) + 16
    : null;
  const openMinimapExpanded = useCallback(() => {
    setIsMinimapExpanded(true);
  }, []);
  const closeMinimapExpanded = useCallback(() => {
    setIsMinimapExpanded(false);
  }, []);
  const resetMinimapView = useCallback(() => {
    minimapDragRef.current = {
      pointerId: null,
      lastX: 0,
      lastY: 0,
      dragging: false,
    };
    setIsMinimapDragging(false);
    setMinimapZoom(1);
    setMinimapOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!isMinimapExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMinimapExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMinimapExpanded]);

  const rememberResolvedPano = useCallback((resolved: ResolvedPano) => {
    const cache = cacheRef.current;

    if (cache.has(resolved.nodeId)) {
      cache.delete(resolved.nodeId);
    }

    cache.set(resolved.nodeId, resolved);

    while (cache.size > RESOLVED_PANO_CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      cache.delete(oldestKey);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      prefersReducedMotionRef.current = mediaQuery.matches;
    };

    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);

    return () => {
      mediaQuery.removeEventListener?.("change", updatePreference);
    };
  }, []);

  const hidePreviewOverlay = useCallback((delay = IOS_PREVIEW_OVERLAY_FADE_MS) => {
    if (flythroughPhaseRef.current !== "idle") {
      return;
    }

    if (previewOverlayHideTimeoutRef.current !== null) {
      globalThis.clearTimeout(previewOverlayHideTimeoutRef.current);
      previewOverlayHideTimeoutRef.current = null;
    }

    previewOverlayHideTimeoutRef.current = globalThis.setTimeout(() => {
      setIsPreviewOverlayVisible(false);
      previewOverlayHideTimeoutRef.current = null;
    }, delay);
  }, []);

  const preparePreviewOverlay = useCallback(
    async (previewUrl: string | null | undefined) => {
      if (!previewUrl) {
        return false;
      }

      if (previewOverlayHideTimeoutRef.current !== null) {
        globalThis.clearTimeout(previewOverlayHideTimeoutRef.current);
        previewOverlayHideTimeoutRef.current = null;
      }

      const loadId = ++previewOverlayLoadIdRef.current;

      await new Promise<void>((resolve) => {
        const image = new window.Image();
        image.decoding = "async";
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = previewUrl;
      });

      if (previewOverlayLoadIdRef.current !== loadId) {
        return false;
      }

      setPreviewOverlayUrl(previewUrl);
      setIsPreviewOverlayVisible(false);
      return true;
    },
    [],
  );

  const beginFlythrough = useCallback(async (showPreviewOverlay = true) => {
    const runId = ++flythroughRunIdRef.current;

    setIsPreviewOverlayVisible(showPreviewOverlay);
    flythroughPhaseRef.current = "swap";
    setFlythroughPhase("swap");

    await waitForAnimationFrame();

    return runId;
  }, []);

  const finishFlythrough = useCallback(async (runId: number | null) => {
    if (runId === null || flythroughRunIdRef.current !== runId) {
      return;
    }

    setIsPreviewOverlayVisible(false);
    flythroughPhaseRef.current = "idle";
    setFlythroughPhase("idle");
  }, []);

  const cancelFlythrough = useCallback(() => {
    flythroughRunIdRef.current += 1;
    setIsPreviewOverlayVisible(false);
    flythroughPhaseRef.current = "idle";
    setFlythroughPhase("idle");
  }, []);

  const resolvePano = useCallback(
    async (
      nodeId: string,
      options?: {
        previewPriority?: "high" | "low" | "auto";
      },
    ) => {
      const cached = cacheRef.current.get(nodeId);
      if (cached) {
        rememberResolvedPano(cached);
        return cached;
      }

      const pending = availabilityPromiseRef.current.get(nodeId);
      if (pending) {
        return pending;
      }

      const node = graph.byId[nodeId];
      if (!node) {
        throw new Error(`Unknown exterior node: ${nodeId}`);
      }

      const promise = (async () => {
        let meta: PanoMeta | null = null;
        let previewFile = "preview.jpg";
        let signedPreviewUrl: string | null = null;

        try {
          meta = await assetStore.getMeta(node.panoId);
        } catch {
          meta = null;
        }

        if (meta?.preview) {
          previewFile = meta.preview;
        }

        const previewUrl = getResolvedPreviewUrl(node.panoId, cdnBaseUrl, previewFile);

        try {
          signedPreviewUrl = await assetStore.preloadPreview(
            node.panoId,
            previewFile,
            options?.previewPriority ?? "high",
          );
        } catch (error) {
          if (!meta) {
            throw error;
          }
          console.warn(`Exterior preview warmup failed for ${node.panoId}`, error);
        }

        if (!signedPreviewUrl) {
          signedPreviewUrl = await assetStore.getSignedUrl(previewUrl);
        }

        if (meta) {
          const supportsTiles = canUseTiledPanorama(meta);

          if (!supportsTiles) {
            const resolved = {
              nodeId,
              panoId: node.panoId,
              meta,
              panorama: signedPreviewUrl,
              previewUrl: signedPreviewUrl,
              mode: "preview",
            } satisfies ResolvedPano;

            availabilityRef.current.set(nodeId, "available");
            rememberResolvedPano(resolved);
            return resolved;
          }

          const signedTileUrls = await assetStore.getSignedTileUrlMap(
            node.panoId,
            meta,
          );

          const resolved = {
            nodeId,
            panoId: node.panoId,
            meta,
            panorama: buildPhotoSpherePanorama(
              node.panoId,
              meta,
              cdnBaseUrl,
              true,
              signedPreviewUrl,
              signedTileUrls,
            ),
            previewUrl: signedPreviewUrl,
            mode: "tiles",
          } satisfies ResolvedPano;

          availabilityRef.current.set(nodeId, "available");
          rememberResolvedPano(resolved);
          return resolved;
        }

        const resolved = {
          nodeId,
          panoId: node.panoId,
          meta: null,
          panorama: signedPreviewUrl,
          previewUrl: signedPreviewUrl,
          mode: "preview",
        } satisfies ResolvedPano;

        availabilityRef.current.set(nodeId, "available");
        rememberResolvedPano(resolved);
        return resolved;
      })()
        .catch((error) => {
          availabilityRef.current.set(nodeId, "missing");
          throw error;
        })
        .finally(() => {
          availabilityPromiseRef.current.delete(nodeId);
        });

      availabilityPromiseRef.current.set(nodeId, promise);
      return promise;
    },
    [assetStore, cdnBaseUrl, graph, rememberResolvedPano],
  );

  const startWarmupRun = useCallback(() => {
    warmupRunIdRef.current += 1;
    return warmupRunIdRef.current;
  }, []);

  const preloadNodePreview = useCallback(
    async (
      nodeId: string,
      fetchPriority: "high" | "low" | "auto" = "high",
    ) => {
      const cached = cacheRef.current.get(nodeId);
      if (cached?.previewUrl) {
        await assetStore.preloadImage(cached.previewUrl, fetchPriority);
        return cached.previewUrl;
      }

      const node = graph.byId[nodeId];
      if (!node) {
        throw new Error(`Unknown exterior node: ${nodeId}`);
      }

      let previewFile = "preview.jpg";
      try {
        const meta = await assetStore.getMeta(node.panoId);
        previewFile = meta.preview ?? previewFile;
      } catch {
        // The preview can still be available when metadata is temporarily unavailable.
      }

      return assetStore.preloadPreview(
        node.panoId,
        previewFile,
        fetchPriority,
      );
    },
    [assetStore, graph],
  );

  const preloadResolvedFocusTiles = useCallback(
    async (
      resolved: ResolvedPano,
      view: ViewSnapshot,
      limit: number,
      concurrency: number,
      fetchPriority: "high" | "low" | "auto",
      runId: number,
    ) => {
      if (resolved.mode !== "tiles" || !resolved.meta) {
        return;
      }

      const shouldContinue = () => warmupRunIdRef.current === runId;
      if (!shouldContinue()) {
        return;
      }

      const focusTiles = selectPriorityTiles(
        resolved.panoId,
        resolved.meta,
        cdnBaseUrl,
        view,
        limit,
      );

      await preloadTileBatch(
        assetStore,
        focusTiles,
        concurrency,
        fetchPriority,
        shouldContinue,
      );
    },
    [assetStore, cdnBaseUrl],
  );

  useEffect(() => {
    Cache.enabled = true;
    Cache.maxItems = Math.max(Cache.maxItems, CACHE_MAX_ITEMS);
    Cache.ttl = Math.max(Cache.ttl, CACHE_TTL_MS);
    Cache.init();
  }, []);

  useEffect(() => {
    return () => {
      warmupRunIdRef.current += 1;
      flythroughRunIdRef.current += 1;
      flythroughPhaseRef.current = "idle";
      if (previewOverlayHideTimeoutRef.current !== null) {
        globalThis.clearTimeout(previewOverlayHideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasCompletedInitialPano) {
      return;
    }

    if (!isInitialPanoReady) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setHasCompletedInitialPano(true);
    }, 180);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    fallbackPreviewUrl,
    hasCompletedInitialPano,
    isInitialPanoReady,
    isAppleTouchFallbackMode,
  ]);

  useEffect(() => {
    if (!isAppleTouchFallbackMode || !activeNodeId) {
      return;
    }

    let cancelled = false;
    const loadId = ++fallbackPreviewLoadIdRef.current;

    void resolvePano(activeNodeId, { previewPriority: "high" })
      .then((resolved) => {
        const nextPreviewUrl = resolved.previewUrl;
        if (cancelled || !nextPreviewUrl) {
          return;
        }

        const image = new window.Image();
        image.decoding = "async";
        image.onload = () => {
          if (cancelled || fallbackPreviewLoadIdRef.current !== loadId) {
            return;
          }

          setFallbackPreviewUrl(nextPreviewUrl);
          setLoadState(createLoadState("ready", "Ready", 1));
          setIsInitialPanoReady(true);
        };
        image.onerror = () => {
          if (cancelled || fallbackPreviewLoadIdRef.current !== loadId) {
            return;
          }

          setFallbackPreviewUrl(nextPreviewUrl);
        };
        image.src = nextPreviewUrl;
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Exterior fallback preview load failed:", error);
        setLoadState(createLoadState("error", "Panorama unavailable"));
      });

    return () => {
      cancelled = true;
    };
  }, [activeNodeId, isAppleTouchFallbackMode, resolvePano]);

  useEffect(() => {
    const container = viewerHostRef.current;
    if (!container || !initialRequestedNodeId || isAppleTouchFallbackMode) {
      return;
    }

    let cancelled = false;
    let localViewer: Viewer | null = null;
    let retriedInitialPreviewImage = false;

    void (async () => {
      const isAppleTouchDevice = isAppleTouchPanoramaDevice();
      prefersCoarsePointerRef.current =
        window.matchMedia?.("(pointer: coarse)").matches ||
        navigator.maxTouchPoints > 0;
      isCompactExperienceRef.current =
        window.matchMedia?.("(max-width: 1279px)").matches ||
        prefersCoarsePointerRef.current;
      viewerHostRef.current!.style.touchAction = "none";
      // viewerHostRef.current!.style.webkitTapHighlightColor = "transparent";

      setLoadState(createLoadState("preview", "Loading panorama"));

      let initialResolved: ResolvedPano | null = null;
      const startCandidates = [
        initialRequestedNodeId,
        ...graph.order.filter((nodeId) => nodeId !== initialRequestedNodeId),
      ];

      for (const candidateId of startCandidates) {
        try {
          initialResolved = await resolvePano(candidateId);
          break;
        } catch {
          // Try the next pano folder that actually exists.
        }
      }

      if (!initialResolved || cancelled || !viewerHostRef.current) {
        setLoadState(createLoadState("error", "No available panorama"));
        return;
      }

      if (initialResolved.nodeId !== activeNodeIdRef.current) {
        startTransition(() => {
          setActiveNodeId(initialResolved!.nodeId);
        });
      }

      const initialNode = graph.byId[initialResolved.nodeId];
      const initialAmenity = amenities.find(
        (amenity) => amenity.startingPano.nodeId === initialResolved.nodeId,
      );
      const initialYaw = initialAmenity
        ? degToRad(initialAmenity.startingPano.viewYaw)
        : initialNode
          ? degToRad(initialNode.yaw)
          : 0;
      const initialPitch = initialAmenity
        ? clamp(degToRad(initialAmenity.startingPano.viewPitch), MIN_PITCH, MAX_PITCH)
        : initialNode
          ? clamp(degToRad(initialNode.pitch), MIN_PITCH, MAX_PITCH)
          : 0;
      const initialZoom = initialAmenity?.startingPano.viewZoom ?? DEFAULT_ZOOM;
      const initialPreviewFallback = buildPreviewOnlyFallback(
        initialResolved.panorama,
        initialResolved.previewUrl,
      );

      if (process.env.NODE_ENV !== "production") {
        console.log("Exterior pano viewer size", {
          w: viewerHostRef.current.clientWidth,
          h: viewerHostRef.current.clientHeight,
          appleTouch: isAppleTouchDevice,
          fallbackMode: isAppleTouchFallbackMode,
        });
      }

      localViewer = new Viewer({
        container: viewerHostRef.current,
        ...(initialResolved.mode === "tiles"
          ? {
              adapter: EquirectangularTilesAdapter.withConfig({
                resolution: isAppleTouchDevice
                  ? EXTERIOR_APPLE_TOUCH_SPHERE_RESOLUTION
                  : isCompactExperienceRef.current
                    ? EXTERIOR_COMPACT_SPHERE_RESOLUTION
                    : EXTERIOR_SPHERE_RESOLUTION,
                showErrorTile: false,
                baseBlur: true,
                antialias: true,
              }),
            }
          : {}),
        panorama: initialResolved.panorama,
        navbar: false,
        plugins: [
          AutorotatePlugin.withConfig({
            autostartDelay: AUTOROTATE_IDLE_MS,
            autostartOnIdle: true,
            autorotateSpeed: "0.55rpm",
            autorotatePitch: 0,
          }),
        ],
        touchmoveTwoFingers: false,
        mousewheelCtrlKey: false,
        defaultYaw: initialYaw,
        defaultPitch: initialPitch,
        defaultZoomLvl: initialZoom,
        minFov: EXTERIOR_MIN_FOV,
        maxFov: EXTERIOR_MAX_FOV,
        moveInertia: true,
        rendererParameters: {
          antialias: true,
          powerPreference:
            initialResolved.mode === "tiles" && !isAppleTouchDevice
              ? "high-performance"
              : "default",
        },
      });

      viewerRef.current = localViewer;
      autorotatePluginRef.current =
        localViewer.getPlugin<AutorotatePlugin>(AutorotatePlugin);

      localViewer.addEventListener("load-progress", ({ progress }) => {
        setLoadState(
          createLoadState("detail", "Streaming tiles", clamp(progress / 100, 0, 1)),
        );
      });

      localViewer.addEventListener("panorama-load", () => {
        setLoadState(createLoadState("preview", "Loading panorama"));
      });

      localViewer.addEventListener("panorama-loaded", () => {
        setLoadState(createLoadState("ready", "Ready", 1));
        setIsInitialPanoReady(true);
        hidePreviewOverlay();
      });

      localViewer.addEventListener("panorama-error", ({ error }) => {
        console.error("Exterior panorama error:", error);
        localViewer?.hideError();
        if (!retriedInitialPreviewImage && initialPreviewFallback && localViewer) {
          retriedInitialPreviewImage = true;
          setLoadState(createLoadState("preview", "Retrying panorama"));
          void localViewer
            .setPanorama(initialPreviewFallback, {
              position: {
                yaw: initialYaw,
                pitch: initialPitch,
              },
              zoom: initialZoom,
              showLoader: false,
            })
            .catch((fallbackError) => {
              console.error("Exterior initial preview fallback failed:", fallbackError);
              localViewer?.hideError();
              hidePreviewOverlay(0);
              setLoadState(createLoadState("error", "Panorama unavailable"));
            });
          return;
        }
        hidePreviewOverlay(0);
        setLoadState(createLoadState("error", "Panorama unavailable"));
      });

      localViewer.addEventListener("position-updated", ({ position }) => {
        viewRef.current = {
          ...viewRef.current,
          yaw: position.yaw,
          pitch: position.pitch,
        };
        updateMinimapHeading(position.yaw);
        if (EXTERIOR_PANO_DEV_TOOL_ENABLED) {
          setLiveDebugView((current) => ({
            ...current,
            yaw: position.yaw,
            pitch: position.pitch,
          }));
        }
      });

      localViewer.addEventListener("zoom-updated", ({ zoomLevel }) => {
        viewRef.current = {
          ...viewRef.current,
          zoom: zoomLevel,
        };
        if (EXTERIOR_PANO_DEV_TOOL_ENABLED) {
          setLiveDebugView((current) => ({
            ...current,
            zoom: zoomLevel,
          }));
        }
      });

      localViewer.addEventListener("ready", () => {
        const readyPosition = localViewer?.getPosition();
        const readyView = {
          yaw: readyPosition?.yaw ?? 0,
          pitch: readyPosition?.pitch ?? 0,
          zoom: localViewer?.getZoomLevel() ?? DEFAULT_ZOOM,
        };

        viewRef.current = readyView;
        updateMinimapHeading(readyView.yaw);
        if (EXTERIOR_PANO_DEV_TOOL_ENABLED) {
          setLiveDebugView(readyView);
        }
      });
    })();

    return () => {
      cancelled = true;
      localViewer?.destroy();
      if (viewerRef.current === localViewer) {
        viewerRef.current = null;
      }
      if (autorotatePluginRef.current) {
        autorotatePluginRef.current = null;
      }
    };
  }, [
    amenities,
    assetStore,
    cdnBaseUrl,
    graph,
    hidePreviewOverlay,
    initialRequestedNodeId,
    isAppleTouchFallbackMode,
    resolvePano,
    updateMinimapHeading,
  ]);

  useEffect(() => {
    if (!isInitialPanoReady || !activeNode || isAppleTouchFallbackMode) {
      return;
    }

    const runId = startWarmupRun();
    let cancelled = false;
    const shouldContinue = () =>
      !cancelled && warmupRunIdRef.current === runId;

    const cancelIdle = scheduleIdle(() => {
      void (async () => {
        try {
          const warmupProfile = getWarmupProfile(isCompactExperienceRef.current);
          const resolved = await resolvePano(activeNode.id, { previewPriority: "high" });
          if (!shouldContinue()) {
            return;
          }

          if (resolved.mode === "tiles" && resolved.meta) {
            const focusTiles = selectPriorityTiles(
              resolved.panoId,
              resolved.meta,
              cdnBaseUrl,
              {
                yaw: viewRef.current.yaw,
                pitch: viewRef.current.pitch,
                zoom: viewRef.current.zoom,
              },
              warmupProfile.activeFocusLimit,
            );

            await preloadTileBatch(
              assetStore,
              focusTiles,
              warmupProfile.activeFocusConcurrency,
              "high",
              shouldContinue,
            );

            if (!shouldContinue()) {
              return;
            }

            const sweepTiles = buildSweepTiles(
              resolved.panoId,
              resolved.meta,
              cdnBaseUrl,
              new Set(focusTiles.map((tile) => tile.key)),
              warmupProfile.activeSweepLimit,
            );

            await preloadTileBatch(
              assetStore,
              sweepTiles,
              warmupProfile.activeSweepConcurrency,
              "auto",
              shouldContinue,
            );
          }

          if (!shouldContinue()) {
            return;
          }

          const warmupIds = [
            ...new Set(
              DIRECTIONS.flatMap((direction) =>
                getViewDirectionalCandidates(
                  graph,
                  activeNode.id,
                  direction,
                  viewRef.current.yaw,
                  forceSequentialForwardBack,
                )
                  .slice(0, 1)
                  .map((candidate) => candidate.node.id),
              ),
            ),
          ]
            .filter((nodeId): nodeId is string => Boolean(nodeId))
            .slice(0, warmupProfile.neighborNodeLimit);

          for (const nodeId of warmupIds) {
            if (!shouldContinue()) {
              return;
            }

            const neighbor = graph.byId[nodeId];
            const neighborResolved = await resolvePano(nodeId, {
              previewPriority: "low",
            });

            await preloadResolvedFocusTiles(
              neighborResolved,
              {
                yaw: neighbor ? degToRad(neighbor.yaw) : 0,
                pitch: neighbor
                  ? clamp(degToRad(neighbor.pitch), MIN_PITCH, MAX_PITCH)
                  : 0,
                zoom: DEFAULT_ZOOM,
              },
              warmupProfile.neighborFocusLimit,
              warmupProfile.neighborFocusConcurrency,
              "low",
              runId,
            );
          }
        } catch {
          // Warmups are opportunistic and must never block the walkthrough.
        }
      })();
    });

    return () => {
      cancelled = true;
      if (warmupRunIdRef.current === runId) {
        warmupRunIdRef.current += 1;
      }
      cancelIdle();
    };
  }, [
    activeNode,
    assetStore,
    cdnBaseUrl,
    graph,
    forceSequentialForwardBack,
    isInitialPanoReady,
    isAppleTouchFallbackMode,
    preloadResolvedFocusTiles,
    resolvePano,
    startWarmupRun,
  ]);

  const pushNavigationHistory = useCallback((nodeId: string) => {
    try {
      const history = nodeHistoryRef.current;
      const latest = history[history.length - 1];

      if (latest !== nodeId) {
        history.push(nodeId);
      }

      while (history.length > 40) {
        history.shift();
      }

      setHistoryDepth(history.length);
    } catch (error) {
      console.warn("Failed to update exterior pano navigation history:", error);
      nodeHistoryRef.current = [];
      setHistoryDepth(0);
    }
  }, []);

  const jumpToNode = useCallback(
    async (
      targetId: string,
      options: {
        recordHistory?: boolean;
        viewYawDegrees?: number;
        viewPitchDegrees?: number;
        viewZoom?: number;
      } = {},
    ) => {
      if (isTransitioning || navigationLockRef.current) {
        return false;
      }

      const viewer = viewerRef.current;
      if (targetId === activeNodeIdRef.current) {
        const hasRequestedView =
          options.viewYawDegrees !== undefined ||
          options.viewPitchDegrees !== undefined ||
          options.viewZoom !== undefined;

        if (!viewer || !hasRequestedView) {
          return false;
        }

        const currentPosition = viewer.getPosition();
        const targetYaw =
          options.viewYawDegrees === undefined
            ? currentPosition.yaw
            : degToRad(options.viewYawDegrees);
        const targetPitch = clamp(
          options.viewPitchDegrees === undefined
            ? currentPosition.pitch
            : degToRad(options.viewPitchDegrees),
          MIN_PITCH,
          MAX_PITCH,
        );
        const targetZoom = options.viewZoom ?? DEFAULT_ZOOM;

        autorotatePluginRef.current?.stop();
        viewer.rotate({
          yaw: targetYaw,
          pitch: targetPitch,
        });
        viewer.zoom(targetZoom);
        viewRef.current = {
          yaw: targetYaw,
          pitch: targetPitch,
          zoom: targetZoom,
        };
        if (EXTERIOR_PANO_DEV_TOOL_ENABLED) {
          setLiveDebugView(viewRef.current);
        }
        return true;
      }

      const fromNode = graph.byId[activeNodeIdRef.current];
      const targetNode = graph.byId[targetId];
      if (!fromNode || !targetNode) {
        return false;
      }

      startWarmupRun();

      if (!viewer && isAppleTouchFallbackMode) {
        navigationLockRef.current = true;
        setIsTransitioning(true);
        setLoadState(createLoadState("preview", "Switching panorama"));
        let flythroughRunId: number | null = null;

        try {
          const target = await resolvePano(targetId, { previewPriority: "high" });
          if (isAppleTouchFallbackMode) {
            await preparePreviewOverlay(target.previewUrl);
          }
          flythroughRunId = await beginFlythrough();

          if (options.recordHistory !== false) {
            pushNavigationHistory(fromNode.id);
          }

          startTransition(() => {
            setActiveNodeId(targetId);
          });
          await waitForMotion(
            prefersReducedMotionRef.current
              ? REDUCED_MOTION_CROSSFADE_MS
              : PANO_TRANSITION_MS,
          );
          await finishFlythrough(flythroughRunId);

          return true;
        } catch (error) {
          console.error("Exterior amenity jump failed:", error);
          cancelFlythrough();
          setLoadState(createLoadState("error", "Panorama unavailable"));
          return false;
        } finally {
          globalThis.setTimeout(() => {
            navigationLockRef.current = false;
            setIsTransitioning(false);
          }, 120);
        }
      }

      if (!viewer) {
        return false;
      }

      const warmupProfile = getWarmupProfile(isCompactExperienceRef.current);
      navigationLockRef.current = true;
      autorotatePluginRef.current?.stop();
      setIsTransitioning(true);
      setLoadState(createLoadState("preview", "Switching panorama"));
      let flythroughRunId: number | null = null;

      try {
        const currentPosition = viewer.getPosition();
        const targetPitch = clamp(
          options.viewPitchDegrees === undefined
            ? currentPosition.pitch
            : degToRad(options.viewPitchDegrees),
          MIN_PITCH,
          MAX_PITCH,
        );
        const targetZoom = options.viewZoom ?? DEFAULT_ZOOM;
        const targetYaw =
          options.viewYawDegrees === undefined
            ? preserveViewYawBetweenNodes(
                fromNode,
                targetNode,
                currentPosition.yaw,
              )
            : degToRad(options.viewYawDegrees);

        const targetPromise = resolvePano(targetId, { previewPriority: "high" });
        await preloadNodePreview(targetId, "high").catch(() => null);

        const target = await targetPromise;
        const targetWarmupRunId = startWarmupRun();
        flythroughRunId = await beginFlythrough(false);
        void preloadResolvedFocusTiles(
          target,
          {
            yaw: targetYaw,
            pitch: targetPitch,
            zoom: targetZoom,
          },
          warmupProfile.activeFocusLimit,
          warmupProfile.activeFocusConcurrency,
          "high",
          targetWarmupRunId,
        );
        const panoramaOptions = {
          position: {
            yaw: targetYaw,
            pitch: targetPitch,
          },
          zoom: targetZoom,
          transition: {
            effect: "fade",
            rotation: false,
            speed: prefersReducedMotionRef.current
              ? REDUCED_MOTION_CROSSFADE_MS
              : Math.min(warmupProfile.transitionSpeed, PANO_TRANSITION_MS),
          },
          showLoader: false,
        } as const;
        let completed: boolean | void;
        try {
          completed = await viewer.setPanorama(target.panorama, panoramaOptions);
        } catch (previewTransitionError) {
          const fallbackPanorama = buildPreviewOnlyFallback(
            target.panorama,
            target.previewUrl,
          );
          if (!fallbackPanorama) {
            throw previewTransitionError;
          }
          completed = await viewer.setPanorama(fallbackPanorama, panoramaOptions);
        }

        if (completed !== false) {
          viewRef.current = {
            yaw: targetYaw,
            pitch: targetPitch,
            zoom: targetZoom,
          };
          if (EXTERIOR_PANO_DEV_TOOL_ENABLED) {
            setLiveDebugView(viewRef.current);
          }

          if (options.recordHistory !== false) {
            pushNavigationHistory(fromNode.id);
          }
          startTransition(() => {
            setActiveNodeId(targetId);
          });
          await finishFlythrough(flythroughRunId);

          return true;
        }
        cancelFlythrough();
        return false;
      } catch (error) {
        console.error("Exterior amenity jump failed:", error);
        viewer.hideError();
        cancelFlythrough();
        setLoadState(createLoadState("error", "Panorama unavailable"));
        return false;
      } finally {
        globalThis.setTimeout(() => {
          navigationLockRef.current = false;
          setIsTransitioning(false);
        }, 120);
      }
    },
    [
      beginFlythrough,
      cancelFlythrough,
      finishFlythrough,
      graph,
      isAppleTouchFallbackMode,
      isTransitioning,
      preloadNodePreview,
      preloadResolvedFocusTiles,
      preparePreviewOverlay,
      pushNavigationHistory,
      resolvePano,
      startWarmupRun,
    ],
  );

  const jumpToAmenity = useCallback(
    (amenity: ExteriorAmenity) =>
      jumpToNode(amenity.startingPano.nodeId, {
        viewYawDegrees: amenity.startingPano.viewYaw,
        viewPitchDegrees: amenity.startingPano.viewPitch,
        viewZoom: amenity.startingPano.viewZoom,
      }),
    [jumpToNode],
  );

  const jumpToAmenityFromExpandedMap = useCallback(
    async (amenity: ExteriorAmenity) => {
      const completed = await jumpToAmenity(amenity);

      if (completed) {
        resetMinimapView();
        closeMinimapExpanded();
      }

      return completed;
    },
    [closeMinimapExpanded, jumpToAmenity, resetMinimapView],
  );

  const handleMinimapWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const bounds = event.currentTarget.getBoundingClientRect();

      setMinimapZoom((current) => {
        const nextZoom = clamp(current + (event.deltaY < 0 ? 0.18 : -0.18), 1, 3.2);

        setMinimapOffset((currentOffset) =>
          clampMinimapOffset(currentOffset, bounds.width, bounds.height, nextZoom),
        );

        return nextZoom;
      });
    },
    [],
  );

  const handleMinimapPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (minimapZoom <= 1) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      minimapDragRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
        dragging: true,
      };
      setIsMinimapDragging(true);

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [minimapZoom],
  );

  const handleMinimapPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = minimapDragRef.current;
      if (!dragState.dragging || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const deltaX = event.clientX - dragState.lastX;
      const deltaY = event.clientY - dragState.lastY;
      const bounds = event.currentTarget.getBoundingClientRect();

      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;

      setMinimapOffset((current) =>
        clampMinimapOffset(
          {
            x: current.x + deltaX,
            y: current.y + deltaY,
          },
          bounds.width,
          bounds.height,
          minimapZoom,
        ),
      );
    },
    [minimapZoom],
  );

  const handleMinimapPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = minimapDragRef.current;
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      dragState.dragging = false;
      dragState.pointerId = null;
      setIsMinimapDragging(false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const navigateTo = useCallback(
    async (direction: NavigationDirection) => {
      if (isTransitioning || navigationLockRef.current) {
        return;
      }

      const viewer = viewerRef.current;
      const fromNode = graph.byId[activeNodeIdRef.current];
      if (!fromNode) {
        return;
      }

      startWarmupRun();

      if (!viewer && isAppleTouchFallbackMode) {
        navigationLockRef.current = true;
        setIsTransitioning(true);
        setLoadState(createLoadState("preview", "Switching panorama"));
        let flythroughRunId: number | null = null;

        try {
          const rankedCandidates = getViewDirectionalCandidates(
            graph,
            activeNodeIdRef.current,
            direction,
            viewRef.current.yaw,
            forceSequentialForwardBack,
          );

          let navigated = false;

          for (const candidate of rankedCandidates) {
            const targetId = candidate.node.id;
            if (targetId === activeNodeIdRef.current) {
              continue;
            }

            try {
              const target = await resolvePano(targetId, {
                previewPriority: "high",
              });
              if (isAppleTouchFallbackMode) {
                await preparePreviewOverlay(target.previewUrl);
              }
              flythroughRunId = await beginFlythrough();
            } catch {
              cancelFlythrough();
              availabilityRef.current.set(targetId, "missing");
              continue;
            }

            pushNavigationHistory(fromNode.id);

            startTransition(() => {
              setActiveNodeId(targetId);
            });
            await waitForMotion(
              prefersReducedMotionRef.current
                ? REDUCED_MOTION_CROSSFADE_MS
                : PANO_TRANSITION_MS,
            );
            await finishFlythrough(flythroughRunId);
            navigated = true;
            break;
          }

          if (!navigated) {
            throw new Error(`No available pano found for direction ${direction}`);
          }
        } catch (error) {
          console.error("Exterior navigation failed:", error);
          cancelFlythrough();
          setLoadState(createLoadState("error", "Panorama unavailable"));
        } finally {
          globalThis.setTimeout(() => {
            navigationLockRef.current = false;
            setIsTransitioning(false);
          }, 120);
        }
        return;
      }

      if (!viewer) {
        return;
      }

      const warmupProfile = getWarmupProfile(isCompactExperienceRef.current);
      navigationLockRef.current = true;
      autorotatePluginRef.current?.stop();
      setIsTransitioning(true);
      setLoadState(createLoadState("preview", "Switching panorama"));
 
      const currentPosition = viewer.getPosition();

      try {
        const rankedCandidates = getViewDirectionalCandidates(
          graph,
          activeNodeIdRef.current,
          direction,
          currentPosition.yaw,
          forceSequentialForwardBack,
        );
        const targetPitch = clamp(currentPosition.pitch, MIN_PITCH, MAX_PITCH);
        const targetZoom = DEFAULT_ZOOM;
        let navigated = false;

        for (const candidate of rankedCandidates) {
          const targetId = candidate.node.id;
          if (targetId === activeNodeIdRef.current) {
            continue;
          }

          const targetYaw = preserveViewYawBetweenNodes(
            fromNode,
            candidate.node,
            currentPosition.yaw,
          );
          let target: ResolvedPano;
          let flythroughRunId: number | null = null;

          try {
            const targetPromise = resolvePano(targetId, {
              previewPriority: "high",
            });
            await preloadNodePreview(targetId, "high").catch(() => null);

            target = await targetPromise;
          } catch {
            cancelFlythrough();
            availabilityRef.current.set(targetId, "missing");
            continue;
          }

          const targetWarmupRunId = startWarmupRun();
          flythroughRunId = await beginFlythrough(false);
          void preloadResolvedFocusTiles(
            target,
            {
              yaw: targetYaw,
              pitch: targetPitch,
              zoom: targetZoom,
            },
            warmupProfile.activeFocusLimit,
            warmupProfile.activeFocusConcurrency,
            "high",
            targetWarmupRunId,
          );

          try {
            const panoramaOptions = {
              position: {
                yaw: targetYaw,
                pitch: targetPitch,
              },
              zoom: targetZoom,
              transition: {
                effect: "fade",
                rotation: false,
                speed: prefersReducedMotionRef.current
                  ? REDUCED_MOTION_CROSSFADE_MS
                  : Math.min(warmupProfile.transitionSpeed, PANO_TRANSITION_MS),
              },
              showLoader: false,
            } as const;
            const completed = await viewer.setPanorama(target.panorama, panoramaOptions);

            if (completed === false) {
              cancelFlythrough();
              continue;
            }

            viewRef.current = {
              yaw: targetYaw,
              pitch: targetPitch,
              zoom: targetZoom,
            };
            if (EXTERIOR_PANO_DEV_TOOL_ENABLED) {
              setLiveDebugView(viewRef.current);
            }

            pushNavigationHistory(fromNode.id);

            startTransition(() => {
              setActiveNodeId(targetId);
            });
            await finishFlythrough(flythroughRunId);
            navigated = true;
            break;
          } catch (previewTransitionError) {
            const fallbackPanorama = buildPreviewOnlyFallback(
              target.panorama,
              target.previewUrl,
            );

            if (!fallbackPanorama) {
              cancelFlythrough();
              console.warn(
                `Exterior pano transition failed for ${target.panoId}`,
                previewTransitionError,
              );
              continue;
            }

            try {
              const targetYaw = preserveViewYawBetweenNodes(
                fromNode,
                candidate.node,
                currentPosition.yaw,
              );
              const completed = await viewer.setPanorama(fallbackPanorama, {
                position: {
                  yaw: targetYaw,
                  pitch: targetPitch,
                },
                zoom: targetZoom,
                transition: {
                  effect: "fade",
                  rotation: false,
                  speed: prefersReducedMotionRef.current
                    ? REDUCED_MOTION_CROSSFADE_MS
                    : Math.min(
                        warmupProfile.transitionSpeed,
                        PANO_TRANSITION_MS,
                      ),
                },
                showLoader: false,
              });

              if (completed === false) {
                cancelFlythrough();
                continue;
              }

              viewRef.current = {
                yaw: targetYaw,
                pitch: targetPitch,
                zoom: targetZoom,
              };
              if (EXTERIOR_PANO_DEV_TOOL_ENABLED) {
                setLiveDebugView(viewRef.current);
              }

              pushNavigationHistory(fromNode.id);

              startTransition(() => {
                setActiveNodeId(targetId);
              });
              await finishFlythrough(flythroughRunId);
              navigated = true;
              break;
            } catch (fallbackTransitionError) {
              cancelFlythrough();
              console.warn(
                `Exterior pano fallback transition failed for ${target.panoId}`,
                fallbackTransitionError,
              );
            }

            continue;
          }
        }

        if (!navigated) {
          cancelFlythrough();
          throw new Error(`No available pano found for direction ${direction}`);
        }
      } catch (error) {
        console.error("Exterior navigation failed:", error);
        viewer.hideError();
        cancelFlythrough();
        setLoadState(createLoadState("error", "Panorama unavailable"));
      } finally {
        globalThis.setTimeout(() => {
          navigationLockRef.current = false;
          setIsTransitioning(false);
        }, 120);
      }
    },
    [
      beginFlythrough,
      cancelFlythrough,
      finishFlythrough,
      forceSequentialForwardBack,
      graph,
      isAppleTouchFallbackMode,
      isTransitioning,
      preloadNodePreview,
      preloadResolvedFocusTiles,
      preparePreviewOverlay,
      pushNavigationHistory,
      resolvePano,
      startWarmupRun,
    ],
  );

  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host) {
      return;
    }

    const getTapDirection = () =>
      getSequentialDirectionForView(
        graph,
        activeNodeIdRef.current,
        viewerRef.current?.getPosition().yaw ?? viewRef.current.yaw,
      );

    const handleDoubleClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      void navigateTo(getTapDirection());
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        return;
      }

      panoTapRef.current.pointerId = event.pointerId;
      panoTapRef.current.startX = event.clientX;
      panoTapRef.current.startY = event.clientY;
    };

    const handlePointerUp = (event: PointerEvent) => {
      const tapState = panoTapRef.current;

      if (
        event.pointerType === "mouse" ||
        tapState.pointerId !== event.pointerId
      ) {
        return;
      }

      tapState.pointerId = null;

      const travel = Math.hypot(
        event.clientX - tapState.startX,
        event.clientY - tapState.startY,
      );

      if (travel > 14) {
        return;
      }

      const direction = getTapDirection();
      const now = performance.now();
      const isDoubleTap =
        now - tapState.lastTapAt < 320 &&
        Math.hypot(event.clientX - tapState.lastTapX, event.clientY - tapState.lastTapY) <
          34 &&
        tapState.lastDirection === direction;

      tapState.lastTapAt = now;
      tapState.lastTapX = event.clientX;
      tapState.lastTapY = event.clientY;
      tapState.lastDirection = direction;

      if (isDoubleTap) {
        event.preventDefault();
        event.stopPropagation();
        tapState.lastTapAt = 0;
        void navigateTo(direction);
      }
    };

    host.addEventListener("dblclick", handleDoubleClick);
    host.addEventListener("pointerdown", handlePointerDown);
    host.addEventListener("pointerup", handlePointerUp);

    return () => {
      host.removeEventListener("dblclick", handleDoubleClick);
      host.removeEventListener("pointerdown", handlePointerDown);
      host.removeEventListener("pointerup", handlePointerUp);
    };
  }, [graph, navigateTo]);

  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || isTransitioning) {
        return;
      }

      const viewer = viewerRef.current;
      if (!viewer) {
        return;
      }

      const wheelDelta = getWheelPixelDelta(event);
      const horizontalDelta =
        Math.abs(wheelDelta.x) >= Math.abs(wheelDelta.y) * 0.55
          ? wheelDelta.x
          : event.shiftKey
            ? wheelDelta.y
            : 0;

      if (Math.abs(horizontalDelta) < 0.5) {
        return;
      }

      event.preventDefault();
      autorotatePluginRef.current?.stop();

      const position = viewer.getPosition();
      const nextView = {
        yaw: wrapAngleRad(
          position.yaw +
            horizontalDelta * TRACKPAD_PANO_YAW_RADIANS_PER_PIXEL,
        ),
        pitch: position.pitch,
        zoom: viewer.getZoomLevel(),
      };

      viewer.rotate({
        yaw: nextView.yaw,
        pitch: nextView.pitch,
      });
      viewRef.current = nextView;
      if (EXTERIOR_PANO_DEV_TOOL_ENABLED) {
        setLiveDebugView(nextView);
      }
    };

    host.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      host.removeEventListener("wheel", handleWheel);
    };
  }, [isTransitioning]);

  const resetTrailProgress = useCallback(() => {
    if (trailProgressFillRef.current) {
      trailProgressFillRef.current.style.transform = "scaleX(0)";
    }
    setTrailSecondsRemaining(Math.ceil(TRAIL_ADVANCE_MS / 1000));
  }, []);

  useEffect(() => {
    if (!isTrailPlaying || !activeNode || graph.order.length < 2 || isTransitioning) {
      if (!isTrailPlaying) {
        resetTrailProgress();
      }
      return;
    }

    let animationFrameId: number | null = null;
    let cancelled = false;
    const startedAt = performance.now();
    const targetId = nextTrailNodeId;
    let lastSecond = Math.ceil(TRAIL_ADVANCE_MS / 1000);
    resetTrailProgress();

    const updateTrail = (now: number) => {
      if (cancelled) {
        return;
      }

      const elapsed = now - startedAt;
      const nextProgress = clamp(elapsed / TRAIL_ADVANCE_MS, 0, 1);

      if (trailProgressFillRef.current) {
        trailProgressFillRef.current.style.transform = `scaleX(${nextProgress})`;
      }

      const nextSecond = Math.max(
        0,
        Math.ceil((TRAIL_ADVANCE_MS - elapsed) / 1000),
      );
      if (nextSecond !== lastSecond) {
        lastSecond = nextSecond;
        setTrailSecondsRemaining(nextSecond);
      }

      if (nextProgress >= 1) {
        if (targetId && targetId !== activeNodeIdRef.current) {
          resetTrailProgress();
          void jumpToNode(targetId);
        }
        return;
      }

      animationFrameId = requestAnimationFrame(updateTrail);
    };

    animationFrameId = requestAnimationFrame(updateTrail);

    return () => {
      cancelled = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    activeNode,
    graph.order.length,
    isTransitioning,
    isTrailPlaying,
    jumpToNode,
    nextTrailNodeId,
    resetTrailProgress,
  ]);

  const toggleTrailPlayback = useCallback(() => {
    setIsTrailPlaying((current) => {
      const next = !current;
      if (!next) {
        autorotatePluginRef.current?.stop();
        resetTrailProgress();
      }
      return next;
    });
  }, [resetTrailProgress]);

  const skipToNextTrailNode = useCallback(() => {
    if (!nextTrailNodeId || isTransitioning) {
      return;
    }

    resetTrailProgress();
    void jumpToNode(nextTrailNodeId);
  }, [isTransitioning, jumpToNode, nextTrailNodeId, resetTrailProgress]);

  const goBackToPreviousNode = useCallback(() => {
    if (isTransitioning || historyDepth === 0) {
      return;
    }

    const previousNodeId = nodeHistoryRef.current.at(-1);

    if (!previousNodeId) {
      return;
    }

    resetTrailProgress();
    void jumpToNode(previousNodeId, { recordHistory: false }).then((completed) => {
      if (!completed) {
        return;
      }

      const latestNodeId = nodeHistoryRef.current.at(-1);
      if (latestNodeId === previousNodeId) {
        nodeHistoryRef.current.pop();
        setHistoryDepth(nodeHistoryRef.current.length);
      }
    });
  }, [historyDepth, isTransitioning, jumpToNode, resetTrailProgress]);

  const liveDebugYawDegrees = roundDebugDegrees(
    radToDeg(wrapAngleRad(liveDebugView.yaw)),
  );
  const liveDebugPitchDegrees = roundDebugDegrees(radToDeg(liveDebugView.pitch));
  const liveDebugSnippet = useMemo(() => {
    if (!activeNode) {
      return "";
    }

    const yaw = formatDebugNumber(liveDebugYawDegrees);
    const pitch = formatDebugNumber(liveDebugPitchDegrees);

    return [
      `startingPano: startingPano("${activeNode.panoId}", {`,
      `  yaw: ${yaw},`,
      `  pitch: ${pitch},`,
      `  angle: ${yaw},`,
      `  viewPitch: ${pitch},`,
      `}),`,
    ].join("\n");
  }, [activeNode, liveDebugPitchDegrees, liveDebugYawDegrees]);

  const copyDebugPanoId = useCallback(async () => {
    if (!activeNode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeNode.panoId);
      setCopiedDebugPanoId(activeNode.panoId);
      globalThis.setTimeout(() => {
        setCopiedDebugPanoId((current) =>
          current === activeNode.panoId ? null : current,
        );
      }, 1000);
    } catch (error) {
      console.error("Failed to copy exterior pano id:", error);
    }
  }, [activeNode]);

  const copyDebugStartingPano = useCallback(async () => {
    if (!activeNode || !liveDebugSnippet) {
      return;
    }

    try {
      await navigator.clipboard.writeText(liveDebugSnippet);
      setCopiedDebugSnippetPanoId(activeNode.panoId);
      globalThis.setTimeout(() => {
        setCopiedDebugSnippetPanoId((current) =>
          current === activeNode.panoId ? null : current,
        );
      }, 1000);
    } catch (error) {
      console.error("Failed to copy exterior starting pano snippet:", error);
    }
  }, [activeNode, liveDebugSnippet]);

  const reduceFlythroughMotion = prefersReducedMotionRef.current;
  const previewMotionStyle: CSSProperties = {
    opacity: isPreviewOverlayVisible ? 1 : 0,
    transitionProperty: "opacity",
    transitionDuration: `${
      reduceFlythroughMotion
        ? REDUCED_MOTION_CROSSFADE_MS
        : PANO_TRANSITION_MS
    }ms`,
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: flythroughPhase === "idle" ? "auto" : "opacity",
  };
  if (!activeNode) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-white/10 bg-black/30 text-white/70">
        No exterior panoramas found.
      </div>
    );
  }

  return (
    <section
      ref={walkthroughRootRef}
      aria-label={title}
      className={`relative isolate h-full min-h-[100svh] w-full overflow-hidden rounded-none border border-white/10 bg-[linear-gradient(180deg,#040608_0%,#05070a_50%,#040608_100%)] text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)] md:min-h-0 md:rounded-[2.25rem] ${className ?? ""}`}
    >
      <AnimatePresence initial={false}>
        {!hasCompletedInitialPano ? (
          <TulaBrandPreloader
            key="exterior-tula-preloader"
            progress={exteriorPreloaderProgress}
          />
        ) : null}
      </AnimatePresence>
      <div className="sr-only">{subtitle}</div>

      <div className="absolute inset-0 overflow-hidden rounded-none md:rounded-[2.25rem]">
        <div className="absolute inset-0" data-flythrough-phase={flythroughPhase}>
          {fallbackPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fallbackPreviewUrl}
              alt=""
              aria-hidden
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                isAppleTouchFallbackMode ? "opacity-100" : "opacity-0"
              }`}
              draggable={false}
            />
          ) : null}
          <div
            ref={viewerHostRef}
            className={`h-full min-h-[100svh] w-full select-none [touch-action:none] [-webkit-user-drag:none] [-webkit-user-select:none] md:min-h-0 ${
              isAppleTouchFallbackMode ? "opacity-0" : "opacity-100"
            }`}
          />
        </div>
        {previewOverlayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewOverlayUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            draggable={false}
            style={previewMotionStyle}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,7,0.18)_0%,rgba(4,8,7,0.03)_26%,rgba(4,8,7,0.05)_70%,rgba(4,8,7,0.24)_100%)]" />
        <div
          className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(0,0,0,0.1)_72%,rgba(0,0,0,0.18)_100%)] transition-opacity duration-200 ${
            isTransitioning ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:gap-4 sm:p-6">
        <div className="pointer-events-auto flex max-w-[78vw] items-start gap-3 sm:max-w-md">
          <button
            type="button"
            aria-label="Open amenities menu"
            onClick={() => setIsMobileAmenitiesOpen(true)}
            className={`walkthrough-glass-button flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] text-white/86 transition ${PREMIUM_PANEL_SURFACE}`}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className={`absolute inset-0 z-40 flex ${
          isMobileAmenitiesOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Close amenities menu"
          onClick={() => setIsMobileAmenitiesOpen(false)}
          className={`absolute inset-0 bg-[rgba(6,12,10,0.34)] backdrop-blur-[6px] transition duration-200 ${
            isMobileAmenitiesOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          className={`absolute left-2 top-2 flex h-fit w-[calc(100vw-1rem)] max-w-[22.5rem] max-h-[calc(100svh-1rem)] self-start flex-col gap-5 overflow-hidden rounded-[1.9rem] px-4 py-4 shadow-[0_24px_64px_rgba(0,0,0,0.22)] transition duration-300 sm:left-3 sm:top-3 sm:w-[25rem] sm:max-w-none sm:max-h-[calc(100svh-1.5rem)] md:left-4 md:top-4 md:w-[26rem] md:max-h-[calc(100svh-2rem)] xl:left-8 xl:top-28 xl:w-[24rem] xl:max-h-[calc(100svh-9rem)] 2xl:left-10 2xl:top-32 2xl:w-[25rem] 2xl:max-h-[calc(100svh-10rem)] ${PREMIUM_PANEL_SURFACE} ${
            isMobileAmenitiesOpen
              ? "translate-x-0"
              : "-translate-x-[calc(100%+0.5rem)] sm:-translate-x-[calc(100%+0.75rem)] md:-translate-x-[calc(100%+1rem)] xl:-translate-x-[calc(100%+2rem)] 2xl:-translate-x-[calc(100%+2.5rem)]"
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`${uiFont.className} text-[10px] uppercase tracking-[0.32em] text-white/62`}>
                  Amenities
                </div>
                <div className={`${editorialFont.className} mt-2 text-[2rem] leading-none text-white`}>
                  Walkthrough Stops
                </div>
                <div className={`${uiFont.className} mt-2 max-w-[14rem] truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/58 xl:hidden`}>
                  {activeAmenity?.name ?? "Exterior Trail"}
                </div>
              </div>

              <button
                type="button"
                aria-label="Close amenities menu"
                onClick={() => setIsMobileAmenitiesOpen(false)}
                className={`walkthrough-glass-button flex h-11 w-11 items-center justify-center rounded-[1rem] text-white/86 transition ${PREMIUM_PILL_SURFACE}`}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className={`${uiFont.className} mt-3 text-sm leading-6 text-white/72`}>
              Tap any amenity to jump into its exterior panorama.
            </div>
          </div>

          <div
            ref={setMobileExteriorMenuScrollAreaNode}
            className="custom-scrollbar min-h-0 flex-none overflow-y-auto overscroll-contain pr-1 snap-y snap-mandatory xl:hidden"
            style={
              mobileExteriorMenuViewportHeightWithBuffer
                ? {
                    height: `${mobileExteriorMenuViewportHeightWithBuffer}px`,
                    maxHeight: `${mobileExteriorMenuViewportHeightWithBuffer}px`,
                  }
                : undefined
            }
          >
            <div
              ref={setMobileExteriorMenuListNode}
              className="space-y-3 pb-3"
            >
              {visibleExteriorAmenities.map((amenity, index) => (
                <AmenityCard
                  key={amenity.id}
                  amenity={amenity}
                  imageSrc={getAmenityMenuImageSrc(
                    amenity.image,
                    signedAssetUrls,
                  )}
                  isActive={activeAmenityId === amenity.id}
                  compact
                  onClick={() => {
                    setIsMobileAmenitiesOpen(false);
                    void jumpToAmenity(amenity);
                  }}
                  ref={
                    index === 0
                      ? setMobileExteriorMenuFirstItemNode
                      : undefined
                  }
                />
              ))}
            </div>
          </div>

          <div
            ref={setExteriorMenuScrollAreaNode}
            className="custom-scrollbar hidden min-h-0 flex-none overflow-y-auto overscroll-contain pr-1 snap-y snap-mandatory xl:block"
            style={
              exteriorMenuViewportHeightWithBuffer
                ? {
                    height: `${exteriorMenuViewportHeightWithBuffer}px`,
                    maxHeight: `${exteriorMenuViewportHeightWithBuffer}px`,
                  }
                : undefined
            }
          >
            <div
              ref={setExteriorMenuListNode}
              className="space-y-3 pb-3"
            >
              {visibleExteriorAmenities.map((amenity, index) => (
                <AmenityCard
                  key={amenity.id}
                  amenity={amenity}
                  imageSrc={getAmenityMenuImageSrc(
                    amenity.image,
                    signedAssetUrls,
                  )}
                  isActive={activeAmenityId === amenity.id}
                  compact
                  onClick={() => {
                    setIsMobileAmenitiesOpen(false);
                    void jumpToAmenity(amenity);
                  }}
                  ref={
                    index === 0
                      ? setExteriorMenuFirstItemNode
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-5">
        <div className={`walkthrough-direction-rail flex flex-col items-center gap-1.5 rounded-full p-1.5 sm:gap-2 sm:p-2 ${PREMIUM_PANEL_SURFACE}`}>
          <ArrowButton
            icon={ArrowUp}
            label="Move forward"
            onClick={() => void navigateTo("forward")}
            disabled={isTransitioning}
          />
          <ArrowButton
            icon={ArrowLeft}
            label="Move left"
            onClick={() => void navigateTo("left")}
            disabled={isTransitioning}
          />
          <ArrowButton
            icon={ArrowRight}
            label="Move right"
            onClick={() => void navigateTo("right")}
            disabled={isTransitioning}
          />
          <ArrowButton
            icon={ArrowDown}
            label="Move back"
            onClick={() => void navigateTo("backward")}
            disabled={isTransitioning}
          />
        </div>
      </div>

      {EXTERIOR_PANO_DEV_TOOL_ENABLED ? (
        <div
          className={`${uiFont.className} pointer-events-none absolute inset-x-0 bottom-[8.65rem] z-30 hidden justify-center px-3 text-white md:flex`}
        >
          <div className="pointer-events-auto w-[min(42rem,calc(100vw-1.5rem))] rounded-[1rem] border border-emerald-300/24 bg-black/58 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-100/72">
                  Dev pano angles
                </div>
                <button
                  type="button"
                  onClick={() => void copyDebugPanoId()}
                  className="mt-1 block max-w-full truncate text-left text-xs font-semibold text-white/82 transition hover:text-white"
                  title="Copy pano name"
                >
                  {activeNode.panoId}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void copyDebugStartingPano()}
                className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/86 transition hover:border-white/30 hover:bg-white/16 active:scale-[0.98]"
              >
                {copiedDebugSnippetPanoId === activeNode.panoId ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Clipboard className="h-3.5 w-3.5" />
                )}
                {copiedDebugSnippetPanoId === activeNode.panoId ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] font-semibold">
              {[
                ["yaw", liveDebugYawDegrees],
                ["pitch", liveDebugPitchDegrees],
                ["angle", liveDebugYawDegrees],
                ["viewPitch", liveDebugPitchDegrees],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[0.7rem] border border-white/10 bg-white/[0.07] px-2 py-1.5"
                >
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/42">
                    {label}
                  </div>
                  <div className="mt-0.5 tabular-nums text-white/88">
                    {formatDebugNumber(value as number)}
                  </div>
                </div>
              ))}
            </div>

            <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap rounded-[0.8rem] border border-white/10 bg-black/42 p-3 text-[11px] leading-5 text-emerald-50/88">
              {liveDebugSnippet}
            </pre>
          </div>
        </div>
      ) : null}

      {EXTERIOR_PANO_DEV_TOOL_ENABLED ? (
        // Dev pano id chip kept here for future tuning, but disabled so it
        // cannot trigger clipboard/debug state updates during walkthrough use.
        <div
          className={`${uiFont.className} pointer-events-none absolute inset-x-0 bottom-[5.8rem] z-30 flex justify-center px-3 text-[11px] font-semibold text-white/78 sm:bottom-[6.1rem] sm:text-xs`}
        >
          <button
            type="button"
            onClick={() => void copyDebugPanoId()}
            className="pointer-events-auto max-w-[calc(100vw-1.5rem)] truncate rounded-full border border-white/12 bg-black/38 px-3 py-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:border-white/24 hover:bg-black/48 active:scale-[0.98]"
            title="Click to copy pano name"
          >
            {copiedDebugPanoId === activeNode.panoId ? "Copied " : ""}
            {activeNode.panoId}
          </button>
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute bottom-[5.25rem] left-5 z-30 hidden w-[19rem] xl:block 2xl:left-7 2xl:w-[20rem]"
      >
        <CurrentAmenityPanel
          name={activeAmenity?.name ?? "Exterior Trail"}
          description={activeAmenityDescription}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 hidden justify-end px-3 pl-[clamp(4.5rem,20vw,6.25rem)] xl:flex sm:bottom-4 sm:pl-[6rem] sm:pr-4 md:justify-center md:px-3">
        <div
          className={`${uiFont.className} pointer-events-auto flex h-[3.75rem] w-[min(40rem,calc(100vw-clamp(5rem,22vw,6.75rem)))] items-center gap-3 rounded-full px-3 text-white sm:w-[min(40rem,calc(100vw-6rem))] sm:px-4 md:w-[min(40rem,calc(100vw-1.5rem))] ${PREMIUM_PANEL_SURFACE}`}
        >
          <button
            type="button"
            aria-label={isTrailPlaying ? "Pause pano trail" : "Play pano trail"}
            onClick={toggleTrailPlayback}
            className={`walkthrough-glass-button relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-white transition active:scale-95 ${PREMIUM_OLIVE_GRADIENT}`}
          >
            {isTrailPlaying ? (
              <Pause className="relative h-4 w-4 stroke-[1.8]" />
            ) : (
              <Play className="relative ml-0.5 h-4 w-4 stroke-[1.8]" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-[12px] font-semibold text-white/88">
              <span className="truncate">
                {activeAmenity?.name ?? "Exterior Trail"}
              </span>
              <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/56">
                {sequential.index + 1} / {graph.order.length}
              </span>
            </div>

            <div className="relative mt-2 h-[2px] overflow-hidden rounded-full bg-white/22">
              <div
                ref={trailProgressFillRef}
                className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-[#78c995] shadow-[0_0_8px_rgba(120,201,149,0.32)] will-change-transform"
                style={{ transform: "scaleX(0)" }}
              />
            </div>
          </div>

          <div className="hidden min-w-[3.5rem] text-right text-[10px] font-semibold tabular-nums text-white/62 sm:block">
            0:{String(trailSecondsRemaining).padStart(2, "0")}
          </div>

          <div className="ml-0.5 flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              aria-label="Go back to previous pano"
              onClick={goBackToPreviousNode}
              disabled={isTransitioning || historyDepth === 0}
              className={`walkthrough-glass-button relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-white/82 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${PREMIUM_PILL_SURFACE}`}
            >
              <SkipBack className="relative h-4 w-4 stroke-[1.8]" />
            </button>

            <button
              type="button"
              aria-label="Next pano"
              onClick={skipToNextTrailNode}
              disabled={isTransitioning || !nextTrailNodeId}
              className={`walkthrough-glass-button relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-white/82 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${PREMIUM_PILL_SURFACE}`}
            >
              <SkipForward className="relative h-4 w-4 stroke-[1.8]" />
            </button>
          </div>
        </div>
      </div>

      {isMinimapExpanded ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close expanded exterior minimap"
            onClick={() => {
              resetMinimapView();
              closeMinimapExpanded();
            }}
            className="absolute inset-0 bg-[rgba(6,12,10,0.42)] backdrop-blur-[10px]"
          />
          <div className="relative z-10 w-[min(94vw,72rem)]">
            <ExteriorMinimapPanel
              isExpanded
              onToggleExpanded={() => {
                resetMinimapView();
                closeMinimapExpanded();
              }}
              signedMinimapImageUrl={signedMinimapImageUrl}
              fallbackMinimapImageUrl={fallbackMinimapImageUrl}
              minimapZoom={minimapZoom}
              minimapOffset={minimapOffset}
              isMinimapDragging={isMinimapDragging}
              handleMinimapWheel={handleMinimapWheel}
              handleMinimapPointerDown={handleMinimapPointerDown}
              handleMinimapPointerMove={handleMinimapPointerMove}
              handleMinimapPointerUp={handleMinimapPointerUp}
              minimapDots={minimapDots}
              activeAmenityId={activeAmenityId}
              activeMinimapPoint={activeMinimapPoint}
              jumpToAmenity={jumpToAmenityFromExpandedMap}
              className="mx-auto w-full max-w-[72rem] rounded-[2.2rem]"
              mapClassName="w-full"
            />
          </div>
        </div>
      ) : null}

      <div className="pointer-events-auto absolute bottom-3 right-3 z-30">
        <ExteriorMinimapPanel
          isExpanded={false}
          onToggleExpanded={openMinimapExpanded}
          signedMinimapImageUrl={signedMinimapImageUrl}
          fallbackMinimapImageUrl={fallbackMinimapImageUrl}
          minimapZoom={minimapZoom}
          minimapOffset={minimapOffset}
          isMinimapDragging={isMinimapDragging}
          handleMinimapWheel={handleMinimapWheel}
          handleMinimapPointerDown={handleMinimapPointerDown}
          handleMinimapPointerMove={handleMinimapPointerMove}
          handleMinimapPointerUp={handleMinimapPointerUp}
          minimapDots={minimapDots}
          activeAmenityId={activeAmenityId}
          activeMinimapPoint={activeMinimapPoint}
          jumpToAmenity={jumpToAmenity}
          className="w-28 sm:w-36 xl:w-[10.5rem] 2xl:w-44"
          mapClassName="h-28 w-28 sm:h-36 sm:w-36 xl:h-[10.5rem] xl:w-[10.5rem] 2xl:h-44 2xl:w-44"
        />
      </div>

      <style jsx global>{`
        .walkthrough-glass-panel,
        .walkthrough-glass-chip,
        .walkthrough-glass-map,
        .walkthrough-glass-button,
        .walkthrough-glass-card,
        .walkthrough-glass-accent {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(5, 7, 6, 0.58);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 18px 45px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(20px) saturate(1.05);
          -webkit-backdrop-filter: blur(20px) saturate(1.05);
          color: rgba(255, 255, 255, 0.94);
          transition:
            transform 180ms ease,
            border-color 180ms ease,
            background-color 180ms ease,
            color 180ms ease;
          text-shadow: none;
        }

        .walkthrough-glass-button,
        .walkthrough-glass-chip {
          background: rgba(4, 6, 5, 0.68);
        }

        .walkthrough-glass-card-active,
        .walkthrough-glass-accent {
          border-color: rgba(120, 201, 149, 0.58);
          background: rgba(5, 9, 7, 0.76);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 0 0 1px rgba(120, 201, 149, 0.1),
            0 14px 34px rgba(0, 0, 0, 0.3);
        }

        .walkthrough-direction-rail {
          background: rgba(3, 5, 4, 0.62);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            0 16px 36px rgba(0, 0, 0, 0.34);
        }

        .walkthrough-minimap-heading-layer {
          transform: translate3d(-50%, -50%, 0)
            rotate(var(--exterior-minimap-rotation, 0deg));
          transform-origin: center center;
          transition: transform 72ms linear;
        }

        .walkthrough-minimap-player-pulse {
          animation: walkthroughMinimapPulse 1.8s ease-in-out infinite;
        }

        @media (hover: hover) and (pointer: fine) {
          .walkthrough-glass-button:hover,
          .walkthrough-glass-chip:hover,
          .walkthrough-glass-card:hover {
            border-color: rgba(255, 255, 255, 0.22);
            background: rgba(8, 11, 9, 0.72);
          }

          .walkthrough-direction-button:hover {
            border-color: rgba(120, 201, 149, 0.7);
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.08),
              0 0 0 1px rgba(120, 201, 149, 0.12);
          }
        }

        .walkthrough-glass-button:active,
        .walkthrough-glass-chip:active,
        .walkthrough-glass-card:active,
        .walkthrough-glass-accent:active {
          transform: scale(0.968);
        }

        @media (prefers-reduced-motion: reduce) {
          .walkthrough-minimap-heading-layer {
            transition: none;
          }

          .walkthrough-minimap-player-pulse {
            animation: none;
          }
        }

        @keyframes walkthroughMinimapPulse {
          0%,
          100% {
            opacity: 0.42;
            transform: scale(0.92);
          }

          50% {
            opacity: 0.82;
            transform: scale(1.16);
          }
        }
      `}</style>

      {/* <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 sm:p-6">
        <div className={`${uiFont.className} flex items-center gap-3 rounded-full border border-white/10 bg-black/18 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/56 shadow-[0_14px_32px_rgba(0,0,0,0.24)] backdrop-blur-2xl`}>
          {loadState.phase === "preview" || loadState.phase === "detail" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          <span>{loadState.message}</span>
          <span>{Math.round(loadState.detailProgress * 100)}%</span>
        </div>
      </div> */}
    </section>
  );
}
