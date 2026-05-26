import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  Box3,
  Euler,
  Group,
  Object3D,
  Quaternion,
  Vector2,
  Vector3,
} from "three";
import trackingData from "../data/trifecta_unreal_tracking_data.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const TARGET_MODEL_HEIGHT = 10;
const TRACKING_KEYS = ["A1", "A2", "A3", "A4", "A5", "A6"] as const;

type TowerCode = "A" | "B";
type TrackingKey = (typeof TRACKING_KEYS)[number];

type TowerFootprint = {
  ta1: Vector3;
  ta2: Vector3;
  ta3: Vector3;
  ta4: Vector3;
};

type SimilarityTransform = {
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
};

type OutputTransform = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: number;
};

type OutputCamera = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  fov: number;
};

type OutputSceneData = Record<
  TowerCode,
  {
    camera: Record<TrackingKey, OutputCamera>;
    transform: OutputTransform;
  }
>;

const round = (value: number) => Number(value.toFixed(6));

function roundVector3(vector: Vector3): [number, number, number] {
  return [round(vector.x), round(vector.y), round(vector.z)];
}

function roundQuaternion(
  quaternion: Quaternion,
): [number, number, number, number] {
  return [
    round(quaternion.x),
    round(quaternion.y),
    round(quaternion.z),
    round(quaternion.w),
  ];
}

function getQuadPoints(quad: TowerFootprint) {
  return [quad.ta1, quad.ta2, quad.ta3, quad.ta4];
}

function averageVector(points: Vector3[]) {
  return points
    .reduce((sum, point) => sum.add(point.clone()), new Vector3())
    .multiplyScalar(1 / Math.max(points.length, 1));
}

function computeSimilarityTransformFromQuads(
  modelQuad: TowerFootprint,
  unrealQuad: TowerFootprint,
): SimilarityTransform | null {
  const modelPoints = getQuadPoints(modelQuad);
  const unrealPoints = getQuadPoints(unrealQuad);
  const modelCenter = averageVector(modelPoints);
  const unrealCenter = averageVector(unrealPoints);
  const centeredModel = modelPoints.map(
    (point) => new Vector2(point.x - modelCenter.x, point.z - modelCenter.z),
  );
  const centeredUnreal = unrealPoints.map(
    (point) => new Vector2(point.x - unrealCenter.x, point.z - unrealCenter.z),
  );

  let dot = 0;
  let cross = 0;
  let sourceNorm = 0;

  centeredModel.forEach((point, index) => {
    dot += point.dot(centeredUnreal[index]);
    cross += point.x * centeredUnreal[index].y - point.y * centeredUnreal[index].x;
    sourceNorm += point.lengthSq();
  });

  if (sourceNorm <= 1e-8) {
    return null;
  }

  const rotationAngle = Math.atan2(cross, dot);
  const quaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    rotationAngle,
  );

  let scaledDot = 0;

  centeredModel.forEach((point, index) => {
    const rotatedPoint = point.clone().rotateAround(new Vector2(0, 0), rotationAngle);
    scaledDot += rotatedPoint.dot(centeredUnreal[index]);
  });

  const scale = scaledDot / sourceNorm;

  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }

  const position = unrealCenter
    .clone()
    .sub(modelCenter.clone().applyQuaternion(quaternion).multiplyScalar(scale));

  return { position, quaternion, scale };
}

function eulerToQuaternion(pitch: number, yaw: number, roll: number) {
  const euler = new Euler(
    (pitch * Math.PI) / 180,
    (-yaw * Math.PI) / 180 - Math.PI / 2,
    (-roll * Math.PI) / 180,
    "YXZ",
  );

  return new Quaternion().setFromEuler(euler);
}

async function loadScene(modelPath: string): Promise<{ scene: Group }> {
  const loader = new GLTFLoader();
  const absolutePath = path.resolve(ROOT_DIR, modelPath);
  const buffer = await readFile(absolutePath);
  const fileUrl = pathToFileURL(absolutePath).href;

  return await new Promise<{ scene: Group }>((resolve, reject) => {
    loader.parse(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      fileUrl,
      resolve,
      reject,
    );
  });
}

