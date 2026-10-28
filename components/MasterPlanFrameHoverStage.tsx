"use client";

/* eslint-disable react-hooks/preserve-manual-memoization */

import {
  Suspense,
  memo,
  startTransition,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";

import { Canvas, useFrame, useThree } from "@react-three/fiber";

import { AdaptiveDpr, PerspectiveCamera, useGLTF } from "@react-three/drei";

import {
  Box3,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  MathUtils,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera as ThreePerspectiveCamera,
  Quaternion,
  Vector2,
  Vector3,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  MASTER_PLAN_SCRUB_HQ_VIDEO_PATH,
  MASTER_PLAN_SCRUB_INTERACTION_VIDEO_PATH,
  MASTER_PLAN_SCRUB_VIDEO_FPS,
  TOTAL_MASTER_PLAN_FRAMES,
} from "@/data/masterPlanFrameCdnUrls";
import {
  MASTER_PLAN_HOTSPOT_FRAMES,
  MASTER_PLAN_HOTSPOT_KEYS,
  type MasterPlanHotspotKey,
  getNearestMasterPlanHotspot,
  isApartmentIdAllowedAtHotspot,
} from "@/lib/master-plan-hotspots";
import {
  filterSignableAssetKeys,
  isLocalAssetKey,
  isRemoteAssetUrl,
  toLocalPublicAssetPath,
} from "@/lib/master-plan-asset-keys";
import trackingData from "@/data/trifecta_unreal_tracking_data.json";
import precomputedSceneData from "@/data/precomputedSceneData.json";
import type {
  InventoryApartment,
  InventoryStatus,
  TowerType,
} from "@/types/inventory";
import type { MasterPlanDeveloperConfig } from "@/types/developer-config";
import { useSignedAssetUrls } from "@/src/lib/use-signed-assets";
(
  BufferGeometry.prototype as unknown as {
    computeBoundsTree?: typeof computeBoundsTree;
  }
).computeBoundsTree = computeBoundsTree;
(
  BufferGeometry.prototype as unknown as {
    disposeBoundsTree?: typeof disposeBoundsTree;
  }
).disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast as Mesh["raycast"];
const MODEL_PATH_A = "/models/forglb.glb";
const MODEL_PATH_B = "/models/forglb - Copy.glb";
const MASTER_PLAN_STAGE_FALLBACK_IMAGE = "images/first_frame_again.png";
// const MODEL_PATH_A = "/models/Towers_Final.glb";
// const MODEL_PATH_B = "/models/Towers_Final - Copy.glb";
const APARTMENT_ID_PATTERN = /^(Tower_[A-Z]_\d{2}_[A-Z0-9]{3,4})_/i;
const BLOCK_APARTMENT_ID_PATTERN = /^Block_([A-D])_(\d{2})_([A-Z0-9]{3,4})$/i;
const MAX_TRIAL_BLOCK_MESH_PATTERN =
  /^g_([A-D])_([0-9A-Z]{2})_([0-9A-Z]{3,4})(?:_.+)?$/i;
const TARGET_MODEL_HEIGHT = 10;
const TOTAL_FRAMES = TOTAL_MASTER_PLAN_FRAMES;
const SNAP_FRAMES = MASTER_PLAN_HOTSPOT_FRAMES;
const DRAG_THRESHOLD_PX = 8;
const SNAP_ANIMATION_MIN_DURATION_MS = 180;
const SNAP_ANIMATION_MAX_DURATION_MS = 340;
const SNAP_ANIMATION_MS_PER_FRAME = 3.6;
const HOTSPOT_NAVIGATION_MIN_DURATION_MS = 380;
const HOTSPOT_NAVIGATION_MAX_DURATION_MS = 720;
const HOTSPOT_NAVIGATION_MS_PER_FRAME = 6.8;
const DRAG_VIDEO_SYNC_MS_STANDARD = 1000 / MASTER_PLAN_SCRUB_VIDEO_FPS;
const DRAG_VIDEO_SYNC_MS_CONSTRAINED = 40;
const DRAG_VIDEO_SYNC_MS_LOW = 56;
const DRAG_VIDEO_FRAME_SKIP_STANDARD = 1;
const DRAG_VIDEO_FRAME_SKIP_CONSTRAINED = 3;
const DRAG_VIDEO_FRAME_SKIP_LOW = 4;
const DISPLAYED_FRAME_COMMIT_MS_STANDARD = 24;
const DISPLAYED_FRAME_COMMIT_MS_CONSTRAINED = 40;
const DISPLAYED_FRAME_COMMIT_MS_LOW = 64;
const HOVER_COOLDOWN_MS = 80;
const TOWER_MESH_PREWARM_FRAMES = 6;
const TOWER_MESH_ENTER_WINDOW = 6;
const TOWER_MESH_EXIT_WINDOW = 9;
const APARTMENT_MESH_ENTER_WINDOW = 0;
const APARTMENT_MESH_EXIT_WINDOW = 2;
const TRACKING_VIDEO_ASPECT = 3840 / 2560;
const VIDEO_SYNC_THRESHOLD_SECONDS = 1 / (MASTER_PLAN_SCRUB_VIDEO_FPS * 1.5);
const VIDEO_FAST_SEEK_THRESHOLD_SECONDS = 0.18;
const ENABLE_TRACKING_DEBUG = false;
const FILTER_HIGHLIGHT_EDGE_SIMPLIFY_THRESHOLD = 6;
const DESKTOP_MOUSE_DRAG_POINTER_DELTA_MULTIPLIER = 1.65;
const DESKTOP_MOUSE_DRAG_PENDING_DELTA_MULTIPLIER = 4.25;
const DESKTOP_MOUSE_DRAG_STARTUP_PENDING_DELTA_MULTIPLIER = 1.75;
const DESKTOP_MOUSE_DRAG_LEAD_MULTIPLIER = 1.4;
const MOBILE_STAGE_MAX_SCALE = 2.8;
const MOBILE_STAGE_MIN_SCALE = 1;
const MOBILE_STAGE_TAP_MOVE_THRESHOLD_PX = 10;
const THREE_DS_MAX_TRIAL_MODEL_CACHE_BUSTER = "trial-refresh=3";
// Camera-relative screen-left corrections for the GLB at these orbit views.
// Increase a value to move that view farther left; decrease it to move less.
const FRAME_91_GLB_LEFT_OFFSET_CM = -70;
const FRAME_271_GLB_LEFT_OFFSET_CM = 240;
const FRAME_GLB_OFFSET_FALLOFF_FRAMES = 12;
const FRAME_GLB_LEFT_CORRECTIONS = [
  { frame: 91, offsetCm: FRAME_91_GLB_LEFT_OFFSET_CM },
  { frame: 271, offsetCm: FRAME_271_GLB_LEFT_OFFSET_CM },
] as const;
const DEFAULT_MASTER_PLAN_PERFORMANCE_PROFILE: MasterPlanPerformanceProfile = {
  canvasPerformance: {
    debounce: 120,
    min: 0.45,
  },
  isConstrained: false,
  isSafariLike: false,
  scrubVideoPreload: "auto",
  tier: "standard",
};

// Placeholder alignment until Unreal tracking data is available.
const BASE_CAMERA_POSITION: [number, number, number] = [10.5, 7.25, 13.5];
const BASE_MODEL_OFFSET: [number, number, number] = [1.8, 0, 0];

type InventoryLoadState = "loading" | "ready" | "error";
type InteractionMode = "idle" | "dragging" | "settling" | "cooldown";
type HighlightRenderMode = "full" | "medium" | "light";
type TouchHighlightProfile = "desktop" | "tablet" | "mobile";
type PointerPosition = { x: number; y: number };
type CoverViewport = {
  height: number;
  left: number;
  top: number;
  width: number;
};
type MasterPlanConnection = {
  addEventListener?: (type: "change", listener: () => void) => void;
  effectiveType?: string;
  removeEventListener?: (type: "change", listener: () => void) => void;
  saveData?: boolean;
};
type MasterPlanNavigator = Navigator & {
  connection?: MasterPlanConnection;
  deviceMemory?: number;
};
type MasterPlanIdleWindow = Window &
  typeof globalThis & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
  };
type MasterPlanPerformanceTier = "standard" | "constrained" | "low";
type MasterPlanPerformanceProfile = {
  canvasPerformance: {
    debounce: number;
    min: number;
  };
  isConstrained: boolean;
  isSafariLike: boolean;
  scrubVideoPreload: "auto" | "metadata";
  tier: MasterPlanPerformanceTier;
};

type HoverMeshData = {
  geometry: Mesh["geometry"];
  key: string;
  matrix: Matrix4;
};

type ParsedApartmentName = {
  apartmentId: string | null;
  sourceTowerCode: TowerCode | null;
};

type ParsedLogicalApartmentId =
  | {
      code: string;
      floorCode: string;
      scope: "block";
      unitCode: string;
    }
  | {
      code: string;
      floorCode: string;
      scope: "tower";
      unitCode: string;
    };

type InventoryApartmentIndex = Map<TowerType, Map<string, InventoryApartment>>;

type PreparedTowerModel = {
  apartments: Map<string, HoverMeshData[]>;
  debugTarget: Vector3;
  offset: [number, number, number];
  pickableMeshes: Mesh[];
  scaledHeight: number;
  scene: Group;
  scale: number;
  trackedTowerFootprints: Partial<Record<TowerCode, TowerFootprint>>;
  towerFootprints: Partial<Record<TowerCode, TowerFootprint>>;
};

const PREPARED_TOWER_CACHE = new Map<string, PreparedTowerModel>();

type DragState = {
  clampedDeltaX: number;
  didDrag: boolean;
  inputMode: "desktop-mouse" | "generic-pointer";
  lastClientX: number;
  lastTimestamp: number;
  pointerId: number;
  startProgress: number;
  startX: number;
};

type StageViewportTransform = {
  scale: number;
  x: number;
  y: number;
};

type MobileStageGestureState = {
  initialDistance: number;
  initialMidpointX: number;
  initialMidpointY: number;
  initialOffsetX: number;
  initialOffsetY: number;
  initialScale: number;
  lastTouchX: number;
  lastTouchY: number;
  mode: "idle" | "pan" | "pinch" | "tap";
  moved: boolean;
  tapStartX: number;
  tapStartY: number;
};

type TowerCode = "A" | "B";

type UnrealCameraKey = keyof typeof trackingData;

type TowerFootprint = {
  ta1: Vector3;
  ta2: Vector3;
  ta3: Vector3;
  ta4: Vector3;
};

type TrackingCameraView = {
  fov: number;
  key: UnrealCameraKey;
  position: Vector3;
  quaternion: Quaternion;
  target: Vector3;
};
type SimilarityTransform = {
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
};
type SerializedTrackingCamera = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  fov: number;
};
type SerializedSimilarityTransform = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: number;
};
type UnrealVector3Like = {
  x: number;
  y: number;
  z: number;
};

type ScrubVideoSources = {
  high: string;
  low: string;
  medium: string;
};

const TOWER_A_TRACKING_KEYS = [
  "A1",
  "A2",
  "A3",
  "A4",
] as const satisfies UnrealCameraKey[];
const PRECOMPUTED_SCENE_DATA = precomputedSceneData as Record<
  TowerCode,
  {
    camera: Partial<Record<UnrealCameraKey, SerializedTrackingCamera>>;
    transform: SerializedSimilarityTransform;
  }
>;
const HIGHLIGHT_EDGE_GEOMETRY_CACHE = new WeakMap<
  Mesh["geometry"],
  EdgesGeometry
>();
const HIGHLIGHT_EXPANDED_MATRIX_CACHE = new WeakMap<
  Matrix4,
  Map<number, Matrix4>
>();
const INVISIBLE_PROXY_MATERIAL = new MeshBasicMaterial({
  colorWrite: false,
  depthTest: true,
  depthWrite: true,
  opacity: 0,
  side: DoubleSide,
  toneMapped: false,
  transparent: true,
});
const DEBUG_PROXY_MATERIAL = new MeshBasicMaterial({
  color: "#ff39d4",
  colorWrite: true,
  depthTest: true,
  depthWrite: true,
  opacity: 0.42,
  side: DoubleSide,
  toneMapped: false,
  transparent: true,
});
const PROXY_MATERIAL_ARRAY_CACHE = new Map<string, Material[]>();
const HIGHLIGHT_FILL_MATERIAL_CACHE = new Map<string, MeshBasicMaterial>();
const HIGHLIGHT_LINE_MATERIAL_CACHE = new Map<string, LineBasicMaterial>();
const EMPTY_MESHES: Mesh[] = [];
const EMPTY_APARTMENT_IDS = new Set<string>();

function getHighlightEdgesGeometry(geometry: Mesh["geometry"]) {
  const cachedGeometry = HIGHLIGHT_EDGE_GEOMETRY_CACHE.get(geometry);

  if (cachedGeometry) {
    return cachedGeometry;
  }

  const edgesGeometry = new EdgesGeometry(geometry, 20);
  HIGHLIGHT_EDGE_GEOMETRY_CACHE.set(geometry, edgesGeometry);
  return edgesGeometry;
}

function getExpandedHighlightMatrix(matrix: Matrix4, scaleMultiplier: number) {
  const cachedMatrices = HIGHLIGHT_EXPANDED_MATRIX_CACHE.get(matrix);
  const cachedMatrix = cachedMatrices?.get(scaleMultiplier);

  if (cachedMatrix) {
    return cachedMatrix;
  }

  const expandedMatrix = matrix
    .clone()
    .multiply(
      new Matrix4().makeScale(
        scaleMultiplier,
        scaleMultiplier,
        scaleMultiplier,
      ),
    );

  if (cachedMatrices) {
    cachedMatrices.set(scaleMultiplier, expandedMatrix);
  } else {
    HIGHLIGHT_EXPANDED_MATRIX_CACHE.set(
      matrix,
      new Map([[scaleMultiplier, expandedMatrix]]),
    );
  }

  return expandedMatrix;
}

function getProxyMaterials(
  material: Material | Material[],
  showDebugMaterial: boolean,
) {
  const sharedMaterial = showDebugMaterial
    ? DEBUG_PROXY_MATERIAL
    : INVISIBLE_PROXY_MATERIAL;

  if (!Array.isArray(material)) {
    return sharedMaterial;
  }

  const cacheKey = `${showDebugMaterial ? "debug" : "hidden"}:${material.length}`;
  const cachedMaterials = PROXY_MATERIAL_ARRAY_CACHE.get(cacheKey);

  if (cachedMaterials) {
    return cachedMaterials;
  }

  const nextMaterials = Array.from(
    { length: material.length },
    () => sharedMaterial,
  );
  PROXY_MATERIAL_ARRAY_CACHE.set(cacheKey, nextMaterials);
  return nextMaterials;
}

function getHighlightFillMaterial(color: string, opacity: number) {
  const key = `${color}:${opacity}`;
  const cachedMaterial = HIGHLIGHT_FILL_MATERIAL_CACHE.get(key);

  if (cachedMaterial) {
    return cachedMaterial;
  }

  const material = new MeshBasicMaterial({
    color,
    depthTest: true,
    depthWrite: false,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
  });

  HIGHLIGHT_FILL_MATERIAL_CACHE.set(key, material);
  return material;
}

function getHighlightLineMaterial(
  color: string,
  thickness: number,
  opacity = 1,
) {
  const key = `${color}:${thickness}:${opacity}`;
  const cachedMaterial = HIGHLIGHT_LINE_MATERIAL_CACHE.get(key);

  if (cachedMaterial) {
    return cachedMaterial;
  }

  const material = new LineBasicMaterial({
    color,
    depthTest: true,
    depthWrite: false,
    linewidth: thickness,
    opacity,
    toneMapped: false,
    transparent: opacity < 1,
  });

  HIGHLIGHT_LINE_MATERIAL_CACHE.set(key, material);
  return material;
}

function isTrialBlockApartmentSurfaceName(name: string) {
  return (
    MAX_TRIAL_BLOCK_MESH_PATTERN.test(name.trim()) &&
    /(wall|balcon)/i.test(name)
  );
}

function parseLogicalApartmentId(
  apartmentId: string | null,
): ParsedLogicalApartmentId | null {
  if (!apartmentId) {
    return null;
  }

  const blockMatch = apartmentId.match(BLOCK_APARTMENT_ID_PATTERN);

  if (blockMatch) {
    return {
      code: blockMatch[1].toUpperCase(),
      floorCode: blockMatch[2].toUpperCase(),
      scope: "block",
      unitCode: blockMatch[3].toUpperCase(),
    };
  }

  const [scope, code = "A", floorCode = "", unitCode = ""] =
    apartmentId.split("_");

  if (scope === "Tower") {
    return {
      code,
      floorCode,
      scope: "tower",
      unitCode,
    };
  }

  return null;
}

function parseApartmentName(name: string): ParsedApartmentName {
  const legacyApartmentId = name.match(APARTMENT_ID_PATTERN)?.[1] ?? null;

  if (legacyApartmentId) {
    const towerToken = legacyApartmentId.split("_")[1];

    return {
      apartmentId: legacyApartmentId,
      sourceTowerCode: towerToken === "B" ? "B" : "A",
    };
  }

  const normalizedName = name.trim();

  if (!isTrialBlockApartmentSurfaceName(normalizedName)) {
    return {
      apartmentId: null,
      sourceTowerCode: null,
    };
  }

  const maxTrialMatch = normalizedName.match(MAX_TRIAL_BLOCK_MESH_PATTERN);

  if (!maxTrialMatch) {
    return {
      apartmentId: null,
      sourceTowerCode: null,
    };
  }

  const blockCode = maxTrialMatch[1].toUpperCase();
  const flatToken = maxTrialMatch[3].toUpperCase();
  const floorCode = flatToken.startsWith("G")
    ? "00"
    : flatToken
        .replace(/[^0-9]/g, "")
        .slice(0, -2)
        .padStart(2, "0")
        .slice(-2);

  return {
    apartmentId: `Block_${blockCode}_${floorCode}_${flatToken}`,
    sourceTowerCode: null,
  };
}

function wrapFrame(frame: number) {
  return ((frame - 1 + TOTAL_FRAMES) % TOTAL_FRAMES) + 1;
}

function wrapProgress(progress: number) {
  return ((progress % 1) + 1) % 1;
}

function getWheelPixelDelta(event: WheelEvent | ReactWheelEvent<Element>) {
  const scale =
    event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerWidth : 1;

  return {
    x: event.deltaX * scale,
    y: event.deltaY * scale,
  };
}

function frameToProgress(frame: number) {
  return (wrapFrame(frame) - 1) / TOTAL_FRAMES;
}

function progressToFrame(progress: number) {
  const normalizedProgress = wrapProgress(progress);
  const roundedFrame =
    Math.round(normalizedProgress * TOTAL_FRAMES) % TOTAL_FRAMES;
  return wrapFrame(roundedFrame + 1);
}

function getProgressRotation(progress: number) {
  return -(wrapProgress(progress) * Math.PI * 2);
}

function isSnapFrame(frame: number) {
  return SNAP_FRAMES.includes(wrapFrame(frame) as (typeof SNAP_FRAMES)[number]);
}

function getNearestSnapFrameInfo(frame: number) {
  const normalizedFrame = wrapFrame(frame);
  let closestFrame: number = SNAP_FRAMES[0];
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  SNAP_FRAMES.forEach((snapFrame, index) => {
    const distance = Math.min(
      Math.abs(normalizedFrame - snapFrame),
      Math.abs(normalizedFrame - (snapFrame + TOTAL_FRAMES)),
      Math.abs(normalizedFrame - (snapFrame - TOTAL_FRAMES)),
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestFrame = snapFrame;
      closestIndex = index;
    }
  });

  return {
    distance: closestDistance,
    frame: closestFrame,
    index: closestIndex,
  };
}

function getNearestSnapFrame(frame: number) {
  return getNearestSnapFrameInfo(frame).frame;
}

function getDirectionalSnapFrame(frame: number, direction: 1 | -1) {
  const normalizedFrame = wrapFrame(frame);

  if (direction === 1) {
    return (
      SNAP_FRAMES.find((snapFrame) => snapFrame > normalizedFrame) ??
      SNAP_FRAMES[0]
    );
  }

  const previousSnapFrames = SNAP_FRAMES.filter(
    (snapFrame) => snapFrame < normalizedFrame,
  );

  return previousSnapFrames.at(-1) ?? SNAP_FRAMES.at(-1) ?? SNAP_FRAMES[0];
}

function isFrameWithinSnapWindow(frame: number, frameWindow: number) {
  return getNearestSnapFrameInfo(frame).distance <= frameWindow;
}

function getShortestProgressDelta(startProgress: number, endProgress: number) {
  const normalizedStart = wrapProgress(startProgress);
  const normalizedEnd = wrapProgress(endProgress);
  const forwardDistance = (normalizedEnd - normalizedStart + 1) % 1;
  const backwardDistance = forwardDistance - 1;

  return Math.abs(forwardDistance) <= Math.abs(backwardDistance)
    ? forwardDistance
    : backwardDistance;
}

