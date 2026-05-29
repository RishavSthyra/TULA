"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Html,
  PerspectiveCamera,
  PointerLockControls,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import type { PointerLockControls as PointerLockControlsImpl } from "three-stdlib";
import {
  Box3,
  BufferGeometry,
  Euler,
  MathUtils,
  Mesh,
  Raycaster,
  type Group,
  type PerspectiveCamera as ThreePerspectiveCamera,
  Vector3,
} from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import { primeSignedAssetUrls } from "@/src/lib/signed-assets";
import { useSignedAssetUrl } from "@/src/lib/use-signed-assets";

const LOCK_BUTTON_ID = "landscape-free-roam-lock";
const DOWN_VECTOR = new Vector3(0, -1, 0);
const LOOK_SENSITIVITY = 0.0032;
const MOVEMENT_CODES = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "KeyA",
  "KeyC",
  "KeyD",
  "KeyS",
  "KeyW",
  "ShiftLeft",
  "ShiftRight",
  "Space",
]);

type SceneMetrics = {
  center: Vector3;
  collisionRadius: number;
  eyeHeight: number;
  far: number;
  floorY: number;
  moveSpeed: number;
  near: number;
  runMultiplier: number;
  startLookAt: Vector3;
  startPosition: Vector3;
  verticalSpeed: number;
};

type PreparedLandscape = {
  collidableMeshes: Mesh[];
  metrics: SceneMetrics;
};

type TouchControlsState = {
  ascend: boolean;
  descend: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
  moveX: number;
  moveY: number;
  running: boolean;
};

type LandscapeFreeRoamProps = {
  initialSignedAssetUrls?: Record<string, string>;
  localModelUrl?: string | null;
  modelAssetKey?: string | null;
};

const bufferGeometryPrototype = BufferGeometry.prototype as unknown as {
  computeBoundsTree?: typeof computeBoundsTree;
  disposeBoundsTree?: typeof disposeBoundsTree;
};

bufferGeometryPrototype.computeBoundsTree = computeBoundsTree;
bufferGeometryPrototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast as Mesh["raycast"];

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "BUTTON" ||
    target.tagName === "INPUT" ||
    target.tagName === "SELECT" ||
    target.tagName === "TEXTAREA"
  );
}

function buildSceneMetrics(scene: Group, collidableMeshes: Mesh[]) {
  const bounds = new Box3().setFromObject(scene);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const eyeHeight = MathUtils.clamp(size.y * 0.32, 1.65, 2.1);
  const collisionRadius = MathUtils.clamp(maxDimension * 0.0045, 0.45, 1.25);
  const startPosition = new Vector3(
    MathUtils.lerp(bounds.min.x, bounds.max.x, 0.18),
    bounds.min.y + eyeHeight,
    MathUtils.lerp(bounds.min.z, bounds.max.z, 0.7),
  );
  const startLookAt = new Vector3(center.x, bounds.min.y + eyeHeight, center.z);
  const floorRaycaster = new Raycaster();
  const floorRayOrigin = new Vector3(
    startPosition.x,
    bounds.max.y + eyeHeight * 6,
    startPosition.z,
  );
  floorRaycaster.set(floorRayOrigin, DOWN_VECTOR);

  const floorHit = floorRaycaster.intersectObjects(collidableMeshes, true)[0];

  if (floorHit) {
    startPosition.y = floorHit.point.y + eyeHeight;
    startLookAt.y = floorHit.point.y + eyeHeight * 0.92;
  }

  return {
    center,
    collisionRadius,
    eyeHeight,
    far: Math.max(maxDimension * 10, 1800),
    floorY: bounds.min.y,
    moveSpeed: MathUtils.clamp(maxDimension * 0.03, 4.5, 12),
    near: 0.05,
    runMultiplier: 2.1,
    startLookAt,
    startPosition,
    verticalSpeed: MathUtils.clamp(maxDimension * 0.025, 3.6, 9),
  } satisfies SceneMetrics;
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="rounded-full border border-white/20 bg-black/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-white shadow-[0_18px_42px_rgba(0,0,0,0.3)] backdrop-blur-md">
        Loading landscape
      </div>
    </Html>
  );
}

