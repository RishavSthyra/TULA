import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import amenitiesPageData from "@/data/amenitiesPage.json";
import { exteriorAmenities } from "@/data/exteriorAmenities";
import exteriorNodes from "@/data/TULA Landscape 20082026 PANO_pano_walkthrough_data_2.json";
import furnishedInteriorNodes from "@/data/trifecta_pano_walkthrough_data_Interior_final.json";
import bareShellInteriorNodes from "@/data/trifecta_pano_walkthrough_data_BareShell.json";
import trackingData from "@/data/trifecta_unreal_tracking_data.json";
import precomputedSceneData from "@/data/precomputedSceneData.json";
import {
  DeveloperAmenitiesConfig,
  DeveloperConfigRevision,
  DeveloperExteriorTourConfig,
  DeveloperFallbackAssetConfig,
  DeveloperHomeConfig,
  DeveloperInteriorTourConfig,
  DeveloperMasterPlanConfig,
  DeveloperPublishedRuntimeConfig,
  type DeveloperSectionDocument,
} from "@/models/DeveloperConfig";
import { connectToDatabase } from "@/lib/mongodb";
import type { AmenitiesPageData } from "@/components/amenities/AmenitiesPageClient";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import type {
  DeveloperConfigSection,
  DeveloperConfigSectionMap,
  DeveloperRuntimeConfig,
  MasterPlanCameraConfig,
  MasterPlanDeveloperConfig,
  TowerDummyAnchors,
  Vector3Config,
} from "@/types/developer-config";
import type { Model } from "mongoose";

export const DEVELOPER_RUNTIME_CONFIG_TAG = "developer-runtime-config";
const GLOBAL_CONFIG_KEY = "global";
const PUBLISHED_CONFIG_KEY = "published";
const MASTER_PLAN_HOTSPOT_KEYS = ["A1", "A2", "A3", "A4"] as const;
const MASTER_PLAN_HOTSPOT_FRAMES = [1, 91, 181, 271] as const;

type TrackingEntry = {
  camera?: {
    position?: Vector3Config;
  };
  dummies?: Record<string, Vector3Config>;
};

type StoredModel = Model<DeveloperSectionDocument>;