function clampProgressLead(
  currentProgress: number,
  targetProgress: number,
  maxLeadFrames: number,
) {
  const maxLeadProgress = maxLeadFrames / TOTAL_FRAMES;
  const delta = getShortestProgressDelta(currentProgress, targetProgress);
  const clampedDelta = Math.max(
    -maxLeadProgress,
    Math.min(maxLeadProgress, delta),
  );

  return wrapProgress(currentProgress + clampedDelta);
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

function easeInOutCubic(progress: number) {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

function getMasterPlanPerformanceProfile(): MasterPlanPerformanceProfile {
  if (typeof navigator === "undefined") {
    return DEFAULT_MASTER_PLAN_PERFORMANCE_PROFILE;
  }

  const masterPlanNavigator = navigator as MasterPlanNavigator;
  const connection = masterPlanNavigator.connection;
  const userAgent = navigator.userAgent ?? "";
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 8;
  const deviceMemory = masterPlanNavigator.deviceMemory ?? 8;
  const effectiveType = connection?.effectiveType ?? "";
  const saveData = connection?.saveData ?? false;
  const isSafariLike =
    /Safari/i.test(userAgent) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/i.test(userAgent);
  const hasSlowNetwork =
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    effectiveType === "3g";
  const hasVerySlowNetwork =
    effectiveType === "slow-2g" || effectiveType === "2g";
  const hasConstrainedCpu = hardwareConcurrency <= 6;
  const hasLowEndCpu = hardwareConcurrency <= 4;
  const hasConstrainedMemory = deviceMemory <= 6;
  const hasLowEndMemory = deviceMemory <= 4;
  const isConstrained =
    saveData ||
    hasSlowNetwork ||
    hasConstrainedCpu ||
    hasConstrainedMemory ||
    isSafariLike;

  if (!isConstrained) {
    return DEFAULT_MASTER_PLAN_PERFORMANCE_PROFILE;
  }

  const tier: MasterPlanPerformanceTier =
    saveData || hasVerySlowNetwork || hasLowEndCpu || hasLowEndMemory
      ? "low"
      : "constrained";

  return {
    canvasPerformance: {
      debounce: isSafariLike
        ? tier === "low"
          ? 260
          : 180
        : tier === "low"
          ? 220
          : 180,
      min: isSafariLike
        ? tier === "low"
          ? 0.18
          : 0.24
        : tier === "low"
          ? 0.28
          : 0.35,
    },
    isConstrained: true,
    isSafariLike,
    scrubVideoPreload: saveData || hasVerySlowNetwork ? "metadata" : "auto",
    tier,
  };
}

function runWhenBrowserIdle(callback: () => void, timeout = 1200) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const idleWindow = window as MasterPlanIdleWindow;

  if (typeof idleWindow.requestIdleCallback === "function") {
    const idleId = idleWindow.requestIdleCallback(() => callback(), {
      timeout,
    });

    return () => {
      idleWindow.cancelIdleCallback?.(idleId);
    };
  }

  const timerId = window.setTimeout(callback, Math.min(timeout, 700));
  return () => {
    window.clearTimeout(timerId);
  };
}

function getDragVideoSyncIntervalMs(
  tier: MasterPlanPerformanceTier,
  isSafariLike: boolean,
) {
  if (isSafariLike) {
    if (tier === "low") {
      return 90;
    }

    if (tier === "constrained") {
      return 72;
    }

    return 56;
  }

  if (tier === "low") {
    return DRAG_VIDEO_SYNC_MS_LOW;
  }

  if (tier === "constrained") {
    return DRAG_VIDEO_SYNC_MS_CONSTRAINED;
  }

  return DRAG_VIDEO_SYNC_MS_STANDARD;
}

function getDragVideoFrameSkip(
  tier: MasterPlanPerformanceTier,
  isSafariLike: boolean,
) {
  if (isSafariLike) {
    if (tier === "low") {
      return 6;
    }

    if (tier === "constrained") {
      return 5;
    }

    return 4;
  }

  if (tier === "low") {
    return DRAG_VIDEO_FRAME_SKIP_LOW;
  }

  if (tier === "constrained") {
    return DRAG_VIDEO_FRAME_SKIP_CONSTRAINED;
  }

  return DRAG_VIDEO_FRAME_SKIP_STANDARD;
}

function getDisplayedFrameCommitIntervalMs(tier: MasterPlanPerformanceTier) {
  if (tier === "low") {
    return DISPLAYED_FRAME_COMMIT_MS_LOW;
  }

  if (tier === "constrained") {
    return DISPLAYED_FRAME_COMMIT_MS_CONSTRAINED;
  }

  return DISPLAYED_FRAME_COMMIT_MS_STANDARD;
}

function getPassiveVideoSyncIntervalMs(
  tier: MasterPlanPerformanceTier,
  isSafariLike: boolean,
) {
  if (isSafariLike) {
    if (tier === "low") {
      return 84;
    }

    if (tier === "constrained") {
      return 68;
    }

    return 56;
  }

  if (tier === "low") {
    return 64;
  }

  if (tier === "constrained") {
    return 48;
  }

  return 32;
}

function updateVisibilityWithHysteresis(
  isCurrentlyVisible: boolean,
  distanceToSnap: number,
  enterWindow: number,
  exitWindow: number,
) {
  if (isCurrentlyVisible) {
    return distanceToSnap <= exitWindow;
  }

  return distanceToSnap <= enterWindow;
}

function getDragConfig(tier: MasterPlanPerformanceTier) {
  if (tier === "low") {
    return {
      maxLeadFrames: 26,
      maxPointerPixelsPerMs: 1.95,
      pixelsPerFrame: 9.5,
    };
  }

  if (tier === "constrained") {
    return {
      maxLeadFrames: 34,
      maxPointerPixelsPerMs: 2.35,
      pixelsPerFrame: 7.4,
    };
  }

  return {
    maxLeadFrames: 46,
    maxPointerPixelsPerMs: 3,
    pixelsPerFrame: 5.8,
  };
}

function normalizeAspect(aspect: number) {
  return Math.round(aspect * 1000) / 1000;
}

function getScrubVideoPath(
  tier: MasterPlanPerformanceTier,
  sources: ScrubVideoSources,
) {
  if (tier === "low") {
    return sources.low;
  }

  if (tier === "constrained") {
    return sources.medium;
  }

  return sources.high;
}

function getCanvasDprRange(
  tier: MasterPlanPerformanceTier,
  {
    isDragging,
    isSafariLike,
    isSettling,
    supportsPreciseHover,
  }: {
    isDragging: boolean;
    isSafariLike: boolean;
    isSettling: boolean;
    supportsPreciseHover: boolean;
  },
): [number, number] {
  if (isSafariLike) {
    if (isDragging) {
      return [0.2, 0.32];
    }

    if (isSettling) {
      return [0.28, 0.42];
    }

    return supportsPreciseHover ? [0.42, 0.62] : [0.36, 0.52];
  }

  if (tier === "low") {
    if (isDragging) {
      return [0.22, 0.34];
    }

    if (isSettling) {
      return [0.32, 0.46];
    }

    return supportsPreciseHover ? [0.45, 0.65] : [0.38, 0.56];
  }

  if (tier === "constrained") {
    if (isDragging) {
      return [0.28, 0.42];
    }

    if (isSettling) {
      return [0.36, 0.52];
    }

    return supportsPreciseHover ? [0.5, 0.72] : [0.42, 0.62];
  }

  if (isDragging) {
    return [0.34, 0.5];
  }

  if (isSettling) {
    return [0.48, 0.68];
  }

  return supportsPreciseHover ? [0.7, 1] : [0.5, 0.85];
}

function towerTypeToCode(tower: TowerType | null) {
  if (tower === "Tower B") {
    return "B" as const;
  }

  return tower === "Tower A" ? ("A" as const) : null;
}

function buildTowerFootprint(
  bounds: Box3,
  offset: [number, number, number],
  scale: number,
): TowerFootprint {
  const groundY = bounds.min.y;
  const toSceneSpace = (x: number, y: number, z: number) =>
    new Vector3(
      (x + offset[0]) * scale,
      (y + offset[1]) * scale,
      (z + offset[2]) * scale,
    );

  return {
    ta1: toSceneSpace(bounds.min.x, groundY, bounds.max.z),
    ta2: toSceneSpace(bounds.max.x, groundY, bounds.max.z),
    ta3: toSceneSpace(bounds.max.x, groundY, bounds.min.z),
    ta4: toSceneSpace(bounds.min.x, groundY, bounds.min.z),
  };
}

function toSceneSpacePosition(
  position: Vector3,
  offset: [number, number, number],
  scale: number,
  preserveWorldPosition = false,
  includeBaseModelOffset = true,
) {
  if (preserveWorldPosition) {
    return position.clone();
  }

  return new Vector3(
    (position.x + offset[0]) * scale +
      (includeBaseModelOffset ? BASE_MODEL_OFFSET[0] : 0),
    (position.y + offset[1]) * scale +
      (includeBaseModelOffset ? BASE_MODEL_OFFSET[1] : 0),
    (position.z + offset[2]) * scale +
      (includeBaseModelOffset ? BASE_MODEL_OFFSET[2] : 0),
  );
}

function collectModelTowerDummies(scene: Group): TowerFootprint | null {
  const dummyPositions = new Map<string, Vector3>();

  scene.traverse((object) => {
    const normalizedName = object.name.trim().toLowerCase();

    if (object instanceof Mesh && /^g_dummy\d*$/.test(normalizedName)) {
      if (!object.geometry.boundingBox) {
        object.geometry.computeBoundingBox();
      }

      const bounds = object.geometry.boundingBox;

      if (!bounds) {
        return;
      }

      dummyPositions.set(
        normalizedName,
        new Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      );
      return;
    }

    if (!/^dummy_a[1-4]$/.test(normalizedName)) {
      return;
    }

    const worldPosition = new Vector3();
    object.getWorldPosition(worldPosition);
    dummyPositions.set(normalizedName, worldPosition.clone());
  });

  const ta1 = dummyPositions.get("dummy_a1");
  const ta2 = dummyPositions.get("dummy_a2");
  const ta3 = dummyPositions.get("dummy_a3");
  const ta4 = dummyPositions.get("dummy_a4");

  if (!ta1 || !ta2 || !ta3 || !ta4) {
    const bakedDummy1 = dummyPositions.get("g_dummy");
    const bakedDummy2 = dummyPositions.get("g_dummy001");

    if (!bakedDummy1 || !bakedDummy2) {
      return null;
    }

    return {
      ta1: bakedDummy1.clone(),
      ta2: bakedDummy2.clone(),
      ta3: bakedDummy2.clone(),
      ta4: bakedDummy1.clone(),
    } satisfies TowerFootprint;
  }

  return { ta1, ta2, ta3, ta4 } satisfies TowerFootprint;
}

function getTowerFootprintsFromModelDummies(
  scene: Group,
  offset: [number, number, number],
  scale: number,
  preserveWorldPosition = false,
  includeBaseModelOffset = true,
  towerCode: TowerCode = "A",
): Partial<Record<TowerCode, TowerFootprint>> {
  const modelDummies = collectModelTowerDummies(scene);

  if (!modelDummies) {
    return {} satisfies Partial<Record<TowerCode, TowerFootprint>>;
  }

  const towerFootprint: TowerFootprint = {
    ta1: toSceneSpacePosition(
      modelDummies.ta1,
      offset,
      scale,
      preserveWorldPosition,
      includeBaseModelOffset,
    ),
    ta2: toSceneSpacePosition(
      modelDummies.ta2,
      offset,
      scale,
      preserveWorldPosition,
      includeBaseModelOffset,
    ),
    ta3: toSceneSpacePosition(
      modelDummies.ta3,
      offset,
      scale,
      preserveWorldPosition,
      includeBaseModelOffset,
    ),
    ta4: toSceneSpacePosition(
      modelDummies.ta4,
      offset,
      scale,
      preserveWorldPosition,
      includeBaseModelOffset,
    ),
  };

  return {
    [towerCode]: towerFootprint,
  } satisfies Partial<Record<TowerCode, TowerFootprint>>;
}

function getCoverViewport(
  containerWidth: number,
  containerHeight: number,
  aspect: number,
): CoverViewport {
  if (containerWidth <= 0 || containerHeight <= 0 || aspect <= 0) {
    return { width: 1, height: 1, left: 0, top: 0 };
  }

  const containerAspect = containerWidth / containerHeight;

  if (containerAspect > aspect) {
    const width = containerWidth;
    const height = width / aspect;

    return {
      width,
      height,
      left: 0,
      top: (containerHeight - height) / 2,
    };
  }

  const height = containerHeight;
  const width = height * aspect;

  return {
    width,
    height,
    left: (containerWidth - width) / 2,
    top: 0,
  };
}

function getUnrealTowerDummies(towerCode: TowerCode) {
  const dummies = trackingData.A1?.dummies;
  const dummyPrefix = towerCode === "B" ? "dummy_Tb" : "dummy_Ta";

  if (
    !dummies?.[`${dummyPrefix}1` as keyof typeof dummies] ||
    !dummies[`${dummyPrefix}2` as keyof typeof dummies] ||
    !dummies[`${dummyPrefix}3` as keyof typeof dummies] ||
    !dummies[`${dummyPrefix}4` as keyof typeof dummies]
  ) {
    return null;
  }

  return {
    ta1: dummies[
      `${dummyPrefix}1` as keyof typeof dummies
    ] as UnrealVector3Like,
    ta2: dummies[
      `${dummyPrefix}2` as keyof typeof dummies
    ] as UnrealVector3Like,
    ta3: dummies[
      `${dummyPrefix}3` as keyof typeof dummies
    ] as UnrealVector3Like,
    ta4: dummies[
      `${dummyPrefix}4` as keyof typeof dummies
    ] as UnrealVector3Like,
  } satisfies Record<keyof TowerFootprint, UnrealVector3Like>;
}

function getTrackedViewTowerDummies(
  trackingKey: UnrealCameraKey,
  towerCode: TowerCode,
) {
  const dummies = trackingData[trackingKey]?.dummies;
  const dummyPrefix = towerCode === "B" ? "dummy_Tb" : "dummy_Ta";

  if (
    !dummies?.[`${dummyPrefix}1` as keyof typeof dummies] ||
    !dummies[`${dummyPrefix}2` as keyof typeof dummies] ||
    !dummies[`${dummyPrefix}3` as keyof typeof dummies] ||
    !dummies[`${dummyPrefix}4` as keyof typeof dummies]
  ) {
    return null;
  }

  return {
    ta1: dummies[
      `${dummyPrefix}1` as keyof typeof dummies
    ] as UnrealVector3Like,
    ta2: dummies[
      `${dummyPrefix}2` as keyof typeof dummies
    ] as UnrealVector3Like,
    ta3: dummies[
      `${dummyPrefix}3` as keyof typeof dummies
    ] as UnrealVector3Like,
    ta4: dummies[
      `${dummyPrefix}4` as keyof typeof dummies
    ] as UnrealVector3Like,
  } satisfies Record<keyof TowerFootprint, UnrealVector3Like>;
}

function applyTransformToPoint(point: Vector3, transform: SimilarityTransform) {
  return point
    .clone()
    .applyQuaternion(transform.quaternion)
    .multiplyScalar(transform.scale)
    .add(transform.position);
}

function unrealToThreePosition(point: UnrealVector3Like) {
  return new Vector3(point.x, point.z, point.y);
}

function getPrecomputedTowerTransform(
  towerCode: TowerCode,
  config?: MasterPlanDeveloperConfig,
): SimilarityTransform | null {
  const transform = config
    ? towerCode === "A"
      ? config.towerATransform
      : config.towerBTransform
    : PRECOMPUTED_SCENE_DATA[towerCode]?.transform;

  if (!transform) {
    return null;
  }

  return {
    position: new Vector3(...transform.position),
    quaternion: new Quaternion(...transform.quaternion),
    scale: transform.scale,
  } satisfies SimilarityTransform;
}

function getPrecomputedTrackingCameraView(
  towerCode: TowerCode,
  trackingKey: UnrealCameraKey,
  aspect: number,
  config?: MasterPlanDeveloperConfig,
) {
  const configuredCamera = config
    ? (towerCode === "A" ? config.towerACameras : config.towerBCameras)[
        trackingKey
      ]
    : null;
  const cameraData = configuredCamera
    ? {
        position: [
          configuredCamera.position.x,
          configuredCamera.position.y,
          configuredCamera.position.z,
        ] as [number, number, number],
        quaternion: configuredCamera.quaternion,
        fov: configuredCamera.fov,
      }
    : PRECOMPUTED_SCENE_DATA[towerCode]?.camera?.[trackingKey];

  if (!cameraData) {
    return null;
  }

  return getTrackingCameraViewFromConfig(cameraData, trackingKey, aspect);
}

function getTrackingCameraViewFromConfig(
  cameraData: SerializedTrackingCamera,
  trackingKey: UnrealCameraKey,
  aspect: number,
) {
  const horizontalFov = MathUtils.degToRad(cameraData.fov);
  const verticalFov = MathUtils.radToDeg(
    2 * Math.atan(Math.tan(horizontalFov / 2) / aspect),
  );

  return {
    fov: verticalFov,
    key: trackingKey,
    position: new Vector3(...cameraData.position),
    quaternion: new Quaternion(...cameraData.quaternion),
    target: new Vector3(),
  } satisfies TrackingCameraView;
}

function getUnrealTowerFootprintInThreeSpace(
  towerCode: TowerCode,
  trackingKey: UnrealCameraKey = "A1",
) {
  const unrealDummies =
    getTrackedViewTowerDummies(trackingKey, towerCode) ??
    getUnrealTowerDummies(towerCode);

  if (!unrealDummies) {
    return null;
  }

  return {
    ta1: unrealToThreePosition(unrealDummies.ta1),
    ta2: unrealToThreePosition(unrealDummies.ta2),
    ta3: unrealToThreePosition(unrealDummies.ta3),
    ta4: unrealToThreePosition(unrealDummies.ta4),
  } satisfies TowerFootprint;
}

function getTrackingInterpolationSegment(currentFrame: number) {
  const normalizedFrame =
    ((currentFrame - 1 + TOTAL_FRAMES) % TOTAL_FRAMES) + 1;

  for (let index = 0; index < SNAP_FRAMES.length; index += 1) {
    const startFrame = SNAP_FRAMES[index];
    const endFrame =
      index === SNAP_FRAMES.length - 1
        ? SNAP_FRAMES[0] + TOTAL_FRAMES
        : SNAP_FRAMES[index + 1];
    const adjustedFrame =
      index === SNAP_FRAMES.length - 1 && normalizedFrame < startFrame
        ? normalizedFrame + TOTAL_FRAMES
        : normalizedFrame;

    if (adjustedFrame < startFrame || adjustedFrame > endFrame) {
      continue;
    }

    const duration = Math.max(endFrame - startFrame, 1);
    const t = clampNumber((adjustedFrame - startFrame) / duration, 0, 1);

    return {
      fromKey: TOWER_A_TRACKING_KEYS[index],
      fromTrackingIndex: index,
      t,
      toKey: TOWER_A_TRACKING_KEYS[(index + 1) % TOWER_A_TRACKING_KEYS.length],
    };
  }

  return {
    fromKey: TOWER_A_TRACKING_KEYS[0],
    fromTrackingIndex: 0,
    t: 0,
    toKey: TOWER_A_TRACKING_KEYS[1] ?? TOWER_A_TRACKING_KEYS[0],
  };
}

function transformTowerFootprint(
  footprint: TowerFootprint | null | undefined,
  transform: SimilarityTransform | null,
) {
  if (!footprint || !transform) {
    return null;
  }

  return {
    ta1: applyTransformToPoint(footprint.ta1, transform),
    ta2: applyTransformToPoint(footprint.ta2, transform),
    ta3: applyTransformToPoint(footprint.ta3, transform),
    ta4: applyTransformToPoint(footprint.ta4, transform),
  } satisfies TowerFootprint;
}

const DEFAULT_STAGE_VIEWPORT_TRANSFORM: StageViewportTransform = {
  scale: 1,
  x: 0,
  y: 0,
};

function createDefaultMobileStageGestureState(): MobileStageGestureState {
  return {
    initialDistance: 0,
    initialMidpointX: 0,
    initialMidpointY: 0,
    initialOffsetX: 0,
    initialOffsetY: 0,
    initialScale: 1,
    lastTouchX: 0,
    lastTouchY: 0,
    mode: "idle",
    moved: false,
    tapStartX: 0,
    tapStartY: 0,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTouchDistance(
  touches: ArrayLike<{ clientX: number; clientY: number }>,
) {
  if (touches.length < 2) {
    return 0;
  }

  const firstTouch = touches[0];
  const secondTouch = touches[1];

  return Math.hypot(
    secondTouch.clientX - firstTouch.clientX,
    secondTouch.clientY - firstTouch.clientY,
  );
}

function getTouchMidpoint(
  touches: ArrayLike<{ clientX: number; clientY: number }>,
) {
  if (touches.length < 2) {
    return { x: 0, y: 0 };
  }

  const firstTouch = touches[0];
  const secondTouch = touches[1];

  return {
    x: (firstTouch.clientX + secondTouch.clientX) / 2,
    y: (firstTouch.clientY + secondTouch.clientY) / 2,
  };
}

function vectorToDebugRow(vector: Vector3) {
  return {
    x: Number(vector.x.toFixed(4)),
    y: Number(vector.y.toFixed(4)),
    z: Number(vector.z.toFixed(4)),
  };
}

type VideoStreamBindingOptions = {
  hlsPath: string;
  isSafariLike?: boolean;
  mp4Path: string;
  onReady: () => void;
  video: HTMLVideoElement;
};

function bindVideoStream({
  hlsPath,
  isSafariLike = false,
  mp4Path,
  onReady,
  video,
}: VideoStreamBindingOptions) {
  let cancelled = false;
  let hasMarkedReady = false;

  const markReady = () => {
    if (cancelled || hasMarkedReady) {
      return;
    }

    hasMarkedReady = true;
    onReady();
  };

  const applyMp4Fallback = () => {
    if (cancelled) {
      return;
    }

    if (video.src !== mp4Path) {
      video.src = mp4Path;
      video.load();
    }
  };

  video.addEventListener("loadeddata", markReady);
  video.addEventListener("canplay", markReady);
  video.addEventListener("error", applyMp4Fallback);

  applyMp4Fallback();

  if (
    !isSafariLike &&
    hlsPath &&
    video.canPlayType("application/vnd.apple.mpegurl")
  ) {
    video.src = hlsPath;
    video.load();
  }

  if (video.readyState >= 2) {
    markReady();
  }

  return () => {
    cancelled = true;
    video.removeEventListener("loadeddata", markReady);
    video.removeEventListener("canplay", markReady);
    video.removeEventListener("error", applyMp4Fallback);
    video.pause();
    video.removeAttribute("src");
    video.load();
  };
}

function inferTowerFromApartmentId(
  apartmentId: string | null,
  fallbackTower: TowerType | null,
): TowerType {
  const parsedApartmentId = parseLogicalApartmentId(apartmentId);

  if (!parsedApartmentId) {
    return fallbackTower ?? "Tower A";
  }

  if (parsedApartmentId.scope === "tower") {
    return (
      ["A", "B", "C", "D"].includes(parsedApartmentId.code)
        ? `Tower ${parsedApartmentId.code}`
        : (fallbackTower ?? "Tower A")
    ) as TowerType;
  }

  return (
    ["A", "B", "C", "D"].includes(parsedApartmentId.code)
      ? `Tower ${parsedApartmentId.code}`
      : (fallbackTower ?? "Tower A")
  ) as TowerType;
}

function formatApartmentLabel(
  apartmentId: string | null,
  fallbackTower: TowerType | null,
) {
  const resolvedTower = inferTowerFromApartmentId(apartmentId, fallbackTower);

  if (!apartmentId) {
    return {
      floor: null,
      tower: resolvedTower,
      towerCode: resolvedTower.slice(-1),
      unit: null,
      title: "Hover a flat",
    };
  }

  const parsedApartmentId = parseLogicalApartmentId(apartmentId);

  if (!parsedApartmentId) {
    return {
      floor: null,
      tower: resolvedTower,
      towerCode: resolvedTower.slice(-1),
      unit: apartmentId,
      title: `Flat ${apartmentId}`,
    };
  }

  if (parsedApartmentId.scope === "block") {
    const blockLabel = `${parsedApartmentId.code}-${parsedApartmentId.unitCode}`;

    return {
      floor: parsedApartmentId.floorCode,
      tower: resolvedTower,
      towerCode: parsedApartmentId.code,
      unit: blockLabel,
      title: `Flat ${blockLabel}`,
    };
  }

  return {
    floor: parsedApartmentId.floorCode,
    tower: `Tower ${parsedApartmentId.code}` as TowerType,
    towerCode: parsedApartmentId.code,
    unit: parsedApartmentId.unitCode,
    title: `Flat ${parsedApartmentId.unitCode}`,
  };
}

function normalizeFlatToken(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function buildFlatCandidates(
  apartmentId: string,
  fallbackTower: TowerType | null,
) {
  const parsedApartmentId = parseLogicalApartmentId(apartmentId);
  const apartment = formatApartmentLabel(apartmentId, fallbackTower);
  const unitToken = normalizeFlatToken(
    parsedApartmentId?.scope === "block"
      ? parsedApartmentId.unitCode
      : (apartment.unit ?? ""),
  );
  const blockUnitToken =
    parsedApartmentId?.scope === "block"
      ? normalizeFlatToken(
          `${parsedApartmentId.code}${parsedApartmentId.unitCode}`,
        )
      : "";
  const floorToken = normalizeFlatToken(apartment.floor ?? "");
  const towerCode = normalizeFlatToken(apartment.towerCode);
  const compoundUnitTokens = new Set<string>();
  const orderedCandidates: string[] = [];

  const pushCandidate = (candidate: string) => {
    if (candidate) {
      orderedCandidates.push(candidate);
    }
  };

  const isGroundFloorToken =
    floorToken === "G" || floorToken === "0" || floorToken === "00";

  if (floorToken && unitToken) {
    const trimmedUnitToken = unitToken.replace(/^0+/, "");
    const unitSlices = new Set([
      unitToken,
      unitToken.slice(-3),
      unitToken.slice(-2),
      trimmedUnitToken,
    ]);

    unitSlices.forEach((unitSlice) => {
      if (!unitSlice) {
        return;
      }

      if (isGroundFloorToken) {
        pushCandidate(`G${unitSlice}`);
        pushCandidate(`${towerCode}G${unitSlice}`);
        pushCandidate(`T${towerCode}G${unitSlice}`);
        pushCandidate(`${towerCode}FLATG${unitSlice}`);
      }

      compoundUnitTokens.add(`${floorToken}${unitSlice}`);
    });
  }

  pushCandidate(unitToken);
  pushCandidate(blockUnitToken);
  compoundUnitTokens.forEach((token) => {
    pushCandidate(token);
  });
  pushCandidate(`${towerCode}${unitToken}`);
  pushCandidate(`T${towerCode}${unitToken}`);
  pushCandidate(`${towerCode}FLAT${unitToken}`);
  compoundUnitTokens.forEach((token) => {
    pushCandidate(`${towerCode}${token}`);
    pushCandidate(`T${towerCode}${token}`);
  });

  return new Set(orderedCandidates.filter(Boolean));
}

function buildApartmentTokenLookup(apartmentIds: Iterable<string>) {
  const lookup = new Map<TowerType, Map<string, string[]>>();

  for (const apartmentId of apartmentIds) {
    const tower = inferTowerFromApartmentId(apartmentId, null);
    const towerLookup = lookup.get(tower) ?? new Map<string, string[]>();
    lookup.set(tower, towerLookup);

    buildFlatCandidates(apartmentId, tower).forEach((token) => {
      const nextApartmentIds = towerLookup.get(token);

      if (nextApartmentIds) {
        nextApartmentIds.push(apartmentId);
        return;
      }

      towerLookup.set(token, [apartmentId]);
    });
  }

  return lookup;
}

function buildHotspotPickMap(
  meshes: Mesh[],
  validApartmentIdsByHotspot: Map<MasterPlanHotspotKey, Set<string>>,
) {
  const result = new Map<MasterPlanHotspotKey, Mesh[]>();

  MASTER_PLAN_HOTSPOT_KEYS.forEach((hotspotKey) => {
    const allowedIds = validApartmentIdsByHotspot.get(hotspotKey);

    if (!allowedIds || allowedIds.size === 0) {
      result.set(hotspotKey, EMPTY_MESHES);
      return;
    }

    result.set(
      hotspotKey,
      meshes.filter((mesh) => {
        const apartmentId = mesh.userData.apartmentId as string | undefined;
        return apartmentId ? allowedIds.has(apartmentId) : false;
      }),
    );
  });

  return result;
}

function buildInventoryApartmentIndex(
  apartments: InventoryApartment[],
): InventoryApartmentIndex {
  const index: InventoryApartmentIndex = new Map();

  apartments.forEach((apartment) => {
    const towerIndex =
      index.get(apartment.tower) ?? new Map<string, InventoryApartment>();

    index.set(apartment.tower, towerIndex);

    const flatToken = normalizeFlatToken(apartment.flatNumber);
    const titleToken = normalizeFlatToken(apartment.title);
    const flatDigitsToken = normalizeFlatToken(
      apartment.flatNumber.replace(/[^0-9]/g, ""),
    );
    const titleDigitsToken = normalizeFlatToken(
      apartment.title.replace(/[^0-9]/g, ""),
    );
    const towerCode = apartment.tower.slice(-1);
    const floorToken = String(apartment.floor)
      .replace(/[^0-9]/g, "")
      .padStart(2, "0");
    const numericVariants = new Set(
      [flatDigitsToken, titleDigitsToken].filter(Boolean),
    );
    const indexTokens = new Set<string>(
      [
        flatToken,
        titleToken,
        `${towerCode}${flatToken}`,
        `${towerCode}${titleToken}`,
      ].filter(Boolean),
    );

    numericVariants.forEach((numericToken) => {
      indexTokens.add(numericToken);
      indexTokens.add(`${towerCode}${numericToken}`);
      indexTokens.add(`T${towerCode}${numericToken}`);

      const lastTwo = numericToken.slice(-2);
      const lastThree = numericToken.slice(-3);
      const lastFour = numericToken.slice(-4);

      [lastTwo, lastThree, lastFour].filter(Boolean).forEach((sliceToken) => {
        indexTokens.add(sliceToken);
        indexTokens.add(`${floorToken}${sliceToken}`);
        indexTokens.add(`${towerCode}${floorToken}${sliceToken}`);
      });
    });

    indexTokens.forEach((token) => {
      if (token && !towerIndex.has(token)) {
        towerIndex.set(token, apartment);
      }
    });
  });

  return index;
}

function findInventoryApartmentInIndex(
  apartmentIndex: InventoryApartmentIndex,
  apartmentId: string | null,
  fallbackTower: TowerType | null,
) {
  if (!apartmentId) {
    return null;
  }

  const tower = inferTowerFromApartmentId(apartmentId, fallbackTower);
  const towerIndex = apartmentIndex.get(tower);

  if (!towerIndex) {
    return null;
  }

  const candidates = buildFlatCandidates(apartmentId, fallbackTower);

  for (const candidate of candidates) {
    const apartment = towerIndex.get(candidate);

    if (apartment) {
      return apartment;
    }
  }

  return null;
}

function filterApartmentIdsForPreparedTower(
  apartmentIds: Set<string>,
  apartments: PreparedTowerModel["apartments"],
) {
  if (apartmentIds.size === 0) {
    return EMPTY_APARTMENT_IDS;
  }

  const nextApartmentIds = new Set<string>();

  apartmentIds.forEach((apartmentId) => {
    if (apartments.has(apartmentId)) {
      nextApartmentIds.add(apartmentId);
    }
  });

  return nextApartmentIds;
}

function getStatusMeta(
  status: InventoryStatus | null | undefined,
  inventoryState: InventoryLoadState,
  inventoryError: string | null,
) {
  if (status === "Available") {
    return {
      badgeClassName:
        "border-emerald-300/35 bg-emerald-400/12 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.16)]",
      dotClassName: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.95)]",
      label: "Available",
    };
  }

  if (status === "Reserved") {
    return {
      badgeClassName:
        "border-amber-300/35 bg-amber-300/14 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.16)]",
      dotClassName: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.95)]",
      label: "Reserved",
    };
  }

  if (status === "Sold") {
    return {
      badgeClassName:
        "border-rose-300/35 bg-rose-400/14 text-rose-50 shadow-[0_0_24px_rgba(251,113,133,0.18)]",
      dotClassName: "bg-rose-300 shadow-[0_0_14px_rgba(253,164,175,0.95)]",
      label: "Sold",
    };
  }

  if (inventoryState === "loading") {
    return {
      badgeClassName:
        "border-sky-200/30 bg-sky-300/12 text-sky-50 shadow-[0_0_24px_rgba(125,211,252,0.14)]",
      dotClassName: "bg-sky-200 shadow-[0_0_14px_rgba(186,230,253,0.95)]",
      label: "Syncing",
    };
  }

  if (inventoryError) {
    return {
      badgeClassName:
        "border-white/20 bg-white/8 text-white/90 shadow-[0_0_20px_rgba(148,163,184,0.12)]",
      dotClassName: "bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.65)]",
      label: "Offline",
    };
  }

  return {
    badgeClassName:
      "border-white/20 bg-white/8 text-white/90 shadow-[0_0_20px_rgba(148,163,184,0.12)]",
    dotClassName: "bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.65)]",
    label: "Unmapped",
  };
}