function LandscapeModel({
  modelUrl,
  onReady,
}: {
  modelUrl: string;
  onReady: (preparedLandscape: PreparedLandscape) => void;
}) {
  const { scene } = useGLTF(modelUrl);
  const preparedLandscape = useMemo(() => {
    const collidableMeshes: Mesh[] = [];

    scene.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }

      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = true;
      object.geometry.computeBoundsTree?.();
      collidableMeshes.push(object);
    });

    return {
      collidableMeshes,
      metrics: buildSceneMetrics(scene, collidableMeshes),
    } satisfies PreparedLandscape;
  }, [scene]);

  useEffect(() => {
    onReady(preparedLandscape);
  }, [onReady, preparedLandscape]);

  return <primitive object={scene} />;
}

function FreeRoamController({
  isActive,
  isTouchDevice,
  preparedLandscape,
  onLockChange,
  touchControlsRef,
}: {
  isActive: boolean;
  isTouchDevice: boolean;
  preparedLandscape: PreparedLandscape | null;
  onLockChange: (locked: boolean) => void;
  touchControlsRef: MutableRefObject<TouchControlsState>;
}) {
  const cameraRef = useRef<ThreePerspectiveCamera | null>(null);
  const controlsRef = useRef<PointerLockControlsImpl | null>(null);
  const collisionRaycasterRef = useRef(new Raycaster());
  const downRaycasterRef = useRef(new Raycaster());
  const eulerRef = useRef(new Euler(0, 0, 0, "YXZ"));
  const forwardRef = useRef(new Vector3());
  const keyStateRef = useRef<Record<string, boolean>>({});
  const lookAheadRef = useRef(new Vector3());
  const moveVectorRef = useRef(new Vector3());
  const nextPositionRef = useRef(new Vector3());
  const originRef = useRef(new Vector3());
  const pitchRef = useRef(0);
  const rightRef = useRef(new Vector3());
  const sampleOffsetRef = useRef(new Vector3());
  const hasPositionedRef = useRef(false);
  const yawRef = useRef(0);

  useEffect(() => {
    const camera = cameraRef.current;
    const metrics = preparedLandscape?.metrics;

    if (!camera || !metrics || hasPositionedRef.current) {
      return;
    }

    camera.position.copy(metrics.startPosition);
    lookAheadRef.current.copy(metrics.startLookAt);
    camera.lookAt(lookAheadRef.current);
    eulerRef.current.setFromQuaternion(camera.quaternion, "YXZ");
    yawRef.current = eulerRef.current.y;
    pitchRef.current = eulerRef.current.x;
    camera.near = metrics.near;
    camera.far = metrics.far;
    camera.updateProjectionMatrix();
    hasPositionedRef.current = true;
  }, [preparedLandscape]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !MOVEMENT_CODES.has(event.code)) {
        return;
      }

      event.preventDefault();
      keyStateRef.current[event.code] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!MOVEMENT_CODES.has(event.code)) {
        return;
      }

      event.preventDefault();
      keyStateRef.current[event.code] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      return;
    }

    keyStateRef.current = {};
  }, [isActive]);

  useFrame((_, delta) => {
    const camera = cameraRef.current;
    const metrics = preparedLandscape?.metrics;
    const collidableMeshes = preparedLandscape?.collidableMeshes;

    if (!camera || !metrics || !collidableMeshes?.length || !isActive) {
      return;
    }

    const keyState = keyStateRef.current;
    const touchState = touchControlsRef.current;
    const cappedDelta = Math.min(delta, 0.1);
    const keyboardForwardInput =
      Number(Boolean(keyState.KeyW || keyState.ArrowUp)) -
      Number(Boolean(keyState.KeyS || keyState.ArrowDown));
    const keyboardStrafeInput =
      Number(Boolean(keyState.KeyD || keyState.ArrowRight)) -
      Number(Boolean(keyState.KeyA || keyState.ArrowLeft));
    const keyboardVerticalInput =
      Number(Boolean(keyState.Space)) - Number(Boolean(keyState.KeyC));
    const forwardInput = isTouchDevice
      ? keyboardForwardInput - touchState.moveY
      : keyboardForwardInput;
    const strafeInput = isTouchDevice
      ? keyboardStrafeInput + touchState.moveX
      : keyboardStrafeInput;
    const verticalInput = isTouchDevice
      ? keyboardVerticalInput +
        Number(touchState.ascend) -
        Number(touchState.descend)
      : keyboardVerticalInput;
    const running = isTouchDevice
      ? Boolean(keyState.ShiftLeft || keyState.ShiftRight || touchState.running)
      : Boolean(keyState.ShiftLeft || keyState.ShiftRight);
    const moveSpeed =
      metrics.moveSpeed * (running ? metrics.runMultiplier : 1) * cappedDelta;
    const verticalSpeed =
      metrics.verticalSpeed * (running ? 1.12 : 1) * cappedDelta;

    if (isTouchDevice) {
      yawRef.current -= touchState.lookDeltaX * LOOK_SENSITIVITY;
      pitchRef.current = MathUtils.clamp(
        pitchRef.current - touchState.lookDeltaY * LOOK_SENSITIVITY,
        -1.3,
        1.3,
      );
      touchState.lookDeltaX = 0;
      touchState.lookDeltaY = 0;

      eulerRef.current.set(pitchRef.current, yawRef.current, 0, "YXZ");
      camera.quaternion.setFromEuler(eulerRef.current);
    }

    const forward = forwardRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = rightRef.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const moveVector = moveVectorRef.current.set(0, 0, 0);
    const nextPosition = nextPositionRef.current.copy(camera.position);

    forward.y = 0;
    right.y = 0;

    if (forward.lengthSq() > 0) {
      forward.normalize();
    }

    if (right.lengthSq() > 0) {
      right.normalize();
    }

    moveVector.addScaledVector(forward, forwardInput);
    moveVector.addScaledVector(right, strafeInput);

    if (moveVector.lengthSq() > 1) {
      moveVector.normalize();
    }

    if (moveVector.lengthSq() > 0) {
      const moveDirection = moveVector.normalize();
      const collisionRaycaster = collisionRaycasterRef.current;
      const horizontalStep = moveSpeed + metrics.collisionRadius;
      let isBlocked = false;

      for (const lateral of [-metrics.collisionRadius * 0.8, 0, metrics.collisionRadius * 0.8]) {
        sampleOffsetRef.current.copy(right).multiplyScalar(lateral);
        originRef.current
          .copy(camera.position)
          .add(sampleOffsetRef.current)
          .setY(camera.position.y - metrics.eyeHeight * 0.45);

        collisionRaycaster.set(originRef.current, moveDirection);

        const hit = collisionRaycaster.intersectObjects(collidableMeshes, true)[0];

        if (hit && hit.distance <= horizontalStep) {
          isBlocked = true;
          break;
        }
      }

      if (!isBlocked) {
        nextPosition.addScaledVector(moveDirection, moveSpeed);
      }
    }

    if (verticalInput !== 0) {
      nextPosition.y += verticalInput * verticalSpeed;
    } else {
      const downRaycaster = downRaycasterRef.current;
      originRef.current.set(
        nextPosition.x,
        camera.position.y + metrics.eyeHeight * 1.4,
        nextPosition.z,
      );
      downRaycaster.set(originRef.current, DOWN_VECTOR);

      const floorHit = downRaycaster.intersectObjects(collidableMeshes, true)[0];

      if (floorHit) {
        nextPosition.y = floorHit.point.y + metrics.eyeHeight;
      } else {
        nextPosition.y = Math.max(nextPosition.y, metrics.floorY + metrics.eyeHeight);
      }
    }

    nextPosition.y = Math.max(nextPosition.y, metrics.floorY + metrics.eyeHeight);
    camera.position.copy(nextPosition);
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        far={6000}
        fov={76}
        near={0.05}
      />
      <PointerLockControls
        ref={controlsRef}
        makeDefault
        selector={`#${LOCK_BUTTON_ID}`}
        enabled={!isTouchDevice}
        onLock={() => onLockChange(true)}
        onUnlock={() => onLockChange(false)}
      />
    </>
  );
}