const sectionModels: Record<DeveloperConfigSection, StoredModel> = {
  home: DeveloperHomeConfig,
  "master-plan": DeveloperMasterPlanConfig,
  interior: DeveloperInteriorTourConfig,
  exterior: DeveloperExteriorTourConfig,
  amenities: DeveloperAmenitiesConfig,
  "fallback-assets": DeveloperFallbackAssetConfig,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asVector3(value: unknown): Vector3Config {
  const point = value as Partial<Vector3Config> | undefined;
  return {
    x: Number(point?.x ?? 0),
    y: Number(point?.y ?? 0),
    z: Number(point?.z ?? 0),
  };
}

function getTowerDummies(prefix: "dummy_Ta" | "dummy_Tb"): TowerDummyAnchors {
  const entry = (trackingData as Record<string, TrackingEntry>).A1;
  const dummies = entry?.dummies ?? {};

  return {
    dummy1: asVector3(dummies[`${prefix}1`]),
    dummy2: asVector3(dummies[`${prefix}2`]),
    dummy3: asVector3(dummies[`${prefix}3`]),
    dummy4: asVector3(dummies[`${prefix}4`]),
  };
}

function getCamera(tower: "A" | "B", key: string): MasterPlanCameraConfig {
  const scene = precomputedSceneData as unknown as Record<
    "A" | "B",
    { camera: Record<string, { position: [number, number, number]; quaternion: [number, number, number, number]; fov: number }> }
  >;
  const camera = scene[tower].camera[key] ?? scene.A.camera.A1;

  return {
    position: { x: camera.position[0], y: camera.position[1], z: camera.position[2] },
    quaternion: camera.quaternion,
    fov: camera.fov,
  };
}

function getCameraMap(tower: "A" | "B") {
  return Object.fromEntries(
    MASTER_PLAN_HOTSPOT_KEYS.map((key) => [key, getCamera(tower, key)]),
  );
}

const defaultMasterPlanConfig: MasterPlanDeveloperConfig = {
  renderer: "unreal",
  scrubVideoKey: "videos/360_scrub_optimized_g3.mp4",
  interactionVideoKey: "videos/360_scrub_optimized_g3.mp4",
  hlsPath: "/master-plan-scrub/hq/index.m3u8",
  fallbackImageKey: "images/first_frame_again.png",
  totalFrames: 360,
  fps: 60,
  aspectRatio: 3840 / 2560,
  hotspotFrames: [...MASTER_PLAN_HOTSPOT_FRAMES],
  hotspots: MASTER_PLAN_HOTSPOT_KEYS.map((key, index) => ({
    key,
    frame: MASTER_PLAN_HOTSPOT_FRAMES[index],
    camera: getCamera("A", key),
  })),
  towerAModelKey: "models/forglb.glb",
  towerBModelKey: "models/forglb - Copy.glb",
  towerAWorldDummies: getTowerDummies("dummy_Ta"),
  towerBWorldDummies: getTowerDummies("dummy_Tb"),
  towerACameras: getCameraMap("A"),
  towerBCameras: getCameraMap("B"),
  towerATransform: (precomputedSceneData as never as { A: { transform: MasterPlanDeveloperConfig["towerATransform"] } }).A.transform,
  towerBTransform: (precomputedSceneData as never as { B: { transform: MasterPlanDeveloperConfig["towerBTransform"] } }).B.transform,
  unitViewVideos: {
    "3601": {
      forwardKey: "videos/Unit  View.mp4",
      reverseKey: "videos/Unit View 3S Reversed New_Compressed.mp4",
    },
    "3001": {
      forwardKey: "videos/Unit  View4sec.mp4",
      reverseKey: "videos/Unit_View4sec_reversed_SMALL.mp4",
    },
  },
  topViewVideoUrl:
    "https://res.cloudinary.com/dlhfbu3kh/video/upload/v1774910334/Sequence_01.mp4",
};

export const DEFAULT_DEVELOPER_RUNTIME_CONFIG: DeveloperRuntimeConfig = {
  version: 0,
  home: {
    entryVideoKey: "videos/Tf Fixed Final_2.mp4",
    heroVideoKey: "videos/01_2.mp4",
    heroLoopVideoKey: "videos/02.mp4",
    heroMobileFallbackKey: "images/01_lastframe.avif",
    heroStageFallbackKey: "images/first_frame_again.png",
    heroPosterKey: "images/hero_first_frame.avif",
    heroLogoKey: "images/Logo_Trifect_Veranza A_new.png",
    masterPlanWarmupVideoKey: "videos/360_scrub_optimized_g3.mp4",
  },

  masterPlan: defaultMasterPlanConfig,
  interior: {
    furnishedPanoBasePath: "interior-panos-trifecta-2/",
    bareShellPanoBasePath: "bareshell-pano-trifecta-new/",
    balconyPanoBasePath: "interior-balcony-pano/",
    furnishedNodes: furnishedInteriorNodes as ExteriorPanoNodeSource[],
    bareShellNodes: bareShellInteriorNodes as ExteriorPanoNodeSource[],
    furnishedInitialNodeId: "BP_panoPath_Interior_F0000",
    bareShellInitialNodeId: "BP_panoPath_F0000",
    furnishedMinimapKey: "Tower_A_01_2D.webp",
    bareShellMinimapKey: "Tower_A_06_2D.webp",
    fallbackImageKey: "images/first_frame_again.png",
  },
  exterior: {
    panoBasePath: "TULA/Panos/exterior-pano-remaining-optimised",
    nodes: exteriorNodes as ExteriorPanoNodeSource[],
    initialNodeId: "PANO_Spline_F0000",
    initialPreviewKey:
      "TULA/Panos/exterior-pano-remaining-optimised/LS_PANO_Spline_F0000/preview.jpg",
    minimapKey: "images/Final_5.avif",
    fallbackImageKey: "images/exterior-minimap-fallback.jpg",
    title: "Trifecta Exterior Walkthrough",
    subtitle:
      "Fast panoramic browsing with directional node navigation tuned for a lighter exterior experience.",
  },
  amenities: {
    pageData: amenitiesPageData as AmenitiesPageData,
    exteriorAmenities: exteriorAmenities as never,
  },
  fallbackAssets: {
    masterPlanStageFallbackKey: "images/first_frame_again.png",
    exteriorMinimapFallbackKey: "images/exterior-minimap-fallback.jpg",
    interiorFallbackKey: "images/first_frame_again.png",
    homeFallbackKey: "images/first_frame_again.png",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertSafeRelativePath(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }

  const normalized = value.trim();
  if (
    normalized.startsWith("/") ||
    normalized.includes("../") ||
    normalized.includes("..\\") ||
    normalized.includes("\\") ||
    /^https?:\/\//i.test(normalized)
  ) {
    throw new Error(`${field} must be a relative R2 key or base path.`);
  }
}

function assertFiniteVector(value: unknown, field: string) {
  if (!isRecord(value) || !["x", "y", "z"].every((key) => Number.isFinite(value[key]))) {
    throw new Error(`${field} must contain finite x, y, and z values.`);
  }
}

function assertCamera(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`${field} is required.`);
  }

  assertFiniteVector(value.position, `${field}.position`);
  if (
    !Array.isArray(value.quaternion) ||
    value.quaternion.length !== 4 ||
    !value.quaternion.every((part) => Number.isFinite(part))
  ) {
    throw new Error(`${field}.quaternion must contain four finite values.`);
  }

  if (!Number.isFinite(value.fov) || Number(value.fov) <= 0 || Number(value.fov) >= 180) {
    throw new Error(`${field}.fov must be between 0 and 180.`);
  }
}

