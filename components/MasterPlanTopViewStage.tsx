"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Euler,
  MathUtils,
  Quaternion,
  Vector3,
} from "three";
import {
  Bike,
  Bird,
  BriefcaseBusiness,
  Building2,
  Dumbbell,
  Flame,
  Flower2,
  Gem,
  Goal,
  Leaf,
  PartyPopper,
  PawPrint,
  Theater,
  ToyBrick,
  Trees,
  Waves,
} from "lucide-react";
import {
  masterPlanAmenities,
  type MasterPlanAmenity,
  type MasterPlanAmenityIconKey,
} from "@/data/masterPlanAmenities";
import { useSignedAssetUrl } from "@/src/lib/use-signed-assets";

const TOP_VIEW_VIDEO_URL =
  "https://res.cloudinary.com/dlhfbu3kh/video/upload/v1774910334/Sequence_01.mp4";
const TOP_VIEW_PLACEHOLDER_IMAGE =
  "images/first_frame_again.png";
const TOP_VIEW_VIDEO_ASPECT = 16 / 9;

const AMENITY_ICON_COMPONENTS: Record<MasterPlanAmenityIconKey, LucideIcon> = {
  bird: Bird,
  business: BriefcaseBusiness,
  clubhouse: Building2,
  fire: Flame,
  fitness: Dumbbell,
  flower: Flower2,
  garden: Trees,
  nature: Leaf,
  party: PartyPopper,
  pet: PawPrint,
  play: ToyBrick,
  pool: Waves,
  rock: Gem,
  sport: Goal,
  theater: Theater,
  track: Bike,
};

const TOP_VIEW_BOUNDS = {
  bottom: 88,
  left: 10,
  right: 91,
  top: 10,
} as const;

const TOP_VIEW_CAMERA = {
  fov: 71.62112426757812,
  position: {
    x: -1360.8571052618827,
    y: -1984.121696051613,
    z: 36578.260066937,
  },
  rotation: {
    pitch: -89.01585861374649,
    roll: 4.62944967445894e-12,
    yaw: 90.61279095256934,
  },
} as const;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function unrealToThreePosition(point: { x: number; y: number; z: number }) {
  return new Vector3(point.x, point.z, point.y);
}

function unrealEulerToThreeQuaternion(rotation: {
  pitch: number;
  roll: number;
  yaw: number;
}) {
  const euler = new Euler(
    MathUtils.degToRad(rotation.pitch),
    -MathUtils.degToRad(rotation.yaw) - Math.PI / 2,
    -MathUtils.degToRad(rotation.roll),
    "YXZ",
  );

  return new Quaternion().setFromEuler(euler);
}

const TOP_VIEW_CAMERA_VERTICAL_FOV = MathUtils.radToDeg(
  2 *
    Math.atan(
      Math.tan(MathUtils.degToRad(TOP_VIEW_CAMERA.fov) / 2) /
        TOP_VIEW_VIDEO_ASPECT,
    ),
);
const TOP_VIEW_CAMERA_HORIZONTAL_FOV_RAD = MathUtils.degToRad(
  TOP_VIEW_CAMERA.fov,
);
const TOP_VIEW_CAMERA_VERTICAL_FOV_RAD = MathUtils.degToRad(
  TOP_VIEW_CAMERA_VERTICAL_FOV,
);
const topViewCameraPosition = unrealToThreePosition(TOP_VIEW_CAMERA.position);
const topViewCameraQuaternion = unrealEulerToThreeQuaternion(
  TOP_VIEW_CAMERA.rotation,
);
const topViewGroundRight = new Vector3(1, 0, 0)
  .applyQuaternion(topViewCameraQuaternion)
  .setY(0)
  .normalize();
const topViewGroundUp = new Vector3(0, 1, 0)
  .applyQuaternion(topViewCameraQuaternion)
  .setY(0)
  .normalize();

function mapAmenityToTopViewPosition(amenity: MasterPlanAmenity) {
  const worldPoint = unrealToThreePosition(amenity.coordinate);
  const groundDelta = worldPoint.clone().sub(topViewCameraPosition);
  groundDelta.y = 0;
  const localX = groundDelta.dot(topViewGroundRight);
  const localY = groundDelta.dot(topViewGroundUp);
  const depth = Math.max(topViewCameraPosition.y - worldPoint.y, 1);
  const projectedX =
    localX / (depth * Math.tan(TOP_VIEW_CAMERA_HORIZONTAL_FOV_RAD / 2));
  const projectedY =
    localY / (depth * Math.tan(TOP_VIEW_CAMERA_VERTICAL_FOV_RAD / 2));

  return {
    xPercent:
      TOP_VIEW_BOUNDS.left +
      clampNumber((projectedX + 1) / 2, 0, 1) *
        (TOP_VIEW_BOUNDS.right - TOP_VIEW_BOUNDS.left),
    yPercent:
      TOP_VIEW_BOUNDS.top +
      clampNumber((1 - projectedY) / 2, 0, 1) *
        (TOP_VIEW_BOUNDS.bottom - TOP_VIEW_BOUNDS.top),
  };
}