function TouchActionButton({
  active,
  label,
  onChange,
}: {
  active: boolean;
  label: string;
  onChange: (nextActive: boolean) => void;
}) {
  const setActive = (nextActive: boolean) => {
    onChange(nextActive);
  };

  return (
    <button
      type="button"
      className={`touch-none rounded-full border px-4 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.28em] shadow-[0_14px_34px_rgba(0,0,0,0.18)] backdrop-blur-xl transition ${
        active
          ? "border-white/35 bg-white text-slate-950"
          : "border-white/20 bg-black/35 text-white/82"
      }`}
      onPointerCancel={() => setActive(false)}
      onPointerDown={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onPointerLeave={() => setActive(false)}
      onPointerUp={() => setActive(false)}
    >
      {label}
    </button>
  );
}

function TouchJoystick({
  onMove,
}: {
  onMove: (x: number, y: number) => void;
}) {
  const knobRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const updateFromEvent = (
    event: ReactPointerEvent<HTMLDivElement>,
    shouldCapture: boolean,
  ) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width * 0.34;
    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const safeDistance = distance > radius ? radius / distance : 1;
    const clampedX = deltaX * safeDistance;
    const clampedY = deltaY * safeDistance;
    const normalizedX = MathUtils.clamp(clampedX / radius, -1, 1);
    const normalizedY = MathUtils.clamp(clampedY / radius, -1, 1);

    if (shouldCapture) {
      element.setPointerCapture(event.pointerId);
      pointerIdRef.current = event.pointerId;
    }

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    }

    onMove(normalizedX, normalizedY);
  };

  const reset = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      pointerIdRef.current !== null &&
      event.currentTarget.hasPointerCapture(pointerIdRef.current)
    ) {
      event.currentTarget.releasePointerCapture(pointerIdRef.current);
    }

    pointerIdRef.current = null;

    if (knobRef.current) {
      knobRef.current.style.transform = "translate(0px, 0px)";
    }

    onMove(0, 0);
  };

  return (
    <div
      className="touch-none relative h-36 w-36 rounded-full border border-white/20 bg-black/28 shadow-[0_18px_44px_rgba(0,0,0,0.2)] backdrop-blur-xl"
      onPointerCancel={reset}
      onPointerDown={(event) => {
        event.preventDefault();
        updateFromEvent(event, true);
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current !== event.pointerId) {
          return;
        }

        event.preventDefault();
        updateFromEvent(event, false);
      }}
      onPointerUp={reset}
    >
      <div className="absolute inset-[18%] rounded-full border border-dashed border-white/18" />
      <div className="absolute inset-[36%] rounded-full border border-white/10" />
      <div
        ref={knobRef}
        className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/85 shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
      />
    </div>
  );
}