function collectModelTowerDummies(scene: Group): TowerFootprint {
  const dummyPositions = new Map<string, Vector3>();

  scene.traverse((object: Object3D) => {
    const normalizedName = object.name.trim().toLowerCase();

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
    throw new Error("Unable to locate model tower dummies.");
  }

  return { ta1, ta2, ta3, ta4 };
}

function toSceneSpacePosition(
  position: Vector3,
  offset: [number, number, number],
  scale: number,
) {
  return new Vector3(
    (position.x + offset[0]) * scale,
    (position.y + offset[1]) * scale,
    (position.z + offset[2]) * scale,
  );
}

function getTrackedTowerFootprint(scene: Group): TowerFootprint {
  scene.updateWorldMatrix(true, true);

  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const scale = TARGET_MODEL_HEIGHT / Math.max(size.y, 1);
  const offset = [-center.x, -bounds.min.y, -center.z] as [
    number,
    number,
    number,
  ];
  const modelDummies = collectModelTowerDummies(scene);

  return {
    ta1: toSceneSpacePosition(modelDummies.ta1, offset, scale),
    ta2: toSceneSpacePosition(modelDummies.ta2, offset, scale),
    ta3: toSceneSpacePosition(modelDummies.ta3, offset, scale),
    ta4: toSceneSpacePosition(modelDummies.ta4, offset, scale),
  };
}

function unrealToThreePosition(point: { x: number; y: number; z: number }) {
  return new Vector3(point.x, point.z, point.y);
}

function getTrackedViewTowerFootprint(
  trackingKey: TrackingKey,
  towerCode: TowerCode,
): TowerFootprint {
  const dummies = trackingData[trackingKey]?.dummies;
  const dummyPrefix = towerCode === "B" ? "dummy_Tb" : "dummy_Ta";
  const ta1 = dummies?.[`${dummyPrefix}1` as keyof typeof dummies];
  const ta2 = dummies?.[`${dummyPrefix}2` as keyof typeof dummies];
  const ta3 = dummies?.[`${dummyPrefix}3` as keyof typeof dummies];
  const ta4 = dummies?.[`${dummyPrefix}4` as keyof typeof dummies];

  if (!ta1 || !ta2 || !ta3 || !ta4) {
    throw new Error(`Missing tracked dummies for ${towerCode} ${trackingKey}`);
  }

  return {
    ta1: unrealToThreePosition(ta1),
    ta2: unrealToThreePosition(ta2),
    ta3: unrealToThreePosition(ta3),
    ta4: unrealToThreePosition(ta4),
  };
}

function getOutputCamera(trackingKey: TrackingKey): OutputCamera {
  const camera = trackingData[trackingKey]?.camera;

  if (!camera) {
    throw new Error(`Missing camera for ${trackingKey}`);
  }

  return {
    position: roundVector3(unrealToThreePosition(camera.position)),
    quaternion: roundQuaternion(
      eulerToQuaternion(
        camera.rotation.pitch,
        camera.rotation.yaw,
        camera.rotation.roll,
      ),
    ),
    fov: round(camera.fov),
  };
}

async function main() {
  const [towerAGltf, towerBGltf] = await Promise.all([
    loadScene("public/models/forglb.glb"),
    loadScene("public/models/forglb - Copy.glb"),
  ]);

  const towerFootprints: Record<TowerCode, TowerFootprint> = {
    A: getTrackedTowerFootprint(towerAGltf.scene),
    B: getTrackedTowerFootprint(towerBGltf.scene),
  };

  const output = {
    A: {
      camera: {} as Record<TrackingKey, OutputCamera>,
      transform: {
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        scale: 1,
      } as OutputTransform,
    },
    B: {
      camera: {} as Record<TrackingKey, OutputCamera>,
      transform: {
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        scale: 1,
      } as OutputTransform,
    },
  } satisfies OutputSceneData;

  (["A", "B"] as const).forEach((towerCode) => {
    const transform = computeSimilarityTransformFromQuads(
      towerFootprints[towerCode],
      getTrackedViewTowerFootprint(TRACKING_KEYS[0], towerCode),
    );

    if (!transform) {
      throw new Error(`Failed to compute transform for tower ${towerCode}`);
    }

    output[towerCode].transform = {
      position: roundVector3(transform.position),
      quaternion: roundQuaternion(transform.quaternion),
      scale: round(transform.scale),
    };

    TRACKING_KEYS.forEach((trackingKey) => {
      output[towerCode].camera[trackingKey] = getOutputCamera(trackingKey);
    });
  });

  const outputPath = path.resolve(ROOT_DIR, "data/precomputedSceneData.json");
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