type ApartmentHighlightMode = "filter" | "hover";

type ApartmentHighlightPalette = {
  fill: string;
  fillOpacity: number;
  innerEdge: string;
  outerEdge: string;
};

function getApartmentHighlightPalette(
  status: InventoryStatus | null | undefined,
  mode: ApartmentHighlightMode,
): ApartmentHighlightPalette {
  if (status === "Available") {
    return {
      fill: "#4ade80",
      fillOpacity: mode === "hover" ? 0.18 : 0.22,
      innerEdge: "#22c55e",
      outerEdge: "#dcfce7",
    };
  }

  if (status === "Sold") {
    return {
      fill: "#fb7185",
      fillOpacity: mode === "hover" ? 0.18 : 0.2,
      innerEdge: "#f43f5e",
      outerEdge: "#ffe4e6",
    };
  }

  if (status === "Reserved") {
    return {
      fill: "#facc15",
      fillOpacity: mode === "hover" ? 0.18 : 0.2,
      innerEdge: "#f59e0b",
      outerEdge: "#fef3c7",
    };
  }

  if (mode === "hover") {
    return {
      fill: "#ffffff",
      fillOpacity: 0.16,
      innerEdge: "#d1d5db",
      outerEdge: "#ffffff",
    };
  }

  return {
    fill: "#86efac",
    fillOpacity: 0.22,
    innerEdge: "#4ade80",
    outerEdge: "#f0fdf4",
  };
}

function prepareTowerScene(
  sourceScene: Object3D,
  showDebugModel: boolean,
  interactionSceneSource: Object3D = sourceScene,
  forcedTowerCode: TowerCode = "A",
  enableBoundsTree = true,
  rawSceneMode = false,
) {
  const trackingScene = cloneSkeleton(sourceScene) as Group;
  const scene = cloneSkeleton(interactionSceneSource) as Group;
  const apartments = new Map<string, HoverMeshData[]>();
  const pickableMeshes: Mesh[] = [];
  const towerBounds = new Map<TowerCode, Box3>();

  scene.updateWorldMatrix(true, true);
  trackingScene.updateWorldMatrix(true, true);

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    if (enableBoundsTree && !object.geometry.boundsTree) {
      object.geometry.computeBoundsTree?.();
    }

    object.visible = true;
    object.frustumCulled = !rawSceneMode;

    const { apartmentId, sourceTowerCode } = parseApartmentName(object.name);

    if (sourceTowerCode && sourceTowerCode !== forcedTowerCode) {
      object.visible = false;
      return;
    }

    const towerCode = forcedTowerCode;
    const shouldShowDebugMaterial = showDebugModel && towerCode === "A";

    object.material = getProxyMaterials(
      object.material,
      shouldShowDebugMaterial,
    );

    if (towerCode) {
      if (!object.geometry.boundingBox) {
        object.geometry.computeBoundingBox();
      }

      if (object.geometry.boundingBox) {
        const nextBounds = object.geometry.boundingBox
          .clone()
          .applyMatrix4(object.matrixWorld);
        const existingBounds = towerBounds.get(towerCode);

        if (existingBounds) {
          existingBounds.union(nextBounds);
        } else {
          towerBounds.set(towerCode, nextBounds);
        }
      }
    }

    const normalizedApartmentId =
      apartmentId && forcedTowerCode
        ? apartmentId.replace(/^Tower_[AB]_/, `Tower_${forcedTowerCode}_`)
        : apartmentId;

    if (!normalizedApartmentId) {
      return;
    }

    object.userData.apartmentId = normalizedApartmentId;
    pickableMeshes.push(object);

    const meshEntry = apartments.get(normalizedApartmentId) ?? [];
    meshEntry.push({
      geometry: object.geometry,
      key: object.uuid,
      matrix: object.matrixWorld.clone(),
    });
    apartments.set(normalizedApartmentId, meshEntry);
  });

  const bounds = new Box3().setFromObject(trackingScene);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const scale = rawSceneMode ? 1 : TARGET_MODEL_HEIGHT / Math.max(size.y, 1);
  const offset = rawSceneMode
    ? ([0, 0, 0] as [number, number, number])
    : ([-center.x, -bounds.min.y, -center.z] as [number, number, number]);
  const towerFootprints: Partial<Record<TowerCode, TowerFootprint>> =
    getTowerFootprintsFromModelDummies(
      scene,
      offset,
      scale,
      rawSceneMode,
      !rawSceneMode,
      forcedTowerCode,
    );
  const trackedTowerFootprints: Partial<Record<TowerCode, TowerFootprint>> =
    getTowerFootprintsFromModelDummies(
      scene,
      offset,
      scale,
      rawSceneMode,
      false,
      forcedTowerCode,
    );

  towerBounds.forEach((towerBoundsEntry, towerCode) => {
    towerFootprints[towerCode] ??= buildTowerFootprint(
      towerBoundsEntry,
      offset,
      scale,
    );
    trackedTowerFootprints[towerCode] ??= buildTowerFootprint(
      towerBoundsEntry,
      offset,
      scale,
    );
  });

  return {
    apartments,
    debugTarget: new Vector3(0, size.y * 0.32 * scale, 0),
    offset,
    pickableMeshes,
    scaledHeight: size.y * scale,
    scene,
    scale,
    trackedTowerFootprints,
    towerFootprints,
  } satisfies PreparedTowerModel;
}

function getPreparedTowerScene(
  sourceScene: Object3D,
  showDebugModel: boolean,
  interactionSceneSource: Object3D = sourceScene,
  forcedTowerCode: TowerCode = "A",
  enableBoundsTree = true,
  rawSceneMode = false,
) {
  const cacheKey = [
    sourceScene.uuid,
    interactionSceneSource.uuid,
    forcedTowerCode,
    showDebugModel ? "debug" : "standard",
    enableBoundsTree ? "bvh" : "fallback",
    rawSceneMode ? "raw" : "normalized",
  ].join(":");
  const cachedPreparedTower = PREPARED_TOWER_CACHE.get(cacheKey);

  if (cachedPreparedTower) {
    return cachedPreparedTower;
  }

  const preparedTower = prepareTowerScene(
    sourceScene,
    showDebugModel,
    interactionSceneSource,
    forcedTowerCode,
    enableBoundsTree,
    rawSceneMode,
  );

  PREPARED_TOWER_CACHE.set(cacheKey, preparedTower);
  return preparedTower;
}

const HighlightEdgeLines = memo(function HighlightEdgeLines({
  color,
  geometry,
  matrix,
  opacity = 1,
  scaleMultiplier = 1,
  renderOrder,
  thickness = 1,
}: {
  color: string;
  geometry: Mesh["geometry"];
  matrix: Matrix4;
  opacity?: number;
  scaleMultiplier?: number;
  renderOrder: number;
  thickness?: number;
}) {
  const edgesGeometry = useMemo(
    () => getHighlightEdgesGeometry(geometry),
    [geometry],
  );
  const material = useMemo(
    () => getHighlightLineMaterial(color, thickness, opacity),
    [color, opacity, thickness],
  );
  const renderMatrix = useMemo(
    () =>
      scaleMultiplier === 1
        ? matrix
        : getExpandedHighlightMatrix(matrix, scaleMultiplier),
    [matrix, scaleMultiplier],
  );

  return (
    <lineSegments
      frustumCulled={false}
      geometry={edgesGeometry}
      material={material}
      matrix={renderMatrix}
      matrixAutoUpdate={false}
      raycast={() => null}
      renderOrder={renderOrder}
    />
  );
});

