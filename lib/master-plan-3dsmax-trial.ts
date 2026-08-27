import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import trialData from "@/data/master-plan-3dsmax-trial.json";
import { MASTER_PLAN_SCRUB_VIDEO_FPS } from "@/data/masterPlanFrameCdnUrls";
import {
  MASTER_PLAN_HOTSPOT_FRAMES,
  MASTER_PLAN_HOTSPOT_KEYS,
} from "@/lib/master-plan-hotspots";
import type {
  MasterPlanCameraConfig,
  MasterPlanDeveloperConfig,
  Vector3Config,
} from "@/types/developer-config";

type TrialData = typeof trialData;
type TrialCameraStop = TrialData["cameraStops"][number];

const GLB_DUMMY_1_ANCHOR_MM = new Vector3(90098, 1284, -57590);
const GLB_DUMMY_2_ANCHOR_MM = new Vector3(-72062.390625, 1284, -77919.2578125);

function toThreeWorldPositionMm(point: Vector3Config): Vector3Config {
  return {
    x: point.x * 1000,
    y: point.z * 1000,
    z: -point.y * 1000,
  };
}

function toThreeWorldVectorMm(point: Vector3Config) {
  const relativePoint = toThreeWorldPositionMm(point);
  return new Vector3(relativePoint.x, relativePoint.y, relativePoint.z);
}

function buildThreeLookTargetMm(trial: TrialData) {
  return toThreeWorldVectorMm(trial.camera.target);
}

function buildCameraQuaternionFromThreeDsMaxRotation(
  rotationDegrees: TrialCameraStop["rotationDegrees"],
  preserveLegacyFrameZeroOrientation = false,
) {
  // 3ds Max applies the Z/world yaw around the already-pitched camera. Three's
  // equivalent Euler composition is ZYX; XYZ incorrectly turns that pitch
  // into roll as soon as the camera yaw moves away from zero.
  const rotationOrder = preserveLegacyFrameZeroOrientation ? "XYZ" : "ZYX";
  const maxQuaternion = new Quaternion().setFromEuler(
    new Euler(
      (rotationDegrees.x * Math.PI) / 180,
      (rotationDegrees.y * Math.PI) / 180,
      (rotationDegrees.z * Math.PI) / 180,
      rotationOrder,
    ),
  );
  const maxToThreeBasis = new Matrix4().set(
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, -1, 0, 0,
    0, 0, 0, 1,
  );
  const threeRotationMatrix = maxToThreeBasis
    .clone()
    .multiply(new Matrix4().makeRotationFromQuaternion(maxQuaternion))
    .multiply(maxToThreeBasis.clone().invert());
  const basisQuaternion = new Quaternion().setFromRotationMatrix(
    threeRotationMatrix,
  );

  // 3ds Max camera local forward differs from Three.js camera forward.
  const cameraForwardAxisCorrection = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    -Math.PI / 2,
  );

  // Keep the approved frame-zero camera exactly as it was. For the remaining
  // stops, the camera-axis correction is local and must be post-multiplied.
  return preserveLegacyFrameZeroOrientation
    ? cameraForwardAxisCorrection.multiply(basisQuaternion).normalize()
    : basisQuaternion.multiply(cameraForwardAxisCorrection).normalize();
}

function buildCameraConfig(
  trial: TrialData,
  cameraStop: TrialCameraStop,
): MasterPlanCameraConfig {
  const position = toThreeWorldVectorMm(cameraStop.position);
  const target = buildThreeLookTargetMm(trial);
  const rotationQuaternion = buildCameraQuaternionFromThreeDsMaxRotation(
    cameraStop.rotationDegrees,
    cameraStop.frame === 0,
  );
  const fallbackQuaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(position, target, new Vector3(0, 1, 0)).invert(),
  );
  const cameraQuaternion = rotationQuaternion ?? fallbackQuaternion;

  return {
    fov: trial.camera.fov,
    position: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    quaternion: [
      cameraQuaternion.x,
      cameraQuaternion.y,
      cameraQuaternion.z,
      cameraQuaternion.w,
    ],
  };
}

