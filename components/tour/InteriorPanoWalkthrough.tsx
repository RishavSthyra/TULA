"use client";

import { Viewer, events as viewerEvents, type Position } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import { EquirectangularTilesAdapter } from "@photo-sphere-viewer/equirectangular-tiles-adapter";
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';
import {
  MarkersPlugin,
  events as markerEvents,
  type MarkerConfig,
} from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/markers-plugin/index.css";
import {
  VirtualTourPlugin,
  events as virtualTourEvents,
  type VirtualTourNode,
} from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import { Cormorant_Garamond, DM_Sans, Manrope } from "next/font/google";
import NextImage, { type StaticImageData } from "next/image";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import pLimit from "p-limit";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BedDouble,
  Menu,
  Sofa,
  X,
} from "lucide-react";
import {
  INTERIOR_PANO_CONFIG,
  INTERIOR_PANO_ROOM_LABELS,
  KITCHEN_FOYER_ADDITIONAL_NAVIGATION_PAIRS,
  KITCHEN_FOYER_BLOCKED_NAVIGATION_PAIRS,
  KITCHEN_FOYER_MINIMAP,
  KITCHEN_FOYER_NAVIGATION_YAW_OVERRIDES,
} from "./interior-pano-config";
import {
  type ExteriorPanoramaSource,
  canUseTiledPanorama,
  getResolvedPreviewUrl,
  PanoAssetStore,
  selectPriorityTiles,
} from "@/lib/exterior-tour/pano";
import { getSignedAssetUrls } from "@/src/lib/signed-assets";
import { useSignedAssetUrls } from "@/src/lib/use-signed-assets";
import {
  buildExteriorTourGraph,
  getNodeHeading,
  imageFilenameToPanoId,
  preserveViewYawBetweenNodes,
} from "@/lib/exterior-tour/nodes";
import { clamp, degToRad, distancePlanar, dotPlanar, normalizePlanar, wrapAngleRad } from "@/lib/exterior-tour/math";
import type {
  DirectionalNavMap,
  ExteriorPanoNodeSource,
  ExteriorTourGraph,
  ExteriorTourNode,
  NavigationDirection,
  PanoMeta,
} from "@/lib/exterior-tour/types";
import type { InteriorDeveloperConfig } from "@/types/developer-config";
import {
  getWalkthroughMode,
} from "@/lib/walkthrough";
import { useSnapListViewport } from "@/lib/useSnapListViewport";

const editorialFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const uiFont = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const wallLabelFont = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "700"],
});

const DEFAULT_ZOOM = 10;
const MIN_PITCH = -Math.PI / 2 + 0.08;
const MAX_PITCH = Math.PI / 2 - 0.08;
const INTERIOR_SPHERE_RESOLUTION = 128;
const INTERIOR_SLOW_SPHERE_RESOLUTION = 64;
const INTERIOR_MIN_FOV = 36;
const INTERIOR_MAX_FOV = 74;
const ENTRANCE_FRAME_ID = "F0000";
const TRACKPAD_PANO_YAW_RADIANS_PER_PIXEL = 0.0032;
const BALCONY_PANO_NODE_ID = "BP_panoPath_Interior_Balcony_F9000";
const BALCONY_PANO_ID = "BAlconyUnit__View_pano";
const BALCONY_MINIMAP_LEFT = 16;
const BALCONY_MINIMAP_TOP =46;

function canUseDeviceOrientation() {
  return (
    typeof window !== "undefined" &&
    "DeviceOrientationEvent" in window &&
    typeof window.DeviceOrientationEvent !== "undefined"
  );
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

function radToDeg(value: number) {
  return (value * 180) / Math.PI;
}

function formatDebugNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(4).replace(/\.?0+$/, "");
}

const INTERIOR_PANO_DEV_TOOL_ENABLED = process.env.NODE_ENV === "development";

type InteriorPanoViewOverride = {
  yaw?: number;
  pitch?: number;
  angle?: number;
  viewPitch?: number;
};

const INTERIOR_PANO_VIEW_OVERRIDES = {
  [BALCONY_PANO_ID]: {
    yaw:0.7961,
    pitch: -0.31,
    angle: -0.0449,
    viewPitch: 1.4155,
  },
} satisfies Record<string, InteriorPanoViewOverride>;

type InteriorPanoWalkthroughProps = {
  initialNodeId?: string;
  className?: string;
  config?: InteriorDeveloperConfig;
  panoOnly?: boolean;
  preserveViewDirection?: boolean;
  blockedNavigationPairs?: ReadonlyArray<readonly [string, string]>;
  additionalNavigationPairs?: ReadonlyArray<readonly [string, string]>;
  navigationYawOverrides?: ReadonlyArray<readonly [string, string, number]>;
  minimap?: InteriorPanoMinimapConfig;
  showMinimap?: boolean;
  showModeToggle?: boolean;
  showDimensionsToggle?: boolean;
  preserveNodeOnModeToggle?: boolean;
};

const EMPTY_ADDITIONAL_NAVIGATION_PAIRS: ReadonlyArray<readonly [string, string]> = [];
const EMPTY_NAVIGATION_YAW_OVERRIDES: ReadonlyArray<
  readonly [string, string, number]
> = [];

type ResolvedPano = {
  nodeId: string;
  panoId: string;
  baseUrl: string;
  meta: PanoMeta;
  panorama: ExteriorPanoramaSource;
  previewUrl: string;
};

type ResolvePanoOptions = {
  preferTiles?: boolean;
};

type RoomTab = {
  id: string;
  label: string;
  image: string;
};

type MenuRoomItem = RoomTab & {
  isActive: boolean;
};

type FloorPlanMinimapPoint = {
  id: string;
  label: string;
  left: number;
  top: number;
  isActive: boolean;
  tone?: "gold" | "blue";
};

type FloorPlanMinimapWorldPoint = {
  x: number;
  y: number;
  z?: number;
};

export type FloorPlanMinimapWorldBounds = {
  bottomLeft: FloorPlanMinimapWorldPoint;
  topRight: FloorPlanMinimapWorldPoint;
};

type FloorPlanMinimapAdjustment = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
};

type FloorPlanMinimapCoordinateProjection = {
  left: { x: number; y: number; offset: number };
  top: { x: number; y: number; offset: number };
};

export type InteriorPanoMinimapConfig = {
  image: StaticImageData;
  worldBounds: FloorPlanMinimapWorldBounds;
  flipX?: boolean;
  flipY?: boolean;
  adjustment?: Partial<FloorPlanMinimapAdjustment>;
  pointPositions?: Record<string, Pick<FloorPlanMinimapPoint, "left" | "top">>;
  visibleNodeIds?: readonly string[];
  hiddenNodeIds?: readonly string[];
  coordinateProjection?: FloorPlanMinimapCoordinateProjection;
};

type ViewerBindings = {
  viewer: Viewer;
};

function isBalconyNode(nodeId: string) {
  return nodeId === BALCONY_PANO_NODE_ID;
}

function getInteriorPanoSource(
  nodeId: string,
  imageFilename: string,
  availablePanoFolders: Record<string, string>,
  isBareShellMode: boolean,
  usesBalconyBase: boolean,
  bases: { furnished: string; bareShell: string; balcony: string },
) {
  if (isBalconyNode(nodeId)) {
    return {
      panoId: BALCONY_PANO_ID,
      baseUrl: bases.balcony,
      previewLabel: "Balcony",
    };
  }

  const panoId = getResolvedPanoFolderId(
    nodeId,
    imageFilename,
    availablePanoFolders,
  );

  return {
    panoId,
    baseUrl: usesBalconyBase
      ? bases.balcony
      : isBareShellMode
        ? bases.bareShell
        : bases.furnished,
    previewLabel: getRoomLabel(imageFilename, nodeId),
  };
}

function getBalconyOverrideView() {
  const override = INTERIOR_PANO_VIEW_OVERRIDES[BALCONY_PANO_ID];

  if (!override) {
    return null;
  }

  return {
    yaw: wrapAngleRad(override.yaw ?? override.angle ?? 0),
    pitch: clamp(override.pitch ?? override.viewPitch ?? 0, MIN_PITCH, MAX_PITCH),
  };
}

type NetworkInformationLike = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

const INTERIOR_DIMENSION_ROOM_NAMES = [
  "Living",
  "Dinning",
  "Kitchen",
  "Utility",
  "M.Bedroom",
  "M.Toilet",
  "Bedroom 02",
  "Bedroom 03",
  "C.Toilet",
] as const;

type InteriorDimensionRoomName = (typeof INTERIOR_DIMENSION_ROOM_NAMES)[number];

type InteriorDimensionMarkerDefinition = {
  markerId: string;
  roomNumber: string;
  roomName: string;
  dimensions: string;
};

type InteriorDimensionMarkerPosition = {
  yaw: number;
  pitch: number;
};

type InteriorDimensionMarkerRotation =
  | number
  | {
      yaw?: number;
      pitch?: number;
      roll?: number;
    };

type InteriorDimensionMarkerOverride = InteriorDimensionMarkerPosition & {
  roomNumber?: string;
  roomName?: string;
  dimensions?: string;
  size?: number;
  offsetY?: number;
  rotation?: InteriorDimensionMarkerRotation;
};

const INTERIOR_ROOM_DIMENSIONS: Record<InteriorDimensionRoomName, Omit<InteriorDimensionMarkerDefinition, "markerId">> = {
  Living: {
    roomNumber: "01",
    roomName: "Living",
    dimensions: `14'7" x 10'10"`,
  },
  Dinning: {
    roomNumber: "02",
    roomName: "Dinning",
    dimensions: `11'3" x 9'0"`,
  },
  Kitchen: {
    roomNumber: "03",
    roomName: "Kitchen",
    dimensions: `13'7" x 7'0"`,
  },
  Utility: {
    roomNumber: "04",
    roomName: "Utility",
    dimensions: `5'3" x 5'0"`,
  },
  "M.Bedroom": {
    roomNumber: "05",
    roomName: "M.Bedroom",
    dimensions: `12'6" x 11'0"`,
  },
  "M.Toilet": {
    roomNumber: "06",
    roomName: "M.Toilet",
    dimensions: `5'0" x 8'0"`,
  },
  "Bedroom 02": {
    roomNumber: "07",
    roomName: "Bedroom 02",
    dimensions: `10'0" x 11'4"`,
  },
  "Bedroom 03": {
    roomNumber: "08",
    roomName: "Bedroom 03",
    dimensions: `12'0" x 9'0"`,
  },
  "C.Toilet": {
    roomNumber: "09",
    roomName: "C.Toilet",
    dimensions: `8'0" x 5'0"`,
  },
};

const SECONDARY_DIMENSION_ROOM_BY_ROOM: Record<
  InteriorDimensionRoomName,
  InteriorDimensionRoomName
> = {
  Living: "Dinning",
  Dinning: "Kitchen",
  Kitchen: "Utility",
  Utility: "Kitchen",
  "M.Bedroom": "M.Toilet",
  "M.Toilet": "M.Bedroom",
  "Bedroom 02": "C.Toilet",
  "Bedroom 03": "C.Toilet",
  "C.Toilet": "Bedroom 03",
};

// Temporary TULA pano mapping; existing measurements and placements await calibration.
const INTERIOR_DIMENSION_MARKER_OVERRIDES: Record<
  string,
  InteriorDimensionMarkerOverride[]