const HighlightOverlay = memo(function HighlightOverlay({
  filteredApartmentIds,
  getApartmentStatus,
  hoveredApartmentId,
  apartments,
  renderMode,
  selectedApartmentId,
  simplifyFilteredVisuals,
  touchHighlightProfile,
}: {
  filteredApartmentIds: Set<string>;
  getApartmentStatus: (
    apartmentId: string | null,
  ) => InventoryStatus | null | undefined;
  hoveredApartmentId: string | null;
  apartments: PreparedTowerModel["apartments"];
  renderMode: HighlightRenderMode;
  selectedApartmentId: string | null;
  simplifyFilteredVisuals: boolean;
  touchHighlightProfile: TouchHighlightProfile;
}) {
  const isTabletHighlightProfile = touchHighlightProfile === "tablet";
  const isMobileHighlightProfile = touchHighlightProfile === "mobile";
  const isTouchHighlightProfile = touchHighlightProfile !== "desktop";
  const getEffectivePalette = useCallback(
    (palette: ApartmentHighlightPalette) =>
      isMobileHighlightProfile
        ? {
            fill: palette.fill,
            fillOpacity: Math.min(palette.fillOpacity, 0.08),
            innerEdge: palette.innerEdge,
            outerEdge: palette.outerEdge,
          }
        : isTabletHighlightProfile
          ? {
              fill: palette.fill,
              fillOpacity: Math.min(palette.fillOpacity, 0.1),
              innerEdge: palette.innerEdge,
              outerEdge: palette.outerEdge,
            }
          : palette,
    [isMobileHighlightProfile, isTabletHighlightProfile],
  );
  const hoveredMeshes = useMemo(() => {
    if (!hoveredApartmentId || hoveredApartmentId === selectedApartmentId) {
      return [];
    }

    const palette = getEffectivePalette(
      getApartmentHighlightPalette(
        getApartmentStatus(hoveredApartmentId),
        "hover",
      ),
    );

    return (apartments.get(hoveredApartmentId) ?? []).map((meshData) => ({
      meshData,
      palette,
    }));
  }, [
    apartments,
    getApartmentStatus,
    getEffectivePalette,
    hoveredApartmentId,
    selectedApartmentId,
  ]);
  const selectedMeshes = useMemo(() => {
    if (!selectedApartmentId) {
      return [];
    }

    const palette = getEffectivePalette(
      getApartmentHighlightPalette(
        getApartmentStatus(selectedApartmentId),
        "filter",
      ),
    );

    return (apartments.get(selectedApartmentId) ?? []).map((meshData) => ({
      meshData,
      palette: {
        ...palette,
        fillOpacity: isTouchHighlightProfile
          ? Math.min(palette.fillOpacity + 0.04, 0.14)
          : Math.min(palette.fillOpacity + 0.08, 0.3),
      },
    }));
  }, [
    apartments,
    getApartmentStatus,
    getEffectivePalette,
    isTouchHighlightProfile,
    selectedApartmentId,
  ]);
  const filteredMeshes = useMemo(() => {
    const next: Array<{
      meshData: HoverMeshData;
      palette: ApartmentHighlightPalette;
    }> = [];
    const limitedIds = Array.from(filteredApartmentIds);

    limitedIds.forEach((apartmentId) => {
      if (
        apartmentId === hoveredApartmentId ||
        apartmentId === selectedApartmentId
      ) {
        return;
      }

      const apartmentMeshes = apartments.get(apartmentId);
      const palette = getEffectivePalette(
        getApartmentHighlightPalette(getApartmentStatus(apartmentId), "filter"),
      );

      if (apartmentMeshes?.length) {
        apartmentMeshes.forEach((meshData) => {
          next.push({
            meshData,
            palette,
          });
        });
      }
    });

    return next;
  }, [
    apartments,
    filteredApartmentIds,
    getApartmentStatus,
    getEffectivePalette,
    hoveredApartmentId,
    selectedApartmentId,
  ]);
  const renderFill = renderMode !== "light";
  const renderInnerEdges = true;
  const renderOuterEdges = renderMode === "full" && !isTouchHighlightProfile;
  const renderSelectedOuterEdge = renderMode !== "light";
  const edgeThickness = isTouchHighlightProfile
    ? 1
    : renderMode === "light"
      ? 1
      : 2;
  const compactEdgeOpacity = isMobileHighlightProfile ? 0.32 : 0.4;
  const filteredEdgeScaleMultiplier = isTouchHighlightProfile ? 1.0015 : 1.006;
  const focusedEdgeScaleMultiplier = isTouchHighlightProfile ? 1.002 : 1.008;
  const shouldSimplifyFilteredEdges =
    renderMode !== "full" ||
    isTouchHighlightProfile ||
    simplifyFilteredVisuals ||
    filteredMeshes.length >= FILTER_HIGHLIGHT_EDGE_SIMPLIFY_THRESHOLD;

  if (
    !hoveredMeshes.length &&
    !selectedMeshes.length &&
    filteredMeshes.length === 0
  ) {
    return null;
  }

  return (
    <group>
      {filteredMeshes.map((meshData) => (
        <group key={`filter-${meshData.meshData.key}`}>
          {renderFill ? (
            <mesh
              frustumCulled={false}
              geometry={meshData.meshData.geometry}
              material={getHighlightFillMaterial(
                meshData.palette.fill,
                meshData.palette.fillOpacity,
              )}
              matrix={meshData.meshData.matrix}
              matrixAutoUpdate={false}
              raycast={() => null}
              renderOrder={10}
            />
          ) : null}
          {renderInnerEdges ? (
            <HighlightEdgeLines
              color={meshData.palette.innerEdge}
              geometry={meshData.meshData.geometry}
              matrix={meshData.meshData.matrix}
              opacity={isTouchHighlightProfile ? compactEdgeOpacity : 1}
              renderOrder={11}
              scaleMultiplier={filteredEdgeScaleMultiplier}
              thickness={edgeThickness}
            />
          ) : null}
          {!shouldSimplifyFilteredEdges && renderOuterEdges ? (
            <HighlightEdgeLines
              color={meshData.palette.outerEdge}
              geometry={meshData.meshData.geometry}
              matrix={meshData.meshData.matrix}
              renderOrder={12}
              thickness={3}
            />
          ) : null}
        </group>
      ))}

      {selectedMeshes.map((meshData) => (
        <group key={`selected-${meshData.meshData.key}`}>
          {renderFill ? (
            <mesh
              frustumCulled={false}
              geometry={meshData.meshData.geometry}
              material={getHighlightFillMaterial(
                meshData.palette.fill,
                meshData.palette.fillOpacity,
              )}
              matrix={meshData.meshData.matrix}
              matrixAutoUpdate={false}
              raycast={() => null}
              renderOrder={14}
            />
          ) : null}
          {renderSelectedOuterEdge ? (
            <HighlightEdgeLines
              color={meshData.palette.outerEdge}
              geometry={meshData.meshData.geometry}
              matrix={meshData.meshData.matrix}
              opacity={isTouchHighlightProfile ? 0.52 : 1}
              renderOrder={16}
              scaleMultiplier={focusedEdgeScaleMultiplier}
              thickness={isTouchHighlightProfile ? 1 : 4}
            />
          ) : null}
        </group>
      ))}

      {hoveredMeshes.map((meshData) => (
        <group key={`hover-${meshData.meshData.key}`}>
          {renderFill ? (
            <mesh
              frustumCulled={false}
              geometry={meshData.meshData.geometry}
              material={getHighlightFillMaterial(
                meshData.palette.fill,
                meshData.palette.fillOpacity,
              )}
              matrix={meshData.meshData.matrix}
              matrixAutoUpdate={false}
              raycast={() => null}
              renderOrder={12}
            />
          ) : null}
          {renderInnerEdges && isTouchHighlightProfile ? (
            <HighlightEdgeLines
              color={meshData.palette.innerEdge}
              geometry={meshData.meshData.geometry}
              matrix={meshData.meshData.matrix}
              opacity={compactEdgeOpacity}
              renderOrder={13}
              scaleMultiplier={focusedEdgeScaleMultiplier}
              thickness={edgeThickness}
            />
          ) : null}
          {renderOuterEdges ? (
            <HighlightEdgeLines
              color={meshData.palette.outerEdge}
              geometry={meshData.meshData.geometry}
              matrix={meshData.meshData.matrix}
              renderOrder={14}
              thickness={4}
            />
          ) : null}
        </group>
      ))}
    </group>
  );
});

const HoverTracker = memo(function HoverTracker({
  allowHover,
  interactionMode,
  onHoverChange,
  pickableMeshes,
}: {
  allowHover: boolean;
  interactionMode: InteractionMode;
  onHoverChange: (
    apartmentId: string | null,
    pointerPosition: PointerPosition | null,
  ) => void;
  pickableMeshes: Mesh[];
}) {
  const { camera, gl, raycaster } = useThree();
  const pointerRef = useRef(new Vector2());
  const worldNormalRef = useRef(new Vector3());
  const pointerPositionRef = useRef<PointerPosition>({ x: 0, y: 0 });

  useEffect(() => {
    const element = gl.domElement;
    const pointer = pointerRef.current;
    const worldNormal = worldNormalRef.current;
    let frameId = 0;
    let latestClientX = 0;
    let latestClientY = 0;
    let latestButtons = 0;
    let latestOffsetX = 0;
    let latestOffsetY = 0;
    let lastTime = 0;

    const updateHover = (
      apartmentId: string | null,
      pointerPosition: PointerPosition | null,
    ) => {
      onHoverChange(apartmentId, pointerPosition);
    };

    if (
      interactionMode !== "idle" ||
      !allowHover ||
      pickableMeshes.length === 0
    ) {
      updateHover(null, null);
      return;
    }

    const processPointerMove = () => {
      frameId = 0;
      const now = performance.now();

      if (now - lastTime < 50) {
        return;
      }

      lastTime = now;

      if (latestButtons !== 0) {
        updateHover(null, null);
        return;
      }

      pointerPositionRef.current.x = latestClientX;
      pointerPositionRef.current.y = latestClientY;

      if (element.clientWidth <= 0 || element.clientHeight <= 0) {
        updateHover(null, null);
        return;
      }

      pointer.x = (latestOffsetX / element.clientWidth) * 2 - 1;
      pointer.y = -(latestOffsetY / element.clientHeight) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const intersections = raycaster.intersectObjects(pickableMeshes, false);
      const frontFacingHit = intersections.find((intersection) => {
        const apartmentId = intersection.object.userData.apartmentId as
          string | undefined;

        if (!apartmentId) {
          return false;
        }

        if (!intersection.face) {
          return true;
        }

        worldNormal
          .copy(intersection.face.normal)
          .transformDirection(intersection.object.matrixWorld);

        return worldNormal.dot(raycaster.ray.direction) <= -0.02;
      });

      const fallbackHit = intersections.find(
        (intersection) =>
          typeof intersection.object.userData.apartmentId === "string",
      );

      const hit = frontFacingHit ?? fallbackHit ?? null;

      updateHover(
        (hit?.object.userData.apartmentId as string | undefined) ?? null,
        pointerPositionRef.current,
      );
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!event.isPrimary || event.pointerType === "touch") {
        return;
      }

      latestClientX = event.clientX;
      latestClientY = event.clientY;
      latestButtons = event.buttons;
      latestOffsetX = event.offsetX;
      latestOffsetY = event.offsetY;

      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(processPointerMove);
    };

    const handlePointerLeave = () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }

      updateHover(null, null);
    };

    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerleave", handlePointerLeave);
    element.addEventListener("pointercancel", handlePointerLeave);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }

      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerleave", handlePointerLeave);
      element.removeEventListener("pointercancel", handlePointerLeave);
    };
  }, [
    allowHover,
    camera,
    gl,
    interactionMode,
    onHoverChange,
    pickableMeshes,
    raycaster,
  ]);

  return null;
});