export default function MasterPlanTopViewStage() {
  const signedTopViewPlaceholderImageUrl = useSignedAssetUrl(
    TOP_VIEW_PLACEHOLDER_IMAGE,
  );
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [hasPlaybackCompleted, setHasPlaybackCompleted] = useState(false);
  const [hoveredAmenityId, setHoveredAmenityId] = useState<string | null>(null);
  const [pinnedAmenityId, setPinnedAmenityId] = useState<string | null>(null);

  const topViewAmenities = useMemo(
    () =>
      masterPlanAmenities.map((amenity) => ({
        ...amenity,
        ...mapAmenityToTopViewPosition(amenity),
      })),
    [],
  );

  return (
    <section className="absolute inset-0 overflow-hidden bg-black">
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${
          isVideoReady ? "opacity-0" : "opacity-100"
        }`}
        style={{
          backgroundImage: signedTopViewPlaceholderImageUrl
            ? `url('${signedTopViewPlaceholderImageUrl}')`
            : undefined,
        }}
      />

      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          isVideoReady ? "opacity-100" : "opacity-0"
        }`}
        onEnded={() => setHasPlaybackCompleted(true)}
        onLoadedData={() => setIsVideoReady(true)}
        onPlay={() => setHasPlaybackCompleted(false)}
      >
        <source src={TOP_VIEW_VIDEO_URL} type="video/mp4" />
      </video>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_32%,rgba(0,0,0,0.12)_100%)]" />

      <div
        className="absolute inset-0"
        onPointerDown={(event) => {
          if (!hasPlaybackCompleted) {
            return;
          }

          if (event.target === event.currentTarget) {
            setPinnedAmenityId(null);
          }
        }}
      >
        {hasPlaybackCompleted
          ? topViewAmenities.map((amenity) => {
          const Icon = AMENITY_ICON_COMPONENTS[amenity.iconKey];
          const isActive =
            hoveredAmenityId === amenity.id || pinnedAmenityId === amenity.id;

          return (
            <div
              key={amenity.id}
              className="absolute"
              style={{
                left: `${amenity.xPercent}%`,
                top: `${amenity.yPercent}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {isActive ? (
                <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+0.45rem)] whitespace-nowrap rounded-full border border-white/20 bg-black/82 px-2.5 py-1 text-[10px] font-medium tracking-[0.01em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.32)] backdrop-blur-md">
                  {amenity.label}
                </div>
              ) : null}

              <button
                type="button"
                aria-label={amenity.label}
                className={`relative flex h-7 w-7 items-center justify-center rounded-full border transition duration-200 sm:h-8 sm:w-8 ${
                  isActive
                    ? "-translate-y-0.5 border-black bg-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.34)]"
                    : "border-black/25 bg-white text-black shadow-[0_10px_22px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.92)] hover:-translate-y-0.5"
                }`}
                onBlur={() => {
                  setHoveredAmenityId((currentAmenityId) =>
                    currentAmenityId === amenity.id ? null : currentAmenityId,
                  );
                }}
                onFocus={() => {
                  setHoveredAmenityId(amenity.id);
                }}
                onMouseEnter={() => {
                  setHoveredAmenityId(amenity.id);
                }}
                onMouseLeave={() => {
                  setHoveredAmenityId((currentAmenityId) =>
                    currentAmenityId === amenity.id ? null : currentAmenityId,
                  );
                }}
                onPointerUp={(event) => {
                  if (event.pointerType !== "touch" && event.pointerType !== "pen") {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  setHoveredAmenityId(amenity.id);
                  setPinnedAmenityId((currentAmenityId) =>
                    currentAmenityId === amenity.id ? null : amenity.id,
                  );
                }}
              >
                <Icon
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 stroke-[2.2] transition duration-200 sm:h-4 sm:w-4 ${
                    isActive ? "scale-110" : ""
                  }`}
                />
              </button>
            </div>
          );
        })
          : null}
      </div>
    </section>
  );
}
