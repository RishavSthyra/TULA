"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import {
  Box3,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  Object3D,
  Vector2,
  Vector3,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { computeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";

(Mesh.prototype as unknown as { raycast: Mesh["raycast"] }).raycast =
  acceleratedRaycast as Mesh["raycast"];

const MODEL_PATH = "/models/without balcony.glb?debug=hover-page-1";
const BLOCK_MESH_PATTERN = /^g_([A-D])_([0-9A-Z]{2})_([0-9A-Z]{3,4})(?:_.+)?$/i;
const TARGET_MODEL_HEIGHT = 14;

type PointerPosition = { x: number; y: number };

type HoverMeshData = {
  geometry: Mesh["geometry"];
  key: string;
  matrix: Matrix4;
};

type PreparedModel = {
  apartments: Map<string, HoverMeshData[]>;
  offset: [number, number, number];
  pickableMeshes: Mesh[];
  scaledHeight: number;
  scene: Group;
  scale: number;
};

function isBlockHoverMesh(name: string) {
  return BLOCK_MESH_PATTERN.test(name.trim()) && /(wall|balcon)/i.test(name);
}

function parseBlockApartmentId(name: string) {
  const match = name.trim().match(BLOCK_MESH_PATTERN);

  if (!match || !/(wall|balcon)/i.test(name)) {
    return null;
  }

  const blockCode = match[1].toUpperCase();
  const flatToken = match[3].toUpperCase();
  const floorCode = flatToken.startsWith("G")
    ? "00"
    : flatToken.replace(/[^0-9]/g, "").slice(0, -2).padStart(2, "0").slice(-2);

  return `Block_${blockCode}_${floorCode}_${flatToken}`;
}

function formatBlockLabel(apartmentId: string | null) {
  if (!apartmentId) {
    return "Hover a block flat";
  }

  const match = apartmentId.match(/^Block_([A-D])_(\d{2})_([A-Z0-9]{3,4})$/i);

  if (!match) {
    return apartmentId;
  }

  return `${match[1].toUpperCase()}-${match[3].toUpperCase()}`;
}

function prepareScene(sourceScene: Object3D): PreparedModel {
  const scene = cloneSkeleton(sourceScene) as Group;
  const apartments = new Map<string, HoverMeshData[]>();
  const pickableMeshes: Mesh[] = [];

  scene.updateWorldMatrix(true, true);

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    if (!isBlockHoverMesh(object.name)) {
      return;
    }

    object.frustumCulled = false;

    object.geometry.computeBoundsTree =
      object.geometry.computeBoundsTree ?? computeBoundsTree;
    object.geometry.computeBoundsTree?.();

    const apartmentId = parseBlockApartmentId(object.name);

    if (!apartmentId) {
      return;
    }

    object.userData.apartmentId = apartmentId;
    pickableMeshes.push(object);

    const meshEntry = apartments.get(apartmentId) ?? [];
    meshEntry.push({
      geometry: object.geometry,
      key: object.uuid,
      matrix: object.matrixWorld.clone(),
    });
    apartments.set(apartmentId, meshEntry);
  });

  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const scale = TARGET_MODEL_HEIGHT / Math.max(size.y, 1);

  return {
    apartments,
    offset: [-center.x, -bounds.min.y, -center.z] as [number, number, number],
    pickableMeshes,
    scaledHeight: size.y * scale,
    scene,
    scale,
  };
}

function LoadingState() {
  return (
    <Html center>
      <div className="rounded-full border border-white/20 bg-black/75 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white">
        Loading GLB debug
      </div>
    </Html>
  );
}

function HoverOverlay({
  apartments,
  hoveredApartmentId,
}: {
  apartments: PreparedModel["apartments"];
  hoveredApartmentId: string | null;
}) {
  const hoveredMeshes = hoveredApartmentId
    ? apartments.get(hoveredApartmentId) ?? []
    : [];

  if (hoveredMeshes.length === 0) {
    return null;
  }

  return (
    <group>
      {hoveredMeshes.map((meshData) => (
        <HoverOverlayItem key={meshData.key} meshData={meshData} />
      ))}
    </group>
  );
}

function HoverOverlayItem({ meshData }: { meshData: HoverMeshData }) {
  const edgeGeometry = useMemo(
    () => new EdgesGeometry(meshData.geometry, 20),
    [meshData.geometry],
  );
  const edgeMaterial = useMemo(
    () =>
      new LineBasicMaterial({
        color: "#dcfce7",
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      edgeGeometry.dispose();
      edgeMaterial.dispose();
    };
  }, [edgeGeometry, edgeMaterial]);

  return (
    <group>
      <mesh
        frustumCulled={false}
        geometry={meshData.geometry}
        matrix={meshData.matrix}
        matrixAutoUpdate={false}
        raycast={() => null}
        renderOrder={10}
      >
        <meshBasicMaterial
          color="#4ade80"
          depthTest={false}
          depthWrite={false}
          opacity={0.28}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <lineSegments
        frustumCulled={false}
        geometry={edgeGeometry}
        material={edgeMaterial}
        matrix={meshData.matrix}
        matrixAutoUpdate={false}
        raycast={() => null}
        renderOrder={11}
      />
    </group>
  );
}