const TowerScene = memo(function TowerScene({
  apartments,
  enableBoundsTree,
  interactionMode,
  currentFrame,
  filteredApartments,
  getApartmentStatus,
  onInvalidateReady,
  onPointerSelectionReady,
  allowHover,
  onApartmentHover,
  presentedVideoFrameRef,
  rotationProgressRef,
  selectedApartmentId,
  selectedTower,
  simplifyFilteredVisuals,
  showApartmentMeshes,
  showTowerMeshes,
  showTrackingDebug,
  touchHighlightProfile,
  trackingVideoAspect,
  towerAModelPath,
  towerBModelPath,
  masterPlanConfig,
}: {
  apartments: InventoryApartment[];
  enableBoundsTree: boolean;
  interactionMode: InteractionMode;
  currentFrame: number;
  filteredApartments: InventoryApartment[];
  getApartmentStatus: (
    apartmentId: string | null,
  ) => InventoryStatus | null | undefined;
  onInvalidateReady?: (invalidateCanvas: () => void) => void;
  onPointerSelectionReady?: (
    pickApartmentAtClientPoint: (
      clientX: number,
      clientY: number,
    ) => string | null,
  ) => void;
  allowHover: boolean;
  onApartmentHover: (
    apartmentId: string | null,
    pointerPosition: PointerPosition | null,
  ) => void;
  presentedVideoFrameRef: MutableRefObject<number>;
  rotationProgressRef: MutableRefObject<number>;
  selectedApartmentId: string | null;
  selectedTower: TowerType | null;
  simplifyFilteredVisuals: boolean;
  showApartmentMeshes: boolean;
  showTowerMeshes: boolean;
  showTrackingDebug: boolean;
  touchHighlightProfile: TouchHighlightProfile;
  trackingVideoAspect: number;
  towerAModelPath: string;
  towerBModelPath: string;
  masterPlanConfig?: MasterPlanDeveloperConfig;
}) {
  const { camera, gl, invalidate, raycaster } = useThree();
  const isThreeDsMaxTrial = masterPlanConfig?.renderer === "3ds-max-vantage";
  const towerAGltf = useGLTF(towerAModelPath);
  const towerBGltf = useGLTF(towerBModelPath);
  const towerAInteractionGltf = useGLTF(towerAModelPath);
  const towerBInteractionGltf = useGLTF(towerBModelPath);
  const cameraRef = useRef<ThreePerspectiveCamera | null>(null);
  const lastAppliedExactFrameRef = useRef<number | null>(null);
  const fallbackGroupRef = useRef<Group | null>(null);
  const hoveredApartmentIdRef = useRef<string | null>(null);
  const trackingDebugLoggedRef = useRef(false);
  const [hoveredApartmentId, setHoveredApartmentId] = useState<string | null>(
    null,
  );
  const activeTowerCode = towerTypeToCode(selectedTower) ?? "A";
  const interactiveTowerScope = useMemo<TowerType | null>(() => null, []);
  const useVisibleTrialModel = false;
  const showDebugModel = masterPlanConfig?.debugModel === true;
  const shouldUseTrialTrackingAlignment =
    isThreeDsMaxTrial && !useVisibleTrialModel;
  const preparedTowerA = useMemo(
    () =>
      getPreparedTowerScene(
        towerAGltf.scene,
        showDebugModel,
        towerAInteractionGltf.scene,
        "A",
        enableBoundsTree,
        !useVisibleTrialModel && isThreeDsMaxTrial,
      ),
    [
      enableBoundsTree,
      isThreeDsMaxTrial,
      showDebugModel,
      towerAGltf.scene,
      towerAInteractionGltf.scene,
      useVisibleTrialModel,
    ],
  );
  const preparedTowerB = useMemo(
    () =>
      getPreparedTowerScene(
        towerBGltf.scene,
        showDebugModel,
        towerBInteractionGltf.scene,
        "B",
        enableBoundsTree,
        !useVisibleTrialModel && isThreeDsMaxTrial,
      ),
    [
      enableBoundsTree,
      isThreeDsMaxTrial,
      showDebugModel,
      towerBGltf.scene,
      towerBInteractionGltf.scene,
      useVisibleTrialModel,
    ],
  );
  const preparedTrialModel = preparedTowerA;
  const primaryPreparedModel = isThreeDsMaxTrial
    ? preparedTrialModel
    : activeTowerCode === "B"
      ? preparedTowerB
      : preparedTowerA;
  const normalizedTrackingVideoAspect = useMemo(
    () => normalizeAspect(trackingVideoAspect),
    [trackingVideoAspect],
  );
  const cameraTargetY = primaryPreparedModel.scaledHeight * 0.52;
  const nearestTrackingFrameInfo = useMemo(
    () => getNearestSnapFrameInfo(currentFrame),
    [currentFrame],
  );
  const trackingInterpolation = useMemo(
    () => getTrackingInterpolationSegment(currentFrame),
    [currentFrame],
  );
  const baseTowerATrackingTransform = useMemo(
    () =>
      shouldUseTrialTrackingAlignment || !isThreeDsMaxTrial
        ? getPrecomputedTowerTransform("A", masterPlanConfig)
        : null,
    [isThreeDsMaxTrial, masterPlanConfig, shouldUseTrialTrackingAlignment],
  );
  const baseTowerBTrackingTransform = useMemo(
    () =>
      shouldUseTrialTrackingAlignment || !isThreeDsMaxTrial
        ? getPrecomputedTowerTransform("B", masterPlanConfig)
        : null,
    [isThreeDsMaxTrial, masterPlanConfig, shouldUseTrialTrackingAlignment],
  );
  const currentTrackingKey =
    TOWER_A_TRACKING_KEYS[nearestTrackingFrameInfo.index] ??
    TOWER_A_TRACKING_KEYS[0];
  const configuredFrameCamera = useMemo(() => {
    const frameCameras = masterPlanConfig?.frameCameras;

    if (!frameCameras?.length) {
      return null;
    }

    const frameIndex =
      (((Math.round(currentFrame) - 1) % frameCameras.length) +
        frameCameras.length) %
      frameCameras.length;
    const camera = frameCameras[frameIndex];

    if (!camera) {
      return null;
    }

    return {
      fov: camera.fov,
      position: [camera.position.x, camera.position.y, camera.position.z] as [
        number,
        number,
        number,
      ],
      quaternion: camera.quaternion,
    } satisfies SerializedTrackingCamera;
  }, [currentFrame, masterPlanConfig?.frameCameras]);
  const frameGlbOffset = useMemo(() => {
    if (!isThreeDsMaxTrial || !configuredFrameCamera) {
      return null;
    }

    const totalFrames = masterPlanConfig?.frameCameras?.length ?? TOTAL_FRAMES;
    const leftOffsetCm = FRAME_GLB_LEFT_CORRECTIONS.reduce(
      (totalOffset, correction) => {
        const directDistance = Math.abs(currentFrame - correction.frame);
        const frameDistance = Math.min(
          directDistance,
          Math.max(0, totalFrames - directDistance),
        );

        if (frameDistance >= FRAME_GLB_OFFSET_FALLOFF_FRAMES) {
          return totalOffset;
        }

        const linearStrength =
          1 - frameDistance / FRAME_GLB_OFFSET_FALLOFF_FRAMES;
        const smoothStrength =
          linearStrength * linearStrength * (3 - 2 * linearStrength);

        return totalOffset + correction.offsetCm * smoothStrength;
      },
      0,
    );

    if (leftOffsetCm === 0) {
      return null;
    }

    const cameraRight = new Vector3(1, 0, 0)
      .applyQuaternion(new Quaternion(...configuredFrameCamera.quaternion))
      .normalize();

    return cameraRight.multiplyScalar(-leftOffsetCm);
  }, [
    configuredFrameCamera,
    currentFrame,
    isThreeDsMaxTrial,
    masterPlanConfig?.frameCameras?.length,
  ]);
  const towerATrackingTransform = useMemo(() => {
    if (!baseTowerATrackingTransform || !frameGlbOffset) {
      return baseTowerATrackingTransform;
    }

    return {
      ...baseTowerATrackingTransform,
      position: baseTowerATrackingTransform.position
        .clone()
        .add(frameGlbOffset),
    } satisfies SimilarityTransform;
  }, [baseTowerATrackingTransform, frameGlbOffset]);
  const towerBTrackingTransform = useMemo(() => {
    if (!baseTowerBTrackingTransform || !frameGlbOffset) {
      return baseTowerBTrackingTransform;
    }

    return {
      ...baseTowerBTrackingTransform,
      position: baseTowerBTrackingTransform.position
        .clone()
        .add(frameGlbOffset),
    } satisfies SimilarityTransform;
  }, [baseTowerBTrackingTransform, frameGlbOffset]);
  const towerTrackingTransform =
    activeTowerCode === "B" ? towerBTrackingTransform : towerATrackingTransform;
  const trackingCameraView = useMemo(() => {
    if (isThreeDsMaxTrial && useVisibleTrialModel) {
      return null;
    }

    if (configuredFrameCamera) {
      return getTrackingCameraViewFromConfig(
        configuredFrameCamera,
        currentTrackingKey,
        normalizedTrackingVideoAspect,
      );
    }

    const fromCamera = getPrecomputedTrackingCameraView(
      activeTowerCode,
      trackingInterpolation.fromKey,
      normalizedTrackingVideoAspect,
      masterPlanConfig,
    );
    const toCamera = getPrecomputedTrackingCameraView(
      activeTowerCode,
      trackingInterpolation.toKey,
      normalizedTrackingVideoAspect,
      masterPlanConfig,
    );

    if (!fromCamera && !toCamera) {
      return null;
    }

    if (!fromCamera) {
      return toCamera;
    }

    if (!toCamera) {
      return fromCamera;
    }

    const position = new Vector3().lerpVectors(
      fromCamera.position,
      toCamera.position,
      trackingInterpolation.t,
    );
    const quaternion = new Quaternion().slerpQuaternions(
      fromCamera.quaternion,
      toCamera.quaternion,
      trackingInterpolation.t,
    );

    return {
      fov: MathUtils.lerp(
        fromCamera.fov,
        toCamera.fov,
        trackingInterpolation.t,
      ),
      key: fromCamera.key,
      position,
      quaternion,
      target: new Vector3(),
    } satisfies TrackingCameraView;
  }, [
    activeTowerCode,
    configuredFrameCamera,
    currentTrackingKey,
    isThreeDsMaxTrial,
    normalizedTrackingVideoAspect,
    masterPlanConfig,
    trackingInterpolation.fromKey,
    trackingInterpolation.t,
    trackingInterpolation.toKey,
    useVisibleTrialModel,
  ]);
  const unrealTowerDummies = useMemo(
    () =>
      showTrackingDebug
        ? getUnrealTowerFootprintInThreeSpace(
            activeTowerCode,
            currentTrackingKey,
          )
        : null,
    [activeTowerCode, currentTrackingKey, showTrackingDebug],
  );
  const transformedTrackedTowerDummies = useMemo(
    () =>
      showTrackingDebug
        ? transformTowerFootprint(
            primaryPreparedModel.trackedTowerFootprints[activeTowerCode],
            towerTrackingTransform,
          )
        : null,
    [
      activeTowerCode,
      primaryPreparedModel.trackedTowerFootprints,
      showTrackingDebug,
      towerTrackingTransform,
    ],
  );
  const combinedApartments = useMemo(() => {
    if (isThreeDsMaxTrial) {
      return preparedTrialModel.apartments;
    }

    const next = new Map<string, HoverMeshData[]>();

    preparedTowerA.apartments.forEach((value, key) => {
      next.set(key, value);
    });
    preparedTowerB.apartments.forEach((value, key) => {
      next.set(key, value);
    });

    return next;
  }, [
    isThreeDsMaxTrial,
    preparedTowerA.apartments,
    preparedTowerB.apartments,
    preparedTrialModel.apartments,
  ]);
  const activeApartments = useMemo(() => {
    if (isThreeDsMaxTrial) {
      return preparedTrialModel.apartments;
    }

    if (interactiveTowerScope === "Tower A") {
      return preparedTowerA.apartments;
    }

    if (interactiveTowerScope === "Tower B") {
      return preparedTowerB.apartments;
    }

    return combinedApartments;
  }, [
    combinedApartments,
    isThreeDsMaxTrial,
    interactiveTowerScope,
    preparedTowerA.apartments,
    preparedTowerB.apartments,
    preparedTrialModel.apartments,
  ]);
  const activeHotspot = useMemo(
    () =>
      getNearestMasterPlanHotspot(
        currentFrame,
        masterPlanConfig?.reverseHotspotDirection,
      ),
    [currentFrame, masterPlanConfig?.reverseHotspotDirection],
  );
  const apartmentIndex = useMemo(
    () => buildInventoryApartmentIndex(apartments),
    [apartments],
  );
  const inventoryBackedApartmentIdsByHotspot = useMemo(() => {
    const next = new Map<MasterPlanHotspotKey, Set<string>>();

    MASTER_PLAN_HOTSPOT_KEYS.forEach((hotspotKey) => {
      const apartmentIds = new Set<string>();

      activeApartments.forEach((_, apartmentId) => {
        if (!isApartmentIdAllowedAtHotspot(apartmentId, hotspotKey)) {
          return;
        }

        const inventoryApartment = findInventoryApartmentInIndex(
          apartmentIndex,
          apartmentId,
          interactiveTowerScope,
        );

        if (inventoryApartment) {
          apartmentIds.add(apartmentId);
        }
      });

      next.set(hotspotKey, apartmentIds);
    });

    return next;
  }, [activeApartments, apartmentIndex, interactiveTowerScope]);
  const inventoryBackedApartmentIds = useMemo(() => {
    const apartmentIds = new Set<string>();

    activeApartments.forEach((_, apartmentId) => {
      const inventoryApartment = findInventoryApartmentInIndex(
        apartmentIndex,
        apartmentId,
        interactiveTowerScope,
      );

      if (inventoryApartment) {
        apartmentIds.add(apartmentId);
      }
    });

    return apartmentIds;
  }, [activeApartments, apartmentIndex, interactiveTowerScope]);
  const activeApartmentTokenLookup = useMemo(
    () => buildApartmentTokenLookup(inventoryBackedApartmentIds),
    [inventoryBackedApartmentIds],
  );
  const combinedPickableMeshes = useMemo(
    () =>
      isThreeDsMaxTrial
        ? preparedTrialModel.pickableMeshes
        : [...preparedTowerA.pickableMeshes, ...preparedTowerB.pickableMeshes],
    [
      isThreeDsMaxTrial,
      preparedTowerA.pickableMeshes,
      preparedTowerB.pickableMeshes,
      preparedTrialModel.pickableMeshes,
    ],
  );
  const hoverPickableMeshes = useMemo(() => {
    if (isThreeDsMaxTrial) {
      return preparedTrialModel.pickableMeshes;
    }

    if (interactiveTowerScope === "Tower A") {
      return preparedTowerA.pickableMeshes;
    }

    if (interactiveTowerScope === "Tower B") {
      return preparedTowerB.pickableMeshes;
    }

    return combinedPickableMeshes;
  }, [
    combinedPickableMeshes,
    isThreeDsMaxTrial,
    interactiveTowerScope,
    preparedTowerA.pickableMeshes,
    preparedTowerB.pickableMeshes,
    preparedTrialModel.pickableMeshes,
  ]);
  const hotspotPickMap = useMemo(
    () =>
      buildHotspotPickMap(
        hoverPickableMeshes,
        inventoryBackedApartmentIdsByHotspot,
      ),
    [hoverPickableMeshes, inventoryBackedApartmentIdsByHotspot],
  );
  const hotspotScopedPickableMeshes = useMemo(
    () => hotspotPickMap.get(activeHotspot) ?? EMPTY_MESHES,
    [activeHotspot, hotspotPickMap],
  );
  const filteredApartmentIds = useMemo(() => {
    if (
      !showApartmentMeshes ||
      activeApartmentTokenLookup.size === 0 ||
      filteredApartments.length === 0
    ) {
      return new Set<string>();
    }

    const nextApartmentIds = new Set<string>();

    filteredApartments.forEach((apartment) => {
      if (selectedTower && apartment.tower !== selectedTower) {
        return;
      }

      const towerLookup = activeApartmentTokenLookup.get(apartment.tower);

      if (!towerLookup) {
        return;
      }

      [
        normalizeFlatToken(apartment.flatNumber),
        normalizeFlatToken(apartment.title),
      ]
        .filter(Boolean)
        .forEach((token) => {
          towerLookup.get(token)?.forEach((apartmentId) => {
            nextApartmentIds.add(apartmentId);
          });
        });
    });

    return nextApartmentIds;
  }, [
    activeApartmentTokenLookup,
    filteredApartments,
    selectedTower,
    showApartmentMeshes,
  ]);
  const selectionPointerRef = useRef(new Vector2());
  const selectionWorldNormalRef = useRef(new Vector3());
  const pickApartmentAtClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (
        interactionMode !== "idle" ||
        hotspotScopedPickableMeshes.length === 0
      ) {
        return null;
      }

      const rect = gl.domElement.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }

      const pointer = selectionPointerRef.current;
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const worldNormal = selectionWorldNormalRef.current;

      raycaster.setFromCamera(pointer, cameraRef.current ?? camera);

      const intersections = raycaster.intersectObjects(
        hotspotScopedPickableMeshes,
        false,
      );
      const frontFacingHit = intersections.find((intersection) => {
        const apartmentId = intersection.object.userData.apartmentId as
          string | undefined;

        if (!apartmentId) {
          return false;
        }

        if (!intersection.face) {
          return true;
        }

        worldNormal
          .copy(intersection.face.normal)
          .transformDirection(intersection.object.matrixWorld);

        return worldNormal.dot(raycaster.ray.direction) <= -0.02;
      });
      const fallbackHit = intersections.find(
        (intersection) =>
          typeof intersection.object.userData.apartmentId === "string",
      );

      return (
        (frontFacingHit?.object.userData.apartmentId as string | undefined) ??
        (fallbackHit?.object.userData.apartmentId as string | undefined) ??
        null
      );
    },
    [camera, gl, hotspotScopedPickableMeshes, interactionMode, raycaster],
  );

  useEffect(() => {
    onPointerSelectionReady?.(pickApartmentAtClientPoint);
  }, [onPointerSelectionReady, pickApartmentAtClientPoint]);

  useEffect(() => {
    if (!showTrackingDebug) {
      trackingDebugLoggedRef.current = false;
      return;
    }

    if (
      trackingDebugLoggedRef.current ||
      !transformedTrackedTowerDummies ||
      !unrealTowerDummies
    ) {
      return;
    }

    console.groupCollapsed(`Tower ${activeTowerCode} tracking debug`);
    console.table({
      modelTa1: vectorToDebugRow(transformedTrackedTowerDummies.ta1),
      modelTa2: vectorToDebugRow(transformedTrackedTowerDummies.ta2),
      modelTa3: vectorToDebugRow(transformedTrackedTowerDummies.ta3),
      modelTa4: vectorToDebugRow(transformedTrackedTowerDummies.ta4),
      unrealTa1: vectorToDebugRow(unrealTowerDummies.ta1),
      unrealTa2: vectorToDebugRow(unrealTowerDummies.ta2),
      unrealTa3: vectorToDebugRow(unrealTowerDummies.ta3),
      unrealTa4: vectorToDebugRow(unrealTowerDummies.ta4),
    });
    console.groupEnd();
    trackingDebugLoggedRef.current = true;
  }, [
    activeTowerCode,
    showTrackingDebug,
    transformedTrackedTowerDummies,
    unrealTowerDummies,
  ]);
  const fallbackScenePosition = BASE_MODEL_OFFSET;
  const trackedScenePosition: [number, number, number] = [0, 0, 0];
  const hotspotSelectedApartmentId = useMemo(
    () =>
      selectedApartmentId &&
      isApartmentIdAllowedAtHotspot(selectedApartmentId, activeHotspot)
        ? selectedApartmentId
        : null,
    [activeHotspot, selectedApartmentId],
  );
  const shouldShowSelectedApartment = hotspotSelectedApartmentId !== null;
  const shouldRenderTowerProxies =
    showTowerMeshes || showTrackingDebug || shouldShowSelectedApartment;
  const hotspotHoveredApartmentId = useMemo(
    () =>
      hoveredApartmentId &&
      isApartmentIdAllowedAtHotspot(hoveredApartmentId, activeHotspot)
        ? hoveredApartmentId
        : null,
    [activeHotspot, hoveredApartmentId],
  );
  const activeHoveredApartmentId = allowHover
    ? hotspotHoveredApartmentId
    : null;
  const effectiveFilteredApartmentIds =
    interactionMode === "idle" ? filteredApartmentIds : EMPTY_APARTMENT_IDS;
  const effectiveHoveredApartmentId =
    interactionMode === "idle" ? activeHoveredApartmentId : null;
  const towerAFilteredApartmentIds = useMemo(
    () =>
      filterApartmentIdsForPreparedTower(
        effectiveFilteredApartmentIds,
        isThreeDsMaxTrial
          ? preparedTrialModel.apartments
          : preparedTowerA.apartments,
      ),
    [
      effectiveFilteredApartmentIds,
      isThreeDsMaxTrial,
      preparedTowerA.apartments,
      preparedTrialModel.apartments,
    ],
  );
  const towerBFilteredApartmentIds = useMemo(
    () =>
      filterApartmentIdsForPreparedTower(
        effectiveFilteredApartmentIds,
        preparedTowerB.apartments,
      ),
    [effectiveFilteredApartmentIds, preparedTowerB.apartments],
  );
  const fallbackFilteredApartmentIds = useMemo(
    () =>
      filterApartmentIdsForPreparedTower(
        effectiveFilteredApartmentIds,
        primaryPreparedModel.apartments,
      ),
    [effectiveFilteredApartmentIds, primaryPreparedModel.apartments],
  );
  const towerAHoveredApartmentId =
    effectiveHoveredApartmentId &&
    (isThreeDsMaxTrial
      ? preparedTrialModel.apartments.has(effectiveHoveredApartmentId)
      : preparedTowerA.apartments.has(effectiveHoveredApartmentId))
      ? effectiveHoveredApartmentId
      : null;
  const towerBHoveredApartmentId =
    effectiveHoveredApartmentId &&
    preparedTowerB.apartments.has(effectiveHoveredApartmentId)
      ? effectiveHoveredApartmentId
      : null;
  const fallbackHoveredApartmentId =
    effectiveHoveredApartmentId &&
    primaryPreparedModel.apartments.has(effectiveHoveredApartmentId)
      ? effectiveHoveredApartmentId
      : null;
  const towerASelectedApartmentId =
    hotspotSelectedApartmentId &&
    (isThreeDsMaxTrial
      ? preparedTrialModel.apartments.has(hotspotSelectedApartmentId)
      : preparedTowerA.apartments.has(hotspotSelectedApartmentId))
      ? hotspotSelectedApartmentId
      : null;
  const towerBSelectedApartmentId =
    hotspotSelectedApartmentId &&
    preparedTowerB.apartments.has(hotspotSelectedApartmentId)
      ? hotspotSelectedApartmentId
      : null;
  const fallbackSelectedApartmentId =
    hotspotSelectedApartmentId &&
    primaryPreparedModel.apartments.has(hotspotSelectedApartmentId)
      ? hotspotSelectedApartmentId
      : null;
  const highlightRenderMode: HighlightRenderMode =
    interactionMode === "dragging" || interactionMode === "settling"
      ? "light"
      : touchHighlightProfile !== "desktop"
        ? "medium"
        : effectiveFilteredApartmentIds.size > 12 || simplifyFilteredVisuals
          ? "medium"
          : "full";
  const shouldShowHighlightOverlay =
    interactionMode === "idle"
      ? (showApartmentMeshes || shouldShowSelectedApartment) &&
        (effectiveHoveredApartmentId !== null ||
          effectiveFilteredApartmentIds.size > 0 ||
          shouldShowSelectedApartment)
      : shouldShowSelectedApartment;

  useEffect(() => {
    onInvalidateReady?.(invalidate);
  }, [invalidate, onInvalidateReady]);

  const handleSceneHover = useCallback(
    (apartmentId: string | null, pointerPosition: PointerPosition | null) => {
      if (hoveredApartmentIdRef.current !== apartmentId) {
        hoveredApartmentIdRef.current = apartmentId;
        setHoveredApartmentId(apartmentId);
      }

      onApartmentHover(apartmentId, pointerPosition);
    },
    [onApartmentHover],
  );

  useEffect(() => {
    const camera = cameraRef.current;

    if (
      !camera ||
      !trackingCameraView ||
      masterPlanConfig?.frameCameras?.length
    ) {
      return;
    }

    if (Math.abs(camera.fov - trackingCameraView.fov) > 0.001) {
      camera.fov = trackingCameraView.fov;
      camera.updateProjectionMatrix();
    }

    camera.position.copy(trackingCameraView.position);
    camera.quaternion.copy(trackingCameraView.quaternion);
    invalidate();
  }, [invalidate, masterPlanConfig?.frameCameras, trackingCameraView]);

  useFrame(() => {
    const camera = cameraRef.current;

    if (!camera) {
      return;
    }

    const exactFrameCameras = masterPlanConfig?.frameCameras;

    if (exactFrameCameras?.length) {
      const frameIndex =
        (((Math.round(presentedVideoFrameRef.current) - 1) %
          exactFrameCameras.length) +
          exactFrameCameras.length) %
        exactFrameCameras.length;

      if (lastAppliedExactFrameRef.current === frameIndex) {
        return;
      }

      const exactCamera = exactFrameCameras[frameIndex];

      if (!exactCamera) {
        return;
      }

      const exactCameraView = getTrackingCameraViewFromConfig(
        {
          fov: exactCamera.fov,
          position: [
            exactCamera.position.x,
            exactCamera.position.y,
            exactCamera.position.z,
          ],
          quaternion: exactCamera.quaternion,
        },
        currentTrackingKey,
        normalizedTrackingVideoAspect,
      );

      if (Math.abs(camera.fov - exactCameraView.fov) > 0.001) {
        camera.fov = exactCameraView.fov;
        camera.updateProjectionMatrix();
      }

      camera.position.copy(exactCameraView.position);
      camera.quaternion.copy(exactCameraView.quaternion);
      lastAppliedExactFrameRef.current = frameIndex;
      return;
    }

    if (trackingCameraView) {
      return;
    }

    camera.position.set(...BASE_CAMERA_POSITION);
    camera.lookAt(
      fallbackScenePosition[0],
      cameraTargetY + fallbackScenePosition[1],
      fallbackScenePosition[2],
    );

    if (fallbackGroupRef.current) {
      fallbackGroupRef.current.rotation.y = getProgressRotation(
        rotationProgressRef.current,
      );
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        far={isThreeDsMaxTrial ? 500000 : trackingCameraView ? 100000 : 400}
        fov={34}
        near={0.01}
        position={BASE_CAMERA_POSITION}
      />

      <ambientLight intensity={1.75} />
      <directionalLight
        color="#fff7d8"
        intensity={2.85}
        position={[12, 16, 8]}
      />
      <directionalLight
        color="#d9ecff"
        intensity={1.2}
        position={[-10, 10, -10]}
      />
      {shouldRenderTowerProxies && towerATrackingTransform ? (
        <group
          position={towerATrackingTransform.position.toArray()}
          quaternion={towerATrackingTransform.quaternion.toArray()}
          scale={towerATrackingTransform.scale}
        >
          {showDebugModel ? (
            <>
              <mesh position={[89948, 1334, -57740]} renderOrder={1000}>
                <sphereGeometry args={[900, 20, 20]} />
                <meshBasicMaterial
                  color="#33ffd1"
                  depthTest={false}
                  toneMapped={false}
                />
              </mesh>
              <mesh
                position={[-72212.390625, 1334, -78069.2578125]}
                renderOrder={1000}
              >
                <sphereGeometry args={[900, 20, 20]} />
                <meshBasicMaterial
                  color="#ffe04a"
                  depthTest={false}
                  toneMapped={false}
                />
              </mesh>
            </>
          ) : null}
          <group
            position={trackedScenePosition}
            scale={
              isThreeDsMaxTrial
                ? preparedTrialModel.scale
                : preparedTowerA.scale
            }
          >
            <group
              position={
                isThreeDsMaxTrial
                  ? preparedTrialModel.offset
                  : preparedTowerA.offset
              }
            >
              <primitive
                object={
                  isThreeDsMaxTrial
                    ? preparedTrialModel.scene
                    : preparedTowerA.scene
                }
              />
              {shouldShowHighlightOverlay && interactionMode === "idle" ? (
                <HighlightOverlay
                  apartments={
                    isThreeDsMaxTrial
                      ? preparedTrialModel.apartments
                      : preparedTowerA.apartments
                  }
                  filteredApartmentIds={towerAFilteredApartmentIds}
                  getApartmentStatus={getApartmentStatus}
                  hoveredApartmentId={towerAHoveredApartmentId}
                  renderMode={highlightRenderMode}
                  selectedApartmentId={towerASelectedApartmentId}
                  simplifyFilteredVisuals={simplifyFilteredVisuals}
                  touchHighlightProfile={touchHighlightProfile}
                />
              ) : null}
            </group>
          </group>
        </group>
      ) : null}
      {!isThreeDsMaxTrial &&
      shouldRenderTowerProxies &&
      towerBTrackingTransform ? (
        <group
          position={towerBTrackingTransform.position.toArray()}
          quaternion={towerBTrackingTransform.quaternion.toArray()}
          scale={towerBTrackingTransform.scale}
        >
          <group position={trackedScenePosition} scale={preparedTowerB.scale}>
            <group position={preparedTowerB.offset}>
              <primitive object={preparedTowerB.scene} />
              {shouldShowHighlightOverlay && interactionMode === "idle" ? (
                <HighlightOverlay
                  apartments={preparedTowerB.apartments}
                  filteredApartmentIds={towerBFilteredApartmentIds}
                  getApartmentStatus={getApartmentStatus}
                  hoveredApartmentId={towerBHoveredApartmentId}
                  renderMode={highlightRenderMode}
                  selectedApartmentId={towerBSelectedApartmentId}
                  simplifyFilteredVisuals={simplifyFilteredVisuals}
                  touchHighlightProfile={touchHighlightProfile}
                />
              ) : null}
            </group>
          </group>
        </group>
      ) : null}
      {shouldRenderTowerProxies &&
      !towerATrackingTransform &&
      (!towerBTrackingTransform || isThreeDsMaxTrial) ? (
        <group
          ref={fallbackGroupRef}
          position={fallbackScenePosition}
          scale={primaryPreparedModel.scale}
        >
          <group position={primaryPreparedModel.offset}>
            <primitive object={primaryPreparedModel.scene} />
            {shouldShowHighlightOverlay && interactionMode === "idle" ? (
              <HighlightOverlay
                apartments={primaryPreparedModel.apartments}
                filteredApartmentIds={fallbackFilteredApartmentIds}
                getApartmentStatus={getApartmentStatus}
                hoveredApartmentId={fallbackHoveredApartmentId}
                renderMode={highlightRenderMode}
                selectedApartmentId={fallbackSelectedApartmentId}
                simplifyFilteredVisuals={simplifyFilteredVisuals}
                touchHighlightProfile={touchHighlightProfile}
              />
            ) : null}
          </group>
        </group>
      ) : null}

      {allowHover && interactionMode === "idle" ? (
        <HoverTracker
          allowHover={allowHover}
          interactionMode={interactionMode}
          onHoverChange={handleSceneHover}
          pickableMeshes={hotspotScopedPickableMeshes}
        />
      ) : null}
    </>
  );
});

type MasterPlanFrameHoverStageProps = {
  apartments: InventoryApartment[];
  currentFrame: number;
  dragEnabled?: boolean;
  filteredApartments: InventoryApartment[];
  inventoryError: string | null;
  inventoryState: InventoryLoadState;
  onApartmentSelect?: (
    apartment: InventoryApartment | null,
    apartmentId: string | null,
  ) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
  onSetFrame: (frame: number) => void;
  selectedApartmentId: string | null;
  selectedTower: TowerType | null;
  touchHighlightProfile?: TouchHighlightProfile;
  config?: MasterPlanDeveloperConfig;
};

