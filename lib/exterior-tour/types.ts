import type { Vec3 } from "@/lib/exterior-tour/math";

export type ExteriorVector = Vec3;

export type ExteriorPanoNodeSource = {
  id: string;
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
  frame?: number;
  image_filename: string;
  facing_axis?: string;
  forward_vector?: ExteriorVector;
  right_vector?: ExteriorVector;
  left_vector?: ExteriorVector;
};

export type ExteriorTourNeighbor = {
  id: string;
  distance: number;
  direction: ExteriorVector;
  alignment: number;
};

export type ExteriorTourNode = {
  id: string;
  order: number;
  panoId: string;
  label: string;
  imageFilename: string;
  rawPosition: ExteriorVector;
  forward: ExteriorVector;
  right: ExteriorVector;
  left: ExteriorVector;
  pitch: number;
  yaw: number;
  roll: number;
  facingAxis?: string;
  nearestDistance: number;
  neighbors: ExteriorTourNeighbor[];
};

export type ExteriorTourGraph = {
  nodes: ExteriorTourNode[];
  byId: Record<string, ExteriorTourNode>;
  order: string[];
  medianNearestDistance: number;
};

export type NavigationDirection = "forward" | "left" | "right" | "backward";

export type DirectionalNavTarget = {
  direction: NavigationDirection;
  node: ExteriorTourNode | null;
  score: number;
};

export type DirectionalNavMap = Record<NavigationDirection, DirectionalNavTarget>;

export type PanoMeta = {
  width: number;
  height: number;
  cols: number;
  rows: number;
  actualCols?: number;
  actualRows?: number;
  tileSize?: number;
  tileWidth?: number;
  tileHeight?: number;
  preview?: string;
  tileFormat?: string;
  tileUrl?: string;
  tiles?: Array<{
    col: number;
    row: number;
    file: string;
  }>;
};

export type PanoTileDescriptor = {
  key: string;
  col: number;
  row: number;
  url: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PanoViewState = {
  yaw: number;
  pitch: number;
  zoom: number;
};

export type PanoLoadState = {
  phase: "idle" | "preview" | "detail" | "ready" | "error";
  detailProgress: number;
  message: string;
};