function HoverTracker({
  onHoverChange,
  pickableMeshes,
}: {
  onHoverChange: (
    apartmentId: string | null,
    pointerPosition: PointerPosition | null,
  ) => void;
  pickableMeshes: Mesh[];
}) {
  const { camera, gl, raycaster } = useThree();

  useEffect(() => {
    const element = gl.domElement;
    const pointer = new Vector2();
    const worldNormal = new Vector3();
    let frameId = 0;
    let latestClientX = 0;
    let latestClientY = 0;

    const processPointerMove = () => {
      frameId = 0;
      const rect = element.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        onHoverChange(null, null);
        return;
      }

      const pointerPosition = {
        x: latestClientX - rect.left,
        y: latestClientY - rect.top,
      };

      pointer.x = (pointerPosition.x / rect.width) * 2 - 1;
      pointer.y = -(pointerPosition.y / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const intersections = raycaster.intersectObjects(pickableMeshes, false);
      const hit = intersections.find((intersection) => {
        const apartmentId = intersection.object.userData.apartmentId as
          | string
          | undefined;

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

      onHoverChange(
        (hit?.object.userData.apartmentId as string | undefined) ?? null,
        pointerPosition,
      );
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!event.isPrimary || event.pointerType === "touch") {
        return;
      }

      latestClientX = event.clientX;
      latestClientY = event.clientY;

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

      onHoverChange(null, null);
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
  }, [camera, gl, onHoverChange, pickableMeshes, raycaster]);

  return null;
}

function DebugScene({
  hoveredApartmentId,
  onHoverChange,
}: {
  hoveredApartmentId: string | null;
  onHoverChange: (
    apartmentId: string | null,
    pointerPosition: PointerPosition | null,
  ) => void;
}) {
  const { scene } = useGLTF(MODEL_PATH);
  const preparedModel = useMemo(() => prepareScene(scene), [scene]);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        far={300000}
        fov={34}
        near={1}
        position={[0, preparedModel.scaledHeight * 0.7, preparedModel.scaledHeight * 1.8]}
      />
      <ambientLight intensity={2} />
      <directionalLight color="#fff6dc" intensity={2.8} position={[2, 4, 3]} />
      <directionalLight color="#d6f0ff" intensity={1.25} position={[-3, 4, -2]} />
      <group scale={preparedModel.scale}>
        <group position={preparedModel.offset}>
          <primitive object={preparedModel.scene} />
          <HoverOverlay
            apartments={preparedModel.apartments}
            hoveredApartmentId={hoveredApartmentId}
          />
        </group>
      </group>
      <OrbitControls
        enableDamping
        enablePan
        maxDistance={40}
        minDistance={4}
        target={[0, preparedModel.scaledHeight * 0.48, 0]}
      />
      <HoverTracker
        onHoverChange={onHoverChange}
        pickableMeshes={preparedModel.pickableMeshes}
      />
      <Html position={[0, preparedModel.scaledHeight + 1, 0]} center>
        <div className="rounded-full border border-white/20 bg-black/65 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
          {preparedModel.pickableMeshes.length} pickable meshes
        </div>
      </Html>
    </>
  );
}

export default function MaxSceneBlockHoverDebug() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredApartmentId, setHoveredApartmentId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<PointerPosition>({
    x: 16,
    y: 16,
  });

  return (
    <section className="min-h-dvh bg-[radial-gradient(circle_at_top,#1f2937_0%,#020617_68%)] text-white">
      <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col px-6 py-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em]">
              3ds Max GLB Hover Debug
            </h1>
            <p className="text-sm text-white/70">
              Floating GLB only. No video, no master-plan visibility gates.
            </p>
          </div>
          <div className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
            {hoveredApartmentId ? formatBlockLabel(hoveredApartmentId) : "No hover"}
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative min-h-[78vh] flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-black/30 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        >
          <Canvas dpr={[1, 1.5]} frameloop="always" gl={{ antialias: true, alpha: true }}>
            <Suspense fallback={<LoadingState />}>
              <DebugScene
                hoveredApartmentId={hoveredApartmentId}
                onHoverChange={(apartmentId, pointerPosition) => {
                  setHoveredApartmentId(apartmentId);

                  if (!pointerPosition || !containerRef.current) {
                    return;
                  }

                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltipPosition({
                    x: Math.min(pointerPosition.x + 18, rect.width - 220),
                    y: Math.min(pointerPosition.y + 18, rect.height - 80),
                  });
                }}
              />
            </Suspense>
          </Canvas>

          {hoveredApartmentId ? (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: `${Math.max(12, tooltipPosition.x)}px`,
                top: `${Math.max(12, tooltipPosition.y)}px`,
              }}
            >
              <div className="rounded-[18px] border border-emerald-200/25 bg-black/70 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <div className="text-lg font-semibold tracking-[-0.04em] text-white">
                  {formatBlockLabel(hoveredApartmentId)}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">
                  {hoveredApartmentId}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

useGLTF.preload(MODEL_PATH);