function buildTrialTowerTransform(trial: TrialData) {
  const modelAnchorA = GLB_DUMMY_1_ANCHOR_MM.clone();
  const modelAnchorB = GLB_DUMMY_2_ANCHOR_MM.clone();
  const worldAnchorA = toThreeWorldVectorMm(trial.dummy);
  const worldAnchorB = toThreeWorldVectorMm(trial.secondaryDummy);
  const modelDelta = modelAnchorB.clone().sub(modelAnchorA);
  const worldDelta = worldAnchorB.clone().sub(worldAnchorA);
  const modelDeltaXZ = new Vector3(modelDelta.x, 0, modelDelta.z);
  const worldDeltaXZ = new Vector3(worldDelta.x, 0, worldDelta.z);
  const modelDistance = modelDeltaXZ.length();
  const worldDistance = worldDeltaXZ.length();
  const scale =
    modelDistance > Number.EPSILON ? worldDistance / modelDistance : 1;
  const modelYaw = Math.atan2(modelDeltaXZ.x, modelDeltaXZ.z);
  const worldYaw = Math.atan2(worldDeltaXZ.x, worldDeltaXZ.z);
  const yawOffset = worldYaw - modelYaw;
  const quaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    yawOffset,
  );
  const position = modelAnchorA
    .clone()
    .applyQuaternion(quaternion)
    .multiplyScalar(scale);

  position.copy(worldAnchorA.clone().sub(position));

  return {
    position: [position.x, position.y, position.z] as [
      number,
      number,
      number,
    ],
    quaternion: [
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w,
    ] as [number, number, number, number],
    scale,
  };
}

export function getThreeDsMaxMasterPlanConfig(): MasterPlanDeveloperConfig {
  const trialTransform = buildTrialTowerTransform(trialData);
  const cameras = Object.fromEntries(
    MASTER_PLAN_HOTSPOT_KEYS.map((key, index) => {
      const cameraStop = trialData.cameraStops[index];

      if (!cameraStop) {
        throw new Error(`Missing 3ds Max camera stop for ${key}.`);
      }

      return [key, buildCameraConfig(trialData, cameraStop)];
    }),
  ) as Record<(typeof MASTER_PLAN_HOTSPOT_KEYS)[number], MasterPlanCameraConfig>;
  const towerWorldDummies = {
    dummy1: trialData.dummy,
    dummy2: trialData.secondaryDummy,
    dummy3: trialData.secondaryDummy,
    dummy4: trialData.dummy,
  };

  return {
    renderer: "3ds-max-vantage",
    scrubVideoKey: trialData.video.assetKey,
    interactionVideoKey: trialData.video.assetKey,
    fallbackImageKey: trialData.fallbackImageKey,
    totalFrames: trialData.video.totalFrames,
    fps: MASTER_PLAN_SCRUB_VIDEO_FPS,
    aspectRatio: trialData.video.width / trialData.video.height,
    hotspotFrames: [...MASTER_PLAN_HOTSPOT_FRAMES],
    hotspots: MASTER_PLAN_HOTSPOT_KEYS.map((key, index) => ({
      camera: cameras[key],
      frame: MASTER_PLAN_HOTSPOT_FRAMES[index] ?? MASTER_PLAN_HOTSPOT_FRAMES[0],
      key,
    })),
    towerAModelKey: trialData.modelAssetKey,
    towerBModelKey: trialData.modelAssetKey,
    towerAWorldDummies: towerWorldDummies,
    towerBWorldDummies: towerWorldDummies,
    towerACameras: cameras,
    towerBCameras: cameras,
    towerATransform: trialTransform,
    towerBTransform: trialTransform,
    unitViewVideos: {},
  } satisfies MasterPlanDeveloperConfig;
}
