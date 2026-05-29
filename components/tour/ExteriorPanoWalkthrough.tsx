"use client";

import { Cache, Viewer } from "@photo-sphere-viewer/core";
import { AutorotatePlugin } from "@photo-sphere-viewer/autorotate-plugin";
import { EquirectangularTilesAdapter } from "@photo-sphere-viewer/equirectangular-tiles-adapter";
import "@photo-sphere-viewer/core/index.css";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Image from "next/image";
import TrifectaPreloader from "@/components/ui/Preloader";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Clipboard,
  Map as MapIcon,
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
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { primeSignedAssetUrls } from "@/src/lib/signed-assets";
import { useSignedAssetUrls } from "@/src/lib/use-signed-assets";
import {
  EXTERIOR_MINIMAP_IMAGE_URL,
  EXTERIOR_MINIMAP_BOUNDS,
  EXTERIOR_MINIMAP_IMAGE_LAYOUT,
  exteriorAmenities,
  type ExteriorAmenity,
} from "@/data/exteriorAmenities";
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
const PREMIUM_OLIVE_GRADIENT =
  "bg-[radial-gradient(circle_at_32%_25%,#69895e_0%,#45603c_58%,#2a452d_100%)]";
const PREMIUM_PANEL_SURFACE =
  "border border-[#d7bf80]/80 bg-[linear-gradient(145deg,rgba(250,248,239,0.96)_0%,rgba(238,242,231,0.92)_58%,rgba(250,247,236,0.98)_100%)] text-[#1f3f2b] shadow-[0_26px_70px_rgba(21,47,30,0.24),inset_0_1px_0_rgba(255,255,255,0.94),inset_0_0_0_1px_rgba(255,255,255,0.36)] backdrop-blur-[28px]";
const PREMIUM_PILL_SURFACE =
  "border border-[#ded8c9] bg-[#fbfaf4]/94 text-[#456859] shadow-[0_10px_24px_rgba(33,50,35,0.10),inset_0_1px_0_rgba(255,255,255,0.92)]";

const DESKTOP_WARMUP_PROFILE = {
  activeFocusLimit: 320,
  activeFocusConcurrency: 32,
  activeSweepLimit: 1120,
  activeSweepConcurrency: 24,
  neighborNodeLimit: 10,
  neighborFocusLimit: 144,
  neighborFocusConcurrency: 24,
  neighborSweepLimit: 320,
  neighborSweepConcurrency: 18,
  transitionSpeed: 520,
};
const COMPACT_WARMUP_PROFILE = {
  activeFocusLimit: 112,
  activeFocusConcurrency: 12,
  activeSweepLimit: 280,
  activeSweepConcurrency: 8,
  neighborNodeLimit: 5,
  neighborFocusLimit: 48,
  neighborFocusConcurrency: 8,
  neighborSweepLimit: 80,
  neighborSweepConcurrency: 5,
  transitionSpeed: 360,
};
const IOS_WARMUP_PROFILE = {
  activeFocusLimit: 24,
  activeFocusConcurrency: 2,
  activeSweepLimit: 0,
  activeSweepConcurrency: 1,
  neighborNodeLimit: 1,
  neighborFocusLimit: 8,
  neighborFocusConcurrency: 1,
  neighborSweepLimit: 0,
  neighborSweepConcurrency: 1,
  transitionSpeed: 300,
};

