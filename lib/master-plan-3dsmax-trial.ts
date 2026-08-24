import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import trialData from "@/data/master-plan-3dsmax-trial.json";
import type {
  MasterPlanCameraConfig,
  MasterPlanDeveloperConfig,
  Vector3Config,
} from "@/types/developer-config";

type TrialData = typeof trialData;

const MASTER_PLAN_HOTSPOT_KEYS = ["A1", "A2", "A3", "A4", "A5", "A6"] as const;
const MASTER_PLAN_HOTSPOT_FRAMES = [1, 61, 121, 181, 241, 301] as const;
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

function buildCameraQuaternionFromThreeDsMaxRotation(trial: TrialData) {
  const rotationDegrees = trial.camera.rotationDegrees;

  if (!rotationDegrees) {
    return null;
  }

  const maxQuaternion = new Quaternion().setFromEuler(
    new Euler(
      (rotationDegrees.x * Math.PI) / 180,
      (rotationDegrees.y * Math.PI) / 180,
      (rotationDegrees.z * Math.PI) / 180,
      "XYZ",
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

  return cameraForwardAxisCorrection.multiply(basisQuaternion).normalize();
}

function buildCameraConfig(
  trial: TrialData,
): MasterPlanCameraConfig {
  const position = toThreeWorldVectorMm(trial.camera.position);
  const target = buildThreeLookTargetMm(trial);
  const rotationQuaternion =
    buildCameraQuaternionFromThreeDsMaxRotation(trial);
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
  const camera = buildCameraConfig(trialData);
  const trialTransform = buildTrialTowerTransform(trialData);
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
    fps: trialData.video.fps,
    aspectRatio: trialData.video.width / trialData.video.height,
    hotspotFrames: [...MASTER_PLAN_HOTSPOT_FRAMES],
    hotspots: MASTER_PLAN_HOTSPOT_KEYS.map((key, index) => ({
      camera,
      frame: MASTER_PLAN_HOTSPOT_FRAMES[index],
      key,
    })),
    towerAModelKey: trialData.modelAssetKey,
    towerBModelKey: trialData.modelAssetKey,
    towerAWorldDummies: towerWorldDummies,
    towerBWorldDummies: towerWorldDummies,
    towerACameras: Object.fromEntries(
      MASTER_PLAN_HOTSPOT_KEYS.map((key) => [key, camera]),
    ),
    towerBCameras: Object.fromEntries(
      MASTER_PLAN_HOTSPOT_KEYS.map((key) => [key, camera]),
    ),
    towerATransform: trialTransform,
    towerBTransform: trialTransform,
    unitViewVideos: {},
  } satisfies MasterPlanDeveloperConfig;
}