export default function MasterPlanFrameHoverStage({
  apartments,
  currentFrame,
  dragEnabled = true,
  filteredApartments,
  inventoryError,
  inventoryState,
  onApartmentSelect,
  onInteractionChange,
  onSetFrame,
  selectedApartmentId,
  selectedTower,
  touchHighlightProfile = "desktop",
  config,
}: MasterPlanFrameHoverStageProps) {
  const isThreeDsMaxTrial = config?.renderer === "3ds-max-vantage";
  const scrubEnabled = dragEnabled;
  const initialFrame = wrapFrame(currentFrame);
  const scrubVideoKey =
    config?.scrubVideoKey ?? MASTER_PLAN_SCRUB_HQ_VIDEO_PATH;
  const interactionVideoKey =
    config?.interactionVideoKey ?? MASTER_PLAN_SCRUB_INTERACTION_VIDEO_PATH;
  const fallbackImageKey =
    config?.fallbackImageKey ?? MASTER_PLAN_STAGE_FALLBACK_IMAGE;
  const towerAModelKey =
    config?.towerAModelKey ?? MODEL_PATH_A.replace(/^\//, "");
  const towerBModelKey =
    config?.towerBModelKey ?? MODEL_PATH_B.replace(/^\//, "");
  const signedAssetUrls = useSignedAssetUrls(
    filterSignableAssetKeys([
      scrubVideoKey,
      interactionVideoKey,
      fallbackImageKey,
      towerAModelKey,
      towerBModelKey,
    ]),
  );
  const sectionRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pointerSelectionRef = useRef<
    ((clientX: number, clientY: number) => string | null) | null
  >(null);
  const dragStateRef = useRef<DragState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasInvalidateRef = useRef<(() => void) | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const hoverCooldownTimeoutRef = useRef<number | null>(null);
  const hoverClearTimeoutRef = useRef<number | null>(null);
  const wheelSettleTimeoutRef = useRef<number | null>(null);
  const hasObservedUserScrubRef = useRef(false);
  const displayedFrameRef = useRef(initialFrame);
  const displayedFrameStateRef = useRef(initialFrame);
  const isSettlingRef = useRef(false);
  const lastSyncedVideoFrameRef = useRef<number | null>(null);
  const lastDragVideoSyncFrameRef = useRef<number | null>(null);
  const lastDragVideoSyncTimeRef = useRef(0);
  const lastPassiveVideoSyncFrameRef = useRef<number | null>(null);
  const lastPassiveVideoSyncTimeRef = useRef(0);
  const pendingVideoSeekProgressRef = useRef<number | null>(null);
  const presentedVideoFrameRef = useRef(initialFrame);
  const lastDisplayedFrameCommitTimeRef = useRef(0);
  const lastInvalidateSignatureRef = useRef("");
  const progressFrameRef = useRef<number | null>(null);
  const pendingProgressRef = useRef<number | null>(null);
  const pendingPointerDeltaXRef = useRef(0);
  const videoRevealFrameRef = useRef<number | null>(null);
  const displayProgressRef = useRef(frameToProgress(initialFrame));
  const dragTargetProgressRef = useRef(frameToProgress(initialFrame));
  const hoveredApartmentIdRef = useRef<string | null>(null);
  const tooltipFrameRef = useRef<number | null>(null);
  const lastTooltipPointerRef = useRef<PointerPosition | null>(null);
  const tooltipPositionRef = useRef({ x: 12, y: 12 });
  const viewportTransformRef = useRef<StageViewportTransform>(
    DEFAULT_STAGE_VIEWPORT_TRANSFORM,
  );
  const mobileGestureRef = useRef<MobileStageGestureState>(
    createDefaultMobileStageGestureState(),
  );
  const lastTouchSelectionTimestampRef = useRef(0);
  const [performanceProfile, setPerformanceProfile] =
    useState<MasterPlanPerformanceProfile>(() =>
      getMasterPlanPerformanceProfile(),
    );
  const [hoveredApartmentId, setHoveredApartmentId] = useState<string | null>(
    null,
  );
  const [displayedFrame, setDisplayedFrame] = useState(() => initialFrame);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isHoverCoolingDown, setIsHoverCoolingDown] = useState(false);
  const [tooltipMountTransform, setTooltipMountTransform] = useState(
    "translate3d(12px, 12px, 0)",
  );
  const [showTowerMeshes, setShowTowerMeshes] = useState(() =>
    updateVisibilityWithHysteresis(
      false,
      getNearestSnapFrameInfo(initialFrame).distance,
      TOWER_MESH_ENTER_WINDOW,
      TOWER_MESH_EXIT_WINDOW,
    ),
  );
  const [showApartmentMeshes, setShowApartmentMeshes] = useState(() =>
    updateVisibilityWithHysteresis(
      false,
      getNearestSnapFrameInfo(initialFrame).distance,
      APARTMENT_MESH_ENTER_WINDOW,
      APARTMENT_MESH_EXIT_WINDOW,
    ),
  );
  const [supportsPreciseHover, setSupportsPreciseHover] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isInteractiveSceneReady, setIsInteractiveSceneReady] = useState(false);
  const [sectionSize, setSectionSize] = useState(() => ({
    height: 0,
    width: 0,
  }));
  const [viewportTransform, setViewportTransformState] =
    useState<StageViewportTransform>(DEFAULT_STAGE_VIEWPORT_TRANSFORM);
  const safeFrame = wrapFrame(currentFrame);
  const showTowerMeshesRef = useRef(showTowerMeshes);
  const showApartmentMeshesRef = useRef(showApartmentMeshes);
  const effectiveShowTowerMeshes = isThreeDsMaxTrial ? true : showTowerMeshes;
  const effectiveShowApartmentMeshes = isThreeDsMaxTrial
    ? true
    : showApartmentMeshes;
  const trackingVideoAspect = config?.aspectRatio ?? TRACKING_VIDEO_ASPECT;
  const exactFrameTimelineFps = config?.frameCameras?.length
    ? config.fps
    : null;
  const coverViewport = useMemo(
    () =>
      getCoverViewport(
        sectionSize.width,
        sectionSize.height,
        trackingVideoAspect,
      ),
    [sectionSize.height, sectionSize.width, trackingVideoAspect],
  );
  const trackingSceneAspect = useMemo(
    () => normalizeAspect(trackingVideoAspect),
    [trackingVideoAspect],
  );
  const dragConfig = useMemo(
    () => getDragConfig(performanceProfile.tier),
    [performanceProfile.tier],
  );
  const dragVideoSyncIntervalMs = useMemo(
    () =>
      getDragVideoSyncIntervalMs(
        performanceProfile.tier,
        performanceProfile.isSafariLike,
      ),
    [performanceProfile.isSafariLike, performanceProfile.tier],
  );
  const dragVideoFrameSkip = useMemo(
    () =>
      getDragVideoFrameSkip(
        performanceProfile.tier,
        performanceProfile.isSafariLike,
      ),
    [performanceProfile.isSafariLike, performanceProfile.tier],
  );
  const displayedFrameCommitIntervalMs = useMemo(
    () =>
      exactFrameTimelineFps
        ? 1000 / exactFrameTimelineFps
        : getDisplayedFrameCommitIntervalMs(performanceProfile.tier),
    [exactFrameTimelineFps, performanceProfile.tier],
  );
  const passiveVideoSyncIntervalMs = useMemo(
    () =>
      getPassiveVideoSyncIntervalMs(
        performanceProfile.tier,
        performanceProfile.isSafariLike,
      ),
    [performanceProfile.isSafariLike, performanceProfile.tier],
  );
  const scrubVideoPath = useMemo(() => {
    if (performanceProfile.isSafariLike) {
      return interactionVideoKey;
    }

    return getScrubVideoPath(performanceProfile.tier, {
      high: scrubVideoKey,
      low: interactionVideoKey,
      medium: interactionVideoKey,
    });
  }, [
    interactionVideoKey,
    performanceProfile.isSafariLike,
    performanceProfile.tier,
    scrubVideoKey,
  ]);
  const signedScrubVideoPath = scrubVideoPath
    ? isLocalAssetKey(scrubVideoPath)
      ? toLocalPublicAssetPath(scrubVideoPath)
      : isRemoteAssetUrl(scrubVideoPath)
        ? scrubVideoPath
        : (signedAssetUrls[scrubVideoPath] ?? null)
    : null;
  const signedMasterPlanStageFallbackImage = isLocalAssetKey(fallbackImageKey)
    ? toLocalPublicAssetPath(fallbackImageKey)
    : isRemoteAssetUrl(fallbackImageKey)
      ? fallbackImageKey
      : (signedAssetUrls[fallbackImageKey] ?? null);
  const towerAModelPath = isThreeDsMaxTrial
    ? isLocalAssetKey(towerAModelKey)
      ? `${toLocalPublicAssetPath(towerAModelKey)}?${THREE_DS_MAX_TRIAL_MODEL_CACHE_BUSTER}`
      : (signedAssetUrls[towerAModelKey] ?? MODEL_PATH_A)
    : `/${towerAModelKey.replace(/^\/+/, "")}`;
  const towerBModelPath = isThreeDsMaxTrial
    ? isLocalAssetKey(towerBModelKey)
      ? `${toLocalPublicAssetPath(towerBModelKey)}?${THREE_DS_MAX_TRIAL_MODEL_CACHE_BUSTER}`
      : (signedAssetUrls[towerBModelKey] ?? MODEL_PATH_B)
    : `/${towerBModelKey.replace(/^\/+/, "")}`;
  const shouldAllowTouchViewportGestures =
    !scrubEnabled || touchHighlightProfile === "tablet";
  const interactionMode: InteractionMode = isDragging
    ? "dragging"
    : isSettling
      ? "settling"
      : isHoverCoolingDown
        ? "cooldown"
        : "idle";
  const isStartupInteractionPending = !isInteractiveSceneReady;
  const shouldRenderCanvas = isThreeDsMaxTrial
    ? true
    : (performanceProfile.tier === "standard" || isInteractiveSceneReady) &&
      isVideoReady &&
      !isDragging &&
      !(
        isSettling &&
        (performanceProfile.isSafariLike ||
          performanceProfile.tier !== "standard" ||
          isStartupInteractionPending)
      );
  const shouldUseContinuousCanvasFrameloop =
    isThreeDsMaxTrial || performanceProfile.isSafariLike;
  const mediaTransform = useMemo(() => {
    if (
      performanceProfile.isSafariLike &&
      Math.abs(viewportTransform.scale - 1) < 0.001 &&
      Math.abs(viewportTransform.x) < 0.5 &&
      Math.abs(viewportTransform.y) < 0.5
    ) {
      return undefined;
    }

    return `translate3d(${viewportTransform.x}px, ${viewportTransform.y}px, 0) scale(${viewportTransform.scale})`;
  }, [
    performanceProfile.isSafariLike,
    viewportTransform.scale,
    viewportTransform.x,
    viewportTransform.y,
  ]);
  const invalidateCanvas = useCallback(() => {
    canvasInvalidateRef.current?.();
  }, []);
  const maybeInvalidateCanvas = useCallback((signature: string) => {
    if (lastInvalidateSignatureRef.current === signature) {
      return;
    }

    lastInvalidateSignatureRef.current = signature;
    canvasInvalidateRef.current?.();
  }, []);
  const clampViewportTransform = useCallback(
    (nextTransform: StageViewportTransform) => {
      const scale = clampNumber(
        nextTransform.scale,
        MOBILE_STAGE_MIN_SCALE,
        MOBILE_STAGE_MAX_SCALE,
      );
      const maxOffsetX = Math.max(
        (coverViewport.width * scale - coverViewport.width) / 2,
        0,
      );
      const maxOffsetY = Math.max(
        (coverViewport.height * scale - coverViewport.height) / 2,
        0,
      );

      return {
        scale,
        x: clampNumber(nextTransform.x, -maxOffsetX, maxOffsetX),
        y: clampNumber(nextTransform.y, -maxOffsetY, maxOffsetY),
      } satisfies StageViewportTransform;
    },
    [coverViewport.height, coverViewport.width],
  );
  const applyViewportTransform = useCallback(
    (nextTransform: StageViewportTransform) => {
      const clampedTransform = clampViewportTransform(nextTransform);
      const currentTransform = viewportTransformRef.current;

      if (
        Math.abs(currentTransform.scale - clampedTransform.scale) < 0.001 &&
        Math.abs(currentTransform.x - clampedTransform.x) < 0.5 &&
        Math.abs(currentTransform.y - clampedTransform.y) < 0.5
      ) {
        return currentTransform;
      }

      viewportTransformRef.current = clampedTransform;
      setViewportTransformState(clampedTransform);
      return clampedTransform;
    },
    [clampViewportTransform],
  );
  const resetViewportTransform = useCallback(() => {
    viewportTransformRef.current = DEFAULT_STAGE_VIEWPORT_TRANSFORM;
    setViewportTransformState(DEFAULT_STAGE_VIEWPORT_TRANSFORM);
  }, []);

  useEffect(() => {
    showTowerMeshesRef.current = showTowerMeshes;
  }, [showTowerMeshes]);

  useEffect(() => {
    showApartmentMeshesRef.current = showApartmentMeshes;
  }, [showApartmentMeshes]);

  const stopScheduledProgress = useCallback(() => {
    if (progressFrameRef.current !== null) {
      window.cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    }
  }, []);

  const stopVideoRevealFrame = useCallback(() => {
    if (videoRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(videoRevealFrameRef.current);
      videoRevealFrameRef.current = null;
    }
  }, []);

  const stopDragLoop = useCallback(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
  }, []);

  const syncSnapVisibility = useCallback(
    (frame: number, mode: InteractionMode) => {
      const distanceToSnap = getNearestSnapFrameInfo(frame).distance;

      const nextShowTowerMeshes =
        mode !== "idle"
          ? false
          : updateVisibilityWithHysteresis(
              showTowerMeshesRef.current,
              distanceToSnap,
              TOWER_MESH_ENTER_WINDOW,
              TOWER_MESH_EXIT_WINDOW,
            );
      const nextShowApartmentMeshes =
        mode !== "idle"
          ? false
          : updateVisibilityWithHysteresis(
              showApartmentMeshesRef.current,
              distanceToSnap,
              APARTMENT_MESH_ENTER_WINDOW,
              APARTMENT_MESH_EXIT_WINDOW,
            );

      if (showTowerMeshesRef.current !== nextShowTowerMeshes) {
        showTowerMeshesRef.current = nextShowTowerMeshes;
        setShowTowerMeshes(nextShowTowerMeshes);
      }

      if (showApartmentMeshesRef.current !== nextShowApartmentMeshes) {
        showApartmentMeshesRef.current = nextShowApartmentMeshes;
        setShowApartmentMeshes(nextShowApartmentMeshes);
      }
    },
    [],
  );

  const clearHoverCooldown = useCallback(() => {
    if (hoverCooldownTimeoutRef.current !== null) {
      window.clearTimeout(hoverCooldownTimeoutRef.current);
      hoverCooldownTimeoutRef.current = null;
    }

    setIsHoverCoolingDown(false);
  }, []);

  const cancelPendingHoverClear = useCallback(() => {
    if (hoverClearTimeoutRef.current !== null) {
      window.clearTimeout(hoverClearTimeoutRef.current);
      hoverClearTimeoutRef.current = null;
    }
  }, []);

  const clearHoveredApartment = useCallback(() => {
    cancelPendingHoverClear();
    hoveredApartmentIdRef.current = null;
    lastTooltipPointerRef.current = null;

    if (tooltipFrameRef.current !== null) {
      window.cancelAnimationFrame(tooltipFrameRef.current);
      tooltipFrameRef.current = null;
    }

    setHoveredApartmentId((currentHoveredApartmentId) =>
      currentHoveredApartmentId === null ? currentHoveredApartmentId : null,
    );
  }, [cancelPendingHoverClear]);

  const startHoverCooldown = useCallback(() => {
    clearHoverCooldown();
    setIsHoverCoolingDown(true);
    syncSnapVisibility(displayedFrameRef.current, "cooldown");
    hoverCooldownTimeoutRef.current = window.setTimeout(() => {
      hoverCooldownTimeoutRef.current = null;
      setIsHoverCoolingDown(false);
      syncSnapVisibility(displayedFrameRef.current, "idle");
    }, HOVER_COOLDOWN_MS);
  }, [clearHoverCooldown, syncSnapVisibility]);

  const syncDisplayedFrameState = useCallback(
    (nextFrame: number, urgent = false) => {
      const wrappedFrame = wrapFrame(nextFrame);

      if (displayedFrameStateRef.current === wrappedFrame) {
        return;
      }

      displayedFrameStateRef.current = wrappedFrame;

      if (urgent) {
        setDisplayedFrame(wrappedFrame);
        return;
      }

      startTransition(() => {
        setDisplayedFrame(wrappedFrame);
      });
    },
    [],
  );

  const syncVideoTime = useCallback(
    (
      video: HTMLVideoElement | null,
      progress: number,
      { force = false }: { force?: boolean } = {},
    ) => {
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }

      const targetFrame = progressToFrame(progress);
      const wrappedProgress = wrapProgress(progress);
      const targetTime = Math.min(
        exactFrameTimelineFps
          ? (targetFrame - 1) / exactFrameTimelineFps
          : wrappedProgress * video.duration,
        Math.max(
          video.duration -
            1 / (exactFrameTimelineFps ?? MASTER_PLAN_SCRUB_VIDEO_FPS),
          0,
        ),
      );
      const previousFrame = lastSyncedVideoFrameRef.current;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();

      if (video.seeking) {
        pendingVideoSeekProgressRef.current = wrappedProgress;
        return;
      }

      pendingVideoSeekProgressRef.current = null;

      if (!force) {
        if (
          dragStateRef.current &&
          now - lastDragVideoSyncTimeRef.current < dragVideoSyncIntervalMs
        ) {
          return;
        }

        if (dragStateRef.current) {
          const lastDragSyncedFrame = lastDragVideoSyncFrameRef.current;

          if (
            lastDragSyncedFrame !== null &&
            Math.abs(
              getShortestProgressDelta(
                frameToProgress(lastDragSyncedFrame),
                frameToProgress(targetFrame),
              ),
            ) *
              TOTAL_FRAMES <
              dragVideoFrameSkip
          ) {
            return;
          }
        }

        if (
          previousFrame === targetFrame &&
          Math.abs(video.currentTime - targetTime) <=
            VIDEO_SYNC_THRESHOLD_SECONDS * 0.5
        ) {
          return;
        }

        if (
          previousFrame !== null &&
          Math.abs(
            getShortestProgressDelta(frameToProgress(previousFrame), progress),
          ) *
            TOTAL_FRAMES <
            1
        ) {
          return;
        }
      }

      lastSyncedVideoFrameRef.current = targetFrame;

      if (
        Math.abs(video.currentTime - targetTime) > VIDEO_SYNC_THRESHOLD_SECONDS
      ) {
        if (performanceProfile.isSafariLike) {
          lastDragVideoSyncTimeRef.current = now;
          lastDragVideoSyncFrameRef.current = targetFrame;
          video.currentTime = targetTime;
          return;
        }

        if (
          !dragStateRef.current &&
          !performanceProfile.isSafariLike &&
          Math.abs(video.currentTime - targetTime) >
            VIDEO_FAST_SEEK_THRESHOLD_SECONDS &&
          typeof video.fastSeek === "function" &&
          targetTime < video.currentTime
        ) {
          lastDragVideoSyncTimeRef.current = now;
          lastDragVideoSyncFrameRef.current = targetFrame;
          video.fastSeek(targetTime);
          return;
        }

        lastDragVideoSyncTimeRef.current = now;
        lastDragVideoSyncFrameRef.current = targetFrame;
        video.currentTime = targetTime;
      }
    },
    [
      dragVideoFrameSkip,
      dragVideoSyncIntervalMs,
      exactFrameTimelineFps,
      performanceProfile.isSafariLike,
    ],
  );

  const syncVisibleVideoTime = useCallback(
    (progress: number) => {
      syncVideoTime(videoRef.current, progress);
    },
    [syncVideoTime],
  );

  const commitProgress = useCallback(
    (nextProgress: number) => {
      const wrappedProgress = wrapProgress(nextProgress);
      displayProgressRef.current = wrappedProgress;
      const nextDisplayedFrame = progressToFrame(wrappedProgress);
      const previousDisplayedFrame = displayedFrameRef.current;
      const displayedFrameChanged =
        previousDisplayedFrame !== nextDisplayedFrame;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const nextInteractionMode: InteractionMode = dragStateRef.current
        ? "dragging"
        : isSettlingRef.current
          ? "settling"
          : isHoverCoolingDown
            ? "cooldown"
            : "idle";

      if (displayedFrameChanged) {
        displayedFrameRef.current = nextDisplayedFrame;

        if (!dragStateRef.current && !isSettlingRef.current) {
          syncDisplayedFrameState(nextDisplayedFrame);
        } else if (
          dragStateRef.current &&
          !isStartupInteractionPending &&
          now - lastDisplayedFrameCommitTimeRef.current >=
            displayedFrameCommitIntervalMs
        ) {
          lastDisplayedFrameCommitTimeRef.current = now;
          syncDisplayedFrameState(nextDisplayedFrame);
        }
      }

      syncSnapVisibility(nextDisplayedFrame, nextInteractionMode);

      const shouldThrottlePassiveVideoSync =
        !dragStateRef.current &&
        (isStartupInteractionPending ||
          performanceProfile.isSafariLike ||
          performanceProfile.tier !== "standard");

      if (dragStateRef.current) {
        if (displayedFrameChanged) {
          syncVisibleVideoTime(wrappedProgress);
        }
      } else if (!shouldThrottlePassiveVideoSync) {
        lastPassiveVideoSyncTimeRef.current = now;
        lastPassiveVideoSyncFrameRef.current = nextDisplayedFrame;
        syncVisibleVideoTime(wrappedProgress);
      } else if (displayedFrameChanged) {
        const lastPassiveFrame = lastPassiveVideoSyncFrameRef.current;
        const msSinceLastPassiveSync =
          now - lastPassiveVideoSyncTimeRef.current;
        const progressedEnough =
          lastPassiveFrame === null ||
          Math.abs(
            getShortestProgressDelta(
              frameToProgress(lastPassiveFrame),
              frameToProgress(nextDisplayedFrame),
            ),
          ) *
            TOTAL_FRAMES >=
            2;

        if (
          progressedEnough &&
          msSinceLastPassiveSync >= passiveVideoSyncIntervalMs
        ) {
          lastPassiveVideoSyncTimeRef.current = now;
          lastPassiveVideoSyncFrameRef.current = nextDisplayedFrame;
          syncVisibleVideoTime(wrappedProgress);
        }
      }

      if (dragStateRef.current) {
        return;
      }

      const previousInPrewarmWindow = isFrameWithinSnapWindow(
        previousDisplayedFrame,
        TOWER_MESH_PREWARM_FRAMES,
      );
      const nextInPrewarmWindow = isFrameWithinSnapWindow(
        nextDisplayedFrame,
        TOWER_MESH_PREWARM_FRAMES,
      );
      const previousSnapIndex = getNearestSnapFrameInfo(
        previousDisplayedFrame,
      ).index;
      const nextSnapIndex = getNearestSnapFrameInfo(nextDisplayedFrame).index;

      if (
        previousInPrewarmWindow !== nextInPrewarmWindow ||
        (previousSnapIndex !== nextSnapIndex &&
          (previousInPrewarmWindow || nextInPrewarmWindow))
      ) {
        maybeInvalidateCanvas(
          `${nextSnapIndex}:${Number(nextInPrewarmWindow)}:${
            isSettlingRef.current ? "settling" : "idle"
          }`,
        );
      }
    },
    [
      displayedFrameCommitIntervalMs,
      isStartupInteractionPending,
      isHoverCoolingDown,
      maybeInvalidateCanvas,
      passiveVideoSyncIntervalMs,
      performanceProfile.isSafariLike,
      performanceProfile.tier,
      syncSnapVisibility,
      syncDisplayedFrameState,
      syncVisibleVideoTime,
    ],
  );

  const scheduleProgress = useCallback(
    (nextProgress: number) => {
      pendingProgressRef.current = wrapProgress(nextProgress);

      if (progressFrameRef.current !== null) {
        return;
      }

      progressFrameRef.current = window.requestAnimationFrame(() => {
        progressFrameRef.current = null;

        if (pendingProgressRef.current == null) {
          return;
        }

        const progress = pendingProgressRef.current;
        pendingProgressRef.current = null;
        commitProgress(progress);
      });
    },
    [commitProgress],
  );

  const applyPendingDragDelta = useCallback(
    (dragState: DragState) => {
      if (pendingPointerDeltaXRef.current !== 0) {
        dragState.clampedDeltaX += pendingPointerDeltaXRef.current;
        pendingPointerDeltaXRef.current = 0;
      }

      const rawTargetProgress = wrapProgress(
        dragState.startProgress +
          dragState.clampedDeltaX / (dragConfig.pixelsPerFrame * TOTAL_FRAMES),
      );
      const maxLeadFrames =
        dragState.inputMode === "desktop-mouse"
          ? Math.round(
              dragConfig.maxLeadFrames * DESKTOP_MOUSE_DRAG_LEAD_MULTIPLIER,
            )
          : dragConfig.maxLeadFrames;

      dragTargetProgressRef.current = clampProgressLead(
        displayProgressRef.current,
        rawTargetProgress,
        maxLeadFrames,
      );

      return dragTargetProgressRef.current;
    },
    [dragConfig.maxLeadFrames, dragConfig.pixelsPerFrame],
  );

  const startDragLoop = useCallback(() => {
    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;

      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      commitProgress(applyPendingDragDelta(dragState));
    });
  }, [applyPendingDragDelta, commitProgress]);

  const stopMotionAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    isSettlingRef.current = false;
    setIsSettling(false);
  }, []);

  const stopWheelSettle = useCallback(() => {
    if (wheelSettleTimeoutRef.current !== null) {
      window.clearTimeout(wheelSettleTimeoutRef.current);
      wheelSettleTimeoutRef.current = null;
    }
  }, []);

  const animateToProgress = useCallback(
    (
      targetProgress: number,
      duration: number,
      onComplete?: (() => void) | undefined,
      easing: (progress: number) => number = easeOutCubic,
    ) => {
      stopDragLoop();
      stopMotionAnimation();

      const startProgress = displayProgressRef.current;
      const progressDelta = getShortestProgressDelta(
        startProgress,
        targetProgress,
      );

      if (Math.abs(progressDelta) < 0.0005) {
        stopScheduledProgress();
        commitProgress(targetProgress);
        syncVideoTime(videoRef.current, targetProgress, { force: true });
        invalidateCanvas();
        onComplete?.();
        return;
      }

      isSettlingRef.current = true;
      setIsSettling(true);
      lastPassiveVideoSyncFrameRef.current = null;
      lastPassiveVideoSyncTimeRef.current = 0;
      syncSnapVisibility(progressToFrame(startProgress), "settling");
      let startTime = 0;

      const animate = (timestamp: number) => {
        if (startTime === 0) {
          startTime = timestamp;
        }

        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progress);

        scheduleProgress(startProgress + progressDelta * easedProgress);

        if (progress >= 1) {
          dragTargetProgressRef.current = wrapProgress(targetProgress);
          stopScheduledProgress();
          commitProgress(targetProgress);
          syncVideoTime(videoRef.current, targetProgress, { force: true });
          stopMotionAnimation();
          lastPassiveVideoSyncFrameRef.current =
            progressToFrame(targetProgress);
          lastPassiveVideoSyncTimeRef.current =
            typeof performance !== "undefined" ? performance.now() : Date.now();
          syncDisplayedFrameState(progressToFrame(targetProgress), true);
          syncSnapVisibility(progressToFrame(targetProgress), "idle");
          invalidateCanvas();
          onComplete?.();
          return;
        }

        animationFrameRef.current = window.requestAnimationFrame(animate);
      };

      animationFrameRef.current = window.requestAnimationFrame(animate);
    },
    [
      commitProgress,
      invalidateCanvas,
      scheduleProgress,
      stopScheduledProgress,
      stopDragLoop,
      stopMotionAnimation,
      syncDisplayedFrameState,
      syncSnapVisibility,
      syncVideoTime,
    ],
  );

  const finishWheelScrub = useCallback(() => {
    wheelSettleTimeoutRef.current = null;
    setIsDragging(false);

    const releaseFrame = progressToFrame(displayProgressRef.current);
    const snappedFrame = getNearestSnapFrame(releaseFrame);
    const targetProgress = frameToProgress(snappedFrame);
    const totalFrames =
      Math.abs(
        getShortestProgressDelta(displayProgressRef.current, targetProgress),
      ) * TOTAL_FRAMES;
    const duration = Math.min(
      SNAP_ANIMATION_MAX_DURATION_MS,
      Math.max(
        SNAP_ANIMATION_MIN_DURATION_MS,
        totalFrames * SNAP_ANIMATION_MS_PER_FRAME,
      ),
    );

    animateToProgress(targetProgress, duration, () => {
      startHoverCooldown();
      onSetFrame(snappedFrame);
    });
  }, [animateToProgress, onSetFrame, startHoverCooldown]);

  const handleStageWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!scrubEnabled) {
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
      hasObservedUserScrubRef.current = true;
      clearHoverCooldown();
      clearHoveredApartment();
      stopWheelSettle();
      stopDragLoop();
      stopMotionAnimation();
      setIsDragging(true);
      lastPassiveVideoSyncFrameRef.current = null;
      lastPassiveVideoSyncTimeRef.current = 0;

      const nextProgress = wrapProgress(
        displayProgressRef.current -
          horizontalDelta / (dragConfig.pixelsPerFrame * TOTAL_FRAMES),
      );

      dragTargetProgressRef.current = nextProgress;
      commitProgress(nextProgress);
      syncVideoTime(videoRef.current, nextProgress, { force: true });
      syncSnapVisibility(progressToFrame(nextProgress), "dragging");
      invalidateCanvas();

      wheelSettleTimeoutRef.current = window.setTimeout(finishWheelScrub, 140);
    },
    [
      clearHoverCooldown,
      clearHoveredApartment,
      commitProgress,
      dragConfig.pixelsPerFrame,
      scrubEnabled,
      finishWheelScrub,
      invalidateCanvas,
      stopDragLoop,
      stopMotionAnimation,
      stopWheelSettle,
      syncSnapVisibility,
      syncVideoTime,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hoverMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncInteractionPreferences = () => {
      setSupportsPreciseHover(hoverMedia.matches);
      setPrefersReducedMotion(motionMedia.matches);
    };

    syncInteractionPreferences();

    hoverMedia.addEventListener("change", syncInteractionPreferences);
    motionMedia.addEventListener("change", syncInteractionPreferences);

    return () => {
      hoverMedia.removeEventListener("change", syncInteractionPreferences);
      motionMedia.removeEventListener("change", syncInteractionPreferences);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    const masterPlanNavigator = navigator as MasterPlanNavigator;
    const connection = masterPlanNavigator.connection;
    const syncPerformanceProfile = () => {
      setPerformanceProfile((current) => {
        const next = getMasterPlanPerformanceProfile();

        if (
          current.isConstrained === next.isConstrained &&
          current.isSafariLike === next.isSafariLike &&
          current.scrubVideoPreload === next.scrubVideoPreload &&
          current.tier === next.tier &&
          current.canvasPerformance.min === next.canvasPerformance.min &&
          current.canvasPerformance.debounce === next.canvasPerformance.debounce
        ) {
          return current;
        }

        return next;
      });
    };

    syncPerformanceProfile();
    connection?.addEventListener?.("change", syncPerformanceProfile);

    return () => {
      connection?.removeEventListener?.("change", syncPerformanceProfile);
    };
  }, []);

  useEffect(() => {
    if (!isVideoReady) {
      return;
    }

    return runWhenBrowserIdle(
      () => {
        useGLTF.preload(towerAModelPath);
        useGLTF.preload(towerBModelPath);
      },
      performanceProfile.tier === "low" ? 2200 : 1400,
    );
  }, [isVideoReady, performanceProfile.tier, towerAModelPath, towerBModelPath]);

  useEffect(() => {
    if (!isVideoReady) {
      return;
    }

    if (interactionMode !== "idle") {
      return;
    }

    const startupUnlockDelayMs = hasObservedUserScrubRef.current
      ? performanceProfile.tier === "low"
        ? 1400
        : performanceProfile.tier === "constrained"
          ? 1100
          : 850
      : performanceProfile.tier === "low"
        ? 3400
        : performanceProfile.tier === "constrained"
          ? 2600
          : 2000;

    return runWhenBrowserIdle(() => {
      startTransition(() => {
        setIsInteractiveSceneReady(true);
      });
    }, startupUnlockDelayMs);
  }, [interactionMode, isVideoReady, performanceProfile.tier]);

  useEffect(() => {
    const section = sectionRef.current;

    if (!section || typeof ResizeObserver === "undefined") {
      return;
    }

    const syncSectionSize = () => {
      const rect = section.getBoundingClientRect();

      setSectionSize((current) => {
        const nextWidth = Math.round(rect.width);
        const nextHeight = Math.round(rect.height);

        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    syncSectionSize();

    const resizeObserver = new ResizeObserver(syncSectionSize);
    resizeObserver.observe(section);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !signedScrubVideoPath) {
      return;
    }

    let videoFrameCallbackId: number | null = null;
    const syncPresentedVideoFrame = (mediaTime: number) => {
      if (exactFrameTimelineFps === null) {
        return;
      }

      const nextFrame = wrapFrame(
        Math.round(mediaTime * exactFrameTimelineFps) + 1,
      );
      presentedVideoFrameRef.current = nextFrame;
      video.dataset.presentedFrame = String(nextFrame);
      canvasInvalidateRef.current?.();
    };
    const watchPresentedVideoFrame: VideoFrameRequestCallback = (
      _now,
      metadata,
    ) => {
      syncPresentedVideoFrame(metadata.mediaTime);
      videoFrameCallbackId = video.requestVideoFrameCallback(
        watchPresentedVideoFrame,
      );
    };

    if (
      exactFrameTimelineFps !== null &&
      typeof video.requestVideoFrameCallback === "function"
    ) {
      videoFrameCallbackId = video.requestVideoFrameCallback(
        watchPresentedVideoFrame,
      );
    }

    const syncVideoState = () => {
      video.pause();
      lastSyncedVideoFrameRef.current = null;
      lastDragVideoSyncFrameRef.current = null;
      lastDragVideoSyncTimeRef.current = 0;
      syncVideoTime(video, displayProgressRef.current, { force: true });
      stopVideoRevealFrame();

      const revealVideo = (remainingFrames: number) => {
        videoRevealFrameRef.current = window.requestAnimationFrame(() => {
          if (remainingFrames > 1) {
            revealVideo(remainingFrames - 1);
            return;
          }

          videoRevealFrameRef.current = null;
          setIsVideoReady(true);
        });
      };

      revealVideo(2);
    };

    const cleanup = bindVideoStream({
      hlsPath: "",
      isSafariLike: performanceProfile.isSafariLike,
      mp4Path: signedScrubVideoPath,
      onReady: syncVideoState,
      video,
    });
    const flushPendingVideoSeek = () => {
      if (typeof video.requestVideoFrameCallback !== "function") {
        syncPresentedVideoFrame(video.currentTime);
      }

      const pendingProgress = pendingVideoSeekProgressRef.current;

      if (pendingProgress === null) {
        return;
      }

      pendingVideoSeekProgressRef.current = null;
      syncVideoTime(video, pendingProgress, { force: true });
    };

    video.addEventListener("seeked", flushPendingVideoSeek);

    return () => {
      if (videoFrameCallbackId !== null) {
        video.cancelVideoFrameCallback(videoFrameCallbackId);
      }

      stopVideoRevealFrame();
      pendingVideoSeekProgressRef.current = null;
      video.removeEventListener("seeked", flushPendingVideoSeek);
      cleanup();
    };
  }, [
    exactFrameTimelineFps,
    performanceProfile.isSafariLike,
    signedScrubVideoPath,
    stopVideoRevealFrame,
    syncVideoTime,
  ]);

  useEffect(() => {
    if (dragStateRef.current) {
      return;
    }

    const targetProgress = frameToProgress(safeFrame);
    const frameDistance =
      Math.abs(
        getShortestProgressDelta(displayProgressRef.current, targetProgress),
      ) * TOTAL_FRAMES;

    if (frameDistance < 0.5) {
      const syncId = window.requestAnimationFrame(() => {
        stopScheduledProgress();
        commitProgress(targetProgress);
        syncVideoTime(videoRef.current, targetProgress, { force: true });
      });

      return () => {
        window.cancelAnimationFrame(syncId);
      };
    }

    const duration = Math.min(
      HOTSPOT_NAVIGATION_MAX_DURATION_MS,
      Math.max(
        HOTSPOT_NAVIGATION_MIN_DURATION_MS,
        frameDistance * HOTSPOT_NAVIGATION_MS_PER_FRAME,
      ),
    );

    const animationId = window.requestAnimationFrame(() => {
      animateToProgress(
        targetProgress,
        duration,
        startHoverCooldown,
        easeInOutCubic,
      );
    });

    return () => {
      window.cancelAnimationFrame(animationId);
    };
  }, [
    animateToProgress,
    commitProgress,
    safeFrame,
    startHoverCooldown,
    stopScheduledProgress,
    syncVideoTime,
  ]);

  useEffect(() => {
    if (!scrubEnabled) {
      dragStateRef.current = null;
      pendingPointerDeltaXRef.current = 0;
      stopDragLoop();
      return;
    }

    const accumulateDragPointerDelta = (
      dragState: DragState,
      clientX: number,
      timeStamp: number,
    ) => {
      const elapsedMs = Math.max(timeStamp - dragState.lastTimestamp, 1);
      const rawDeltaX = clientX - dragState.lastClientX;
      const baseMaxDeltaX = dragConfig.maxPointerPixelsPerMs * elapsedMs;
      const maxDeltaX =
        dragState.inputMode === "desktop-mouse"
          ? baseMaxDeltaX * DESKTOP_MOUSE_DRAG_POINTER_DELTA_MULTIPLIER
          : baseMaxDeltaX;
      const clampedIncrement = Math.max(
        -maxDeltaX,
        Math.min(maxDeltaX, rawDeltaX),
      );
      const pendingDeltaLimit =
        maxDeltaX *
        (dragState.inputMode === "desktop-mouse"
          ? isStartupInteractionPending
            ? DESKTOP_MOUSE_DRAG_STARTUP_PENDING_DELTA_MULTIPLIER
            : DESKTOP_MOUSE_DRAG_PENDING_DELTA_MULTIPLIER
          : isStartupInteractionPending
            ? 1.35
            : 2.4);

      pendingPointerDeltaXRef.current = clampNumber(
        pendingPointerDeltaXRef.current + clampedIncrement,
        -pendingDeltaLimit,
        pendingDeltaLimit,
      );
      dragState.lastClientX = clientX;
      dragState.lastTimestamp = timeStamp;
      startDragLoop();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;

      if (!dragState.didDrag && Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
        return;
      }

      if (!dragState.didDrag) {
        dragState.didDrag = true;
        hasObservedUserScrubRef.current = true;
        clearHoverCooldown();
        setIsDragging(true);
        syncSnapVisibility(displayedFrameRef.current, "dragging");
        lastDisplayedFrameCommitTimeRef.current = 0;
        lastDragVideoSyncFrameRef.current = null;
        lastDragVideoSyncTimeRef.current = 0;
        lastPassiveVideoSyncFrameRef.current = null;
        lastPassiveVideoSyncTimeRef.current = 0;
        stopDragLoop();
        stopMotionAnimation();
        clearHoveredApartment();
      }

      event.preventDefault();
      accumulateDragPointerDelta(dragState, event.clientX, event.timeStamp);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      applyPendingDragDelta(dragState);

      dragStateRef.current = null;
      setIsDragging(false);
      stopDragLoop();
      pendingPointerDeltaXRef.current = 0;

      if (!dragState.didDrag) {
        return;
      }

      const releaseFrame = progressToFrame(dragTargetProgressRef.current);
      const dragDirection =
        dragState.clampedDeltaX === 0
          ? 0
          : dragState.clampedDeltaX > 0
            ? 1
            : -1;
      const snappedFrame =
        dragDirection === 0
          ? getNearestSnapFrame(releaseFrame)
          : getDirectionalSnapFrame(releaseFrame, dragDirection);
      const targetProgress = frameToProgress(snappedFrame);
      dragTargetProgressRef.current = targetProgress;
      const totalFrames =
        Math.abs(
          getShortestProgressDelta(displayProgressRef.current, targetProgress),
        ) * TOTAL_FRAMES;
      const duration = Math.min(
        SNAP_ANIMATION_MAX_DURATION_MS,
        Math.max(
          SNAP_ANIMATION_MIN_DURATION_MS,
          totalFrames * SNAP_ANIMATION_MS_PER_FRAME,
        ),
      );

      animateToProgress(targetProgress, duration, () => {
        startHoverCooldown();
        onSetFrame(snappedFrame);
      });
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [
    applyPendingDragDelta,
    animateToProgress,
    clearHoverCooldown,
    clearHoveredApartment,
    dragConfig.maxPointerPixelsPerMs,
    scrubEnabled,
    isStartupInteractionPending,
    onSetFrame,
    startDragLoop,
    startHoverCooldown,
    stopDragLoop,
    stopMotionAnimation,
    syncSnapVisibility,
  ]);

  useEffect(() => {
    if (!scrubEnabled) {
      return;
    }

    const accumulateDragPointerDelta = (
      dragState: DragState,
      clientX: number,
      timeStamp: number,
    ) => {
      const elapsedMs = Math.max(timeStamp - dragState.lastTimestamp, 1);
      const rawDeltaX = clientX - dragState.lastClientX;
      const baseMaxDeltaX = dragConfig.maxPointerPixelsPerMs * elapsedMs;
      const maxDeltaX =
        dragState.inputMode === "desktop-mouse"
          ? baseMaxDeltaX * DESKTOP_MOUSE_DRAG_POINTER_DELTA_MULTIPLIER
          : baseMaxDeltaX;
      const clampedIncrement = Math.max(
        -maxDeltaX,
        Math.min(maxDeltaX, rawDeltaX),
      );
      const pendingDeltaLimit =
        maxDeltaX *
        (dragState.inputMode === "desktop-mouse"
          ? isStartupInteractionPending
            ? DESKTOP_MOUSE_DRAG_STARTUP_PENDING_DELTA_MULTIPLIER
            : DESKTOP_MOUSE_DRAG_PENDING_DELTA_MULTIPLIER
          : isStartupInteractionPending
            ? 1.35
            : 2.4);

      pendingPointerDeltaXRef.current = clampNumber(
        pendingPointerDeltaXRef.current + clampedIncrement,
        -pendingDeltaLimit,
        pendingDeltaLimit,
      );
      dragState.lastClientX = clientX;
      dragState.lastTimestamp = timeStamp;
      startDragLoop();
    };

    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== -1) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;

      if (!dragState.didDrag && Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
        return;
      }

      if (!dragState.didDrag) {
        dragState.didDrag = true;
        hasObservedUserScrubRef.current = true;
        clearHoverCooldown();
        setIsDragging(true);
        syncSnapVisibility(displayedFrameRef.current, "dragging");
        lastDisplayedFrameCommitTimeRef.current = 0;
        lastDragVideoSyncFrameRef.current = null;
        lastDragVideoSyncTimeRef.current = 0;
        lastPassiveVideoSyncFrameRef.current = null;
        lastPassiveVideoSyncTimeRef.current = 0;
        stopDragLoop();
        stopMotionAnimation();
        clearHoveredApartment();
      }

      event.preventDefault();
      accumulateDragPointerDelta(dragState, event.clientX, event.timeStamp);
    };

    const handleMouseEnd = () => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== -1) {
        return;
      }

      applyPendingDragDelta(dragState);

      dragStateRef.current = null;
      setIsDragging(false);
      stopDragLoop();
      pendingPointerDeltaXRef.current = 0;

      if (!dragState.didDrag) {
        return;
      }

      const releaseFrame = progressToFrame(dragTargetProgressRef.current);
      const dragDirection =
        dragState.clampedDeltaX === 0
          ? 0
          : dragState.clampedDeltaX > 0
            ? 1
            : -1;
      const snappedFrame =
        dragDirection === 0
          ? getNearestSnapFrame(releaseFrame)
          : getDirectionalSnapFrame(releaseFrame, dragDirection);
      const targetProgress = frameToProgress(snappedFrame);
      dragTargetProgressRef.current = targetProgress;
      const totalFrames =
        Math.abs(
          getShortestProgressDelta(displayProgressRef.current, targetProgress),
        ) * TOTAL_FRAMES;
      const duration = Math.min(
        SNAP_ANIMATION_MAX_DURATION_MS,
        Math.max(
          SNAP_ANIMATION_MIN_DURATION_MS,
          totalFrames * SNAP_ANIMATION_MS_PER_FRAME,
        ),
      );

      animateToProgress(targetProgress, duration, () => {
        startHoverCooldown();
        onSetFrame(snappedFrame);
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", handleMouseEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseEnd);
    };
  }, [
    applyPendingDragDelta,
    animateToProgress,
    clearHoverCooldown,
    clearHoveredApartment,
    dragConfig.maxPointerPixelsPerMs,
    scrubEnabled,
    isStartupInteractionPending,
    onSetFrame,
    startDragLoop,
    startHoverCooldown,
    stopDragLoop,
    stopMotionAnimation,
    syncSnapVisibility,
  ]);

  useEffect(() => {
    return () => {
      cancelPendingHoverClear();
      clearHoverCooldown();
      pendingPointerDeltaXRef.current = 0;
      lastTooltipPointerRef.current = null;
      stopWheelSettle();
      stopDragLoop();
      stopMotionAnimation();
      stopScheduledProgress();
      if (tooltipFrameRef.current !== null) {
        window.cancelAnimationFrame(tooltipFrameRef.current);
      }
    };
  }, [
    cancelPendingHoverClear,
    clearHoverCooldown,
    stopWheelSettle,
    stopDragLoop,
    stopMotionAnimation,
    stopScheduledProgress,
  ]);

  const snapInfo = useMemo(
    () => getNearestSnapFrameInfo(displayedFrame),
    [displayedFrame],
  );
  const allowHover = isThreeDsMaxTrial
    ? isVideoReady && interactionMode === "idle"
    : (scrubEnabled || isThreeDsMaxTrial) &&
      supportsPreciseHover &&
      !prefersReducedMotion &&
      performanceProfile.tier !== "low" &&
      isInteractiveSceneReady &&
      interactionMode === "idle" &&
      (!scrubEnabled || isSnapFrame(displayedFrame));
  const showTrackingDebug = ENABLE_TRACKING_DEBUG && interactionMode === "idle";
  const showVideo = isVideoReady;
  const showFallbackBackdrop = !isVideoReady;
  const canvasDpr: [number, number] = useMemo(() => {
    const baseRange = getCanvasDprRange(performanceProfile.tier, {
      isDragging: isThreeDsMaxTrial ? false : isDragging,
      isSafariLike: performanceProfile.isSafariLike,
      isSettling: isThreeDsMaxTrial ? false : isSettling,
      supportsPreciseHover,
    });

    if (touchHighlightProfile === "mobile") {
      return [Math.min(baseRange[0], 0.28), Math.min(baseRange[1], 0.46)];
    }

    if (touchHighlightProfile === "tablet") {
      return [Math.min(baseRange[0], 0.34), Math.min(baseRange[1], 0.56)];
    }

    return baseRange;
  }, [
    isDragging,
    isThreeDsMaxTrial,
    isSettling,
    performanceProfile.isSafariLike,
    performanceProfile.tier,
    supportsPreciseHover,
    touchHighlightProfile,
  ]);
  const trackingFrame = snapInfo.frame;
  const activeHotspot = useMemo(
    () =>
      getNearestMasterPlanHotspot(
        trackingFrame,
        config?.reverseHotspotDirection,
      ),
    [config?.reverseHotspotDirection, trackingFrame],
  );
  const interactiveTowerScope = useMemo<TowerType | null>(() => null, []);
  const apartmentIndex = useMemo(
    () => buildInventoryApartmentIndex(apartments),
    [apartments],
  );
  const hoveredInventoryCandidate = findInventoryApartmentInIndex(
    apartmentIndex,
    hoveredApartmentId,
    interactiveTowerScope,
  );
  const hotspotHoveredApartmentId =
    hoveredApartmentId &&
    Boolean(hoveredInventoryCandidate) &&
    isApartmentIdAllowedAtHotspot(hoveredApartmentId, activeHotspot)
      ? hoveredApartmentId
      : null;
  const activeHoveredApartmentId = allowHover
    ? hotspotHoveredApartmentId
    : null;
  const getApartmentStatus = useCallback(
    (apartmentId: string | null) =>
      findInventoryApartmentInIndex(
        apartmentIndex,
        apartmentId,
        interactiveTowerScope,
      )?.status ?? null,
    [apartmentIndex, interactiveTowerScope],
  );
  const hoveredApartment = useMemo(
    () => formatApartmentLabel(activeHoveredApartmentId, interactiveTowerScope),
    [activeHoveredApartmentId, interactiveTowerScope],
  );
  const hoveredInventoryApartment = findInventoryApartmentInIndex(
    apartmentIndex,
    activeHoveredApartmentId,
    interactiveTowerScope,
  );
  const hoveredFlatLabel = (
    hoveredApartment.unit ||
    hoveredInventoryApartment?.flatNumber ||
    "--"
  )
    .toUpperCase()
    .trim();
  const statusMeta = getStatusMeta(
    hoveredInventoryApartment?.status,
    inventoryState,
    inventoryError,
  );
  const selectApartmentByMeshId = useCallback(
    (apartmentMeshId: string | null) => {
      if (!onApartmentSelect) {
        return;
      }

      onApartmentSelect(
        findInventoryApartmentInIndex(
          apartmentIndex,
          apartmentMeshId,
          interactiveTowerScope,
        ),
        apartmentMeshId,
      );
    },
    [apartmentIndex, interactiveTowerScope, onApartmentSelect],
  );

  useEffect(() => {
    onInteractionChange?.(isDragging || isSettling);
  }, [isDragging, isSettling, onInteractionChange]);

  useEffect(() => {
    return () => {
      onInteractionChange?.(false);
    };
  }, [onInteractionChange]);

  const updateTooltipPosition = useCallback(
    (pointerPosition: PointerPosition | null) => {
      if (!pointerPosition || !sectionRef.current) {
        return;
      }

      const lastTooltipPointer = lastTooltipPointerRef.current;

      if (
        lastTooltipPointer &&
        Math.abs(lastTooltipPointer.x - pointerPosition.x) < 2 &&
        Math.abs(lastTooltipPointer.y - pointerPosition.y) < 2
      ) {
        return;
      }

      lastTooltipPointerRef.current = {
        x: pointerPosition.x,
        y: pointerPosition.y,
      };

      const rect = sectionRef.current.getBoundingClientRect();
      const tooltipBounds = tooltipRef.current?.getBoundingClientRect();
      const tooltipWidth = tooltipBounds?.width || 180;
      const tooltipHeight = tooltipBounds?.height || 62;
      const offsetX = 16;
      const offsetY = 16;

      const nextLeft = Math.min(
        Math.max(pointerPosition.x - rect.left + offsetX, 12),
        Math.max(rect.width - tooltipWidth - 12, 12),
      );
      const nextTop = Math.min(
        Math.max(pointerPosition.y - rect.top + offsetY, 12),
        Math.max(rect.height - tooltipHeight - 12, 12),
      );

      if (
        Math.abs(tooltipPositionRef.current.x - nextLeft) < 0.5 &&
        Math.abs(tooltipPositionRef.current.y - nextTop) < 0.5
      ) {
        return;
      }

      tooltipPositionRef.current = {
        x: nextLeft,
        y: nextTop,
      };
      const nextTooltipTransform = `translate3d(${nextLeft}px, ${nextTop}px, 0)`;

      if (!tooltipRef.current) {
        setTooltipMountTransform(nextTooltipTransform);
      }

      if (!tooltipRef.current || tooltipFrameRef.current !== null) {
        return;
      }

      tooltipFrameRef.current = window.requestAnimationFrame(() => {
        tooltipFrameRef.current = null;

        if (!tooltipRef.current) {
          return;
        }

        tooltipRef.current.style.transform = nextTooltipTransform;
      });
    },
    [],
  );

  const handleApartmentHover = useCallback(
    (apartmentId: string | null, pointerPosition: PointerPosition | null) => {
      if (!allowHover) {
        return;
      }

      if (!apartmentId) {
        if (hoveredApartmentIdRef.current === null) {
          return;
        }

        if (hoverClearTimeoutRef.current !== null) {
          return;
        }

        hoverClearTimeoutRef.current = window.setTimeout(() => {
          hoverClearTimeoutRef.current = null;
          clearHoveredApartment();
        }, 72);
        return;
      }

      cancelPendingHoverClear();
      updateTooltipPosition(pointerPosition);

      if (hoveredApartmentIdRef.current === apartmentId) {
        return;
      }

      hoveredApartmentIdRef.current = apartmentId;

      startTransition(() => {
        setHoveredApartmentId(apartmentId);
      });
    },
    [
      allowHover,
      cancelPendingHoverClear,
      clearHoveredApartment,
      updateTooltipPosition,
    ],
  );

  const handleCanvasInvalidateReady = useCallback(
    (invalidateCanvas: () => void) => {
      canvasInvalidateRef.current = invalidateCanvas;
    },
    [],
  );
  const handlePointerSelectionReady = useCallback(
    (
      pickApartmentAtClientPoint: (
        clientX: number,
        clientY: number,
      ) => string | null,
    ) => {
      pointerSelectionRef.current = pickApartmentAtClientPoint;
    },
    [],
  );
  const cancelDragInteraction = useCallback(() => {
    dragStateRef.current = null;
    pendingPointerDeltaXRef.current = 0;
    setIsDragging(false);
    stopDragLoop();
    stopMotionAnimation();
  }, [stopDragLoop, stopMotionAnimation]);
  const handleStageTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!shouldAllowTouchViewportGestures) {
        return;
      }

      if (event.touches.length >= 2) {
        event.preventDefault();
        cancelDragInteraction();
        const midpoint = getTouchMidpoint(event.touches);

        mobileGestureRef.current = {
          ...createDefaultMobileStageGestureState(),
          initialDistance: getTouchDistance(event.touches),
          initialMidpointX: midpoint.x,
          initialMidpointY: midpoint.y,
          initialOffsetX: viewportTransformRef.current.x,
          initialOffsetY: viewportTransformRef.current.y,
          initialScale: viewportTransformRef.current.scale,
          mode: "pinch",
          moved: true,
        };
        return;
      }

      if (
        scrubEnabled &&
        viewportTransformRef.current.scale <= MOBILE_STAGE_MIN_SCALE + 0.01
      ) {
        return;
      }

      const primaryTouch = event.touches[0];

      if (!primaryTouch) {
        return;
      }

      mobileGestureRef.current = {
        ...createDefaultMobileStageGestureState(),
        lastTouchX: primaryTouch.clientX,
        lastTouchY: primaryTouch.clientY,
        mode: "tap",
        tapStartX: primaryTouch.clientX,
        tapStartY: primaryTouch.clientY,
      };
    },
    [cancelDragInteraction, scrubEnabled, shouldAllowTouchViewportGestures],
  );
  const handleStageTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!shouldAllowTouchViewportGestures) {
        return;
      }

      if (event.touches.length >= 2) {
        event.preventDefault();

        const gestureState = mobileGestureRef.current;
        const currentDistance = getTouchDistance(event.touches);

        if (currentDistance <= 0) {
          return;
        }

        const midpoint = getTouchMidpoint(event.touches);
        const scaleRatio =
          gestureState.initialDistance > 0
            ? currentDistance / gestureState.initialDistance
            : 1;
        const nextScale = clampNumber(
          gestureState.initialScale * scaleRatio,
          MOBILE_STAGE_MIN_SCALE,
          MOBILE_STAGE_MAX_SCALE,
        );
        const nextOffsetX =
          gestureState.initialOffsetX +
          (midpoint.x - gestureState.initialMidpointX);
        const nextOffsetY =
          gestureState.initialOffsetY +
          (midpoint.y - gestureState.initialMidpointY);

        applyViewportTransform({
          scale: nextScale,
          x: nextOffsetX,
          y: nextOffsetY,
        });

        mobileGestureRef.current = {
          ...gestureState,
          lastTouchX: midpoint.x,
          lastTouchY: midpoint.y,
          mode: "pinch",
          moved: true,
        };
        return;
      }

      const primaryTouch = event.touches[0];
      const gestureState = mobileGestureRef.current;

      if (!primaryTouch) {
        return;
      }

      if (
        scrubEnabled &&
        gestureState.mode !== "pan" &&
        viewportTransformRef.current.scale <= MOBILE_STAGE_MIN_SCALE + 0.01
      ) {
        return;
      }

      const travelDistance = Math.hypot(
        primaryTouch.clientX - gestureState.tapStartX,
        primaryTouch.clientY - gestureState.tapStartY,
      );
      const isZoomedIn =
        viewportTransformRef.current.scale > MOBILE_STAGE_MIN_SCALE + 0.01;

      if (travelDistance > MOBILE_STAGE_TAP_MOVE_THRESHOLD_PX) {
        gestureState.moved = true;
      }

      if (gestureState.mode !== "pan" && !isZoomedIn) {
        return;
      }

      if (gestureState.mode !== "pan" && !gestureState.moved) {
        return;
      }

      event.preventDefault();
      const deltaX = primaryTouch.clientX - gestureState.lastTouchX;
      const deltaY = primaryTouch.clientY - gestureState.lastTouchY;
      const nextTransform = viewportTransformRef.current;

      applyViewportTransform({
        scale: nextTransform.scale,
        x: nextTransform.x + deltaX,
        y: nextTransform.y + deltaY,
      });

      mobileGestureRef.current = {
        ...gestureState,
        lastTouchX: primaryTouch.clientX,
        lastTouchY: primaryTouch.clientY,
        mode: "pan",
        moved: true,
      };
    },
    [applyViewportTransform, scrubEnabled, shouldAllowTouchViewportGestures],
  );
  const handleStageTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!shouldAllowTouchViewportGestures) {
        return;
      }

      if (event.touches.length >= 2) {
        return;
      }

      if (event.touches.length === 1) {
        const remainingTouch = event.touches[0];

        mobileGestureRef.current = {
          ...createDefaultMobileStageGestureState(),
          lastTouchX: remainingTouch.clientX,
          lastTouchY: remainingTouch.clientY,
          mode:
            viewportTransformRef.current.scale > MOBILE_STAGE_MIN_SCALE + 0.01
              ? "pan"
              : "tap",
          moved: true,
          tapStartX: remainingTouch.clientX,
          tapStartY: remainingTouch.clientY,
        };
        return;
      }

      const gestureState = mobileGestureRef.current;
      const changedTouch = event.changedTouches[0];

      if (
        scrubEnabled &&
        gestureState.mode !== "tap" &&
        viewportTransformRef.current.scale <= MOBILE_STAGE_MIN_SCALE + 0.01
      ) {
        mobileGestureRef.current = createDefaultMobileStageGestureState();
        return;
      }

      if (changedTouch && gestureState.mode === "tap" && !gestureState.moved) {
        lastTouchSelectionTimestampRef.current = window.performance.now();
        selectApartmentByMeshId(
          pointerSelectionRef.current?.(
            changedTouch.clientX,
            changedTouch.clientY,
          ) ?? hoveredApartmentIdRef.current,
        );
      }

      if (viewportTransformRef.current.scale <= MOBILE_STAGE_MIN_SCALE + 0.02) {
        resetViewportTransform();
      }

      mobileGestureRef.current = createDefaultMobileStageGestureState();
    },
    [
      scrubEnabled,
      resetViewportTransform,
      selectApartmentByMeshId,
      shouldAllowTouchViewportGestures,
    ],
  );
  const handleStageTouchCancel = useCallback(() => {
    mobileGestureRef.current = createDefaultMobileStageGestureState();
  }, []);

  const beginScrubInteraction = useCallback(
    (
      clientX: number,
      timeStamp: number,
      pointerId: number,
      inputMode: DragState["inputMode"],
    ) => {
      if (!scrubEnabled) {
        return;
      }

      clearHoverCooldown();
      stopMotionAnimation();
      stopWheelSettle();
      stopDragLoop();
      pendingPointerDeltaXRef.current = 0;
      lastDragVideoSyncFrameRef.current = null;
      lastDragVideoSyncTimeRef.current = 0;
      syncVideoTime(videoRef.current, displayProgressRef.current, {
        force: true,
      });
      invalidateCanvas();
      dragTargetProgressRef.current = displayProgressRef.current;
      dragStateRef.current = {
        clampedDeltaX: 0,
        didDrag: false,
        inputMode,
        lastClientX: clientX,
        lastTimestamp: timeStamp,
        pointerId,
        startProgress: displayProgressRef.current,
        startX: clientX,
      };
    },
    [
      clearHoverCooldown,
      scrubEnabled,
      invalidateCanvas,
      stopDragLoop,
      stopMotionAnimation,
      stopWheelSettle,
      syncVideoTime,
    ],
  );

  useEffect(() => {
    if (!dragStateRef.current && !isSettlingRef.current) {
      syncVideoTime(videoRef.current, displayProgressRef.current, {
        force: true,
      });
    }

    if (
      interactionMode === "idle" &&
      (effectiveShowTowerMeshes || allowHover || showTrackingDebug)
    ) {
      maybeInvalidateCanvas(
        `${trackingFrame}:${Number(effectiveShowTowerMeshes)}:${Number(allowHover)}:${Number(showTrackingDebug)}:effect`,
      );
    }
  }, [
    allowHover,
    effectiveShowTowerMeshes,
    interactionMode,
    maybeInvalidateCanvas,
    showTrackingDebug,
    syncVideoTime,
    trackingFrame,
  ]);

  return (
    <section
      ref={sectionRef}
      className="absolute inset-0 select-none overflow-hidden bg-black [touch-action:none] [-webkit-user-drag:none] [-webkit-user-select:none]"
    >
      {config?.previewLabel ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-emerald-200/35 bg-black/65 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100 shadow-lg backdrop-blur-md">
          {config.previewLabel}
          {config.debugModel ? " · alignment overlay" : ""}
        </div>
      ) : null}

      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${
          showFallbackBackdrop ? "opacity-100" : "opacity-0"
        }`}
        style={{
          backgroundImage: signedMasterPlanStageFallbackImage
            ? `url('${signedMasterPlanStageFallbackImage}')`
            : undefined,
        }}
      />

      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute"
          style={{
            height: `${coverViewport.height}px`,
            left: `${coverViewport.left}px`,
            top: `${coverViewport.top}px`,
            width: `${coverViewport.width}px`,
          }}
        >
          <div
            className="absolute inset-0 will-change-transform"
            style={{
              transform: mediaTransform,
              transformOrigin: "center center",
            }}
          >
            <video
              ref={videoRef}
              aria-label={`Master plan scrub view ${displayedFrame}`}
              className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-200 ${
                showVideo ? "opacity-100" : "opacity-0"
              }`}
              muted
              playsInline
              preload={performanceProfile.scrubVideoPreload}
              disablePictureInPicture
            />

            <div
              onPointerMoveCapture={(event) => {
                if (!isThreeDsMaxTrial) {
                  return;
                }

                if (event.pointerType === "touch" || event.buttons !== 0) {
                  return;
                }

                if (interactionMode !== "idle") {
                  return;
                }

                handleApartmentHover(
                  pointerSelectionRef.current?.(event.clientX, event.clientY) ??
                    null,
                  {
                    x: event.clientX,
                    y: event.clientY,
                  },
                );
              }}
              onWheelCapture={handleStageWheel}
              onTouchStartCapture={handleStageTouchStart}
              onTouchMoveCapture={handleStageTouchMove}
              onTouchEndCapture={handleStageTouchEnd}
              onTouchCancelCapture={handleStageTouchCancel}
              onMouseDownCapture={(event: ReactMouseEvent<HTMLDivElement>) => {
                if (event.button !== 0 || dragStateRef.current) {
                  return;
                }

                beginScrubInteraction(
                  event.clientX,
                  event.timeStamp,
                  -1,
                  "desktop-mouse",
                );
              }}
              onPointerDownCapture={(event) => {
                if (dragStateRef.current) {
                  return;
                }

                if (
                  event.pointerType === "touch" &&
                  (!event.isPrimary ||
                    (shouldAllowTouchViewportGestures &&
                      viewportTransformRef.current.scale >
                        MOBILE_STAGE_MIN_SCALE + 0.01))
                ) {
                  return;
                }

                if (!scrubEnabled) {
                  return;
                }

                if (event.pointerType !== "touch" && event.button !== 0) {
                  return;
                }

                beginScrubInteraction(
                  event.clientX,
                  event.timeStamp,
                  event.pointerId,
                  event.pointerType === "mouse"
                    ? "desktop-mouse"
                    : "generic-pointer",
                );
              }}
              onPointerUpCapture={(event) => {
                if (
                  event.pointerType === "touch" &&
                  shouldAllowTouchViewportGestures &&
                  viewportTransformRef.current.scale >
                    MOBILE_STAGE_MIN_SCALE + 0.01
                ) {
                  return;
                }

                if (event.pointerType !== "touch" && event.button !== 0) {
                  return;
                }

                if (!scrubEnabled) {
                  if (
                    event.pointerType === "touch" &&
                    window.performance.now() -
                      lastTouchSelectionTimestampRef.current <
                      120
                  ) {
                    return;
                  }

                  selectApartmentByMeshId(
                    pointerSelectionRef.current?.(
                      event.clientX,
                      event.clientY,
                    ) ?? hoveredApartmentIdRef.current,
                  );
                  return;
                }

                const dragState = dragStateRef.current;

                if (!dragState || dragState.didDrag) {
                  return;
                }

                selectApartmentByMeshId(
                  pointerSelectionRef.current?.(event.clientX, event.clientY) ??
                    hoveredApartmentIdRef.current,
                );
              }}
              onPointerLeave={() => {
                clearHoveredApartment();
              }}
              onPointerCancel={() => {
                cancelDragInteraction();
                clearHoveredApartment();
                mobileGestureRef.current =
                  createDefaultMobileStageGestureState();
              }}
              className={`absolute inset-0 touch-none select-none ${
                !scrubEnabled
                  ? "cursor-default"
                  : allowHover && activeHoveredApartmentId
                    ? "cursor-pointer"
                    : isDragging
                      ? "cursor-ew-resize"
                      : "cursor-[grab] active:cursor-[grabbing]"
              }`}
            >
              {shouldRenderCanvas ? (
                <Canvas
                  dpr={canvasDpr}
                  frameloop={
                    shouldUseContinuousCanvasFrameloop ? "always" : "demand"
                  }
                  performance={performanceProfile.canvasPerformance}
                  gl={{
                    alpha: true,
                    antialias: false,
                    depth: true,
                    powerPreference: "high-performance",
                    stencil: false,
                  }}
                >
                  <Suspense fallback={null}>
                    {!shouldUseContinuousCanvasFrameloop ? (
                      <AdaptiveDpr />
                    ) : null}
                    <TowerScene
                      apartments={apartments}
                      enableBoundsTree={performanceProfile.tier === "standard"}
                      interactionMode={interactionMode}
                      currentFrame={trackingFrame}
                      filteredApartments={filteredApartments}
                      getApartmentStatus={getApartmentStatus}
                      allowHover={allowHover}
                      onInvalidateReady={handleCanvasInvalidateReady}
                      onPointerSelectionReady={handlePointerSelectionReady}
                      onApartmentHover={handleApartmentHover}
                      presentedVideoFrameRef={presentedVideoFrameRef}
                      rotationProgressRef={displayProgressRef}
                      selectedApartmentId={
                        !isDragging && !isSettling ? selectedApartmentId : null
                      }
                      selectedTower={selectedTower}
                      simplifyFilteredVisuals={
                        performanceProfile.tier !== "standard"
                      }
                      showApartmentMeshes={effectiveShowApartmentMeshes}
                      showTowerMeshes={effectiveShowTowerMeshes}
                      showTrackingDebug={showTrackingDebug}
                      touchHighlightProfile={touchHighlightProfile}
                      trackingVideoAspect={trackingSceneAspect}
                      towerAModelPath={towerAModelPath}
                      towerBModelPath={towerBModelPath}
                      masterPlanConfig={config}
                    />
                  </Suspense>
                </Canvas>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {allowHover && activeHoveredApartmentId && !selectedApartmentId ? (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-30 will-change-transform"
          style={{ transform: tooltipMountTransform }}
        >
          <div className="rounded-[18px] border border-white/30 bg-[linear-gradient(145deg,rgba(255,255,255,0.20),rgba(255,255,255,0.10))] px-3.5 py-3 shadow-[0_18px_44px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <span className="text-[1.28rem] font-semibold leading-none tracking-[-0.05em] text-slate-950">
                {hoveredFlatLabel}
              </span>
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] ${statusMeta.badgeClassName}`}
              >
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${statusMeta.dotClassName}`}
                />
                {statusMeta.label}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
