import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Matrix4, Quaternion, Vector3 } from "three";
import { getThreeDsMaxMasterPlanConfig } from "@/lib/master-plan-3dsmax-trial";
import {
  MASTER_PLAN_ORBIT_FALLBACK_IMAGE_URL,
  MASTER_PLAN_ORBIT_VIDEO_URL,
} from "@/lib/master-plan-asset-keys";
import {
  MASTER_PLAN_HOTSPOT_FRAMES,
  MASTER_PLAN_HOTSPOT_KEYS,
} from "@/lib/master-plan-hotspots";
import type {
  MasterPlanCameraConfig,
  MasterPlanDeveloperConfig,
  Vector3Config,
} from "@/types/developer-config";

const PREVIEW_CAMERA_DATA_PATH = join(
  process.cwd(),
  "data/master-plan-orbit-camera.json",
);

const GLB_DUMMY_ANCHOR_MM = new Vector3(89948, 1334, -57740);
const GLB_DUMMY_001_ANCHOR_MM = new Vector3(
  -72212.390625,
  1334,
  -78069.2578125,
);
const RENDER_DUMMY_ANCHOR_CM = new Vector3(9036.03516, 124.94747, -5798.80847);
const RENDER_DUMMY_001_ANCHOR_CM = new Vector3(
  -7179.91807,
  124.88676,
  -7837.97368,
);

type OrbitPreviewFrame = {
  frame: number;
  forward_vector: Vector3Config;
  right_vector: Vector3Config;
  x: number;
  y: number;
  z: number;
};

export type OrbitPreviewOptions = {
  debugModel?: boolean;
  fov?: number;
  modelOffset?: Partial<Vector3Config>;
  modelScaleMultiplier?: number;
  modelYawOffsetDegrees?: number;
};

function renderToThreeVector(point: Vector3Config) {
  return new Vector3(point.x, point.z, point.y);
}

function buildCameraQuaternion(frame: OrbitPreviewFrame) {
  const forward = renderToThreeVector(frame.forward_vector).normalize();
  const right = renderToThreeVector(frame.right_vector).normalize();
  const up = right.clone().cross(forward).normalize();
  const back = forward.clone().negate();
  const rotationMatrix = new Matrix4().makeBasis(right, up, back);

  return new Quaternion().setFromRotationMatrix(rotationMatrix).normalize();
}

function buildCameraConfig(
  frame: OrbitPreviewFrame,
  horizontalFov: number,
): MasterPlanCameraConfig {
  const position = renderToThreeVector({
    x: frame.x,
    y: frame.y,
    z: frame.z,
  });
  const quaternion = buildCameraQuaternion(frame);

  return {
    fov: horizontalFov,
    position: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
}

function buildModelTransform(options: OrbitPreviewOptions) {
  const modelDelta = GLB_DUMMY_001_ANCHOR_MM.clone().sub(GLB_DUMMY_ANCHOR_MM);
  const renderDelta = RENDER_DUMMY_001_ANCHOR_CM.clone().sub(
    RENDER_DUMMY_ANCHOR_CM,
  );
  const modelDeltaXZ = new Vector3(modelDelta.x, 0, modelDelta.z);
  const renderDeltaXZ = new Vector3(renderDelta.x, 0, renderDelta.z);
  const baseScale = renderDeltaXZ.length() / modelDeltaXZ.length();
  const scale = baseScale * (options.modelScaleMultiplier ?? 1);
  const modelYaw = Math.atan2(modelDeltaXZ.x, modelDeltaXZ.z);
  const renderYaw = Math.atan2(renderDeltaXZ.x, renderDeltaXZ.z);
  const yawOffset =
    renderYaw -
    modelYaw +
    ((options.modelYawOffsetDegrees ?? 0) * Math.PI) / 180;
  const quaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    yawOffset,
  );
  const position = RENDER_DUMMY_ANCHOR_CM.clone().sub(
    GLB_DUMMY_ANCHOR_MM.clone()
      .applyQuaternion(quaternion)
      .multiplyScalar(scale),
  );

  position.add(
    new Vector3(
      options.modelOffset?.x ?? 0,
      options.modelOffset?.y ?? 0,
      options.modelOffset?.z ?? 0,
    ),
  );

  return {
    position: position.toArray(),
    quaternion: quaternion.toArray(),
    scale,
  } satisfies MasterPlanDeveloperConfig["towerATransform"];
}

function readOrbitPreviewFrames() {
  const frames = JSON.parse(
    readFileSync(PREVIEW_CAMERA_DATA_PATH, "utf8"),
  ) as OrbitPreviewFrame[];

  if (frames.length !== 360) {
    throw new Error(
      `Expected 360 master-plan preview cameras, received ${frames.length}.`,
    );
  }

  return frames;
}

export function getOrbitPreviewMasterPlanConfig(
  options: OrbitPreviewOptions = {},
): MasterPlanDeveloperConfig {
  const baseConfig = getThreeDsMaxMasterPlanConfig();
  const horizontalFov = options.fov ?? 60;
  const sourceFrames = readOrbitPreviewFrames();
  const frameCameras = sourceFrames.map((frame) =>
    buildCameraConfig(frame, horizontalFov),
  );
  const cameras = Object.fromEntries(
    MASTER_PLAN_HOTSPOT_KEYS.map((key, index) => [
      key,
      frameCameras[MASTER_PLAN_HOTSPOT_FRAMES[index] - 1],
    ]),
  ) as Record<string, MasterPlanCameraConfig>;
  const transform = buildModelTransform(options);
  const worldDummies = {
    dummy1: { x: 9036.03516, y: -5798.80847, z: 124.94747 },
    dummy2: { x: -7179.91807, y: -7837.97368, z: 124.88676 },
    dummy3: { x: -7179.91807, y: -7837.97368, z: 124.88676 },
    dummy4: { x: 9036.03516, y: -5798.80847, z: 124.94747 },
  };

  return {
    ...baseConfig,
    aspectRatio: 16 / 9,
    debugModel: options.debugModel ?? false,
    fallbackImageKey: MASTER_PLAN_ORBIT_FALLBACK_IMAGE_URL,
    fps: 60,
    frameCameras,
    hotspotFrames: [...MASTER_PLAN_HOTSPOT_FRAMES],
    hotspots: MASTER_PLAN_HOTSPOT_KEYS.map((key, index) => ({
      camera: cameras[key],
      frame: MASTER_PLAN_HOTSPOT_FRAMES[index],
      key,
    })),
    interactionVideoKey: MASTER_PLAN_ORBIT_VIDEO_URL,
    reverseHotspotDirection: true,
    scrubVideoKey: MASTER_PLAN_ORBIT_VIDEO_URL,
    totalFrames: 360,
    towerACameras: cameras,
    towerAWorldDummies: worldDummies,
    towerATransform: transform,
    towerBCameras: cameras,
    towerBWorldDummies: worldDummies,
    towerBTransform: transform,
  };
}