> = {
  LS_spline_pano_02_F0013: [
   { yaw: 4.75, pitch: 0.03, roomNumber: "02", rotation:{roll: 0, yaw :-10, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 1.2 },
  ],
  LS_spline_pano_01_F0001: [
   { yaw: 4, pitch: 0.03, roomNumber: "02", rotation:{roll: 0, yaw :-43, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 2.4 },
  ],
  LS_spline_pano_01_F0002: [
    // { yaw: 1.75, pitch: 0, roomNumber: "01", rotation:{roll: 0, yaw :-30, pitch : 0}, roomName: "Living and Dining", dimensions: `27'1" × 11'10"`, size : 1 },
   { yaw: 3.75, pitch: 0.03, roomNumber: "02", rotation:{roll: 0, yaw :-35, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 1.2 },
  ],
  LS_spline_pano_01_F0010: [
      { yaw: 1, pitch: 0.15, roomNumber: "03", rotation:{roll: 0, yaw : 3, pitch : 0}, roomName: "Bedroom 01", size:1.5, dimensions: `11'10" x 13'0"` },
  ],
  LS_spline_pano_01_F0011: [
    { yaw: 3.1, pitch: 0, roomNumber: "01", rotation:{roll: 0, yaw :5, pitch : 0}, roomName: "M.Bedroom", size:0.9, dimensions: `16'2"x11'0"` },
    { yaw: 6.3, pitch: 5.3, rotation:{roll: -12, yaw :12, pitch : 94}, roomNumber: "03",  size: 1.5, roomName: "M.Toilet", dimensions: `5'0"x8'0"` },
  ],
  LS_spline_pano_01_F0012: [
    { yaw: 4.6, pitch: 0, roomNumber: "01", rotation:{roll: 0, yaw :0, pitch : 0}, roomName: "M.Bedroom", size:1.2, dimensions: `16'2"x11'0"` },
    // { yaw: 6.7, pitch: -0.08, rotation:{roll: 0, yaw :0, pitch : 0}, roomNumber: "02",  size:0.8, roomName: "Dining", dimensions: `` },
    { yaw: 7.7, pitch: 5.6, rotation:{roll: 20, yaw :-10, pitch : 90}, roomNumber: "03",  size: 1.3, roomName: "M.Toilet", dimensions: `5'0"x8'0"` },
  ],
  LS_spline_pano_01_F0005 : [
         { yaw: 2.35, pitch: 0.3, roomNumber: "01", rotation:{roll: 0, yaw :35, pitch : 0}, roomName: "Foyer", dimensions: `5'0" x 9'0"`, size : 1.5 },   
       { yaw: 4, pitch: 0.5,rotation:{roll: 0, yaw :-48, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.4 },
  ],
  LS_spline_pano_01_F0006 :[
      { yaw: 6.3, pitch: 5.7, rotation:{roll: 15, yaw :-17, pitch : 86}, roomNumber: "03",  size: 1.7, roomName: "Kitchen", dimensions: `11'0" x 9'0"` },
{ yaw: -2.6, pitch: 0.3,rotation:{roll: 0, yaw :-32, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.2 },
  ],
  LS_spline_pano_01_F0007 :[
      { yaw: -2.7, pitch: 0.2,rotation:{roll: 0, yaw :-23, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.9 },
    { yaw: -4.7, pitch: -0.2, roomNumber: "01", rotation:{roll: 0, yaw :0, pitch : 0}, roomName: "Kitchen", size:1.1, dimensions: `11'0" x 9'0"` },
    // { yaw: 6.4, pitch: 0, roomNumber: "01", rotation:{roll: 0, yaw :-10, pitch : 0}, roomName: "Balcony View", size:1.1, dimensions: `Click to go to Balcony View` },
  ],
  LS_spline_pano_01_F0008 : [
    { yaw: -1.52, pitch: -0.6, roomNumber: "03", rotation:{roll: -15, yaw : 10, pitch : 90}, roomName: "Bedroom 01", size:1.2, dimensions: `11'10" x 13'0"` },
    // { yaw: 4.3, pitch: -0.6, roomNumber: "01", rotation:{roll: 10, yaw :12, pitch : 90}, roomName: "Balcony View", size:1.1, dimensions: `Click to go to Balcony View` },
          { yaw: -2.8, pitch: 0.15,rotation:{roll: 0, yaw :-15, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.6 },
  ],
  LS_spline_pano_01_F0004 :[
            { yaw: 3.55, pitch: 0.07, roomNumber: "04", rotation:{roll: 0, yaw :57, pitch : 0}, roomName: "Bedroom 1", dimensions: `11'0" x 11'0"`, size : 1.3 },   
              // { yaw: 5.14, pitch: 0.2, roomNumber: "02", rotation:{roll: 0, yaw :-24, pitch : -4}, roomName: "Living and Dining", size:0.9, dimensions: `27'1" × 11'10"` },
  ],

 LS_spline_pano_03_F0016 :[
{ yaw: -0.40, pitch: 0.12, roomNumber: "04", rotation:{roll: 0, yaw :16, pitch : 0}, roomName: "Bedroom 1", dimensions: `11'0" x 11'0"`, size : 1.1 },  
  ],
  LS_spline_pano_02_F0015 :[
        { yaw: 4, pitch: 0.1, roomNumber: "01", rotation:{roll: 0, yaw : 10, pitch : 0}, roomName: "Bedroom 02", size:1.1, dimensions: `10'9" × 11'4"` },
  ],
  LS_spline_pano_02_F0014 :[
   { yaw: 4.75, pitch: 0.03, roomNumber: "05", rotation:{roll: 0, yaw :60, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 1.4 },
  ],
  LS_spline_pano_01_F0003 :[
    //  { yaw: 2.14, pitch: 0.2, roomNumber: "01", rotation:{roll: 0, yaw :0, pitch : 0}, roomName: "Living and Dining", dimensions: `27'1" × 11'10"`, size : 0.8 },
   { yaw: 2.75, pitch: 0.07, roomNumber: "02", rotation:{roll: 0, yaw :-65, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 1.5 },
    //  { yaw: 6.7, pitch: 5.8, rotation:{roll: -8, yaw :12, pitch : 90}, roomNumber: "03",  size: 1.3, roomName: "C.Toilet", dimensions: `5'0"x8'0"` },
  ],
  LS_spline_pano_03_F0017 :[
{ yaw: -1.73, pitch: 0.25, roomNumber: "04", rotation:{roll: 0, yaw :10, pitch : 0}, roomName: "Bedroom 1", dimensions: `11'0" x 11'0"`, size : 1.6 },  
  ],
  LS_spline_pano_03_F0018 :[
         { yaw: 5.55, pitch: 0.3, roomNumber: "01", rotation:{roll: 0, yaw :-48, pitch : 0}, roomName: "Foyer", dimensions: `5'0" x 9'0"`, size : 2 },
  ],
  LS_spline_pano_01_F0009 :[
                  { yaw: 0.8, pitch: 0.2, roomNumber: "03", rotation:{roll: 0, yaw : 30, pitch : 0}, roomName: "Bedroom 01", size:1.2, dimensions: `11'10" x 13'0"` },
  ],
  // Temporary placeholders for the additional TULA cameras; calibrate later.
  LS_spline_pano_01_F0000: [
    { yaw: 0, pitch: 0, roomNumber: "01", roomName: "Walk-in Wardrobe", dimensions: INTERIOR_ROOM_DIMENSIONS.Living.dimensions, size: 0.8 },
  ],
  LS_spline_pano_04_F0019: [
    { yaw: 0.1, pitch: 0, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.8 },
     { yaw: 4.35, pitch: 0.1, roomNumber: "01", rotation:{roll: 0, yaw :20, pitch : 0}, roomName: "Foyer", dimensions: `5'0" x 9'0"`, size : 2.5 },
  ],
  LS_spline_pano_04_F0020: [
   { yaw: 0.1, pitch: 0, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.2 },
  ],
  LS_spline_pano_04_F0021: [
           { yaw: 2.5, pitch: 0.4,rotation:{roll: 0, yaw :35, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.1 },
  ],
  LS_spline_pano_04_F0022: [
       { yaw: 2.8, pitch: 0.5,rotation:{roll: 0, yaw :28, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.4 },
  ],
  LS_spline_pano_04_F0023: [
    { yaw: 0, pitch: 0, roomNumber: "01", roomName: "Interior", dimensions: INTERIOR_ROOM_DIMENSIONS.Living.dimensions, size: 0.8 },
  ],
  LS_spline_pano_05_F0024: [
             { yaw: -0.1, pitch: 0.2, roomNumber: "02", rotation:{roll: 0, yaw :-35, pitch : 0}, roomName: "Living and Dining", dimensions: `27'1" × 11'10"`, size : 0.6 },
    { yaw: -2.4, pitch: -0.3, roomNumber: "01", rotation:{roll: 0, yaw :0, pitch : 0}, roomName: "Kitchen", size:1.5, dimensions: `11'0" x 9'0"` },
  ],
  LS_spline_pano_05_F0025: [
    { yaw: 0, pitch: 0, roomNumber: "01", roomName: "Interior", dimensions: INTERIOR_ROOM_DIMENSIONS.Living.dimensions, size: 0.8 },
  ],
  LS_spline_pano_05_F0026: [
    { yaw: -1.3, pitch: 0.27,rotation:{roll: 0, yaw :-13, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.9 },
        { yaw: -3.5, pitch: -0.15, roomNumber: "01", rotation:{roll: 0, yaw :15, pitch : 0}, roomName: "Kitchen", size:1, dimensions: `11'0" x 9'0"` },
  ],
  LS_spline_pano_05_F0027: [
      { yaw: -1.5, pitch: 0.27,rotation:{roll: 0, yaw :0, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.9 },
  ],
};

// Independent bare-shell placements, initially copied from the furnished markers.
// Keys match the bare-shell R2 pano folders; edits here affect bare shell only.
const BARE_SHELL_DIMENSION_MARKER_OVERRIDES: Record<
  string,
  InteriorDimensionMarkerOverride[]
> = {
  "PANO.00013": [
   { yaw: 4.75, pitch: 0.03, roomNumber: "02", rotation:{roll: 0, yaw :-10, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 1.2 },
  ],
  "PANO.00001": [
   { yaw: 4, pitch: 0.03, roomNumber: "02", rotation:{roll: 0, yaw :-43, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 2.4 },
  ],
  "PANO.00002": [
    // { yaw: 1.75, pitch: 0, roomNumber: "01", rotation:{roll: 0, yaw :-30, pitch : 0}, roomName: "Living and Dining", dimensions: `27'1" × 11'10"`, size : 1 },
   { yaw: 3.75, pitch: 0.03, roomNumber: "02", rotation:{roll: 0, yaw :-35, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 1.2 },
  ],
  "PANO.00010": [
      { yaw: 1, pitch: 0.15, roomNumber: "03", rotation:{roll: 0, yaw : 3, pitch : 0}, roomName: "Bedroom 01", size:1.5, dimensions: `11'10" x 13'0"` },
  ],
  "PANO.00011": [
    { yaw: 3.1, pitch: 0, roomNumber: "01", rotation:{roll: 0, yaw :5, pitch : 0}, roomName: "M.Bedroom", size:0.9, dimensions: `16'2"x11'0"` },
    { yaw: 6.3, pitch: 5.3, rotation:{roll: -12, yaw :12, pitch : 94}, roomNumber: "03",  size: 1.5, roomName: "M.Toilet", dimensions: `5'0"x8'0"` },
  ],
  "PANO.00012": [
    { yaw: 4.6, pitch: 0, roomNumber: "01", rotation:{roll: 0, yaw :0, pitch : 0}, roomName: "M.Bedroom", size:1.2, dimensions: `16'2"x11'0"` },
    // { yaw: 6.7, pitch: -0.08, rotation:{roll: 0, yaw :0, pitch : 0}, roomNumber: "02",  size:0.8, roomName: "Dining", dimensions: `` },
    { yaw: 7.7, pitch: 5.6, rotation:{roll: 20, yaw :-10, pitch : 90}, roomNumber: "03",  size: 1.3, roomName: "M.Toilet", dimensions: `5'0"x8'0"` },
  ],
  "PANO.00005" : [
         { yaw: 2.35, pitch: 0.3, roomNumber: "01", rotation:{roll: 0, yaw :35, pitch : 0}, roomName: "Foyer", dimensions: `5'0" x 9'0"`, size : 1.5 },   
       { yaw: 4, pitch: 0.5,rotation:{roll: 0, yaw :-48, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.4 },
  ],
  "PANO.00006" :[
      { yaw: 6.3, pitch: 5.7, rotation:{roll: 15, yaw :-17, pitch : 86}, roomNumber: "03",  size: 1.7, roomName: "Kitchen", dimensions: `11'0" x 9'0"` },
{ yaw: -2.6, pitch: 0.3,rotation:{roll: 0, yaw :-32, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.2 },
  ],
  "PANO.00007" :[
      { yaw: -2.7, pitch: 0.2,rotation:{roll: 0, yaw :-23, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.9 },
    { yaw: -4.7, pitch: -0.2, roomNumber: "01", rotation:{roll: 0, yaw :0, pitch : 0}, roomName: "Kitchen", size:1.1, dimensions: `11'0" x 9'0"` },
    // { yaw: 6.4, pitch: 0, roomNumber: "01", rotation:{roll: 0, yaw :-10, pitch : 0}, roomName: "Balcony View", size:1.1, dimensions: `Click to go to Balcony View` },
  ],
  "PANO.00008" : [
    { yaw: -1.52, pitch: -0.6, roomNumber: "03", rotation:{roll: -15, yaw : 10, pitch : 90}, roomName: "Bedroom 01", size:1.2, dimensions: `11'10" x 13'0"` },
    // { yaw: 4.3, pitch: -0.6, roomNumber: "01", rotation:{roll: 10, yaw :12, pitch : 90}, roomName: "Balcony View", size:1.1, dimensions: `Click to go to Balcony View` },
          { yaw: -2.8, pitch: 0.15,rotation:{roll: 0, yaw :-15, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.6 },
  ],
  "PANO.00004" :[
            { yaw: 3.55, pitch: 0.07, roomNumber: "04", rotation:{roll: 0, yaw :57, pitch : 0}, roomName: "Bedroom 1", dimensions: `11'0" x 11'0"`, size : 1.3 },   
              // { yaw: 5.14, pitch: 0.2, roomNumber: "02", rotation:{roll: 0, yaw :-24, pitch : -4}, roomName: "Living and Dining", size:0.9, dimensions: `27'1" × 11'10"` },
  ],

 "PANO.00016" :[
{ yaw: -0.40, pitch: 0.12, roomNumber: "04", rotation:{roll: 0, yaw :16, pitch : 0}, roomName: "Bedroom 1", dimensions: `11'0" x 11'0"`, size : 1.1 },  
  ],
  "PANO.00015" :[
        { yaw: 4, pitch: 0.1, roomNumber: "01", rotation:{roll: 0, yaw : 10, pitch : 0}, roomName: "Bedroom 02", size:1.1, dimensions: `10'9" × 11'4"` },
  ],
  "PANO.00014" :[
   { yaw: 4.75, pitch: 0.03, roomNumber: "05", rotation:{roll: 0, yaw :60, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 1.4 },
  ],
  "PANO.00003" :[
    //  { yaw: 2.14, pitch: 0.2, roomNumber: "01", rotation:{roll: 0, yaw :0, pitch : 0}, roomName: "Living and Dining", dimensions: `27'1" × 11'10"`, size : 0.8 },
   { yaw: 2.75, pitch: 0.07, roomNumber: "02", rotation:{roll: 0, yaw :-65, pitch : 0}, roomName: "Master Bedroom", dimensions: `12'0" x 15'0"`, size : 1.5 },
    //  { yaw: 6.7, pitch: 5.8, rotation:{roll: -8, yaw :12, pitch : 90}, roomNumber: "03",  size: 1.3, roomName: "C.Toilet", dimensions: `5'0"x8'0"` },
  ],
  "PANO.00017" :[
{ yaw: -1.73, pitch: 0.25, roomNumber: "04", rotation:{roll: 0, yaw :10, pitch : 0}, roomName: "Bedroom 1", dimensions: `11'0" x 11'0"`, size : 1.6 },  
  ],
  "PANO.00018" :[
         { yaw: 5.55, pitch: 0.3, roomNumber: "01", rotation:{roll: 0, yaw :-48, pitch : 0}, roomName: "Foyer", dimensions: `5'0" x 9'0"`, size : 2 },
  ],
  "PANO.00009" :[
                  { yaw: 0.8, pitch: 0.2, roomNumber: "03", rotation:{roll: 0, yaw : 30, pitch : 0}, roomName: "Bedroom 01", size:1.2, dimensions: `11'10" x 13'0"` },
  ],
  // Temporary placeholders for the additional TULA cameras; calibrate later.
  "PANO.00000": [
    { yaw: 0, pitch: 0, roomNumber: "01", roomName: "Walk-in Wardrobe", dimensions: "14'7\" x 10'10\"", size: 0.8 },
  ],
  "PANO.00019": [
    { yaw: 0.1, pitch: 0, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.8 },
     { yaw: 4.35, pitch: 0.1, roomNumber: "01", rotation:{roll: 0, yaw :20, pitch : 0}, roomName: "Foyer", dimensions: `5'0" x 9'0"`, size : 2.5 },
  ],
  "PANO.00020": [
   { yaw: 0.1, pitch: 0, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.2 },
  ],
  "PANO.00021": [
           { yaw: 2.5, pitch: 0.4,rotation:{roll: 0, yaw :35, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.1 },
  ],
  "PANO.00022": [
       { yaw: 2.8, pitch: 0.5,rotation:{roll: 0, yaw :28, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 1.4 },
  ],
  "PANO.00023": [
    { yaw: 0, pitch: 0, roomNumber: "01", roomName: "Interior", dimensions: "14'7\" x 10'10\"", size: 0.8 },
  ],
  "PANO.00024": [
             { yaw: -0.1, pitch: 0.2, roomNumber: "02", rotation:{roll: 0, yaw :-35, pitch : 0}, roomName: "Living and Dining", dimensions: `27'1" × 11'10"`, size : 0.6 },
    { yaw: -2.4, pitch: -0.3, roomNumber: "01", rotation:{roll: 0, yaw :0, pitch : 0}, roomName: "Kitchen", size:1.5, dimensions: `11'0" x 9'0"` },
  ],
  "PANO.00025": [
    { yaw: 0, pitch: 0, roomNumber: "01", roomName: "Interior", dimensions: "14'7\" x 10'10\"", size: 0.8 },
  ],
  "PANO.00026": [
    { yaw: -1.3, pitch: 0.27,rotation:{roll: 0, yaw :-13, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.9 },
        { yaw: -3.5, pitch: -0.15, roomNumber: "01", rotation:{roll: 0, yaw :15, pitch : 0}, roomName: "Kitchen", size:1, dimensions: `11'0" x 9'0"` },
  ],
  "PANO.00027": [
      { yaw: -1.5, pitch: 0.27,rotation:{roll: 0, yaw :0, pitch : 0}, roomNumber: "02", roomName: "Living / Dining", dimensions: `21'0" x 15'0"`, size: 0.9 },
  ],
};

function getDimensionRoomName(label: string): InteriorDimensionRoomName | null {
  return INTERIOR_DIMENSION_ROOM_NAMES.includes(label as InteriorDimensionRoomName)
    ? (label as InteriorDimensionRoomName)
    : null;
}

function getInteriorDimensionMarkerDefinitions(
  node: ExteriorTourNode | undefined,
  markerOverrides?: InteriorDimensionMarkerOverride[],
) {
  if (!node || !markerOverrides?.length) {
    return [] as InteriorDimensionMarkerDefinition[];
  }

  const panoId = imageFilenameToPanoId(node.imageFilename);
  return markerOverrides.map((override, index) => {
    const fallbackRoomName = override.roomName;
    const baseRoomDefinition = fallbackRoomName && getDimensionRoomName(fallbackRoomName)
      ? INTERIOR_ROOM_DIMENSIONS[fallbackRoomName as InteriorDimensionRoomName]
      : undefined;

    return {
      markerId: `${panoId}-dimension-marker-${index + 1}`,
      roomNumber: override.roomNumber ?? baseRoomDefinition?.roomNumber ?? String(index + 1).padStart(2, "0"),
      roomName: override.roomName ?? baseRoomDefinition?.roomName ?? `Marker ${index + 1}`,
      dimensions: override.dimensions ?? baseRoomDefinition?.dimensions ?? "",
    };
  });
}

function getInteriorDimensionMarkerTargetNodeId(marker: InteriorDimensionMarkerDefinition) {
  return marker.roomName === "Balcony View" ? BALCONY_PANO_NODE_ID : undefined;
}

function buildInteriorDimensionMarkerElement(
  marker: InteriorDimensionMarkerDefinition,
  variant: "primary" | "secondary",
  offsetY = 0,
  size = 1,
  isClickable = false,
) {
  const root = document.createElement("div");
  root.className = `interior-dimension-marker interior-dimension-marker--${variant} relative block [transform-style:preserve-3d]`;
  root.style.transform = `translate3d(0, ${offsetY}px, 0)`;
  if (isClickable) {
    root.style.cursor = "pointer";
  }

  const label = document.createElement("div");
  label.className = `${wallLabelFont.className} interior-dimension-marker__wall-text inline-flex min-w-[320px] w-max flex-col items-start gap-3 whitespace-nowrap`;
  label.style.transform = `scale(${size})`;
  label.style.transformOrigin = "left center";

  const eyebrow = document.createElement("span");
  eyebrow.className = "interior-dimension-marker__eyebrow block text-[18px] font-bold uppercase tracking-[0.32em] leading-none text-white/50";
  eyebrow.textContent = marker.roomNumber;

  const title = document.createElement("span");
  title.className = "interior-dimension-marker__title block text-[76px] font-bold leading-[0.84] tracking-[-0.05em] text-white/92 [text-shadow:0_1px_1px_rgba(0,0,0,0.22),0_12px_28px_rgba(0,0,0,0.18)]";
  title.textContent = marker.roomName;

  const dimension = document.createElement("span");
  dimension.className = "interior-dimension-marker__size block pt-1 text-[30px] font-medium leading-[1.08] tracking-[0.03em] text-white/60";
  dimension.textContent = marker.dimensions;
  if (isClickable) {
    dimension.style.cursor = "pointer";
    dimension.style.textDecoration = "underline";
    dimension.style.textUnderlineOffset = "0.18em";
  }

  label.appendChild(eyebrow);
  label.appendChild(title);
  label.appendChild(dimension);
  root.appendChild(label);

  return root;
}

function normalizeMarkerRotation(rotation: InteriorDimensionMarkerRotation | undefined) {
  if (typeof rotation === "number") {
    return {
      roll: `${rotation}deg`,
    };
  }

  return {
    yaw: rotation?.yaw !== undefined ? `${rotation.yaw}deg` : undefined,
    pitch: rotation?.pitch !== undefined ? `${rotation.pitch}deg` : undefined,
    roll: rotation?.roll !== undefined ? `${rotation.roll}deg` : undefined,
  };
}

function getInteriorDimensionMarkers(
  node: ExteriorTourNode | undefined,
  isBareShellMode: boolean,
  isDimensionsVisible: boolean,
  nodesById: ExteriorTourGraph["byId"],
): MarkerConfig[] {
  if (!node) {
    return [];
  }

  const panoId = imageFilenameToPanoId(node.imageFilename);
  const markerOverrides = isBareShellMode
    ? BARE_SHELL_DIMENSION_MARKER_OVERRIDES[panoId] ??
      BARE_SHELL_DIMENSION_MARKER_OVERRIDES[panoId.replace(/-v\d+$/i, "")]
    : INTERIOR_DIMENSION_MARKER_OVERRIDES[panoId] ??
      INTERIOR_DIMENSION_MARKER_OVERRIDES[`LS_${node.id}`];
  if (!markerOverrides?.length) {
    return [];
  }
  const markers = getInteriorDimensionMarkerDefinitions(
    node,
    markerOverrides,
  );

  return markers.flatMap((marker, index) => {
      const rotation = normalizeMarkerRotation(markerOverrides?.[index]?.rotation);
      const requestedTargetNodeId = getInteriorDimensionMarkerTargetNodeId(marker);
      const targetNodeId = requestedTargetNodeId && nodesById[requestedTargetNodeId]
        ? requestedTargetNodeId
        : undefined;
      const shouldRender = isDimensionsVisible || Boolean(targetNodeId);

      if (!shouldRender) {
        return [];
      }

      return {
      id: marker.markerId,
      position: {
        yaw: markerOverrides[index].yaw,
        pitch: markerOverrides[index].pitch,
      },
      elementLayer: buildInteriorDimensionMarkerElement(
        {
          ...marker,
          roomNumber: marker.roomNumber,
          roomName: marker.roomName,
          dimensions: marker.dimensions,
        },
        "primary",
        markerOverrides?.[index]?.offsetY ?? 0,
        markerOverrides?.[index]?.size ?? 1,
        Boolean(targetNodeId),
      ),
      className: "overflow-visible",
      rotation: {
        yaw: rotation.yaw,
        pitch: rotation.pitch,
        roll: rotation.roll,
      },
      hideList: true,
      zIndex: 40,
      size: {
        width: index % 2 === 0 ? 420 : 380,
        height: index % 2 === 0 ? 240 : 220,
      },
      data: {
        targetNodeId,
        roomName: marker.roomName,
        type: "room-dimension",
      },
    };
    });
}

function ArrowButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof ArrowUp;
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
      className="interior-direction-button group flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-white/84 transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-28"
    >
      <Icon className="h-4 w-4 stroke-[1.65] transition duration-200 group-hover:text-[#8bd3a7] sm:h-4.5 sm:w-4.5" />
    </button>
  );
}

function InteriorFloorPlanMinimap({
  image,
  points,
  isTransitioning,
  onPointSelect,
  isCalibrationMode = false,
  onPointMove,
  className = "",
}: {
  image: StaticImageData;
  points: FloorPlanMinimapPoint[];
  isTransitioning: boolean;
  onPointSelect: (nodeId: string) => void;
  isCalibrationMode?: boolean;
  onPointMove?: (nodeId: string, position: Pick<FloorPlanMinimapPoint, "left" | "top">) => void;
  className?: string;
}) {
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  if (!points.length) {
    return null;
  }

  const updateDraggedPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingPointId || !onPointMove || !minimapRef.current) {
      return;
    }

    const bounds = minimapRef.current.getBoundingClientRect();
    onPointMove(draggingPointId, {
      left: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      top: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100),
    });
  };

  return (
    <div
      ref={minimapRef}
      onPointerMove={updateDraggedPoint}
      onPointerUp={() => setDraggingPointId(null)}
      onPointerCancel={() => setDraggingPointId(null)}
      className={`pointer-events-auto relative ${className}`}
    >
      <NextImage
        src={image}
        alt="Interior floor plan minimap"
        className="h-auto w-full select-none"
        sizes="(max-width: 767px) 176px, (max-width: 1279px) 220px, 280px"
        priority={false}
      />

      {points.map((point) => (
        <button
          key={point.id}
          type="button"
          aria-label={`Open ${point.label}`}
          title={point.label}
          disabled={isTransitioning}
          onClick={() => {
            if (!isCalibrationMode) {
              onPointSelect(point.id);
            }
          }}
          onPointerDown={(event) => {
            if (!isCalibrationMode || !onPointMove) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDraggingPointId(point.id);
          }}
          style={{
            left: `${point.left}%`,
            top: `${point.top}%`,
          }}
          className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border cursor-pointer transition duration-200 hover:scale-150 disabled:cursor-not-allowed disabled:opacity-50 ${
            isCalibrationMode
              ? "h-4 w-4 cursor-grab active:cursor-grabbing sm:h-4 sm:w-4"
              : "h-2 w-2 sm:h-2 sm:w-2"
          } ${
            point.tone === "blue"
              ? point.isActive
                ? "border-white bg-[#7dd3fc] shadow-[0_0_0_4px_rgba(56,189,248,0.24),0_0_18px_rgba(56,189,248,0.84)]"
                : "border-[#c7f2ff] bg-[#38bdf8] shadow-[0_0_0_3px_rgba(56,189,248,0.2),0_0_14px_rgba(56,189,248,0.72),0_5px_14px_rgba(0,0,0,0.22)]"
              : point.isActive
                ? "border-white bg-[#ffd45a] shadow-[0_0_0_4px_rgba(255,212,90,0.22),0_0_18px_rgba(255,212,90,0.82)]"
                : "border-[#fff4c9] bg-[#f4c84d] shadow-[0_0_0_3px_rgba(244,200,77,0.18),0_0_14px_rgba(244,200,77,0.7),0_5px_14px_rgba(0,0,0,0.22)]"
          }`}
        >
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 rounded-full ${
              point.tone === "blue"
                ? point.isActive
                  ? "bg-[#d7f3ff]/62"
                  : "bg-[#7dd3fc]/50"
                : point.isActive
                  ? "bg-[#ffe389]/60"
                  : "bg-[#ffd45a]/48"
            }`}
            style={{ animation: "walkthroughMinimapPulse 1.75s ease-in-out infinite" }}
          />
          <span className="sr-only">{point.label}</span>
        </button>
      ))}
    </div>
  );
}

function getRoomLabel(imageFilename: string, nodeId?: string) {
  const panoId = imageFilenameToPanoId(imageFilename);
  const sourceNodeId = nodeId ?? panoId.replace(/^LS_(?=spline_pano_)/i, "");
  return INTERIOR_PANO_ROOM_LABELS[sourceNodeId] ?? sourceNodeId;
}

function getImportantRoomLabel(label: string) {
  const normalizedLabel = label.trim().toLowerCase();

  if (!normalizedLabel) {
    return null;
  }

  if (normalizedLabel === "entrance") {
    return "Entrance";
  }

  if (normalizedLabel === "living") {
    return "Living";
  }

  if (normalizedLabel === "dinning") {
    return "Dinning";
  }

  if (normalizedLabel === "kitchen") {
    return "Kitchen";
  }

  if (normalizedLabel === "utility") {
    return "Utility";
  }

  if (normalizedLabel === "m.bedroom") {
    return "M.Bedroom";
  }

  if (normalizedLabel === "m.toilet") {
    return "M.Toilet";
  }

  if (normalizedLabel === "bedroom 02") {
    return "Bedroom 02";
  }

  if (normalizedLabel === "bedroom 03") {
    return "Bedroom 03";
  }

  if (normalizedLabel === "c.toilet") {
    return "C.Toilet";
  }

  if (normalizedLabel.includes("passage") || /^hall\b/.test(normalizedLabel)) {
    return null;
  }

  if (normalizedLabel.endsWith("entrance")) {
    return null;
  }

  if (normalizedLabel.includes("kitchen")) {
    return "Kitchen";
  }

  if (normalizedLabel.includes("master bedroom")) {
    return "M.Bedroom";
  }

  if (normalizedLabel.includes("childrens room")) {
    return "Bedroom 03";
  }

  if (normalizedLabel.includes("maid room")) {
    return "Utility";
  }

  if (normalizedLabel.includes("drawing room")) {
    return "Living";
  }

  if (normalizedLabel.includes("dining room")) {
    return "Dinning";
  }

  if (normalizedLabel.includes("living room")) {
    return "Living";
  }

  if (
    normalizedLabel.includes("bathroom") ||
    normalizedLabel.includes("washroom")
  ) {
    return "C.Toilet";
  }

  return null;
}

function getResolvedPanoFolderId(
  nodeId: string,
  imageFilename: string,
  availablePanoFolders: Record<string, string>,
) {
  return availablePanoFolders[nodeId] ?? imageFilenameToPanoId(imageFilename);
}

function getDefaultPreviewFile() {
  return "preview.jpg";
}

function buildNodeModeLabel(isBareShellMode: boolean) {
  return isBareShellMode ? "Bare Shell" : "Furnished";
}

function projectWorldPointToMinimap(
  point: FloorPlanMinimapWorldPoint,
  bounds: FloorPlanMinimapWorldBounds,
) {
  const spanX = Math.max(bounds.topRight.x - bounds.bottomLeft.x, 1);
  const spanY = Math.max(bounds.topRight.y - bounds.bottomLeft.y, 1);

  return {
    left: clamp(((point.x - bounds.bottomLeft.x) / spanX) * 100, 0, 100),
    top: clamp((1 - (point.y - bounds.bottomLeft.y) / spanY) * 100, 0, 100),
  };
}

function adjustMinimapPosition(
  position: Pick<FloorPlanMinimapPoint, "left" | "top">,
  adjustment: FloorPlanMinimapAdjustment,
) {
  return {
    left: clamp(
      50 + (position.left - 50) * adjustment.scaleX + adjustment.offsetX,
      0,
      100,
    ),
    top: clamp(
      50 + (position.top - 50) * adjustment.scaleY + adjustment.offsetY,
      0,
      100,
    ),
  };
}

function vectorFromAngle(angle: number) {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
    z: 0,
  };
}

function getNavigationPairKey(firstNodeId: string, secondNodeId: string) {
  return [firstNodeId, secondNodeId].sort().join("::");
}

function getNavigationYawOverride(
  overrides: ReadonlyArray<readonly [string, string, number]>,
  fromNodeId: string,
  toNodeId: string,
) {
  const override = overrides.find(
    ([from, to]) => from === fromNodeId && to === toNodeId,
  );

  return override ? degToRad(override[2]) : undefined;
}

function getConnectedNavigationCandidates(
  graph: ExteriorTourGraph,
  activeNode: ExteriorTourNode,
  blockedNavigationPairKeys: ReadonlySet<string>,
  additionalNavigationPairs: ReadonlyArray<readonly [string, string]>,
) {
  const candidateIds = new Set(activeNode.neighbors.map((neighbor) => neighbor.id));

  for (const [firstNodeId, secondNodeId] of additionalNavigationPairs) {
    if (firstNodeId === activeNode.id) {
      candidateIds.add(secondNodeId);
    } else if (secondNodeId === activeNode.id) {
      candidateIds.add(firstNodeId);
    }
  }

  return graph.nodes.filter(
    (node) =>
      candidateIds.has(node.id) &&
      !blockedNavigationPairKeys.has(
        getNavigationPairKey(activeNode.id, node.id),
      ),
  );
}

function getViewRelativeNavigationTargets(
  graph: ExteriorTourGraph,
  activeNode: ExteriorTourNode | undefined,
  currentYaw: number,
  connectedOnly = false,
  blockedNavigationPairKeys: ReadonlySet<string> = new Set(),
  additionalNavigationPairs: ReadonlyArray<readonly [string, string]> =
    EMPTY_ADDITIONAL_NAVIGATION_PAIRS,
  navigationYawOverrides: ReadonlyArray<readonly [string, string, number]> =
    EMPTY_NAVIGATION_YAW_OVERRIDES,
): DirectionalNavMap {
  const emptyTarget = {
    forward: { direction: "forward" as const, node: null, score: -Infinity },
    left: { direction: "left" as const, node: null, score: -Infinity },
    right: { direction: "right" as const, node: null, score: -Infinity },
    backward: { direction: "backward" as const, node: null, score: -Infinity },
  };

  if (!activeNode) {
    return emptyTarget;
  }

  const worldForwardAngle = getNodeHeading(activeNode) + currentYaw;
  const desiredAngles: Record<NavigationDirection, number> = {
    forward: worldForwardAngle,
    left: worldForwardAngle - Math.PI / 2,
    right: worldForwardAngle + Math.PI / 2,
    backward: worldForwardAngle + Math.PI,
  };
  const candidates = connectedOnly
    ? getConnectedNavigationCandidates(
        graph,
        activeNode,
        blockedNavigationPairKeys,
        additionalNavigationPairs,
      )
    : graph.nodes.filter((node) => node.id !== activeNode.id);

  return {
    forward: getBestDirectionalTarget(activeNode, candidates, desiredAngles.forward, "forward", navigationYawOverrides),
    left: getBestDirectionalTarget(activeNode, candidates, desiredAngles.left, "left", navigationYawOverrides),
    right: getBestDirectionalTarget(activeNode, candidates, desiredAngles.right, "right", navigationYawOverrides),
    backward: getBestDirectionalTarget(activeNode, candidates, desiredAngles.backward, "backward", navigationYawOverrides),
  };
}

function getBestDirectionalTarget(
  activeNode: ExteriorTourNode,
  candidates: ExteriorTourNode[],
  desiredAngle: number,
  direction: NavigationDirection,
  navigationYawOverrides: ReadonlyArray<readonly [string, string, number]>,
) {
  const desiredVector = vectorFromAngle(desiredAngle);
  const ranked = candidates
    .map((candidate) => {
      const delta = {
        x: candidate.rawPosition.x - activeNode.rawPosition.x,
        y: candidate.rawPosition.y - activeNode.rawPosition.y,
        z: 0,
      };
      const yawOverride = getNavigationYawOverride(
        navigationYawOverrides,
        activeNode.id,
        candidate.id,
      );
      const directionVector =
        yawOverride === undefined
          ? normalizePlanar(delta, desiredVector)
          : vectorFromAngle(getNodeHeading(activeNode) + yawOverride);
      const distance = distancePlanar(activeNode.rawPosition, candidate.rawPosition);
      const alignment = dotPlanar(directionVector, desiredVector);
      const distanceBias =
        1 - clamp(distance / Math.max(activeNode.nearestDistance * 4.75, 1), 0, 1);
      const score = alignment * 0.82 + distanceBias * 0.18;

      return {
        direction,
        node: candidate,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 0.1) {
    return {
      direction,
      node: null,
      score: best?.score ?? -Infinity,
    };
  }

  return best;
}

function buildLinkPosition(
  node: ExteriorTourNode,
  target: ExteriorTourNode,
  yawOverride?: number,
): Position {
  const dx = target.rawPosition.x - node.rawPosition.x;
  const dy = target.rawPosition.y - node.rawPosition.y;
  const dz = target.rawPosition.z - node.rawPosition.z;
  const planarDistance = Math.max(distancePlanar(node.rawPosition, target.rawPosition), 1);

  return {
    yaw:
      yawOverride ??
      wrapAngleRad(Math.atan2(dy, dx) - getNodeHeading(node)),
    pitch: clamp(Math.atan2(dz, planarDistance), MIN_PITCH, MAX_PITCH),
  };
}

export default function InteriorPanoWalkthrough({
  initialNodeId,
  className,
  config = INTERIOR_PANO_CONFIG,
  panoOnly = true,
  preserveViewDirection = true,
  blockedNavigationPairs = KITCHEN_FOYER_BLOCKED_NAVIGATION_PAIRS,
  additionalNavigationPairs = KITCHEN_FOYER_ADDITIONAL_NAVIGATION_PAIRS,
  navigationYawOverrides = KITCHEN_FOYER_NAVIGATION_YAW_OVERRIDES,
  minimap = KITCHEN_FOYER_MINIMAP,
  showMinimap = true,
  showModeToggle = true,
  showDimensionsToggle = true,
  preserveNodeOnModeToggle = true,
}: InteriorPanoWalkthroughProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedBareShellMode = getWalkthroughMode(searchParams) === "bare-shell";
  const [isBareShellMode, setIsBareShellMode] = useState(requestedBareShellMode);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDimensionsVisible, setIsDimensionsVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewYaw, setViewYaw] = useState(0);
  const [readyPanoramaVersion, setReadyPanoramaVersion] = useState(0);
  const [calibratedMinimapPointPositions, setCalibratedMinimapPointPositions] = useState<
    Record<string, Pick<FloorPlanMinimapPoint, "left" | "top">>
  >({});
  const isMinimapCalibrationMode =
    INTERIOR_PANO_DEV_TOOL_ENABLED && searchParams.get("calibrate") === "1";
  const showAllConfiguredMinimapPoints =
    INTERIOR_PANO_DEV_TOOL_ENABLED && searchParams.get("all-points") === "1";
  const [activeNodeId, setActiveNodeId] = useState(
    initialNodeId ?? (requestedBareShellMode ? config?.bareShellInitialNodeId : config?.furnishedInitialNodeId) ?? "",
  );
  const [availablePanoFolders, setAvailablePanoFolders] = useState<Record<string, string>>({});
  const [availableNodeIds, setAvailableNodeIds] = useState<Set<string> | null>(null);
  const [preferredFrame, setPreferredFrame] = useState<string | null>(null);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [isMobileTouchViewport, setIsMobileTouchViewport] = useState(false);
  const viewerHostRef = useRef<HTMLDivElement | null>(null);
  const bindingsRef = useRef<ViewerBindings | null>(null);
  const activeNodeIdRef = useRef(activeNodeId);
  const currentNodeIdRef = useRef("");
  const isDimensionsVisibleRef = useRef(isDimensionsVisible);
  const cacheRef = useRef(new Map<string, ResolvedPano>());
  const assetStoreMapRef = useRef(new Map<string, PanoAssetStore>());
  const pendingNodeViewRef = useRef<Position | null>(null);
  const warmupRunRef = useRef(0);
  const navigationInFlightRef = useRef(true);
  const goToNodeRef = useRef<(targetId: string) => Promise<void>>(async () => {});
  const panoTapRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    lastTapAt: number;
    lastTapX: number;
    lastTapY: number;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  const allNodes = useMemo(
    () => isBareShellMode
      ? config.bareShellNodes
      : [...config.furnishedNodes, ...(config.balconyNodes ?? [])],
    [config.balconyNodes, config.bareShellNodes, config.furnishedNodes, isBareShellMode],
  );
  const configuredBalconyNodeIds = useMemo(
    () => new Set((config.balconyNodes ?? []).map((node) => node.id)),
    [config.balconyNodes],
  );
  const panoBases = useMemo(() => {
    const trailingSlash = (value: string) => value.endsWith("/") ? value : `${value}/`;
    return {
      furnished: trailingSlash(config.furnishedPanoBasePath),
      bareShell: trailingSlash(config.bareShellPanoBasePath),
      balcony: trailingSlash(config.balconyPanoBasePath),
    };
  }, [config.balconyPanoBasePath, config.bareShellPanoBasePath, config.furnishedPanoBasePath]);
  // Retain each render set's metadata and signed assets when switching modes.
  const getAssetStoreForBaseUrl = useCallback((baseUrl: string) => {
    let store = assetStoreMapRef.current.get(baseUrl);
    if (!store) {
      store = new PanoAssetStore(baseUrl);
      assetStoreMapRef.current.set(baseUrl, store);
    }
    return store;
  }, []);
  const interiorViewerMoveSpeed = isMobileTouchViewport ? 3.6 : 2;
  const interiorViewerMoveInertia = isMobileTouchViewport ? 0.82 : 0.92;
  const interiorNodeTransitionSpeed = isMobileTouchViewport ? 560 : 650;

  const nodes = useMemo(() => {
    if (!availableNodeIds) {
      return [] as ExteriorPanoNodeSource[];
    }

    return allNodes.filter((item) => availableNodeIds.has(item.id));
  }, [allNodes, availableNodeIds]);

  const graph = useMemo(() => buildExteriorTourGraph(nodes), [nodes]);
  const blockedNavigationPairKeys = useMemo(
    () =>
      new Set(
        blockedNavigationPairs.map(([firstNodeId, secondNodeId]) =>
          getNavigationPairKey(firstNodeId, secondNodeId),
        ),
      ),
    [blockedNavigationPairs],
  );
  const fallbackNodeId = graph.nodes[0]?.id ?? "";
  const explicitNodeId = activeNodeId && graph.byId[activeNodeId] ? activeNodeId : undefined;
  const preferredNodeId = preferredFrame
    ? graph.nodes.find((node) => imageFilenameToPanoId(node.imageFilename).endsWith(preferredFrame))?.id
    : undefined;
  const currentNodeId = explicitNodeId || preferredNodeId || fallbackNodeId;
  const activeNode = graph.byId[currentNodeId];
  const navigationTargets = useMemo(
    () =>
      getViewRelativeNavigationTargets(
        graph,
        activeNode,
        viewYaw,
        panoOnly,
        blockedNavigationPairKeys,
        additionalNavigationPairs,
        navigationYawOverrides,
      ),
    [
      activeNode,
      additionalNavigationPairs,
      blockedNavigationPairKeys,
      graph,
      navigationYawOverrides,
      panoOnly,
      viewYaw,
    ],
  );
  const menuRooms = useMemo<MenuRoomItem[]>(() => {
    if (panoOnly || !isMenuOpen) {
      return [];
    }
    const seenLabels = new Set<string>();

    return graph.nodes.reduce<MenuRoomItem[]>((items, node) => {
      const importantLabel = getImportantRoomLabel(getRoomLabel(node.imageFilename, node.id));

      if (!importantLabel || seenLabels.has(importantLabel)) {
        return items;
      }

      seenLabels.add(importantLabel);

      const { panoId, baseUrl } = getInteriorPanoSource(
        node.id,
        node.imageFilename,
        availablePanoFolders,
        isBareShellMode,
        configuredBalconyNodeIds.has(node.id),
        panoBases,
      );

      items.push({
        id: node.id,
        image: getResolvedPreviewUrl(
          panoId,
          baseUrl,
          getDefaultPreviewFile(),
        ),
        isActive: node.id === currentNodeId,
        label: importantLabel,
      });

      return items;
    }, []);
  }, [
    availablePanoFolders,
    currentNodeId,
    configuredBalconyNodeIds,
    graph.nodes,
    isBareShellMode,
    isMenuOpen,
    panoBases,
    panoOnly,
  ]);
  const signedMenuRoomImages = useSignedAssetUrls(
    menuRooms.map((room) => room.image),
  );
  const {
    setFirstItemNode: setRoomMenuFirstItemNode,
    setListNode: setRoomMenuListNode,
    setScrollAreaNode: setRoomMenuScrollAreaNode,
    viewportHeight: roomMenuViewportHeight,
  } = useSnapListViewport({
    itemCount: menuRooms.length,
    targetVisibleCards: 4,
  });
  const minimapImage = minimap.image;
  const minimapPoints = useMemo<FloorPlanMinimapPoint[]>(() => {
    const worldBounds = minimap.worldBounds;
    const shouldFlipX = minimap.flipX ?? false;
    const shouldFlipY = minimap.flipY ?? false;
    const minimapAdjustment: FloorPlanMinimapAdjustment = {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      ...minimap.adjustment,
    };

    return graph.nodes.reduce<FloorPlanMinimapPoint[]>((points, node) => {
      if (minimap?.visibleNodeIds && !minimap.visibleNodeIds.includes(node.id)) {
        return points;
      }

      if (
        !showAllConfiguredMinimapPoints &&
        minimap?.hiddenNodeIds?.includes(node.id)
      ) {
        return points;
      }

      if (isBalconyNode(node.id)) {
        points.push({
          id: node.id,
          isActive: node.id === currentNodeId,
          label: "Balcony",
          left: BALCONY_MINIMAP_LEFT,
          top: BALCONY_MINIMAP_TOP,
          tone: "blue",
        });
        return points;
      }

      // Dragged calibration values are a local, temporary preview. Once calibration
      // mode is closed, render the saved minimap configuration again.
      const manualPosition = isMinimapCalibrationMode
        ? calibratedMinimapPointPositions[node.id] ?? minimap?.pointPositions?.[node.id]
        : minimap?.pointPositions?.[node.id];
      const projectedPosition = minimap?.coordinateProjection
        ? {
            left: clamp(
              node.rawPosition.x * minimap.coordinateProjection.left.x +
                node.rawPosition.y * minimap.coordinateProjection.left.y +
                minimap.coordinateProjection.left.offset,
              0,
              100,
            ),
            top: clamp(
              node.rawPosition.x * minimap.coordinateProjection.top.x +
                node.rawPosition.y * minimap.coordinateProjection.top.y +
                minimap.coordinateProjection.top.offset,
              0,
              100,
            ),
          }
        : projectWorldPointToMinimap(node.rawPosition, worldBounds);
      const adjustedPosition = manualPosition
        ? manualPosition
        : adjustMinimapPosition(
        {
          left: shouldFlipX ? 100 - projectedPosition.left : projectedPosition.left,
          top: shouldFlipY ? 100 - projectedPosition.top : projectedPosition.top,
        },
          minimapAdjustment,
        );

      points.push({
        id: node.id,
        isActive: node.id === currentNodeId,
        label: getRoomLabel(node.imageFilename, node.id),
        left: adjustedPosition.left,
        top: adjustedPosition.top,
        tone: configuredBalconyNodeIds.has(node.id) ? "blue" : "gold",
      });

      return points;
    }, []);
  }, [calibratedMinimapPointPositions, configuredBalconyNodeIds, currentNodeId, graph.nodes, isMinimapCalibrationMode, minimap, showAllConfiguredMinimapPoints]);

  const handleMinimapPointMove = useCallback(
    (nodeId: string, position: Pick<FloorPlanMinimapPoint, "left" | "top">) => {
      setCalibratedMinimapPointPositions((current) => ({
        ...current,
        [nodeId]: {
          left: Number(position.left.toFixed(2)),
          top: Number(position.top.toFixed(2)),
        },
      }));
    },
    [],
  );

  const copyMinimapCalibration = useCallback(() => {
    void navigator.clipboard.writeText(
      JSON.stringify(calibratedMinimapPointPositions, null, 2),
    );
  }, [calibratedMinimapPointPositions]);

  const updateModeInUrl = useCallback(
    (nextMode: boolean) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (nextMode) {
        nextParams.set("mode", "bare-shell");
      } else {
        nextParams.delete("mode");
      }

      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const applyModeChange = useCallback((nextMode: boolean) => {
    if (nextMode === isBareShellMode) {
      return;
    }

    const currentNodeId = currentNodeIdRef.current || activeNodeIdRef.current;
    navigationInFlightRef.current = true;
    warmupRunRef.current += 1;
    setPreferredFrame(preserveNodeOnModeToggle ? null : ENTRANCE_FRAME_ID);
    setActiveNodeId(preserveNodeOnModeToggle ? currentNodeId : "");
    setViewYaw(0);
    setIsMenuOpen(false);
    setIsTransitioning(true);
    setAvailablePanoFolders({});
    setAvailableNodeIds(null);
    setIsBareShellMode(nextMode);
  }, [isBareShellMode, preserveNodeOnModeToggle]);

  const handleModeToggle = useCallback(() => {
    if (navigationInFlightRef.current || isTransitioning) return;
    const nextMode = !isBareShellMode;
    applyModeChange(nextMode);
    updateModeInUrl(nextMode);
  }, [applyModeChange, isBareShellMode, isTransitioning, updateModeInUrl]);

  const handleDimensionsToggle = useCallback(() => {
    setIsDimensionsVisible((current) => !current);
  }, []);

  const resolvePano = useCallback(
    async (
      nodeId: string,
      { preferTiles = true }: ResolvePanoOptions = {},
    ) => {
      const node = graph.byId[nodeId];
      if (!node) {
        throw new Error(`Unknown interior node: ${nodeId}`);
      }

      const { panoId, baseUrl } = getInteriorPanoSource(
        node.id,
        node.imageFilename,
        availablePanoFolders,
        isBareShellMode,
        configuredBalconyNodeIds.has(node.id),
        panoBases,
      );
      const panoAssetStore = getAssetStoreForBaseUrl(baseUrl);
      const cacheKey = `${isBareShellMode ? "bs" : "fu"}:${nodeId}:${baseUrl}:${panoId}:${preferTiles ? "tiles" : "preview"}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const assets = await panoAssetStore.getPanorama(panoId, preferTiles);
      if (!canUseTiledPanorama(assets.meta)) {
        throw new Error(`Incompatible pano tiles for ${panoId}`);
      }

      const resolved: ResolvedPano = { nodeId, panoId, baseUrl, ...assets };

      cacheRef.current.set(cacheKey, resolved);
      return resolved;
    },
    [availablePanoFolders, configuredBalconyNodeIds, getAssetStoreForBaseUrl, graph, isBareShellMode, panoBases],
  );

  const buildTourNode = useCallback(
    async (
      node: ExteriorTourNode,
      { preferTiles = false }: ResolvePanoOptions = {},
    ): Promise<VirtualTourNode> => {
      const resolved = await resolvePano(node.id, { preferTiles });

      return {
        id: node.id,
        panorama: resolved.panorama,
        thumbnail: resolved.previewUrl,
        name: getRoomLabel(node.imageFilename, node.id),
        caption: `${getRoomLabel(node.imageFilename, node.id)} | ${buildNodeModeLabel(isBareShellMode)}`,
        links: getConnectedNavigationCandidates(
          graph,
          node,
          blockedNavigationPairKeys,
          additionalNavigationPairs,
        )
          .map((target) => ({
            nodeId: target.id,
            position: buildLinkPosition(
              node,
              target,
              getNavigationYawOverride(
                navigationYawOverrides,
                node.id,
                target.id,
              ),
            ),
          })),
      };
    },
    [
      additionalNavigationPairs,
      blockedNavigationPairKeys,
      graph,
      isBareShellMode,
      navigationYawOverrides,
      resolvePano,
    ],
  );

  const syncNodeMarkers = useCallback(
    (viewer: Viewer, nodeId: string) => {
      const markersPlugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);

      if (!markersPlugin) {
        return;
      }

      markersPlugin.setMarkers(
        getInteriorDimensionMarkers(
          graph.byId[nodeId],
          isBareShellMode,
          isDimensionsVisibleRef.current,
          graph.byId,
        ),
      );
    },
    [graph.byId, isBareShellMode],
  );

  const goToNode = useCallback(async (targetId: string) => {
    const bindings = bindingsRef.current;
    const targetNode = graph.byId[targetId];
    const sourceNode = graph.byId[activeNodeIdRef.current];
    const virtualTour = bindings?.viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin);

    if (!bindings || !virtualTour || !targetNode || navigationInFlightRef.current || isTransitioning || targetId === activeNodeIdRef.current) {
      return;
    }

    navigationInFlightRef.current = true;
    warmupRunRef.current += 1;
    setIsTransitioning(true);
    setViewerError(null);
    const currentPosition = bindings.viewer.getPosition();
    const targetPosition = isBalconyNode(targetId)
      ? getBalconyOverrideView()
      : preserveViewDirection && sourceNode
        ? {
            yaw: preserveViewYawBetweenNodes(
              sourceNode,
              targetNode,
              currentPosition.yaw,
            ),
            pitch: currentPosition.pitch,
          }
        : null;
    pendingNodeViewRef.current = targetPosition;

    try {
      const completed = await virtualTour.setCurrentNode(targetId, {
        effect: "fade",
        showLoader: false,
        speed: interiorNodeTransitionSpeed,
        rotation: !targetPosition,
        rotateTo: targetPosition ?? undefined,
        zoomTo: targetPosition ? bindings.viewer.getZoomLevel() : undefined,
      });

      if (completed === false) {
        pendingNodeViewRef.current = null;
        setIsTransitioning(false);
      }
    } catch (error) {
      console.error("Failed to change interior pano node:", error);
      pendingNodeViewRef.current = null;
      setViewerError(`Failed to load ${getRoomLabel(targetNode.imageFilename, targetNode.id)}.`);
      setIsTransitioning(false);
    } finally {
      navigationInFlightRef.current = false;
    }
  }, [
    graph.byId,
    interiorNodeTransitionSpeed,
    isTransitioning,
    preserveViewDirection,
  ]);

  useEffect(() => {
    goToNodeRef.current = goToNode;
  }, [goToNode]);

  const navigateToDirection = useCallback(
    async (direction: NavigationDirection) => {
      const viewer = bindingsRef.current?.viewer;
      const source = graph.byId[activeNodeIdRef.current];
      if (!viewer || !source) return;
      // Clicks use the live camera direction, independently of the throttled UI.
      const targets = getViewRelativeNavigationTargets(
        graph, source, viewer.getPosition().yaw, panoOnly,
        blockedNavigationPairKeys, additionalNavigationPairs, navigationYawOverrides,
      );
      const target = targets[direction].node;
      if (!target) {
        return;
      }

      await goToNode(target.id);
    },
    [additionalNavigationPairs, blockedNavigationPairKeys, goToNode, graph, navigationYawOverrides, panoOnly],
  );

  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host) {
      return;
    }

    const navigateForward = () => {
      void navigateToDirection("forward");
    };

    const handleDoubleClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      navigateForward();
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

      const now = performance.now();
      const isDoubleTap =
        now - tapState.lastTapAt < 320 &&
        Math.hypot(event.clientX - tapState.lastTapX, event.clientY - tapState.lastTapY) <
          34;

      tapState.lastTapAt = now;
      tapState.lastTapX = event.clientX;
      tapState.lastTapY = event.clientY;

      if (isDoubleTap) {
        event.preventDefault();
        event.stopPropagation();
        tapState.lastTapAt = 0;
        navigateForward();
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
  }, [navigateToDirection]);

  useEffect(() => {
    if (requestedBareShellMode !== isBareShellMode) {
      const timer = globalThis.setTimeout(() => {
        applyModeChange(requestedBareShellMode);
      }, 0);

      return () => {
        globalThis.clearTimeout(timer);
      };
    }
  }, [applyModeChange, isBareShellMode, requestedBareShellMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mobileViewportMedia = window.matchMedia("(max-width: 767px)");
    const coarsePointerMedia = window.matchMedia("(pointer: coarse)");
    const anyCoarsePointerMedia = window.matchMedia("(any-pointer: coarse)");

    const syncMobileTouchViewport = () => {
      setIsMobileTouchViewport(
        mobileViewportMedia.matches &&
          (coarsePointerMedia.matches || anyCoarsePointerMedia.matches),
      );
    };

    syncMobileTouchViewport();
    mobileViewportMedia.addEventListener("change", syncMobileTouchViewport);
    coarsePointerMedia.addEventListener("change", syncMobileTouchViewport);
    anyCoarsePointerMedia.addEventListener("change", syncMobileTouchViewport);

    return () => {
      mobileViewportMedia.removeEventListener("change", syncMobileTouchViewport);
      coarsePointerMedia.removeEventListener("change", syncMobileTouchViewport);
      anyCoarsePointerMedia.removeEventListener(
        "change",
        syncMobileTouchViewport,
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateAvailableNodes = async () => {
      const candidates = allNodes.map((item) => {
        const { panoId, baseUrl } = getInteriorPanoSource(
          item.id, item.image_filename, {}, isBareShellMode,
          configuredBalconyNodeIds.has(item.id), panoBases,
        );
        return { item, panoId, baseUrl };
      });
      // Batch authorization once, then let the asset store retain parsed metadata.
      await getSignedAssetUrls(candidates.map(({ panoId, baseUrl }) => `${baseUrl}${panoId}/meta.json`));
      if (cancelled) return;
      const limit = pLimit(isSlowNetwork ? 2 : 6);
      const availability = await Promise.allSettled(candidates.map(({ item, panoId, baseUrl }) =>
        limit(async () => {
          if (cancelled) return null;
          const meta = await getAssetStoreForBaseUrl(baseUrl).getMeta(panoId);
          return canUseTiledPanorama(meta) ? { id: item.id, panoFolderId: panoId } : null;
        }),
      ));

      if (cancelled) {
        return;
      }

      const nextFolders: Record<string, string> = {};
      const nextIds = new Set<string>();

      availability.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          nextIds.add(result.value.id);
          nextFolders[result.value.id] = result.value.panoFolderId;
        }
      });

      setAvailablePanoFolders((previous) =>
        Object.keys(previous).length === Object.keys(nextFolders).length &&
        Object.entries(nextFolders).every(([id, folder]) => previous[id] === folder)
          ? previous : nextFolders,
      );
      setAvailableNodeIds((previous) => previous?.size === nextIds.size &&
        [...nextIds].every((id) => previous.has(id)) ? previous : nextIds);

    };

    void hydrateAvailableNodes().catch((error) => {
      if (!cancelled) {
        console.error("Failed to load interior panorama metadata:", error);
        setViewerError("Unable to load walkthrough. Please refresh to try again.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [allNodes, configuredBalconyNodeIds, getAssetStoreForBaseUrl, isBareShellMode, isSlowNetwork, panoBases]);

  useEffect(() => {
    activeNodeIdRef.current = activeNodeId;
  }, [activeNodeId]);

  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || isTransitioning) {
        return;
      }

      const bindings = bindingsRef.current;
      const viewer = bindings?.viewer;
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

      const position = viewer.getPosition();
      const nextYaw = wrapAngleRad(
        position.yaw +
          horizontalDelta * TRACKPAD_PANO_YAW_RADIANS_PER_PIXEL,
      );

      viewer.rotate({
        yaw: nextYaw,
        pitch: position.pitch,
      });
    };

    host.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      host.removeEventListener("wheel", handleWheel);
    };
  }, [isTransitioning]);

  useEffect(() => {
    currentNodeIdRef.current = currentNodeId;
  }, [currentNodeId]);

  useEffect(() => {
    isDimensionsVisibleRef.current = isDimensionsVisible;
  }, [isDimensionsVisible]);

  useEffect(() => {
    const bindings = bindingsRef.current;

    if (!bindings || !currentNodeId) {
      return;
    }

    syncNodeMarkers(bindings.viewer, currentNodeId);
  }, [currentNodeId, isDimensionsVisible, isBareShellMode, syncNodeMarkers]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    const nav = navigator as Navigator & {
      connection?: NetworkInformationLike;
      mozConnection?: NetworkInformationLike;
      webkitConnection?: NetworkInformationLike;
    };
    const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;

    if (!connection) {
      return;
    }

    const updateSlowNetworkState = () => {
      const effectiveType = connection.effectiveType?.toLowerCase() ?? "";
      setIsSlowNetwork(
        Boolean(connection.saveData) ||
          effectiveType === "slow-2g" ||
          effectiveType === "2g" ||
          effectiveType === "3g",
      );
    };

    updateSlowNetworkState();
    connection.addEventListener?.("change", updateSlowNetworkState);

    return () => {
      connection.removeEventListener?.("change", updateSlowNetworkState);
    };
  }, []);

  useEffect(() => {
    const viewer = bindingsRef.current?.viewer;
    const node = graph.byId[currentNodeId];
    if (!viewer || !node || isTransitioning || !readyPanoramaVersion) return;
    let cancelled = false;
    const runId = ++warmupRunRef.current;
    const shouldContinue = () => !cancelled && warmupRunRef.current === runId && bindingsRef.current?.viewer === viewer;

    const warmNeighbors = async () => {
      const position = viewer.getPosition();
      const targets = getViewRelativeNavigationTargets(graph, node, position.yaw, panoOnly,
        blockedNavigationPairKeys, additionalNavigationPairs, navigationYawOverrides);
      const connected = getConnectedNavigationCandidates(graph, node, blockedNavigationPairKeys, additionalNavigationPairs);
      const ids = [...new Set([targets.forward.node?.id, ...connected.map((neighbor) => neighbor.id)]
        .filter((id): id is string => Boolean(id)))].slice(0, isSlowNetwork ? 1 : 2);
      for (const id of ids) {
        if (!shouldContinue()) return;
        try {
          const resolved = await resolvePano(id, { preferTiles: !isSlowNetwork });
          if (!shouldContinue()) return;
          // Use PSV's decoded-image cache, including the same panorama cache key.
          await viewer.textureLoader.loadImage(resolved.previewUrl, undefined, resolved.previewUrl);
          if (!shouldContinue() || isSlowNetwork) continue;
          const target = graph.byId[id];
          const yaw = preserveViewDirection
            ? preserveViewYawBetweenNodes(node, target, position.yaw) : 0;
          const tiles = selectPriorityTiles(resolved.panoId, resolved.meta, resolved.baseUrl,
            { yaw, pitch: preserveViewDirection ? position.pitch : 0, zoom: viewer.getZoomLevel() }, 4);
          const panorama = resolved.panorama;
          const tileLimit = pLimit(2);
          await Promise.allSettled(tiles.map((tile) => tileLimit(async () => {
            if (!shouldContinue() || typeof panorama === "string") return;
            const url = panorama.tileUrl(tile.col, tile.row);
            if (url) await viewer.textureLoader.loadImage(url, undefined, resolved.previewUrl);
          })));
        } catch (error) {
          if (shouldContinue()) console.debug("Interior neighbor prefetch skipped:", error);
        }
      }
    };
    // Let the active panorama's visible tiles take priority over speculative work.
    const timer = globalThis.setTimeout(() => { void warmNeighbors(); }, isSlowNetwork ? 700 : 350);
    return () => { cancelled = true; globalThis.clearTimeout(timer); };
  }, [additionalNavigationPairs, blockedNavigationPairKeys, currentNodeId, graph, isSlowNetwork,
    isTransitioning, navigationYawOverrides, panoOnly, preserveViewDirection, readyPanoramaVersion, resolvePano]);

  useEffect(() => {
    if (!viewerHostRef.current || !graph.nodes.length) {
      return;
    }

    let disposed = false;
    let initTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    let detachMarkerSelectListener: (() => void) | null = null;
    let detachViewerListeners: (() => void) | null = null;
    let positionUpdateTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    let latestYaw = 0;

    const initializeViewer = async () => {
      const startNodeId = currentNodeIdRef.current;
      if (disposed || !viewerHostRef.current) return;

      setViewerError(null);
      viewerHostRef.current.replaceChildren();

      const viewer = new Viewer({
        container: viewerHostRef.current,
        adapter: EquirectangularTilesAdapter.withConfig({
          resolution: isSlowNetwork || isMobileTouchViewport
            ? INTERIOR_SLOW_SPHERE_RESOLUTION
            : INTERIOR_SPHERE_RESOLUTION,
          showErrorTile: false,
          baseBlur: true,
          antialias: true,
        }),
        navbar: false,
        touchmoveTwoFingers: false,
        mousewheelCtrlKey: false,
        defaultYaw: "0deg",
        defaultZoomLvl: DEFAULT_ZOOM,
        minFov: INTERIOR_MIN_FOV,
        maxFov: INTERIOR_MAX_FOV,
        moveSpeed: interiorViewerMoveSpeed,
        moveInertia: interiorViewerMoveInertia,
        rendererParameters: {
          antialias: true,
          powerPreference: "high-performance",
        },
        plugins: [
          MarkersPlugin,
          ...(canUseDeviceOrientation() ? [GyroscopePlugin] : []),
        //    AutorotatePlugin.withConfig({
        //     autorotatePitch: '5deg',
        //     autostartDelay: 9000,
        // }),
          VirtualTourPlugin.withConfig({
            positionMode: "manual",
            renderMode: "3d",
            dataMode: "server",
            getNode: async (nodeId: string) => {
              const node = graph.byId[nodeId];
              if (!node) throw new Error(`Unknown interior node: ${nodeId}`);
              return buildTourNode(node, { preferTiles: true });
            },
            preload: false,
            transitionOptions: {
              effect: "fade",
              showLoader: false,
              speed: interiorNodeTransitionSpeed,
              rotation: true,
            },
            linksOnCompass: false,
          }),
        ],
      });

      const virtualTour = viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin);
      const handleNodeChanged = ({ node }: { node: VirtualTourNode }) => {
        const pendingNodeView = pendingNodeViewRef.current;
        if (pendingNodeView) {
          viewer.rotate(pendingNodeView);
          pendingNodeViewRef.current = null;
        }
        syncNodeMarkers(viewer, node.id);
        activeNodeIdRef.current = node.id;
        currentNodeIdRef.current = node.id;
        latestYaw = viewer.getPosition().yaw;
        if (positionUpdateTimer !== null) {
          globalThis.clearTimeout(positionUpdateTimer);
          positionUpdateTimer = null;
        }
        setActiveNodeId(node.id);
        setViewYaw(latestYaw);
        navigationInFlightRef.current = false;
        setReadyPanoramaVersion((version) => version + 1);
        setViewerError(null);
        setIsTransitioning(false);
      };
      const handlePanoramaError = () => {
        navigationInFlightRef.current = false;
        setViewerError("Panorama failed to load.");
        setIsTransitioning(false);
      };
      const handlePositionUpdated = (event: Event) => {
        const position = (event as Event & { position?: Position }).position;
        if (!position) return;
        latestYaw = position.yaw;
        // Rendering remains at the viewer's frame rate; only React controls are throttled.
        if (positionUpdateTimer === null) {
          positionUpdateTimer = globalThis.setTimeout(() => {
            positionUpdateTimer = null;
            if (!disposed) setViewYaw(latestYaw);
          }, 80);
        }
      };
      const handleMarkerSelect = (event: Event) => {
        const targetNodeId = (
          event as Event & { marker?: { data?: { targetNodeId?: string } } }
        ).marker?.data?.targetNodeId;

        if (targetNodeId) {
          void goToNodeRef.current(targetNodeId);
        }
      };

      virtualTour.addEventListener(virtualTourEvents.NodeChangedEvent.type, handleNodeChanged);
      viewer.addEventListener(viewerEvents.PanoramaErrorEvent.type, handlePanoramaError);
      viewer.addEventListener(viewerEvents.PositionUpdatedEvent.type, handlePositionUpdated);
      detachViewerListeners = () => {
        virtualTour.removeEventListener(virtualTourEvents.NodeChangedEvent.type, handleNodeChanged);
        viewer.removeEventListener(viewerEvents.PanoramaErrorEvent.type, handlePanoramaError);
        viewer.removeEventListener(viewerEvents.PositionUpdatedEvent.type, handlePositionUpdated);
      };
      const markersPlugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);
      markersPlugin?.addEventListener(
        markerEvents.SelectMarkerEvent.type,
        handleMarkerSelect,
      );
      detachMarkerSelectListener = () => {
        markersPlugin?.removeEventListener(
          markerEvents.SelectMarkerEvent.type,
          handleMarkerSelect,
        );
      };

      bindingsRef.current = { viewer };
      await virtualTour.setCurrentNode(startNodeId, { effect: "none", rotation: false });
    };

    initTimer = globalThis.setTimeout(() => {
      void initializeViewer().catch((error) => {
        if (disposed) return;
        navigationInFlightRef.current = false;
        console.error("Failed to initialize interior pano viewer:", error);
        setViewerError("Viewer failed to initialize.");
        setIsTransitioning(false);
      });
    }, 0);

    return () => {
      disposed = true;
      if (initTimer) {
        globalThis.clearTimeout(initTimer);
      }

      if (positionUpdateTimer !== null) globalThis.clearTimeout(positionUpdateTimer);
      detachViewerListeners?.();
      const bindings = bindingsRef.current;
      if (bindings) {
        detachMarkerSelectListener?.();
        bindings.viewer.destroy();
        bindingsRef.current = null;
      }
    };
  }, [
    buildTourNode,
    graph,
    interiorNodeTransitionSpeed,
    interiorViewerMoveInertia,
    interiorViewerMoveSpeed,
    isMobileTouchViewport,
    isSlowNetwork,
    syncNodeMarkers,
  ]);

  if (availableNodeIds === null) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-white/10 bg-black/30 text-white/70">
        {viewerError ?? "Loading Walkthrough. Please Wait"}
      </div>
    );
  }

  if (!graph.nodes.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-white/10 bg-black/30 text-white/70">
        No interior panoramas found.
      </div>
    );
  }

  return (
    <section
      className={`interior-pano-walkthrough relative isolate h-full w-full overflow-hidden rounded-[2.25rem] border border-white/10 bg-black text-white  ${className ?? ""}`}
    >
      {INTERIOR_PANO_DEV_TOOL_ENABLED && activeNode ? (
        <aside
          aria-label="Current panorama developer information"
          className="interior-pano-dev-overlay absolute bottom-4 left-4 z-30 max-w-[calc(100%-2rem)] select-text rounded-xl border border-white/20 bg-black/70 px-3 py-2 font-mono text-[11px] leading-5 text-white backdrop-blur-md"
        >
          <div className="text-[10px] uppercase tracking-wider text-amber-200">
            Pano dev · {buildNodeModeLabel(isBareShellMode)}
          </div>
          <div className="break-all">Pano: {activeNode.imageFilename}</div>
          <div className="break-all text-white/65">Node: {activeNode.id}</div>
        </aside>
      ) : null}

      {/* {walkthroughContext.flatNumber ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex justify-center sm:top-5">
          <div className={`${uiFont.className} rounded-[1.35rem] border border-white/16 bg-[rgba(14,20,27,0.58)] px-4 py-3 text-center text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl`}>
            <div className="text-[10px] uppercase tracking-[0.26em] text-white/56">
              Requested Residence
            </div>
            <div className="mt-1 text-sm font-semibold tracking-[0.04em] text-white">
              Flat {walkthroughContext.flatNumber}
              {walkthroughContext.tower ? ` • ${walkthroughContext.tower}` : ""}
              {walkthroughContext.floorLabel
                ? ` • Floor ${walkthroughContext.floorLabel}`
                : ""}
              {walkthroughContext.bhk ? ` • ${walkthroughContext.bhk} BHK` : ""}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">
              Representative walkthrough
            </div>
          </div>
        </div>
      ) : null} */}

      <div className="absolute inset-0">
        <div
          ref={viewerHostRef}
          className="h-full w-full select-none [touch-action:none] [-webkit-user-drag:none] [-webkit-user-select:none]"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,18,24,0.18)_0%,rgba(11,18,24,0.03)_22%,rgba(11,18,24,0.05)_68%,rgba(11,18,24,0.22)_100%)]" />
        <div
          className={`pointer-events-none absolute inset-0 bg-black/10 transition-opacity duration-200 ${
            isTransitioning ? "opacity-100" : "opacity-0"
          }`}
        />
        {viewerError ? (
          <div className="pointer-events-none absolute inset-x-4 top-20 z-20 flex justify-center sm:top-28">
            <div className={`${uiFont.className} rounded-full border border-[#ffb3b3]/30 bg-[rgba(38,10,10,0.58)] px-4 py-2 text-xs font-medium tracking-[0.12em] text-[#ffd4d4] backdrop-blur-xl`}>
              {viewerError}
            </div>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute left-0 top-0 z-30 flex flex-col gap-2 p-3 sm:p-6">
        {!panoOnly ? (
          <button
            type="button"
            aria-label="Open room index"
            onClick={() => setIsMenuOpen(true)}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(189,202,211,0.06))] text-white shadow-[0_16px_34px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition hover:border-white/34 hover:bg-white/12"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {showMinimap ? (
        <div className="interior-minimap-desktop pointer-events-none absolute right-4 top-[1.5rem] z-30 hidden w-[400px] xl:block 2xl:right-6 2xl:top-[2rem] 2xl:w-[460px]">
        <div className={panoOnly ? "pointer-events-auto ml-auto w-[320px] 2xl:w-[360px]" : "pointer-events-auto rounded-[1.6rem] p-3"}>
          <InteriorFloorPlanMinimap
            image={minimapImage}
            points={minimapPoints}
            isTransitioning={isTransitioning}
            onPointSelect={(nodeId) => {
              setPreferredFrame(null);
              void goToNode(nodeId);
            }}
            isCalibrationMode={isMinimapCalibrationMode}
            onPointMove={handleMinimapPointMove}
            className={panoOnly ? "ml-auto w-[320px] 2xl:w-[360px]" : "mx-auto mb-3 w-[210px] 2xl:w-[280px]"}
          />

          {isMinimapCalibrationMode ? (
            <div className={`${uiFont.className} ml-auto mt-3 w-full rounded-xl border border-amber-100/30 bg-black/55 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-50 backdrop-blur-xl`}>
              <div>Calibration mode: drag any dot.</div>
              <div className="mt-2 flex gap-2 normal-case tracking-normal">
                <button
                  type="button"
                  onClick={copyMinimapCalibration}
                  className="rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-white transition hover:bg-white/20"
                >
                  Copy placed dots
                </button>
                <button
                  type="button"
                  onClick={() => setCalibratedMinimapPointPositions({})}
                  className="rounded-lg border border-white/18 px-2 py-1 text-white/78 transition hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}

          {showModeToggle ? <button
            type="button"
            onClick={handleModeToggle}
            className={`${uiFont.className} mt-3 flex w-full items-center justify-center gap-2 rounded-[1.1rem] border border-white/38 bg-white/[0.07] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.14)] backdrop-blur-xl transition hover:border-white/58 hover:bg-white/[0.13]`}
          >
            {isBareShellMode ? <Sofa className="h-4 w-4" /> : <BedDouble className="h-4 w-4" />}
            {isBareShellMode ? "View Furnished" : "View Bare Shell"}
          </button> : null}

          {showDimensionsToggle ? <button
            type="button"
            onClick={handleDimensionsToggle}
            className={`${uiFont.className} mt-3 flex w-full items-center justify-center rounded-[1.25rem] border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] shadow-[0_16px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition ${
              isDimensionsVisible
                ? "border-[#ecd1a0]/40 bg-[linear-gradient(180deg,rgba(255,244,224,0.22),rgba(206,175,120,0.12))] text-[#fff3da] hover:border-[#f3dbb0]/54 hover:bg-[linear-gradient(180deg,rgba(255,244,224,0.26),rgba(206,175,120,0.16))]"
                : "border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(171,188,196,0.05))] text-white hover:border-white/30 hover:bg-white/12"
            }`}
          >
            {isDimensionsVisible ? "Hide Dimensions" : "Show Dimensions"}
          </button> : null}

        </div>
        </div>
      ) : null}

      {showMinimap ? (
        <div className="interior-minimap-compact pointer-events-auto absolute right-3 top-3 z-30 w-[min(12rem,calc(100%-1.5rem))] overflow-y-auto overscroll-contain sm:w-60 xl:hidden">
          <InteriorFloorPlanMinimap
            image={minimapImage}
            points={minimapPoints}
            isTransitioning={isTransitioning}
            onPointSelect={(nodeId) => {
              setPreferredFrame(null);
              void goToNode(nodeId);
            }}
            isCalibrationMode={isMinimapCalibrationMode}
            onPointMove={handleMinimapPointMove}
            className="w-full"
          />
          {isMinimapCalibrationMode ? (
            <div className={`${uiFont.className} pointer-events-auto mt-2 w-full rounded-lg border border-amber-100/30 bg-black/55 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-50 backdrop-blur-xl`}>
              <div>Drag dots, then copy.</div>
              <div className="mt-1 flex gap-1.5 normal-case tracking-normal">
                <button
                  type="button"
                  onClick={copyMinimapCalibration}
                  className="rounded-md border border-white/25 bg-white/10 px-1.5 py-1 text-white"
                >
                  Copy placed dots
                </button>
                <button
                  type="button"
                  onClick={() => setCalibratedMinimapPointPositions({})}
                  className="rounded-md border border-white/18 px-1.5 py-1 text-white/78"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}
          {showModeToggle ? (
            <button
              type="button"
              onClick={handleModeToggle}
              className={`${uiFont.className} pointer-events-auto mt-2 flex min-h-11 w-full touch-manipulation items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/45 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(18,24,30,0.42))] px-2 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-xl backdrop-saturate-150 transition hover:border-white/65 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.24),rgba(18,24,30,0.5))]`}
            >
              {isBareShellMode ? <Sofa className="h-3.5 w-3.5" /> : <BedDouble className="h-3.5 w-3.5" />}
              {isBareShellMode ? "View Furnished" : "View Bare Shell"}
            </button>
          ) : null}
          {showDimensionsToggle ? (
            <button
              type="button"
              onClick={handleDimensionsToggle}
              aria-pressed={isDimensionsVisible}
              className={`${uiFont.className} pointer-events-auto mt-2 flex min-h-11 w-full touch-manipulation items-center justify-center overflow-hidden rounded-xl border px-2 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-xl backdrop-saturate-150 transition ${
                isDimensionsVisible
                  ? "border-[#ecd1a0]/65 bg-[linear-gradient(135deg,rgba(236,209,160,0.28),rgba(55,43,24,0.5))]"
                  : "border-white/45 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(18,24,30,0.42))] hover:border-white/65 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.24),rgba(18,24,30,0.5))]"
              }`}
            >
              {isDimensionsVisible ? "Hide Dimensions" : "Show Dimensions"}
            </button>
          ) : null}
        </div>
      ) : null}

      {!panoOnly && isMenuOpen ? (
        <div className="absolute inset-0 z-40 flex pointer-events-auto">
          <button
            type="button"
            aria-label="Close room index"
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 bg-[rgba(14,20,27,0.22)] transition duration-200 xl:bg-[rgba(14,20,27,0.12)]"
          />

          <div className="relative m-2 flex w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] self-start flex-col border-r border-white/14 bg-[linear-gradient(180deg,rgba(144,155,164,0.16)_0%,rgba(116,127,136,0.1)_100%)] p-4 text-white shadow-[0_24px_64px_rgba(0,0,0,0.16)] backdrop-blur-[24px] transition duration-300 sm:m-4 sm:w-[28rem] sm:max-h-[calc(100dvh-2rem)] xl:mb-6 xl:ml-6 xl:mr-0 xl:mt-24 xl:w-[24rem] xl:max-h-[min(58dvh,calc(100dvh-8rem))] xl:overflow-hidden xl:rounded-[2rem] xl:border xl:border-white/18 xl:bg-[linear-gradient(180deg,rgba(165,176,184,0.18)_0%,rgba(120,134,142,0.12)_100%)] 2xl:max-h-[min(60dvh,calc(100dvh-8rem))]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`${uiFont.className} text-[10px] uppercase tracking-[0.32em] text-white/55`}>
                  {buildNodeModeLabel(isBareShellMode)}
                </div>
                <div className={`${editorialFont.className} mt-2 text-[2rem] leading-none text-white`}>
                  Rooms
                </div>
                {/* <p className={`${uiFont.className} mt-2 max-w-[18rem] text-sm leading-5 text-white/72`}>
                  Browse rooms from a very light glass panel and jump instantly to any panorama.
                </p> */}
              </div>
              <button
                type="button"
                aria-label="Close room index"
                onClick={() => setIsMenuOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/18 bg-white/10 text-white transition hover:border-white/28 hover:bg-white/14"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="mt-5 xl:hidden">
              <div className="mx-auto w-full max-w-[16rem] rounded-[1.45rem] sm:max-w-[18rem]">
                <button
                  type="button"
                  onClick={handleModeToggle}
                  className={`${uiFont.className} mt-3 flex w-full items-center justify-center gap-2 rounded-[1.15rem] border border-white/22 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(171,188,196,0.06))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white shadow-[0_14px_28px_rgba(0,0,0,0.16)] backdrop-blur-2xl transition hover:border-white/34 hover:bg-white/12`}
                >
                  {isBareShellMode ? <Sofa className="h-4 w-4" /> : <BedDouble className="h-4 w-4" />}
                  {isBareShellMode ? "View Furnished" : "View Bare Shell"}
                </button>

                <button
                  type="button"
                  onClick={handleDimensionsToggle}
                  className={`${uiFont.className} mt-3 flex w-full items-center justify-center rounded-[1.15rem] border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] shadow-[0_14px_28px_rgba(0,0,0,0.16)] backdrop-blur-2xl transition ${
                    isDimensionsVisible
                      ? "border-[#ecd1a0]/40 bg-[linear-gradient(180deg,rgba(255,244,224,0.22),rgba(206,175,120,0.12))] text-[#fff3da] hover:border-[#f3dbb0]/54 hover:bg-[linear-gradient(180deg,rgba(255,244,224,0.26),rgba(206,175,120,0.16))]"
                      : "border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(171,188,196,0.05))] text-white hover:border-white/30 hover:bg-white/12"
                  }`}
                >
                  {isDimensionsVisible ? "Hide Dimensions" : "Show Dimensions"}
                </button>
              </div>
            </div>

            <div
              ref={setRoomMenuScrollAreaNode}
              className="custom-scrollbar mt-5 min-h-0 overflow-y-auto overscroll-contain pr-2 snap-y snap-mandatory"
              style={
                roomMenuViewportHeight
                  ? { height: `${roomMenuViewportHeight}px` }
                  : undefined
              }
            >
              <div ref={setRoomMenuListNode} className="space-y-3 pb-2">
                {menuRooms.map((room, index) => {
                  const isActive = room.id === currentNodeId;
                  return (
                    <button
                      key={room.id}
                      ref={index === 0 ? setRoomMenuFirstItemNode : undefined}
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setPreferredFrame(null);
                        void goToNode(room.id);
                      }}
                      className={`group flex w-full snap-start snap-always items-center gap-3 rounded-[1.4rem] border p-2.5 text-left shadow-[0_12px_30px_rgba(0,0,0,0.1)] transition ${
                        isActive
                          ? "border-[#7fd9d5]/34 bg-[linear-gradient(135deg,rgba(175,223,223,0.16),rgba(88,122,131,0.12))]"
                          : "border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(181,197,204,0.05))] hover:border-white/22 hover:bg-white/10"
                      }`}
                    >
                      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[1rem] border border-white/18 bg-white/8">
                        <NextImage
                          src={
                            signedMenuRoomImages[room.image] ??
                            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
                          }
                          alt={room.label}
                          fill
                          sizes="96px"
                          unoptimized
                          className="object-cover object-center transition duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-white">{room.label}</div>
                        <div className="mt-1 text-sm leading-5 text-white/72">
                          {isActive
                            ? "You are currently inside this room."
                            : "Tap to switch the panorama view to this room."}
                        </div>
                        <div className={`${uiFont.className} mt-2 text-[10px] uppercase tracking-[0.28em] text-white/48`}>
                          {isActive ? "Current" : "Open"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="interior-navigation-controls pointer-events-auto absolute z-20">
        <div className="interior-direction-rail flex flex-col items-center gap-1.5 rounded-full p-1.5 sm:gap-2 sm:p-2">
          <ArrowButton
            icon={ArrowUp}
            label="Move forward"
            onClick={() => void navigateToDirection("forward")}
            disabled={!navigationTargets.forward.node || isTransitioning}
          />
          <ArrowButton
            icon={ArrowLeft}
            label="Move left"
            onClick={() => void navigateToDirection("left")}
            disabled={!navigationTargets.left.node || isTransitioning}
          />
          <ArrowButton
            icon={ArrowRight}
            label="Move right"
            onClick={() => void navigateToDirection("right")}
            disabled={!navigationTargets.right.node || isTransitioning}
          />
          <ArrowButton
            icon={ArrowDown}
            label="Move back"
            onClick={() => void navigateToDirection("backward")}
            disabled={!navigationTargets.backward.node || isTransitioning}
          />
        </div>
      </div>

      <style jsx global>{`
        @keyframes walkthroughMinimapPulse {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(0.92);
          }

          50% {
            opacity: 0.88;
            transform: scale(1.18);
          }
        }

        .interior-pano-walkthrough .psv-navbar,
        .interior-pano-walkthrough .psv-virtual-tour-arrows {
          display: none !important;
        }

        .interior-navigation-controls {
          right: 1.25rem;
          top: 50%;
          transform: translateY(-50%);
        }

        .interior-minimap-compact {
          max-height: calc(
            100% - max(0.75rem, env(safe-area-inset-bottom)) - 5.25rem
          );
        }

        .interior-direction-rail {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(3, 5, 4, 0.62);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            0 16px 36px rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(20px) saturate(1.16);
        }

        .interior-direction-button {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(4, 6, 5, 0.68);
        }

        @media (max-width: 1279px), (max-height: 850px) {
          .interior-pano-walkthrough .interior-minimap-desktop {
            display: none;
          }

          .interior-pano-walkthrough .interior-minimap-compact {
            display: block;
          }

          .interior-pano-walkthrough .interior-navigation-controls {
            top: auto;
            right: auto;
            bottom: max(0.75rem, env(safe-area-inset-bottom));
            left: 50%;
            transform: translateX(-50%);
          }

          .interior-pano-walkthrough .interior-direction-rail {
            flex-direction: row;
          }

          .interior-pano-walkthrough .interior-pano-dev-overlay {
            bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.5rem);
          }
        }

        @media (hover: hover) and (pointer: fine) {
          .interior-direction-button:hover:not(:disabled) {
            border-color: rgba(255, 255, 255, 0.22);
            background: rgba(8, 11, 9, 0.72);
          }
        }
      `}</style>
    </section>
  );
}