function TouchLookPad({
  onLook,
}: {
  onLook: (deltaX: number, deltaY: number) => void;
}) {
  const pointerIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reset = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      pointerIdRef.current !== null &&
      event.currentTarget.hasPointerCapture(pointerIdRef.current)
    ) {
      event.currentTarget.releasePointerCapture(pointerIdRef.current);
    }

    pointerIdRef.current = null;
    lastPointRef.current = null;
    setIsDragging(false);
  };

  return (
    <div
      className={`touch-none relative h-36 w-36 rounded-[2rem] border shadow-[0_18px_44px_rgba(0,0,0,0.2)] backdrop-blur-xl transition ${
        isDragging
          ? "border-white/32 bg-white/18"
          : "border-white/18 bg-black/22"
      }`}
      onPointerCancel={reset}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerIdRef.current = event.pointerId;
        lastPointRef.current = { x: event.clientX, y: event.clientY };
        setIsDragging(true);
      }}
      onPointerMove={(event) => {
        if (
          pointerIdRef.current !== event.pointerId ||
          !lastPointRef.current
        ) {
          return;
        }

        event.preventDefault();
        const deltaX = event.clientX - lastPointRef.current.x;
        const deltaY = event.clientY - lastPointRef.current.y;

        lastPointRef.current = { x: event.clientX, y: event.clientY };
        onLook(deltaX, deltaY);
      }}
      onPointerUp={reset}
    >
      <div className="absolute inset-5 rounded-[1.5rem] border border-dashed border-white/14" />
      <div className="absolute inset-0 flex items-center justify-center text-center text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-white/62">
        Look
      </div>
    </div>
  );
}