type ExteriorPanoWalkthroughProps = {
  nodes: ExteriorPanoNodeSource[];
  cdnBaseUrl: string;
  initialNodeId?: string;
  initialSignedAssetUrls?: Record<string, string>;
  className?: string;
  title?: string;
  subtitle?: string;
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
) {
  const signedTiles = await assetStore.resolveSignedTiles(tiles);
  let index = 0;
  const workerCount = Math.max(1, Math.min(concurrency, signedTiles.length));

  await Promise.allSettled(
    Array.from({ length: workerCount }, async () => {
      while (index < tiles.length) {
        const currentIndex = index;
        index += 1;
        const tile = signedTiles[currentIndex];
        if (!tile) {
          return;
        }

        if (currentIndex > 0 && currentIndex % workerCount === 0) {
          await waitForIdle();
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

function getViewDirectionalCandidates(
  graph: ExteriorTourGraph,
  nodeId: string,
  direction: NavigationDirection,
  currentYaw: number,
) {
  const node = graph.byId[nodeId];
  if (!node) {
    return [] as Array<{ node: ExteriorTourNode; score: number }>;
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

function withoutBasePreview(panorama: ExteriorPanoramaSource) {
  if (typeof panorama === "string" || !("tileUrl" in panorama) || !("baseUrl" in panorama)) {
    return null;
  }

  const tileOnlyPanorama = { ...panorama };
  delete (tileOnlyPanorama as { baseUrl?: string }).baseUrl;

  return tileOnlyPanorama;
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
      className={`group flex h-10 w-10 touch-manipulation items-center justify-center rounded-[1rem] border text-[#355139] transition duration-200 active:scale-95 sm:h-11 sm:w-11 sm:rounded-[1.05rem] disabled:cursor-not-allowed disabled:opacity-30 ${PREMIUM_PILL_SURFACE} hover:border-[#bca56e] hover:bg-[#fffdf7] hover:text-[#23482f]`}
    >
      <Icon className="h-4 w-4 transition duration-200 group-hover:scale-110 sm:h-4.5 sm:w-4.5" />
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
      className={`group w-full snap-start snap-always rounded-[1.45rem] border text-left transition duration-200 ${
        isActive
          ? `${PREMIUM_OLIVE_GRADIENT} border-[#6d8652] text-[#fff7e4] shadow-[0_18px_38px_rgba(33,57,36,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]`
          : "border-[#e2d8c2] bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(244,238,226,0.95))] text-[#1f3f2b] shadow-[0_14px_28px_rgba(43,52,37,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] hover:border-[#d1be8f] hover:bg-[#fffdf7]"
      }`}
    >
      <div className="flex items-center gap-3 p-2.5">
        <div
          className={`relative h-16 w-[5.4rem] shrink-0 overflow-hidden rounded-[1rem] border sm:h-[5rem] sm:w-[7.1rem] ${
            isActive
              ? "border-[#dccc9d]/55 bg-[rgba(255,249,236,0.12)]"
              : "border-[#dcca9d]/65 bg-[#ede5d4]"
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
                  isActive ? "text-[#fff6df]" : "text-[#21462d]"
                }`}
              >
                {amenity.name}
              </div>
              {!isCompact ? (
                <div
                  className={`mt-1 text-[13px] leading-5 ${
                    isActive ? "text-[#f7efd9]/78" : "text-[#6f7d70]"
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
  nodeIds,
  activeNodeId,
  progressIndex,
  isMapExpanded,
  onViewMap,
  className = "",
}: {
  name: string;
  description: string;
  nodeIds: string[];
  activeNodeId: string;
  progressIndex: number;
  isMapExpanded: boolean;
  onViewMap: () => void;
  className?: string;
}) {
  return (
    <div
      className={`${uiFont.className} pointer-events-auto relative overflow-hidden rounded-[2rem] ${PREMIUM_PANEL_SURFACE} ${className}`}
    >
      <div className="pointer-events-none absolute inset-[8px] rounded-[1.6rem] border border-[#ead8a4]/60" />
      <div className="pointer-events-none absolute -right-8 bottom-0 h-44 w-28 opacity-35">
        <Image
          src="/flowerUI.png"
          alt=""
          fill
          sizes="160px"
          className="object-contain object-bottom-right mix-blend-multiply"
        />
      </div>

      <div className="relative z-10 px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#687866]">
              You are here
            </div>
            <div
              className={`${editorialFont.className} mt-2 truncate text-[2.3rem] leading-none text-[#21462d]`}
            >
              {name}
            </div>
          </div>
          <div
            className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] ${PREMIUM_PILL_SURFACE}`}
          >
            Live View
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#decfa5]" />
          <span className="text-[#c4a667]">✦</span>
          <span className="h-px flex-1 bg-[#decfa5]" />
        </div>

        <p
          className="mt-4 max-w-[14.5rem] text-[14px] leading-7 text-[#657265]"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
          }}
        >
          {description}
        </p>

        <button
          type="button"
          onClick={onViewMap}
          className={`mt-6 inline-flex items-center gap-3 rounded-[1.15rem] px-5 py-3 text-sm font-semibold text-[#fff7e4] shadow-[0_18px_30px_rgba(33,57,36,0.22),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:scale-[1.01] active:scale-[0.99] ${PREMIUM_OLIVE_GRADIENT}`}
        >
          <MapIcon className="h-4 w-4" />
          {isMapExpanded ? "Hide Map" : "View on Map"}
        </button>

        <div className="mt-5 flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${PREMIUM_PILL_SURFACE}`}>
            Stop {progressIndex + 1} of {nodeIds.length}
          </span>
        </div>

        <div className="mt-4 flex w-full min-w-0 items-center gap-1.5 overflow-hidden">
          {nodeIds.map((nodeId, index) => {
            const isCurrent = nodeId === activeNodeId;
            const isVisited = index <= progressIndex;

            return (
              <span
                key={`${nodeId}-${index}`}
                className={`h-1 min-w-0 flex-1 rounded-full transition-colors duration-300 ${
                  isCurrent
                    ? "bg-[#c4a667] shadow-[0_0_10px_rgba(196,166,103,0.35)]"
                    : isVisited
                      ? "bg-[#789169]/72"
                      : "bg-[#e4dcc9]"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExteriorMinimapGraphic({
  signedMinimapImageUrl,
  isExpanded,
  minimapZoom,
  minimapOffset,
  isMinimapDragging,
  handleMinimapWheel,
  handleMinimapPointerDown,
  handleMinimapPointerMove,
  handleMinimapPointerUp,
  minimapTrailPoints,
  minimapTrailPolyline,
  minimapDots,
  activeAmenityId,
  jumpToAmenity,
  className,
}: {
  signedMinimapImageUrl: string;
  isExpanded: boolean;
  minimapZoom: number;
  minimapOffset: { x: number; y: number };
  isMinimapDragging: boolean;
  handleMinimapWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  handleMinimapPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleMinimapPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleMinimapPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  minimapTrailPoints: Array<{
    nodeId: string;
    leftPercent: number;
    topPercent: number;
  }>;
  minimapTrailPolyline: string;
  minimapDots: Array<ExteriorAmenity & { leftPercent: number; topPercent: number }>;
  activeAmenityId: string | null;
  jumpToAmenity: (amenity: ExteriorAmenity) => Promise<boolean>;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.45rem] border border-[#d7bf80]/75 bg-[#e6decb] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-[width,height,transform,opacity] duration-300 ${
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
      style={{ touchAction: "none" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.4),transparent_36%),linear-gradient(180deg,rgba(255,249,236,0.34),rgba(231,222,205,0.18))]" />
      <div
        className="absolute inset-0 transition-transform duration-150 ease-out"
        style={{
          transform: `translate(${minimapOffset.x}px, ${minimapOffset.y}px) scale(${minimapZoom})`,
          transformOrigin: "center center",
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2"
          style={{
            aspectRatio: `${EXTERIOR_MINIMAP_IMAGE_LAYOUT.width} / ${EXTERIOR_MINIMAP_IMAGE_LAYOUT.height}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signedMinimapImageUrl}
            alt="Trifecta amenity minimap"
            className="h-full w-full brightness-[0.94] contrast-[1.02] saturate-[0.88] sepia-[0.12]"
            draggable={false}
          />

          {minimapTrailPoints.length > 1 ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <polyline
                points={minimapTrailPolyline}
                fill="none"
                stroke="rgba(63,77,49,0.34)"
                strokeWidth={isExpanded ? 1.35 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={minimapTrailPolyline}
                fill="none"
                stroke="rgba(196,166,103,0.42)"
                strokeWidth={isExpanded ? 3.6 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: "blur(2px)" }}
              />
              <polyline
                points={minimapTrailPolyline}
                fill="none"
                stroke="rgba(103,137,90,0.96)"
                strokeWidth={isExpanded ? 1.1 : 1.15}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : null}

          {minimapTrailPoints.length > 0 ? (
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f7edd0] bg-[#315238] shadow-[0_0_0_4px_rgba(196,166,103,0.18),0_0_16px_rgba(103,137,90,0.38)]"
              style={{
                left: `${minimapTrailPoints[minimapTrailPoints.length - 1].leftPercent * 100}%`,
                top: `${minimapTrailPoints[minimapTrailPoints.length - 1].topPercent * 100}%`,
              }}
            />
          ) : null}

          {minimapDots.map((amenity) => (
            <button
              key={amenity.id}
              type="button"
              aria-label={`Go to ${amenity.name}`}
              title={amenity.name}
              onClick={() => void jumpToAmenity(amenity)}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition hover:scale-110 ${
                isExpanded ? "h-3 w-3" : "h-2.5 w-2.5"
              } ${
                activeAmenityId === amenity.id
                  ? "border-[#f3e6be] bg-[#c4a667] shadow-[0_0_0_4px_rgba(196,166,103,0.2),0_0_12px_rgba(196,166,103,0.42)]"
                  : "border-[#f6efd9] bg-[#315238] shadow-[0_0_8px_rgba(49,82,56,0.3)]"
              }`}
              style={{
                left: `${amenity.leftPercent * 100}%`,
                top: `${amenity.topPercent * 100}%`,
              }}
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 rounded-full ${
                  activeAmenityId === amenity.id
                    ? "bg-[#e7d39f]/62"
                    : "bg-[#8aa078]/42"
                }`}
                style={{ animation: "walkthroughMinimapPulse 1.8s ease-in-out infinite" }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExteriorMinimapPanel({
  isExpanded,
  onToggle,
  signedMinimapImageUrl,
  minimapZoom,
  minimapOffset,
  isMinimapDragging,
  handleMinimapWheel,
  handleMinimapPointerDown,
  handleMinimapPointerMove,
  handleMinimapPointerUp,
  minimapTrailPoints,
  minimapTrailPolyline,
  minimapDots,
  activeAmenityId,
  jumpToAmenity,
  className,
  mapClassName,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  signedMinimapImageUrl: string;
  minimapZoom: number;
  minimapOffset: { x: number; y: number };
  isMinimapDragging: boolean;
  handleMinimapWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  handleMinimapPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleMinimapPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleMinimapPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  minimapTrailPoints: Array<{
    nodeId: string;
    leftPercent: number;
    topPercent: number;
  }>;
  minimapTrailPolyline: string;
  minimapDots: Array<ExteriorAmenity & { leftPercent: number; topPercent: number }>;
  activeAmenityId: string | null;
  jumpToAmenity: (amenity: ExteriorAmenity) => Promise<boolean>;
  className?: string;
  mapClassName: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.85rem] ${PREMIUM_PANEL_SURFACE} ${className ?? ""}`}
    >
      <div className="pointer-events-none absolute inset-[8px] rounded-[1.45rem] border border-[#ead8a4]/60" />
      <div className="relative z-10">
        <div className={`${uiFont.className} flex items-center justify-between gap-3 px-4 pb-3 pt-4 text-[#1f3f2b]`}>
          <div className="min-w-0">
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.26em] text-[#687866]">
              Amenity Map
            </div>
            <div className={`${editorialFont.className} mt-1 text-[1.55rem] leading-none text-[#21462d]`}>
              Exterior Route
            </div>
          </div>
          <button
            type="button"
            aria-label={isExpanded ? "Collapse minimap" : "Expand minimap"}
            onClick={onToggle}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#355139] transition hover:border-[#bca56e] hover:text-[#23482f] ${PREMIUM_PILL_SURFACE}`}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${PREMIUM_PILL_SURFACE}`}>
              {isExpanded ? "Click outside to close" : "Tap to expand"}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a7b67]">
              Scroll to zoom
            </span>
          </div>

          <ExteriorMinimapGraphic
            signedMinimapImageUrl={signedMinimapImageUrl}
            isExpanded={isExpanded}
            minimapZoom={minimapZoom}
            minimapOffset={minimapOffset}
            isMinimapDragging={isMinimapDragging}
            handleMinimapWheel={handleMinimapWheel}
            handleMinimapPointerDown={handleMinimapPointerDown}
            handleMinimapPointerMove={handleMinimapPointerMove}
            handleMinimapPointerUp={handleMinimapPointerUp}
            minimapTrailPoints={minimapTrailPoints}
            minimapTrailPolyline={minimapTrailPolyline}
            minimapDots={minimapDots}
            activeAmenityId={activeAmenityId}
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
  className,
  title = "Exterior Walkthrough",
  subtitle = "Fast sphere-based exterior navigation",
}: ExteriorPanoWalkthroughProps) {
  primeSignedAssetUrls(initialSignedAssetUrls);
  const signedAssetUrls = useSignedAssetUrls([
    EXTERIOR_MINIMAP_IMAGE_URL,
    ...exteriorAmenities.map((amenity) => amenity.image),
  ]);
  const graph = useMemo(() => buildExteriorTourGraph(nodes), [nodes]);
  const initialRequestedNodeId =
    (initialNodeId && graph.byId[initialNodeId] ? initialNodeId : null) ??
    graph.nodes[0]?.id ??
    "";

  const [activeNodeId, setActiveNodeId] = useState(initialRequestedNodeId);
  const [loadState, setLoadState] = useState<PanoLoadState>(
    createLoadState("idle", "Preparing panorama"),
  );
  const [hasCompletedInitialPano, setHasCompletedInitialPano] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobileAmenitiesOpen, setIsMobileAmenitiesOpen] = useState(false);
  const [isTrailPlaying, setIsTrailPlaying] = useState(false);
  const [transitionPulseKey, setTransitionPulseKey] = useState(0);
  const [historyDepth, setHistoryDepth] = useState(0);
  const [visitedTrailNodeIds, setVisitedTrailNodeIds] = useState<string[]>([]);
  const [trailSecondsRemaining, setTrailSecondsRemaining] = useState(
    Math.ceil(TRAIL_ADVANCE_MS / 1000),
  );
  const [isMinimapExpanded, setIsMinimapExpanded] = useState(false);
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
  const preferTileOnlyPanoramaRef = useRef(false);
  const fallbackPreviewLoadIdRef = useRef(0);
  const previewOverlayLoadIdRef = useRef(0);
  const previewOverlayHideTimeoutRef = useRef<
    ReturnType<typeof globalThis.setTimeout> | null
  >(null);

  const activeNode = graph.byId[activeNodeId];
  const sequential = useMemo(
    () => getSequentialNodeIds(graph, activeNodeId),
    [activeNodeId, graph],
  );
  const nextTrailNodeId = sequential.nextId ?? graph.order[0] ?? null;
  const activeAmenity = useMemo(
    () => exteriorAmenities.find((amenity) => amenity.nodeIds.includes(activeNodeId)) ?? null,
    [activeNodeId],
  );
  const signedMinimapImageUrl =
    signedAssetUrls[EXTERIOR_MINIMAP_IMAGE_URL] ?? EMPTY_IMAGE_DATA_URL;
  const activeAmenityId = useMemo(
    () => activeAmenity?.id ?? null,
    [activeAmenity],
  );
  const activeAmenityDescription =
    activeAmenity?.description ??
    "Explore the exterior route through gardens, arrivals, play courts, and community spaces.";
  const exteriorPreloaderProgress = getExteriorPreloaderProgress(
    loadState,
    Boolean(fallbackPreviewUrl || previewOverlayUrl),
  );
  const activeAmenityNodeIds = activeAmenity?.nodeIds.length
    ? activeAmenity.nodeIds
    : [activeNodeId];
  const activeAmenityProgressIndex = Math.max(
    0,
    activeAmenityNodeIds.indexOf(activeNodeId),
  );
  const visibleExteriorAmenities = useMemo(
    () => exteriorAmenities.filter((amenity) => amenity.id !== "general"),
    [],
  );
  const {
    setFirstItemNode: setExteriorMenuFirstItemNode,
    setListNode: setExteriorMenuListNode,
    setScrollAreaNode: setExteriorMenuScrollAreaNode,
    viewportHeight: exteriorMenuViewportHeight,
  } = useSnapListViewport({
    itemCount: visibleExteriorAmenities.length,
    targetVisibleCards: 4.4,
  });
  const {
    setFirstItemNode: setMobileExteriorMenuFirstItemNode,
    setListNode: setMobileExteriorMenuListNode,
    setScrollAreaNode: setMobileExteriorMenuScrollAreaNode,
    viewportHeight: mobileExteriorMenuViewportHeight,
  } = useSnapListViewport({
    itemCount: visibleExteriorAmenities.length,
    targetVisibleCards: 4.4,
  });
  const projectMinimapPoint = useCallback((coordinate: Vec3) => {
    const minX = EXTERIOR_MINIMAP_BOUNDS.bottomLeft.x;
    const maxX = EXTERIOR_MINIMAP_BOUNDS.topRight.x;
    const minY = EXTERIOR_MINIMAP_BOUNDS.topRight.y;
    const maxY = EXTERIOR_MINIMAP_BOUNDS.bottomLeft.y;
    const xRange = Math.max(maxX - minX, 1);
    const yRange = Math.max(maxY - minY, 1);

    return {
      leftPercent: clamp((coordinate.x - minX) / xRange, 0, 1),
      topPercent: clamp((coordinate.y - minY) / yRange, 0, 1),
    };
  }, []);
  const minimapDots = useMemo(() => {
    return visibleExteriorAmenities.map((amenity) => ({
      ...amenity,
      ...projectMinimapPoint(amenity.coordinate),
    }));
  }, [projectMinimapPoint, visibleExteriorAmenities]);
  const minimapTrailPoints = useMemo(() => {
    const orderedNodeIds = [...visitedTrailNodeIds, activeNodeId].filter(
      (nodeId, index, list) => index === 0 || nodeId !== list[index - 1],
    );

    return orderedNodeIds
      .map((nodeId) => {
        const node = graph.byId[nodeId];

        if (!node) {
          return null;
        }

        return {
          nodeId,
          ...projectMinimapPoint(node.rawPosition),
        };
      })
      .filter(
        (
          point,
        ): point is {
          nodeId: string;
          leftPercent: number;
          topPercent: number;
        } => Boolean(point),
      );
  }, [activeNodeId, graph.byId, projectMinimapPoint, visitedTrailNodeIds]);
  const minimapTrailPolyline = minimapTrailPoints
    .map((point) => `${point.leftPercent * 100},${point.topPercent * 100}`)
    .join(" ");
  const toggleMinimapExpanded = useCallback(() => {
    setIsMinimapExpanded((current) => !current);
  }, []);
  const closeMinimapExpanded = useCallback(() => {
    setIsMinimapExpanded(false);
  }, []);

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

  const hidePreviewOverlay = useCallback((delay = IOS_PREVIEW_OVERLAY_FADE_MS) => {
    if (previewOverlayHideTimeoutRef.current !== null) {
      globalThis.clearTimeout(previewOverlayHideTimeoutRef.current);
      previewOverlayHideTimeoutRef.current = null;
    }

    previewOverlayHideTimeoutRef.current = globalThis.setTimeout(() => {
      setIsPreviewOverlayVisible(false);
      previewOverlayHideTimeoutRef.current = null;
    }, delay);
  }, []);

  const showPreviewOverlay = useCallback(async (previewUrl: string | null | undefined) => {
    if (!previewUrl || !preferTileOnlyPanoramaRef.current) {
      return;
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
      return;
    }

    setPreviewOverlayUrl(previewUrl);
    setIsPreviewOverlayVisible(true);
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
            panorama:
              (preferTileOnlyPanoramaRef.current
                ? withoutBasePreview(
                    buildPhotoSpherePanorama(
                      node.panoId,
                      meta,
                      cdnBaseUrl,
                      true,
                      signedPreviewUrl,
                      signedTileUrls,
                    ),
                  )
                : null) ??
              buildPhotoSpherePanorama(
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

  useEffect(() => {
    Cache.enabled = true;
    Cache.maxItems = Math.max(Cache.maxItems, CACHE_MAX_ITEMS);
    Cache.ttl = Math.max(Cache.ttl, CACHE_TTL_MS);
    Cache.init();
  }, []);

  useEffect(() => {
    return () => {
      if (previewOverlayHideTimeoutRef.current !== null) {
        globalThis.clearTimeout(previewOverlayHideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasCompletedInitialPano) {
      return;
    }

    const isInitialPanoReady = isAppleTouchFallbackMode
      ? Boolean(fallbackPreviewUrl)
      : loadState.phase === "ready";

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
    isAppleTouchFallbackMode,
    loadState.phase,
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
    let retriedInitialWithoutBase = false;
    let retriedInitialPreviewImage = false;

    void (async () => {
      prefersCoarsePointerRef.current =
        window.matchMedia?.("(pointer: coarse)").matches ||
        navigator.maxTouchPoints > 0;
      preferTileOnlyPanoramaRef.current = isAppleTouchPanoramaDevice();
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
      const initialAmenity = exteriorAmenities.find(
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
      const initialTileOnlyPanorama = withoutBasePreview(initialResolved.panorama);

      await showPreviewOverlay(initialResolved.previewUrl);

      if (process.env.NODE_ENV !== "production") {
        console.log("Exterior pano viewer size", {
          w: viewerHostRef.current.clientWidth,
          h: viewerHostRef.current.clientHeight,
          appleTouch: preferTileOnlyPanoramaRef.current,
          fallbackMode: isAppleTouchFallbackMode,
        });
      }

      localViewer = new Viewer({
        container: viewerHostRef.current,
        ...(initialResolved.mode === "tiles"
          ? {
              adapter: EquirectangularTilesAdapter.withConfig({
                resolution: preferTileOnlyPanoramaRef.current
                  ? EXTERIOR_APPLE_TOUCH_SPHERE_RESOLUTION
                  : isCompactExperienceRef.current
                    ? EXTERIOR_COMPACT_SPHERE_RESOLUTION
                    : EXTERIOR_SPHERE_RESOLUTION,
                showErrorTile: false,
                baseBlur: !preferTileOnlyPanoramaRef.current,
                antialias: !preferTileOnlyPanoramaRef.current,
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
          antialias: !preferTileOnlyPanoramaRef.current,
          powerPreference:
            initialResolved.mode === "tiles" && !preferTileOnlyPanoramaRef.current
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
        hidePreviewOverlay();
      });

      localViewer.addEventListener("panorama-error", ({ error }) => {
        console.error("Exterior panorama error:", error);
        localViewer?.hideError();
        if (!retriedInitialWithoutBase && initialTileOnlyPanorama && localViewer) {
          retriedInitialWithoutBase = true;
          setLoadState(createLoadState("preview", "Retrying panorama"));
          void localViewer
            .setPanorama(initialTileOnlyPanorama, {
              position: {
                yaw: initialYaw,
                pitch: initialPitch,
              },
              zoom: initialZoom,
              showLoader: false,
            })
            .catch((fallbackError) => {
              console.error("Exterior initial tile-only fallback failed:", fallbackError);
              localViewer?.hideError();
              hidePreviewOverlay(0);
              setLoadState(createLoadState("error", "Panorama unavailable"));
            });
          return;
        }
        if (!retriedInitialPreviewImage && initialResolved.previewUrl && localViewer) {
          retriedInitialPreviewImage = true;
          setLoadState(createLoadState("preview", "Retrying panorama"));
          void localViewer
            .setPanorama(initialResolved.previewUrl, {
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
    graph.byId,
    graph.order,
    hidePreviewOverlay,
    initialRequestedNodeId,
    isAppleTouchFallbackMode,
    resolvePano,
    showPreviewOverlay,
  ]);

  useEffect(() => {
    if (!activeNode || isAppleTouchFallbackMode) {
      return;
    }

    let cancelled = false;
    const cancelIdle = scheduleIdle(() => {
      void (async () => {
        try {
          const warmupProfile = getWarmupProfile(isCompactExperienceRef.current);
          const resolved = await resolvePano(activeNode.id, { previewPriority: "high" });
          if (cancelled || resolved.mode !== "tiles" || !resolved.meta) {
            return;
          }

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
          );

          if (cancelled) {
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
          );
        } catch {
          // Ignore active pano warmup failures.
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [activeNode, assetStore, cdnBaseUrl, isAppleTouchFallbackMode, resolvePano]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !activeNode || isAppleTouchFallbackMode) {
      return;
    }

    const warmupProfile = getWarmupProfile(isCompactExperienceRef.current);
    const warmupIds = [
      ...new Set(
        DIRECTIONS.flatMap((direction) =>
          getViewDirectionalCandidates(
            graph,
            activeNode.id,
            direction,
            viewRef.current.yaw,
          )
            .slice(0, 3)
            .map((candidate) => candidate.node.id),
        ),
      ),
    ]
      .filter((nodeId): nodeId is string => Boolean(nodeId))
      .slice(0, warmupProfile.neighborNodeLimit);

    if (warmupIds.length === 0) {
      return;
    }

    let cancelled = false;
    const cancelIdle = scheduleIdle(() => {
      void Promise.allSettled(
        warmupIds.map(async (nodeId) => {
          if (cancelled) {
            return;
          }

          const resolved = await resolvePano(nodeId, { previewPriority: "low" });
          if (cancelled) {
            return;
          }

          try {
            await viewer.textureLoader.preloadPanorama(resolved.panorama);
          } catch {
            // Some tiled panos may not support PSV preload cleanly; keep manual warmup.
          }

          if (resolved.mode === "tiles" && resolved.meta) {
            const warmTiles = selectPriorityTiles(
              resolved.panoId,
              resolved.meta,
              cdnBaseUrl,
              {
                yaw: viewRef.current.yaw,
                pitch: 0,
                zoom: viewRef.current.zoom,
              },
              warmupProfile.neighborFocusLimit,
            );
            const sweepTiles = buildSweepTiles(
              resolved.panoId,
              resolved.meta,
              cdnBaseUrl,
              new Set(warmTiles.map((tile) => tile.key)),
              warmupProfile.neighborSweepLimit,
            );

            await preloadTileBatch(
              assetStore,
              warmTiles,
              warmupProfile.neighborFocusConcurrency,
              "high",
            );
            if (cancelled) {
              return;
            }
            await preloadTileBatch(
              assetStore,
              sweepTiles,
              warmupProfile.neighborSweepConcurrency,
              "auto",
            );
          }
        }),
      );
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [
    activeNode,
    assetStore,
    cdnBaseUrl,
    graph,
    isAppleTouchFallbackMode,
    resolvePano,
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

      if (!viewer && isAppleTouchFallbackMode) {
        navigationLockRef.current = true;
        setTransitionPulseKey((current) => (current + 1) % 10000);
        setIsTransitioning(true);
        setLoadState(createLoadState("preview", "Switching panorama"));

        try {
          await resolvePano(targetId, { previewPriority: "high" });

          if (options.recordHistory !== false) {
            pushNavigationHistory(fromNode.id);
          }

          setVisitedTrailNodeIds((current) => {
            const next = current.length === 0 ? [fromNode.id] : [...current];
            if (next[next.length - 1] !== targetId) {
              next.push(targetId);
            }
            return next.slice(-80);
          });

          startTransition(() => {
            setActiveNodeId(targetId);
          });

          return true;
        } catch (error) {
          console.error("Exterior amenity jump failed:", error);
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
      setTransitionPulseKey((current) => (current + 1) % 10000);
      setIsTransitioning(true);
      setLoadState(createLoadState("preview", "Switching panorama"));

      try {
        const target = await resolvePano(targetId, { previewPriority: "high" });
        await showPreviewOverlay(target.previewUrl);
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

        const panoramaOptions = {
          position: {
            yaw: targetYaw,
            pitch: targetPitch,
          },
          zoom: targetZoom,
          transition: {
            effect: "fade",
            rotation: false,
            speed: warmupProfile.transitionSpeed,
          },
          showLoader: false,
        } as const;
        let completed: boolean | void;
        try {
          completed = await viewer.setPanorama(target.panorama, panoramaOptions);
        } catch (previewTransitionError) {
          const fallbackPanorama =
            withoutBasePreview(target.panorama) ?? target.previewUrl;
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
          setVisitedTrailNodeIds((current) => {
            const next = current.length === 0 ? [fromNode.id] : [...current];
            if (next[next.length - 1] !== targetId) {
              next.push(targetId);
            }
            return next.slice(-80);
          });

          startTransition(() => {
            setActiveNodeId(targetId);
          });

          return true;
        }
        hidePreviewOverlay(0);
        return false;
      } catch (error) {
        console.error("Exterior amenity jump failed:", error);
        viewer.hideError();
        hidePreviewOverlay(0);
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
      graph,
      hidePreviewOverlay,
      isAppleTouchFallbackMode,
      isTransitioning,
      pushNavigationHistory,
      resolvePano,
      showPreviewOverlay,
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

  useEffect(() => {
    if (!isMinimapExpanded) {
      minimapDragRef.current = {
        pointerId: null,
        lastX: 0,
        lastY: 0,
        dragging: false,
      };
      setIsMinimapDragging(false);
      setMinimapZoom(1);
      setMinimapOffset({ x: 0, y: 0 });
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

      if (!viewer && isAppleTouchFallbackMode) {
        navigationLockRef.current = true;
        setTransitionPulseKey((current) => (current + 1) % 10000);
        setIsTransitioning(true);
        setLoadState(createLoadState("preview", "Switching panorama"));

        try {
          const rankedCandidates = getViewDirectionalCandidates(
            graph,
            activeNodeIdRef.current,
            direction,
            viewRef.current.yaw,
          );

          let navigated = false;

          for (const candidate of rankedCandidates) {
            const targetId = candidate.node.id;
            if (targetId === activeNodeIdRef.current) {
              continue;
            }

            try {
              await resolvePano(targetId, { previewPriority: "high" });
            } catch {
              availabilityRef.current.set(targetId, "missing");
              continue;
            }

            pushNavigationHistory(fromNode.id);
            setVisitedTrailNodeIds((current) => {
              const next = current.length === 0 ? [fromNode.id] : [...current];
              if (next[next.length - 1] !== targetId) {
                next.push(targetId);
              }
              return next.slice(-80);
            });

            startTransition(() => {
              setActiveNodeId(targetId);
            });
            navigated = true;
            break;
          }

          if (!navigated) {
            throw new Error(`No available pano found for direction ${direction}`);
          }
        } catch (error) {
          console.error("Exterior navigation failed:", error);
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
      setTransitionPulseKey((current) => (current + 1) % 10000);
      setIsTransitioning(true);
      setLoadState(createLoadState("preview", "Switching panorama"));
 
      const currentPosition = viewer.getPosition();

      try {
        const rankedCandidates = getViewDirectionalCandidates(
          graph,
          activeNodeIdRef.current,
          direction,
          currentPosition.yaw,
        );
        const targetPitch = clamp(currentPosition.pitch, MIN_PITCH, MAX_PITCH);
        const targetZoom = DEFAULT_ZOOM;
        let navigated = false;

        for (const candidate of rankedCandidates) {
          const targetId = candidate.node.id;
          if (targetId === activeNodeIdRef.current) {
            continue;
          }

          let target: ResolvedPano;

          try {
            target = await resolvePano(targetId, { previewPriority: "high" });
          } catch {
            availabilityRef.current.set(targetId, "missing");
            continue;
          }

          await showPreviewOverlay(target.previewUrl);

          try {
            const targetYaw = preserveViewYawBetweenNodes(
              fromNode,
              candidate.node,
              currentPosition.yaw,
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
                speed: warmupProfile.transitionSpeed,
              },
              showLoader: false,
            } as const;
            const completed = await viewer.setPanorama(target.panorama, panoramaOptions);

            if (completed === false) {
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
            setVisitedTrailNodeIds((current) => {
              const next = current.length === 0 ? [fromNode.id] : [...current];
              if (next[next.length - 1] !== targetId) {
                next.push(targetId);
              }
              return next.slice(-80);
            });

            startTransition(() => {
              setActiveNodeId(targetId);
            });
            navigated = true;
            break;
          } catch (previewTransitionError) {
            const fallbackPanorama =
              withoutBasePreview(target.panorama) ?? target.previewUrl;

            if (!fallbackPanorama) {
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
                  speed: warmupProfile.transitionSpeed,
                },
                showLoader: false,
              });

              if (completed === false) {
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
              setVisitedTrailNodeIds((current) => {
                const next = current.length === 0 ? [fromNode.id] : [...current];
                if (next[next.length - 1] !== targetId) {
                  next.push(targetId);
                }
                return next.slice(-80);
              });

              startTransition(() => {
                setActiveNodeId(targetId);
              });
              navigated = true;
              break;
            } catch (fallbackTransitionError) {
              console.warn(
                `Exterior pano fallback transition failed for ${target.panoId}`,
                fallbackTransitionError,
              );
            }

            continue;
          }
        }

        if (!navigated) {
          hidePreviewOverlay(0);
          throw new Error(`No available pano found for direction ${direction}`);
        }
      } catch (error) {
        console.error("Exterior navigation failed:", error);
        viewer.hideError();
        hidePreviewOverlay(0);
        setLoadState(createLoadState("error", "Panorama unavailable"));
      } finally {
        globalThis.setTimeout(() => {
          navigationLockRef.current = false;
          setIsTransitioning(false);
        }, 120);
      }
    },
    [
      graph,
      hidePreviewOverlay,
      isAppleTouchFallbackMode,
      isTransitioning,
      pushNavigationHistory,
      resolvePano,
      showPreviewOverlay,
    ],
  );

  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host) {
      return;
    }

    const handleDoubleClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      void navigateTo("forward");
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

      const direction: NavigationDirection = "forward";
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
  }, [navigateTo]);

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

  if (!activeNode) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-white/10 bg-black/30 text-white/70">
        No exterior panoramas found.
      </div>
    );
  }

  return (
    <section
      aria-label={title}
      className={`relative isolate h-full min-h-[100svh] w-full overflow-hidden rounded-none border border-white/10 bg-[linear-gradient(180deg,#040608_0%,#05070a_50%,#040608_100%)] text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)] md:min-h-0 md:rounded-[2.25rem] ${className ?? ""}`}
    >
      {!hasCompletedInitialPano ? (
        <TrifectaPreloader progress={exteriorPreloaderProgress} />
      ) : null}
      <div className="sr-only">{subtitle}</div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_80%_12%,rgba(207,193,167,0.08),transparent_20%)]" />

      <div className="absolute inset-0 overflow-hidden rounded-none md:rounded-[2.25rem]">
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
        {previewOverlayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewOverlayUrl}
            alt=""
            aria-hidden
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              isPreviewOverlayVisible ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,6,10,0.2)_0%,rgba(4,6,10,0.02)_26%,rgba(4,6,10,0.05)_70%,rgba(4,6,10,0.28)_100%)]" />
        <div
          className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(0,0,0,0.1)_72%,rgba(0,0,0,0.18)_100%)] transition-opacity duration-200 ${
            isTransitioning ? "opacity-100" : "opacity-0"
          }`}
        />
        {transitionPulseKey > 0 ? (
          <div
            key={transitionPulseKey}
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            aria-hidden
          >
            <div
              className="absolute inset-[-8%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.20)_0%,rgba(246,231,166,0.10)_16%,rgba(0,0,0,0)_44%),linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.10)_48%,rgba(255,255,255,0)_100%)]"
              style={{
                animation:
                  "exteriorStepFlash 820ms cubic-bezier(0.2, 0.82, 0.18, 1) both",
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 h-[34vmin] w-[34vmin] rounded-full border border-white/28 shadow-[0_0_55px_rgba(246,231,166,0.16)]"
              style={{
                animation:
                  "exteriorStepFocus 780ms cubic-bezier(0.18, 0.84, 0.2, 1) both",
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:gap-4 sm:p-6">
        <div className="pointer-events-auto flex max-w-[78vw] items-start gap-3 sm:max-w-md">
          <button
            type="button"
            aria-label="Open amenities menu"
            onClick={() => setIsMobileAmenitiesOpen(true)}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] text-[#355139] transition hover:border-[#bca56e] hover:bg-[#fffdf7] hover:text-[#23482f] ${PREMIUM_PANEL_SURFACE}`}
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
          className={`absolute inset-0 bg-black/46 transition duration-200 ${
            isMobileAmenitiesOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          className={`absolute left-2 top-2 flex w-[calc(100vw-1rem)] max-w-[22.5rem] flex-col gap-5 overflow-hidden rounded-[1.9rem] px-4 py-4 shadow-[0_24px_64px_rgba(0,0,0,0.22)] transition duration-300 sm:left-3 sm:top-3 sm:w-[25rem] sm:max-w-none md:left-4 md:top-4 md:w-[26rem] xl:left-8 xl:top-28 xl:max-h-[min(78dvh,52rem)] xl:w-[24rem] 2xl:left-10 2xl:top-32 2xl:w-[25rem] ${PREMIUM_PANEL_SURFACE} ${
            isMobileAmenitiesOpen
              ? "translate-x-0"
              : "-translate-x-[calc(100%+0.5rem)] sm:-translate-x-[calc(100%+0.75rem)] md:-translate-x-[calc(100%+1rem)] xl:-translate-x-[calc(100%+2rem)] 2xl:-translate-x-[calc(100%+2.5rem)]"
          }`}
         style={{ maxHeight: "calc(100dvh - 1rem)" }}
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`${uiFont.className} text-[10px] uppercase tracking-[0.32em] text-[#687866]`}>
                  Amenities
                </div>
                <div className={`${editorialFont.className} mt-2 text-[2rem] leading-none text-[#21462d]`}>
                  Walkthrough Stops
                </div>
                <div className={`${uiFont.className} mt-2 max-w-[14rem] truncate text-xs font-semibold uppercase tracking-[0.18em] text-[#7a7b67] xl:hidden`}>
                  {activeAmenity?.name ?? "Exterior Trail"}
                </div>
              </div>

              <button
                type="button"
                aria-label="Close amenities menu"
                onClick={() => setIsMobileAmenitiesOpen(false)}
                className={`flex h-11 w-11 items-center justify-center rounded-[1rem] text-[#355139] transition hover:border-[#bca56e] hover:bg-[#fffdf7] hover:text-[#23482f] ${PREMIUM_PILL_SURFACE}`}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className={`${uiFont.className} mt-3 text-sm leading-6 text-[#6f7d70]`}>
              Tap any amenity to jump into its exterior panorama.
            </div>
          </div>

          <div
            ref={setMobileExteriorMenuScrollAreaNode}
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 snap-y snap-mandatory xl:hidden"
            style={
              mobileExteriorMenuViewportHeight
                ? { maxHeight: `${Math.ceil(mobileExteriorMenuViewportHeight)}px` }
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
                  imageSrc={signedAssetUrls[amenity.image] ?? EMPTY_IMAGE_DATA_URL}
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
            className="custom-scrollbar hidden min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 snap-y snap-mandatory xl:block"
            style={
              exteriorMenuViewportHeight
                ? { maxHeight: `${Math.ceil(exteriorMenuViewportHeight)}px` }
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
                  imageSrc={signedAssetUrls[amenity.image] ?? EMPTY_IMAGE_DATA_URL}
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
        <div className={`flex flex-col items-center gap-1.5 rounded-[1.35rem] p-2 sm:gap-2 sm:p-2.5 ${PREMIUM_PANEL_SURFACE}`}>
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
        className="pointer-events-none absolute bottom-3 left-4 z-30 hidden w-[20.5rem] xl:block 2xl:left-5 2xl:w-[22rem]"
      >
        <CurrentAmenityPanel
          name={activeAmenity?.name ?? "Exterior Trail"}
          description={activeAmenityDescription}
          nodeIds={activeAmenityNodeIds}
          activeNodeId={activeNodeId}
          progressIndex={activeAmenityProgressIndex}
          isMapExpanded={isMinimapExpanded}
          onViewMap={toggleMinimapExpanded}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 hidden justify-end px-3 pl-[clamp(4.5rem,20vw,6.25rem)] xl:flex sm:bottom-4 sm:pl-[6rem] sm:pr-4 md:justify-center md:px-3">
        <div
          className={`${uiFont.className} pointer-events-auto flex w-[min(34rem,calc(100vw-clamp(5rem,22vw,6.75rem)))] items-center gap-2.5 rounded-full px-3 py-2 text-[#1f3f2b] sm:w-[min(34rem,calc(100vw-6rem))] sm:gap-3 sm:px-4 sm:py-2.5 md:w-[min(34rem,calc(100vw-1.5rem))] ${PREMIUM_PANEL_SURFACE}`}
        >
          <button
            type="button"
            aria-label={isTrailPlaying ? "Pause pano trail" : "Play pano trail"}
            onClick={toggleTrailPlayback}
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[#fff7e4] shadow-[0_10px_24px_rgba(33,57,36,0.22),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-105 active:scale-95 sm:h-10 sm:w-10 ${PREMIUM_OLIVE_GRADIENT}`}
          >
            <span className="pointer-events-none absolute inset-x-1 top-0 h-1/2 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0))]" />
            {isTrailPlaying ? (
              <Pause className="relative h-4 w-4 stroke-[1.8]" />
            ) : (
              <Play className="relative ml-0.5 h-4 w-4 stroke-[1.8]" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#687866]">
              <span>Trail</span>
              <span className="shrink-0 tracking-[0.18em] text-[#355139]">
                {sequential.index + 1}/{graph.order.length}
              </span>
            </div>

            <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-[#e4dcc9] shadow-[inset_0_1px_2px_rgba(43,52,37,0.12)]">
              <div
                ref={trailProgressFillRef}
                className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-[linear-gradient(90deg,#f7e8ad_0%,#d7bd6c_52%,#b99a48_100%)] shadow-[0_0_14px_rgba(246,231,166,0.22)] will-change-transform"
                style={{ transform: "scaleX(0)" }}
              />
            </div>
          </div>

          <div className="hidden min-w-7 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-[#687866] sm:block">
            {trailSecondsRemaining}s
          </div>

          <div className="ml-0.5 flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              aria-label="Go back to previous pano"
              onClick={goBackToPreviousNode}
              disabled={isTransitioning || historyDepth === 0}
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[#355139] transition hover:border-[#bca56e] hover:bg-[#fffdf7] hover:text-[#23482f] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:h-10 sm:w-10 ${PREMIUM_PILL_SURFACE}`}
            >
              <SkipBack className="relative h-4 w-4 stroke-[1.8]" />
            </button>

            <button
              type="button"
              aria-label="Next pano"
              onClick={skipToNextTrailNode}
              disabled={isTransitioning || !nextTrailNodeId}
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[#355139] transition hover:border-[#bca56e] hover:bg-[#fffdf7] hover:text-[#23482f] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:h-10 sm:w-10 ${PREMIUM_PILL_SURFACE}`}
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
            aria-label="Close expanded amenity map"
            onClick={closeMinimapExpanded}
            className="absolute inset-0 bg-[rgba(13,20,14,0.44)] backdrop-blur-[8px]"
          />
          <div className="relative z-10 w-[min(92vw,72rem)] max-w-[72rem]">
            <ExteriorMinimapPanel
              isExpanded
              onToggle={closeMinimapExpanded}
              signedMinimapImageUrl={signedMinimapImageUrl}
              minimapZoom={minimapZoom}
              minimapOffset={minimapOffset}
              isMinimapDragging={isMinimapDragging}
              handleMinimapWheel={handleMinimapWheel}
              handleMinimapPointerDown={handleMinimapPointerDown}
              handleMinimapPointerMove={handleMinimapPointerMove}
              handleMinimapPointerUp={handleMinimapPointerUp}
              minimapTrailPoints={minimapTrailPoints}
              minimapTrailPolyline={minimapTrailPolyline}
              minimapDots={minimapDots}
              activeAmenityId={activeAmenityId}
              jumpToAmenity={jumpToAmenity}
              mapClassName="h-auto w-full"
            />
          </div>
        </div>
      ) : null}

      <div className="pointer-events-auto absolute bottom-3 right-3 z-30">
        <ExteriorMinimapPanel
          isExpanded={false}
          onToggle={toggleMinimapExpanded}
          signedMinimapImageUrl={signedMinimapImageUrl}
          minimapZoom={minimapZoom}
          minimapOffset={minimapOffset}
          isMinimapDragging={isMinimapDragging}
          handleMinimapWheel={handleMinimapWheel}
          handleMinimapPointerDown={handleMinimapPointerDown}
          handleMinimapPointerMove={handleMinimapPointerMove}
          handleMinimapPointerUp={handleMinimapPointerUp}
          minimapTrailPoints={minimapTrailPoints}
          minimapTrailPolyline={minimapTrailPolyline}
          minimapDots={minimapDots}
          activeAmenityId={activeAmenityId}
          jumpToAmenity={jumpToAmenity}
          className="w-[min(70vw,19rem)] sm:w-[18.5rem] xl:w-[17rem] 2xl:w-[18.5rem]"
          mapClassName="h-[11rem] w-full sm:h-[12rem] xl:h-[10.5rem] 2xl:h-[11.5rem]"
        />
      </div>

      <style jsx global>{`
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
