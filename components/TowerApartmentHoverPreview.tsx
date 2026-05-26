"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
  Outlines,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import {
  Box3,
  Group,
  Material,
  Matrix4,
  Mesh,
  Object3D,
  Vector2,
  Vector3,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type {
  InventoryApartment,
  InventoryStatus,
  TowerType,
} from "@/types/inventory";

const MODEL_PATH = "/models/Tower-Planes.glb";
const HOVER_VIDEO_PATH = "/360_Level_sequence_optimized.mp4";
const APARTMENT_ID_PATTERN = /^(Tower_[A-Z]_\d{2}_\d{3,4})_/;
const TARGET_MODEL_HEIGHT = 10;
const HOVER_VIDEO_ASPECT = 16 / 9;

type CoverViewport = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type HoverMeshData = {
  geometry: Mesh["geometry"];
  key: string;
  matrix: Matrix4;
};

type PreparedTowerModel = {
  apartmentCount: number;
  apartmentIds: string[];
  apartments: Map<string, HoverMeshData[]>;
  offset: [number, number, number];
  pickableMeshes: Mesh[];
  scaledHeight: number;
  scene: Group;
  scale: number;
};

type InventoryLoadState = "loading" | "ready" | "error";
type PointerPosition = { x: number; y: number };

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

function extractApartmentIdFromName(name: string) {
  return name.match(APARTMENT_ID_PATTERN)?.[1] ?? null;
}

function resolveApartmentIdFromObject(object: Object3D | null) {
  let current: Object3D | null = object;

  while (current) {
    const apartmentId = extractApartmentIdFromName(current.name);
    if (apartmentId) {
      return apartmentId;
    }

    current = current.parent;
  }

  return null;
}

function formatApartmentLabel(
  apartmentId: string | null,
  fallbackTower: TowerType,
) {
  if (!apartmentId) {
    return {
      floor: null,
      tower: fallbackTower,
      towerCode: fallbackTower.endsWith("B") ? "B" : "A",
      unit: null,
      title: "Hover a flat",
    };
  }

  const [, towerCode = "A", floorCode = "", unitCode = ""] =
    apartmentId.split("_");

  return {
    floor: floorCode,
    tower: `Tower ${towerCode}`,
    towerCode,
    unit: unitCode,
    title: `Flat ${unitCode}`,
  };
}

function normalizeFlatToken(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function buildFlatCandidates(apartmentId: string, tower: TowerType) {
  const apartment = formatApartmentLabel(apartmentId, tower);
  const unitToken = normalizeFlatToken(apartment.unit ?? "");
  const towerCode = normalizeFlatToken(apartment.towerCode);

  return new Set(
    [
      unitToken,
      `${towerCode}${unitToken}`,
      `T${towerCode}${unitToken}`,
      `${towerCode}FLAT${unitToken}`,
    ].filter(Boolean),
  );
}

function findInventoryApartment(
  apartments: InventoryApartment[],
  apartmentId: string | null,
  tower: TowerType,
) {
  if (!apartmentId) {
    return null;
  }

  const candidates = buildFlatCandidates(apartmentId, tower);

  return (
    apartments.find((apartment) => {
      if (apartment.tower !== tower) {
        return false;
      }

      const flatToken = normalizeFlatToken(apartment.flatNumber);
      const titleToken = normalizeFlatToken(apartment.title);
      return candidates.has(flatToken) || candidates.has(titleToken);
    }) ?? null
  );
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

function prepareTowerScene(sourceScene: Object3D) {
  const scene = cloneSkeleton(sourceScene) as Group;
  const apartments = new Map<string, HoverMeshData[]>();
  const pickableMeshes: Mesh[] = [];

  scene.updateWorldMatrix(true, true);

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    const invisibleMaterials = materials.map((material) => {
      const nextMaterial = (material as Material).clone();
      nextMaterial.transparent = true;
      nextMaterial.opacity = 0;
      nextMaterial.depthWrite = false;
      nextMaterial.colorWrite = false;
      return nextMaterial;
    });

    object.material = Array.isArray(object.material)
      ? invisibleMaterials
      : invisibleMaterials[0];

    const apartmentId = resolveApartmentIdFromObject(object);

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
    apartmentCount: apartments.size,
    apartmentIds: [...apartments.keys()].sort((left, right) =>
      left.localeCompare(right),
    ),
    apartments,
    offset: [-center.x, -bounds.min.y, -center.z] as [number, number, number],
    pickableMeshes,
    scaledHeight: size.y * scale,
    scene,
    scale,
  } satisfies PreparedTowerModel;
}

function LoadingState() {
  return (
    <Html center>
      <div className="rounded-full border border-white/30 bg-slate-950/88 px-4 py-2 text-xs font-medium tracking-[0.28em] text-white uppercase shadow-[0_12px_48px_rgba(15,23,42,0.28)]">
        Loading tower model
      </div>
    </Html>
  );
}

function HoverTracker({
  allowHover,
  onHoverChange,
  pickableMeshes,
}: {
  allowHover: boolean;
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
    let latestButtons = 0;

    const updateHover = (
      apartmentId: string | null,
      pointerPosition: PointerPosition | null,
    ) => {
      onHoverChange(apartmentId, pointerPosition);
    };

    if (!allowHover || pickableMeshes.length === 0) {
      updateHover(null, null);
      return;
    }

    const processPointerMove = () => {
      frameId = 0;

      if (latestButtons !== 0) {
        updateHover(null, null);
        return;
      }

      const rect = element.getBoundingClientRect();
      const pointerPosition = {
        x: latestClientX - rect.left,
        y: latestClientY - rect.top,
      };

      pointer.x = (pointerPosition.x / rect.width) * 2 - 1;
      pointer.y = -(pointerPosition.y / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const intersections = raycaster.intersectObjects(pickableMeshes, false);
      const frontFacingHit = intersections.find((intersection) => {
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
      const fallbackHit = intersections.find(
        (intersection) =>
          typeof intersection.object.userData.apartmentId === "string",
      );
      const hit = frontFacingHit ?? fallbackHit ?? null;

      updateHover(
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
      latestButtons = event.buttons;

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
  }, [allowHover, camera, gl, onHoverChange, pickableMeshes, raycaster]);

  return null;
}

function HoverOverlay({
  hoveredApartmentId,
  apartments,
}: {
  hoveredApartmentId: string | null;
  apartments: PreparedTowerModel["apartments"];
}) {
  const hoveredMeshes = hoveredApartmentId
    ? apartments.get(hoveredApartmentId) ?? []
    : [];

  if (!hoveredMeshes.length) {
    return null;
  }

  return (
    <group>
      {hoveredMeshes.map((meshData) => (
        <mesh
          key={meshData.key}
          frustumCulled={false}
          geometry={meshData.geometry}
          matrix={meshData.matrix}
          matrixAutoUpdate={false}
          raycast={() => null}
          renderOrder={12}
        >
          <meshPhysicalMaterial
            clearcoat={1}
            clearcoatRoughness={0.04}
            color="#ffe38a"
            depthWrite={false}
            emissive="#ffd24a"
            emissiveIntensity={1.6}
            metalness={0.12}
            opacity={0.78}
            polygonOffset
            polygonOffsetFactor={-8}
            roughness={0.14}
            toneMapped={false}
            transparent
          />
          <Outlines
            angle={Math.PI}
            color="#fff7b2"
            opacity={1}
            screenspace
            thickness={4.4}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function TowerApartmentScene({
  allowHover,
  hoveredApartmentId,
  onHoverChange,
}: {
  allowHover: boolean;
  hoveredApartmentId: string | null;
  onHoverChange: (
    apartmentId: string | null,
    pointerPosition: PointerPosition | null,
  ) => void;
}) {
  const { scene } = useGLTF(MODEL_PATH);
  const preparedModel = useMemo(() => prepareTowerScene(scene), [scene]);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        far={120}
        fov={34}
        near={0.1}
        position={[10.5, 7.25, 13.5]}
      />

      <ambientLight intensity={1.75} />
      <directionalLight color="#fff7d8" intensity={2.85} position={[12, 16, 8]} />
      <directionalLight color="#d9ecff" intensity={1.2} position={[-10, 10, -10]} />

      <group scale={preparedModel.scale}>
        <group position={preparedModel.offset}>
          <primitive object={preparedModel.scene} />
          {allowHover ? (
            <HoverOverlay
              apartments={preparedModel.apartments}
              hoveredApartmentId={hoveredApartmentId}
            />
          ) : null}
        </group>
      </group>

      <OrbitControls
        enableDamping={allowHover}
        enablePan={false}
        maxDistance={24}
        maxPolarAngle={1.46}
        minDistance={7}
        minPolarAngle={0.55}
        target={[0, preparedModel.scaledHeight * 0.52, 0]}
      />

      <HoverTracker
        allowHover={allowHover}
        onHoverChange={onHoverChange}
        pickableMeshes={preparedModel.pickableMeshes}
      />
    </>
  );
}

export default function TowerApartmentHoverPreview({
  tower = "Tower A",
}: {
  tower?: TowerType;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hoveredApartmentIdRef = useRef<string | null>(null);
  const [sectionSize, setSectionSize] = useState({ width: 0, height: 0 });
  const [videoAspect, setVideoAspect] = useState(HOVER_VIDEO_ASPECT);
  const [hoveredApartmentId, setHoveredApartmentId] = useState<string | null>(
    null,
  );
  const [inventoryState, setInventoryState] = useState<InventoryLoadState>(
    "loading",
  );
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryApartments, setInventoryApartments] = useState<
    InventoryApartment[]
  >([]);
  const [supportsPreciseHover, setSupportsPreciseHover] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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
    const section = sectionRef.current;

    if (!section || typeof ResizeObserver === "undefined") {
      return;
    }

    const syncSectionSize = () => {
      setSectionSize({
        width: section.clientWidth,
        height: section.clientHeight,
      });
    };

    syncSectionSize();

    const resizeObserver = new ResizeObserver(() => {
      syncSectionSize();
    });

    resizeObserver.observe(section);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadInventory = async () => {
      setInventoryState("loading");

      try {
        const response = await fetch("/api/inventory", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          apartments?: InventoryApartment[];
          message?: string;
        };

        if (!response.ok || !result.apartments) {
          throw new Error(result.message || "Failed to load inventory.");
        }

        if (!isMounted) {
          return;
        }

        setInventoryApartments(
          result.apartments.filter((apartment) => apartment.tower === tower),
        );
        setInventoryError(null);
        setInventoryState("ready");
      } catch (error) {
        if (controller.signal.aborted || !isMounted) {
          return;
        }

        setInventoryApartments([]);
        setInventoryError(
          error instanceof Error
            ? error.message
            : "Failed to load inventory.",
        );
        setInventoryState("error");
      }
    };

    void loadInventory();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [tower]);

  const allowHover = supportsPreciseHover && !prefersReducedMotion;
  const coverViewport = useMemo(
    () =>
      getCoverViewport(
        sectionSize.width,
        sectionSize.height,
        videoAspect || HOVER_VIDEO_ASPECT,
      ),
    [sectionSize.height, sectionSize.width, videoAspect],
  );

  useEffect(() => {
    if (allowHover) {
      return;
    }

    hoveredApartmentIdRef.current = null;
    setHoveredApartmentId(null);
  }, [allowHover]);

  const hoveredApartment = formatApartmentLabel(hoveredApartmentId, tower);
  const hoveredInventoryApartment = useMemo(
    () => findInventoryApartment(inventoryApartments, hoveredApartmentId, tower),
    [hoveredApartmentId, inventoryApartments, tower],
  );
  const hoveredFlatLabel = (
    hoveredInventoryApartment?.flatNumber ||
    hoveredApartment.unit ||
    "--"
  )
    .toUpperCase()
    .trim();
  const statusMeta = getStatusMeta(
    hoveredInventoryApartment?.status,
    inventoryState,
    inventoryError,
  );

  const updateTooltipPosition = (pointerPosition: PointerPosition | null) => {
    if (!pointerPosition || !sectionRef.current || !tooltipRef.current) {
      return;
    }

    const rect = sectionRef.current.getBoundingClientRect();
    const tooltipWidth = 180;
    const tooltipHeight = 62;
    const offsetX = 16;
    const offsetY = 16;

    const nextLeft = Math.min(
      Math.max(pointerPosition.x + coverViewport.left + offsetX, 12),
      Math.max(rect.width - tooltipWidth - 12, 12),
    );
    const nextTop = Math.min(
      Math.max(pointerPosition.y + coverViewport.top + offsetY, 12),
      Math.max(rect.height - tooltipHeight - 12, 12),
    );

    tooltipRef.current.style.left = `${nextLeft}px`;
    tooltipRef.current.style.top = `${nextTop}px`;
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-dvh w-full overflow-hidden bg-black"
    >
      <div className="absolute inset-0">
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
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              src={HOVER_VIDEO_PATH}
              className="absolute inset-0 h-full w-full"
              onLoadedMetadata={(event) => {
                const nextAspect =
                  event.currentTarget.videoWidth > 0 &&
                  event.currentTarget.videoHeight > 0
                    ? event.currentTarget.videoWidth / event.currentTarget.videoHeight
                    : HOVER_VIDEO_ASPECT;

                setVideoAspect(nextAspect);
              }}
            />

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,226,138,0.18),_transparent_28%),radial-gradient(circle_at_84%_18%,_rgba(96,165,250,0.18),_transparent_24%),linear-gradient(180deg,_rgba(0,0,0,0.10),_rgba(0,0,0,0.16))]" />
          </div>
        </div>

        <div
          className={`absolute ${
            allowHover && hoveredApartmentId
              ? "cursor-pointer"
              : "cursor-[grab] active:cursor-[grabbing]"
          }`}
          style={{
            height: `${coverViewport.height}px`,
            left: `${coverViewport.left}px`,
            top: `${coverViewport.top}px`,
            width: `${coverViewport.width}px`,
          }}
        >
          <Canvas
            dpr={allowHover ? [1, 1.25] : 1}
            frameloop="demand"
            gl={{
              alpha: true,
              antialias: allowHover,
              powerPreference: allowHover ? "high-performance" : "low-power",
            }}
          >
            <Suspense fallback={<LoadingState />}>
              <TowerApartmentScene
                allowHover={allowHover}
                hoveredApartmentId={hoveredApartmentId}
                onHoverChange={(apartmentId, nextPointerPosition) => {
                  if (!allowHover) {
                    return;
                  }

                  updateTooltipPosition(nextPointerPosition);

                  if (hoveredApartmentIdRef.current === apartmentId) {
                    return;
                  }

                  hoveredApartmentIdRef.current = apartmentId;
                  setHoveredApartmentId(apartmentId);
                }}
              />
            </Suspense>
          </Canvas>
        </div>
      </div>

      {allowHover && hoveredApartmentId ? (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-30"
          style={{ left: 12, top: 12 }}
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

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap gap-3">
          <div className="rounded-full border border-white/70 bg-white/72 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-md">
            {tower} Live Hover
          </div>
          <div className="rounded-full border border-white/70 bg-white/72 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-md">
            {inventoryState === "ready"
              ? `${inventoryApartments.length} synced flats`
              : inventoryState === "loading"
                ? "Syncing inventory"
                : "Inventory offline"}
          </div>
        </div>

        <div className="rounded-full border border-white/70 bg-white/72 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-md">
          {allowHover ? "Desktop hover enabled" : "Touch-optimized view"}
        </div>
      </div>
    </section>
  );
}

useGLTF.preload(MODEL_PATH);