function MobileControlsOverlay({
  touchControlsRef,
}: {
  touchControlsRef: MutableRefObject<TouchControlsState>;
}) {
  const [ascendActive, setAscendActive] = useState(false);
  const [descendActive, setDescendActive] = useState(false);
  const [runActive, setRunActive] = useState(false);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-4 sm:p-6">
      <div className="flex flex-col items-start gap-3">
        <div className="rounded-full border border-white/18 bg-black/28 px-3 py-2 text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-white/72 backdrop-blur-xl">
          Move
        </div>
        <TouchJoystick
          onMove={(x, y) => {
            touchControlsRef.current.moveX = x;
            touchControlsRef.current.moveY = y;
          }}
        />
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="flex flex-wrap justify-end gap-2">
          <TouchActionButton
            active={ascendActive}
            label="Up"
            onChange={(nextActive) => {
              touchControlsRef.current.ascend = nextActive;
              setAscendActive(nextActive);
            }}
          />
          <TouchActionButton
            active={descendActive}
            label="Down"
            onChange={(nextActive) => {
              touchControlsRef.current.descend = nextActive;
              setDescendActive(nextActive);
            }}
          />
          <TouchActionButton
            active={runActive}
            label="Run"
            onChange={(nextActive) => {
              touchControlsRef.current.running = nextActive;
              setRunActive(nextActive);
            }}
          />
        </div>
        <div className="rounded-full border border-white/18 bg-black/28 px-3 py-2 text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-white/72 backdrop-blur-xl">
          Drag To Look
        </div>
        <TouchLookPad
          onLook={(deltaX, deltaY) => {
            touchControlsRef.current.lookDeltaX += deltaX;
            touchControlsRef.current.lookDeltaY += deltaY;
          }}
        />
      </div>
    </div>
  );
}

function ProgressOverlay() {
  const { active, progress } = useProgress();

  if (!active) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-30 max-w-sm rounded-[28px] border border-white/20 bg-black/45 px-4 py-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:left-6 sm:right-auto sm:top-6 sm:w-[20rem]">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-white/70">
        Streaming model
      </p>
      <p className="mt-2 text-sm font-medium text-white/92">
        Landscape2.glb is loading with its textures.
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/70">{progress.toFixed(0)}%</p>
    </div>
  );
}

