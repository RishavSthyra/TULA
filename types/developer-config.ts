import type { ExteriorAmenity } from "@/data/exteriorAmenities";
import type { AmenitiesPageData } from "@/components/amenities/AmenitiesPageClient";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";

export type DeveloperConfigSection =
  | "home"
  | "master-plan"
  | "interior"
  | "exterior"
  | "amenities"
  | "fallback-assets";

export type R2AssetKey = string;

export type Vector3Config = {
  x: number;
  y: number;
  z: number;
};

export type QuaternionConfig = [number, number, number, number];

export type MasterPlanCameraConfig = {
  position: Vector3Config;
  quaternion: QuaternionConfig;
  fov: number;
};

export type TowerDummyAnchors = {
  dummy1: Vector3Config;
  dummy2: Vector3Config;
  dummy3: Vector3Config;
  dummy4: Vector3Config;
};

export type MasterPlanHotspotConfig = {
  key: string;
  frame: number;
  camera: MasterPlanCameraConfig;
};

export type HomeDeveloperConfig = {
  entryVideoKey: R2AssetKey;
  heroVideoKey: R2AssetKey;
  heroLoopVideoKey: R2AssetKey;
  heroMobileFallbackKey: R2AssetKey;
  heroStageFallbackKey: R2AssetKey;
  heroPosterKey: R2AssetKey;
  heroLogoKey: R2AssetKey;
  masterPlanWarmupVideoKey: R2AssetKey;
};

export type MasterPlanDeveloperConfig = {
  renderer: "unreal" | "3ds-max-vantage";
  scrubVideoKey: R2AssetKey;
  interactionVideoKey: R2AssetKey;
  hlsPath?: string;
  fallbackImageKey: R2AssetKey;
  totalFrames: number;
  fps: number;
  aspectRatio: number;
  hotspotFrames: number[];
  hotspots: MasterPlanHotspotConfig[];
  towerAModelKey: R2AssetKey;
  towerBModelKey: R2AssetKey;
  towerAWorldDummies: TowerDummyAnchors;
  towerBWorldDummies: TowerDummyAnchors;
  towerACameras: Record<string, MasterPlanCameraConfig>;
  towerBCameras: Record<string, MasterPlanCameraConfig>;
  towerATransform: {
    position: [number, number, number];
    quaternion: QuaternionConfig;
    scale: number;
  };
  towerBTransform: {
    position: [number, number, number];
    quaternion: QuaternionConfig;
    scale: number;
  };
  unitViewVideos: Record<
    string,
    {
      forwardKey: R2AssetKey;
      reverseKey: R2AssetKey;
    }
  >;
  topViewVideoUrl?: string;
};

export type InteriorDeveloperConfig = {
  furnishedPanoBasePath: string;
  bareShellPanoBasePath: string;
  balconyPanoBasePath: string;
  furnishedNodes: ExteriorPanoNodeSource[];
  bareShellNodes: ExteriorPanoNodeSource[];
  balconyNodes?: ExteriorPanoNodeSource[];
  furnishedInitialNodeId?: string;
  bareShellInitialNodeId?: string;
  furnishedMinimapKey?: R2AssetKey;
  bareShellMinimapKey?: R2AssetKey;
  fallbackImageKey?: R2AssetKey;
};

export type ExteriorDeveloperConfig = {
  panoBasePath: string;
  nodes: ExteriorPanoNodeSource[];
  initialNodeId?: string;
  initialPreviewKey?: R2AssetKey;
  minimapKey?: R2AssetKey;
  fallbackImageKey?: R2AssetKey;
  title: string;
  subtitle: string;
};

export type AmenitiesDeveloperConfig = {
  pageData: AmenitiesPageData;
  exteriorAmenities: ExteriorAmenity[];
};

export type FallbackAssetsDeveloperConfig = {
  masterPlanStageFallbackKey: R2AssetKey;
  exteriorMinimapFallbackKey: R2AssetKey;
  interiorFallbackKey?: R2AssetKey;
  homeFallbackKey: R2AssetKey;
};

export type DeveloperRuntimeConfig = {
  version: number;
  publishedAt?: string;
  home: HomeDeveloperConfig;
  masterPlan: MasterPlanDeveloperConfig;
  interior: InteriorDeveloperConfig;
  exterior: ExteriorDeveloperConfig;
  amenities: AmenitiesDeveloperConfig;
  fallbackAssets: FallbackAssetsDeveloperConfig;
};

export type DeveloperConfigSectionMap = {
  home: HomeDeveloperConfig;
  "master-plan": MasterPlanDeveloperConfig;
  interior: InteriorDeveloperConfig;
  exterior: ExteriorDeveloperConfig;
  amenities: AmenitiesDeveloperConfig;
  "fallback-assets": FallbackAssetsDeveloperConfig;
};