function assertDummies(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`${field} is required.`);
  }

  ["dummy1", "dummy2", "dummy3", "dummy4"].forEach((key) =>
    assertFiniteVector(value[key], `${field}.${key}`),
  );
}

function assertPanoNodes(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must contain at least one pano node.`);
  }

  value.forEach((node, index) => {
    if (!isRecord(node) || typeof node.id !== "string" || typeof node.image_filename !== "string") {
      throw new Error(`${field}[${index}] needs id and image_filename.`);
    }
    ["x", "y", "z", "pitch", "yaw", "roll"].forEach((key) => {
      if (!Number.isFinite(node[key])) {
        throw new Error(`${field}[${index}].${key} must be finite.`);
      }
    });
  });
}

export function validateDeveloperRuntimeConfig(config: DeveloperRuntimeConfig) {
  const issues: string[] = [];

  const capture = (action: () => void) => {
    try {
      action();
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "Invalid configuration.");
    }
  };

  capture(() => {
    Object.entries(config.home).forEach(([field, value]) => assertSafeRelativePath(value, `home.${field}`));
  });
  capture(() => {
    const master = config.masterPlan;
    [
      "scrubVideoKey",
      "interactionVideoKey",
      "fallbackImageKey",
      "towerAModelKey",
      "towerBModelKey",
    ].forEach((field) => assertSafeRelativePath(master[field as keyof typeof master], `masterPlan.${field}`));
    if (!Number.isInteger(master.totalFrames) || master.totalFrames <= 0) {
      throw new Error("masterPlan.totalFrames must be a positive integer.");
    }
    if (!Number.isFinite(master.fps) || master.fps <= 0) {
      throw new Error("masterPlan.fps must be positive.");
    }
    if (!Number.isFinite(master.aspectRatio) || master.aspectRatio <= 0) {
      throw new Error("masterPlan.aspectRatio must be positive.");
    }
    if (master.hotspots.length !== 4) {
      throw new Error("masterPlan.hotspots must contain A1 through A4.");
    }
    const keys = master.hotspots.map((hotspot) => hotspot.key).sort().join(",");
    if (keys !== MASTER_PLAN_HOTSPOT_KEYS.join(",")) {
      throw new Error("masterPlan.hotspots must contain exactly A1 through A4.");
    }
    master.hotspots.forEach((hotspot) => assertCamera(hotspot.camera, `masterPlan.hotspots.${hotspot.key}.camera`));
    MASTER_PLAN_HOTSPOT_KEYS.forEach((key) => {
      assertCamera(master.towerACameras[key], `masterPlan.towerACameras.${key}`);
      assertCamera(master.towerBCameras[key], `masterPlan.towerBCameras.${key}`);
    });
    assertDummies(master.towerAWorldDummies, "masterPlan.towerAWorldDummies");
    assertDummies(master.towerBWorldDummies, "masterPlan.towerBWorldDummies");
    ["towerATransform", "towerBTransform"].forEach((field) => {
      const transform = master[field as "towerATransform" | "towerBTransform"];
      if (!Array.isArray(transform.position) || transform.position.length !== 3 || !transform.position.every(Number.isFinite)) {
        throw new Error(`masterPlan.${field}.position must contain three finite values.`);
      }
      if (!Array.isArray(transform.quaternion) || transform.quaternion.length !== 4 || !transform.quaternion.every(Number.isFinite) || !Number.isFinite(transform.scale) || transform.scale <= 0) {
        throw new Error(`masterPlan.${field} must contain a valid quaternion and positive scale.`);
      }
    });
  });
  capture(() => {
    const interior = config.interior;
    ["furnishedPanoBasePath", "bareShellPanoBasePath", "balconyPanoBasePath"].forEach((field) =>
      assertSafeRelativePath(interior[field as keyof typeof interior], `interior.${field}`),
    );
    assertPanoNodes(interior.furnishedNodes, "interior.furnishedNodes");
    assertPanoNodes(interior.bareShellNodes, "interior.bareShellNodes");
  });
  capture(() => {
    assertSafeRelativePath(config.exterior.panoBasePath, "exterior.panoBasePath");
    assertPanoNodes(config.exterior.nodes, "exterior.nodes");
  });
  capture(() => {
    if (!Array.isArray(config.amenities.pageData.items)) {
      throw new Error("amenities.pageData.items must be an array.");
    }
  });
  capture(() => {
    Object.entries(config.fallbackAssets).forEach(([field, value]) => {
      if (value) assertSafeRelativePath(value, `fallbackAssets.${field}`);
    });
  });

  return { valid: issues.length === 0, issues };
}

export function getDefaultDeveloperConfigSection<T extends DeveloperConfigSection>(section: T) {
  const defaults: DeveloperConfigSectionMap = {
    home: DEFAULT_DEVELOPER_RUNTIME_CONFIG.home,
    "master-plan": DEFAULT_DEVELOPER_RUNTIME_CONFIG.masterPlan,
    interior: DEFAULT_DEVELOPER_RUNTIME_CONFIG.interior,
    exterior: DEFAULT_DEVELOPER_RUNTIME_CONFIG.exterior,
    amenities: DEFAULT_DEVELOPER_RUNTIME_CONFIG.amenities,
    "fallback-assets": DEFAULT_DEVELOPER_RUNTIME_CONFIG.fallbackAssets,
  };

  return clone(defaults[section]);
}

export async function getDeveloperConfigSection<T extends DeveloperConfigSection>(section: T) {
  await connectToDatabase();
  const document = await sectionModels[section].findOne({ key: GLOBAL_CONFIG_KEY }).lean();
  const config = document?.config ?? getDefaultDeveloperConfigSection(section);

  return {
    config: clone(config) as DeveloperConfigSectionMap[T],
    revision: document?.revision ?? 0,
    updatedAt: document?.updatedAt?.toISOString?.() ?? null,
  };
}

export async function saveDeveloperConfigSection<T extends DeveloperConfigSection>(
  section: T,
  config: DeveloperConfigSectionMap[T],
) {
  if (!isRecord(config)) {
    throw new Error("Configuration payload must be an object.");
  }

  await connectToDatabase();
  const document = await sectionModels[section].findOneAndUpdate(
    { key: GLOBAL_CONFIG_KEY },
    {
      $set: { config: clone(config) },
      $setOnInsert: { key: GLOBAL_CONFIG_KEY },
      $inc: { revision: 1 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  return {
    config: clone(document.config) as DeveloperConfigSectionMap[T],
    revision: document.revision,
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function getDraftDeveloperRuntimeConfig(): Promise<DeveloperRuntimeConfig> {
  const [home, masterPlan, interior, exterior, amenities, fallbackAssets] = await Promise.all(
    ([
      getDeveloperConfigSection("home"),
      getDeveloperConfigSection("master-plan"),
      getDeveloperConfigSection("interior"),
      getDeveloperConfigSection("exterior"),
      getDeveloperConfigSection("amenities"),
      getDeveloperConfigSection("fallback-assets"),
    ] as const),
  );

  return {
    version: 0,
    home: home.config,
    masterPlan: masterPlan.config,
    interior: interior.config,
    exterior: exterior.config,
    amenities: amenities.config,
    fallbackAssets: fallbackAssets.config,
  };
}

async function readPublishedRuntimeConfig() {
  await connectToDatabase();
  const document = await DeveloperPublishedRuntimeConfig.findOne({ key: PUBLISHED_CONFIG_KEY }).lean();
  if (!document?.config) {
    return clone(DEFAULT_DEVELOPER_RUNTIME_CONFIG);
  }

  return clone({
    ...(document.config as DeveloperRuntimeConfig),
    version: document.version,
    publishedAt: document.publishedAt.toISOString(),
  });
}

const getCachedPublishedRuntimeConfig = unstable_cache(
  readPublishedRuntimeConfig,
  ["developer-published-runtime-config"],
  { revalidate: 300, tags: [DEVELOPER_RUNTIME_CONFIG_TAG] },
);

export async function getPublishedDeveloperRuntimeConfig() {
  return getCachedPublishedRuntimeConfig();
}

export async function publishDeveloperRuntimeConfig() {
  const draft = await getDraftDeveloperRuntimeConfig();
  const validation = validateDeveloperRuntimeConfig(draft);

  if (!validation.valid) {
    return { published: false as const, validation };
  }

  await connectToDatabase();
  const existing = await DeveloperPublishedRuntimeConfig.findOne({ key: PUBLISHED_CONFIG_KEY }).lean();
  const version = (existing?.version ?? 0) + 1;
  const publishedAt = new Date();
  const runtimeConfig: DeveloperRuntimeConfig = {
    ...draft,
    version,
    publishedAt: publishedAt.toISOString(),
  };

  await DeveloperPublishedRuntimeConfig.findOneAndUpdate(
    { key: PUBLISHED_CONFIG_KEY },
    {
      $set: { config: runtimeConfig, version, publishedAt },
      $setOnInsert: { key: PUBLISHED_CONFIG_KEY },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await DeveloperConfigRevision.create({ version, config: runtimeConfig, publishedAt });
  revalidateTag(DEVELOPER_RUNTIME_CONFIG_TAG, "max");

  return {
    published: true as const,
    validation,
    version,
    publishedAt: runtimeConfig.publishedAt,
  };
}