export default function LandscapeFreeRoam({
  initialSignedAssetUrls = {},
  localModelUrl = null,
  modelAssetKey = null,
}: LandscapeFreeRoamProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isTouchSessionActive, setIsTouchSessionActive] = useState(false);
  const [preparedLandscape, setPreparedLandscape] =
    useState<PreparedLandscape | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const touchControlsRef = useRef<TouchControlsState>({
    ascend: false,
    descend: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
    moveX: 0,
    moveY: 0,
    running: false,
  });
  const seededModelUrl = modelAssetKey
    ? initialSignedAssetUrls[modelAssetKey] ?? null
    : null;
  const signedModelUrl = useSignedAssetUrl(modelAssetKey) ?? seededModelUrl;
  const resolvedModelUrl = signedModelUrl ?? localModelUrl;

  useEffect(() => {
    primeSignedAssetUrls(initialSignedAssetUrls);
  }, [initialSignedAssetUrls]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const coarsePointerMedia = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    );

    const syncTouchDevice = () => {
      setIsTouchDevice(coarsePointerMedia.matches);
    };

    syncTouchDevice();
    coarsePointerMedia.addEventListener("change", syncTouchDevice);

    return () => {
      coarsePointerMedia.removeEventListener("change", syncTouchDevice);
    };
  }, []);

  useEffect(() => {
    if (isTouchDevice) {
      return;
    }

    touchControlsRef.current = {
      ascend: false,
      descend: false,
      lookDeltaX: 0,
      lookDeltaY: 0,
      moveX: 0,
      moveY: 0,
      running: false,
    };
  }, [isTouchDevice]);

  const isActive = isTouchDevice ? isTouchSessionActive : isLocked;

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-screen overflow-hidden bg-[#d9e7f4] text-white"
    >
      <ProgressOverlay />

      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
        }}
        shadows
      >
        <color attach="background" args={["#d7e7f5"]} />
        <fog attach="fog" args={["#d7e7f5", 220, 2400]} />
        <ambientLight intensity={1.2} />
        <hemisphereLight
          args={["#f5fbff", "#a9bccd", 1.4]}
          position={[0, 120, 0]}
        />
        <directionalLight
          castShadow
          color="#fff6dc"
          intensity={1.75}
          position={[180, 240, 140]}
          shadow-bias={-0.00006}
          shadow-mapSize-height={2048}
          shadow-mapSize-width={2048}
        />
        <directionalLight color="#dcecff" intensity={0.55} position={[-160, 140, -120]} />

        <Suspense fallback={<LoadingFallback />}>
          {resolvedModelUrl ? (
            <>
              <LandscapeModel
                modelUrl={resolvedModelUrl}
                onReady={setPreparedLandscape}
              />
              <FreeRoamController
                isActive={isActive}
                isTouchDevice={isTouchDevice}
                onLockChange={setIsLocked}
                preparedLandscape={preparedLandscape}
                touchControlsRef={touchControlsRef}
              />
            </>
          ) : null}
        </Suspense>
      </Canvas>

      {isActive ? (
        <>
          <div className="pointer-events-none absolute right-4 top-4 z-20 rounded-full border border-white/20 bg-black/30 px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:right-6 sm:top-6">
            {isTouchDevice
              ? "Thumb Move · Drag Look · Up Down Run"
              : "WASD Move · Space Up · C Down · Shift Run · Esc Exit"}
          </div>
          {isTouchDevice ? (
            <MobileControlsOverlay touchControlsRef={touchControlsRef} />
          ) : null}
        </>
      ) : (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-sm rounded-[30px] border border-white/25 bg-black/35 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-white/72">
              {isTouchDevice ? "Touch Free Roam" : "Free Roam"}
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              {isTouchDevice ? "Mobile Walk Mode" : "Full Screen Walk"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/78 sm:text-[0.95rem]">
              {isTouchDevice
                ? "Starts inside the model with touch move, touch look, and on-screen up, down, and run controls."
                : "Starts inside the model, locks the mouse, and opens browser fullscreen."}
            </p>
            <button
              id={LOCK_BUTTON_ID}
              type="button"
              className="mt-5 inline-flex min-w-56 items-center justify-center rounded-full border border-white/30 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-slate-950 transition duration-200 hover:scale-[1.02] hover:bg-slate-100"
              onClick={() => {
                if (isTouchDevice) {
                  setIsTouchSessionActive(true);
                  return;
                }

                if (document.fullscreenElement || !sectionRef.current) {
                  return;
                }

                void sectionRef.current.requestFullscreen?.();
              }}
            >
              {isTouchDevice ? "Start Touch Controls" : "Enter Full Screen"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
