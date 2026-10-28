"use client";

import NextImage from "next/image";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  motion,
  AnimatePresence,
  type Variants,
  type Easing,
} from "framer-motion";
import MasterPlanTopViewStage from "./MasterPlanTopViewStage";
import MasterPlanFrameHoverStage from "./MasterPlanFrameHoverStage";
import SelectedFlatDetailsPanel from "./SelectedFlatDetailsPanel";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Building2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Ruler,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import TowerSelect from "./TowerSelect";
import { scheduleAmenityVideoWarmup } from "@/lib/amenity-video-warmup";
import {
  MASTER_PLAN_HOTSPOT_FRAMES,
  getNearestMasterPlanHotspot,
} from "@/lib/master-plan-hotspots";
import { readJsonResponse } from "@/lib/utils";
import { formatBlockLabel } from "@/lib/inventory-display";
import { SITE_ICON_URL } from "@/lib/metadata";
import type { InventoryApartment, TowerType } from "@/types/inventory";
import type { MasterPlanDeveloperConfig } from "@/types/developer-config";
import SignedImage from "@/src/components/common/SignedImage";
import { primeSignedAssetUrls } from "@/src/lib/signed-assets";
import { useSignedAssetUrls } from "@/src/lib/use-signed-assets";

const facingOptions = ["All", "North", "South", "East", "West"] as const;
const statusOptions = ["All", "Available", "Reserved", "Sold"] as const;
const bhkOptions = ["All", "2", "3", "3.5", "4"] as const;
type BhkFilterValue = (typeof bhkOptions)[number] | null;
type FacingFilterValue = (typeof facingOptions)[number] | null;
type StatusFilterValue = (typeof statusOptions)[number] | null;
const FLOOR_ALL_VALUE = "All";
const INVENTORY_REFRESH_INTERVAL = 15000;
const MATCHING_FLATS_PAGE_SIZE = 24;
const FALLBACK_AREA_RANGE = { min: 1376.73, max: 2801.81 } as const;
const AREA_RANGE_STEP = 0.01;
const TOTAL_MASTER_PLAN_FRAMES = 360;
const MASTER_PLAN_SNAP_FRAMES = MASTER_PLAN_HOTSPOT_FRAMES;
const SPECIAL_UNIT_VIDEO_TOWER: TowerType = "Tower B";
const SPECIAL_UNIT_VIDEO_HOTSPOT = "A1";
const SPECIAL_UNIT_VIDEO_FRAME = 1;
type SpecialUnitVideoConfig = {
  forwardUrl: string;
  reverseUrl: string;
};

const SPECIAL_UNIT_VIDEO_CONFIGS: Record<string, SpecialUnitVideoConfig> = {
  "3601": {
    forwardUrl: "videos/Unit  View.mp4",
    reverseUrl: "videos/Unit View 3S Reversed New_Compressed.mp4",
  },
  "3001": {
    forwardUrl: "videos/Unit  View4sec.mp4",
    reverseUrl: "videos/Unit_View4sec_reversed_SMALL.mp4",
  },
};
const MASTER_PLAN_STAGE_FALLBACK_IMAGE = "images/first_frame_again.png";
const SPECIAL_UNIT_VIDEO_NAVIGATION_DELAY_MS = 760;
const HOTSPOT_NAVIGATION_MIN_DURATION_MS = 380;
const HOTSPOT_NAVIGATION_MAX_DURATION_MS = 720;
const HOTSPOT_NAVIGATION_MS_PER_FRAME = 6.8;
const smoothEase: Easing = [0.22, 1, 0.36, 1];
let sharedInventoryRequest: Promise<InventoryApartment[]> | null = null;

type AreaRange = {
  min: number;
  max: number;
};

type SelectedAreaRange = {
  min: number | null;
  max: number | null;
};

const areaFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatAreaSqft(value: number) {
  return areaFormatter.format(value);
}

const masterPlanSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    x: "100%",
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.9,
      ease: smoothEase,
      delay: 0.2,
    },
  },
  exit: {
    opacity: 0,
    x: "100%",
    transition: {
      duration: 0.75,
      ease: smoothEase,
    },
  },
};

const staggerWrap: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.12,
    },
  },
};

const itemAnim: Variants = {
  hidden: { opacity: 0, x: 30, scale: 0.98 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.42, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    x: 20,
    scale: 0.98,
    transition: { duration: 0.2 },
  },
};

function getApartmentMeshId(apartment: InventoryApartment) {
  const towerCode = apartment.tower.slice(-1);
  const floorCode = String(apartment.floor)
    .replace(/[^0-9]/g, "")
    .padStart(2, "0");
  const flatCode = apartment.flatNumber
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();

  if (!floorCode || !flatCode) {
    return null;
  }

  return `Tower_${towerCode}_${floorCode}_${flatCode}`;
}

type MasterPlanLayoutProps = {
  initialApartments?: InventoryApartment[];
  initialSignedAssetUrls?: Record<string, string>;
  masterPlanConfig?: MasterPlanDeveloperConfig;
};

type FloorFilterOption = {
  value: string;
  label: string;
};

type FilterableApartmentRow = {
  apartment: InventoryApartment;
  floorValue: string;
  searchText: string;
};

type WarmVideoHandle = {
  preloadLink: HTMLLinkElement;
  warmVideo: HTMLVideoElement;
};

function createVideoWarmup(src: string) {
  const preloadLink = document.createElement("link");
  preloadLink.rel = "preload";
  preloadLink.as = "video";
  preloadLink.href = src;
  preloadLink.crossOrigin = "anonymous";
  document.head.appendChild(preloadLink);

  const warmVideo = document.createElement("video");
  warmVideo.preload = "auto";
  warmVideo.muted = true;
  warmVideo.playsInline = true;
  warmVideo.crossOrigin = "anonymous";
  warmVideo.src = src;
  warmVideo.load();

  return {
    preloadLink,
    warmVideo,
  };
}

function cleanupVideoWarmup(handle: WarmVideoHandle | null) {
  if (!handle) {
    return;
  }

  handle.preloadLink.remove();
  handle.warmVideo.pause();
  handle.warmVideo.removeAttribute("src");
  handle.warmVideo.load();
}

async function fetchSharedInventory() {
  if (!sharedInventoryRequest) {
    sharedInventoryRequest = fetch("/api/inventory", {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await readJsonResponse<{
          apartments?: InventoryApartment[];
          message?: string;
        }>(response, "Inventory API");

        if (!response.ok || !result.apartments) {
          throw new Error(result.message || "Failed to fetch inventory.");
        }

        return result.apartments;
      })
      .finally(() => {
        sharedInventoryRequest = null;
      });
  }

  return sharedInventoryRequest;
}

function getApartmentSignature(apartments: InventoryApartment[]) {
  return apartments
    .map(
      ({
        id,
        title,
        tower,
        bhk,
        priceLakhs,
        areaSqft,
        facing,
        status,
        floorLabel,
        floorPlanId,
      }) =>
        [
          id,
          title,
          tower,
          bhk,
          priceLakhs,
          areaSqft,
          facing,
          status,
          floorLabel,
          floorPlanId,
        ].join(":"),
    )
    .join("|");
}

function getApartmentFlatToken(apartment: InventoryApartment) {
  return (apartment.flatNumber || apartment.title || "")
    .replace(/[^0-9]/g, "")
    .trim();
}

function getRoomDimensionItems(roomDimensions: string) {
  return roomDimensions
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const [label, ...valueParts] = part.split(":");
      const value = valueParts.join(":").trim();

      return {
        key: `${label || part}-${index}`,
        label: value ? label.trim() : `Space ${index + 1}`,
        value: value || label.trim(),
      };
    });
}

function compareMasterPlanApartments(
  left: InventoryApartment,
  right: InventoryApartment,
) {
  if (left.floor !== right.floor) {
    return left.floor - right.floor;
  }

  const leftFlatKey = left.flatNumber || left.title;
  const rightFlatKey = right.flatNumber || right.title;
  const flatComparison = leftFlatKey.localeCompare(rightFlatKey, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  if (flatComparison !== 0) {
    return flatComparison;
  }

  return left.title.localeCompare(right.title, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function wrapMasterPlanFrame(
  frame: number,
  totalFrames = TOTAL_MASTER_PLAN_FRAMES,
) {
  return ((frame - 1 + totalFrames) % totalFrames) + 1;
}

function getShortestMasterPlanFrameDistance(
  fromFrame: number,
  toFrame: number,
  totalFrames = TOTAL_MASTER_PLAN_FRAMES,
) {
  const normalizedFromFrame = wrapMasterPlanFrame(fromFrame, totalFrames);
  const normalizedToFrame = wrapMasterPlanFrame(toFrame, totalFrames);
  const directDistance = Math.abs(normalizedToFrame - normalizedFromFrame);

  return Math.min(directDistance, totalFrames - directDistance);
}

function getMasterPlanFrameTransitionDuration(
  fromFrame: number,
  toFrame: number,
) {
  const frameDistance = getShortestMasterPlanFrameDistance(fromFrame, toFrame);

  return Math.min(
    HOTSPOT_NAVIGATION_MAX_DURATION_MS,
    Math.max(
      HOTSPOT_NAVIGATION_MIN_DURATION_MS,
      frameDistance * HOTSPOT_NAVIGATION_MS_PER_FRAME,
    ),
  );
}

function isSpecialVideoApartment(
  apartment: InventoryApartment | null,
  configs: Record<string, SpecialUnitVideoConfig>,
) {
  if (!apartment) {
    return false;
  }

  return (
    apartment.tower === SPECIAL_UNIT_VIDEO_TOWER &&
    Boolean(configs[getApartmentFlatToken(apartment)])
  );
}

function getSpecialUnitVideoConfig(
  flatToken: string,
  configs: Record<string, SpecialUnitVideoConfig>,
) {
  return configs[flatToken] ?? null;
}

function MasterPlanHotspotControls({
  onPrevious,
  onNext,
  compact = false,
}: {
  onPrevious: () => void;
  onNext: () => void;
  compact?: boolean;
}) {
  return (
    <div
      data-master-plan-stage-controls
      className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.42),rgba(255,255,255,0.14))] shadow-[0_18px_46px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(20,20,24,0.46),rgba(20,20,24,0.2))] ${
        compact ? "" : ""
      } ${compact ? "p-1.5" : "p-2"}`}
    >
      <button
        type="button"
        onClick={onPrevious}
        onContextMenu={(event) => event.preventDefault()}
        className={`group inline-flex touch-manipulation items-center justify-center rounded-full border border-white/45 bg-white/72 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(15,23,42,0.12)] transition duration-300 hover:bg-white/88 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.22)] dark:hover:bg-white/14 ${
          compact
            ? "h-9 w-9"
            : "h-10 w-10 hover:-translate-x-0.5 sm:h-11 sm:w-11"
        }`}
        aria-label="Previous master plan hotspot"
      >
        <ArrowLeft
          className={`h-4 w-4 transition duration-300 ${
            compact ? "" : "group-hover:-translate-x-0.5"
          }`}
        />
      </button>

      <div className="h-7 w-px bg-gradient-to-b from-white/0 via-white/35 to-white/0 dark:via-white/12 sm:h-8" />

      <button
        type="button"
        onClick={onNext}
        onContextMenu={(event) => event.preventDefault()}
        className={`group inline-flex touch-manipulation items-center justify-center rounded-full border border-white/45 bg-white/72 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(15,23,42,0.12)] transition duration-300 hover:bg-white/88 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.22)] dark:hover:bg-white/14 ${
          compact
            ? "h-9 w-9"
            : "h-10 w-10 hover:translate-x-0.5 sm:h-11 sm:w-11"
        }`}
        aria-label="Next master plan hotspot"
      >
        <ArrowRight
          className={`h-4 w-4 transition duration-300 ${
            compact ? "" : "group-hover:translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SelectedFlatPlanPanel({
  apartment,
  onExpand,
}: {
  apartment: InventoryApartment;
  onExpand: (apartment: InventoryApartment) => void;
}) {
  const dimensionItems = useMemo(
    () => getRoomDimensionItems(apartment.roomDimensions),
    [apartment.roomDimensions],
  );
  const [floorPlanLoadState, setFloorPlanLoadState] = useState<{
    src: string;
    status: "loaded" | "error";
  } | null>(null);
  const currentFloorPlanLoadState =
    floorPlanLoadState?.src === apartment.floorPlanImage
      ? floorPlanLoadState.status
      : "loading";
  const isFloorPlanLoaded = currentFloorPlanLoadState === "loaded";

  return (
    <div
      className="pointer-events-auto relative flex h-[min(82dvh,48rem)] w-[clamp(19rem,28vw,27rem)] flex-col overflow-hidden bg-transparent p-0 text-[#1f3f2b] 2xl:w-[29rem]"
      data-scroll-area="flat-plan-panel"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="pointer-events-none absolute left-0 right-0 top-[16.5rem] z-0 hidden h-16 rounded-b-[4rem] bg-[#1f3f2b]/90 blur-[18px] 2xl:block" />

        <div className="relative z-10 shrink-0 overflow-hidden rounded-[30px] rounded-tr-[56px] border border-[#d7bf80]/48 bg-[linear-gradient(145deg,rgba(250,248,239,0.56)_0%,rgba(238,242,231,0.48)_58%,rgba(250,247,236,0.60)_100%)] pb-3 pl-5 pr-8 pt-3 shadow-[0_14px_40px_rgba(21,47,30,0.10),inset_0_1px_0_rgba(255,255,255,0.64),inset_0_0_0_1px_rgba(255,255,255,0.13)] backdrop-blur-sm 2xl:rounded-[36px] 2xl:rounded-tr-[68px]">
          <div className="pointer-events-none absolute inset-[8px] rounded-[24px] rounded-tr-[48px] border border-[#ead8a4]/60 2xl:rounded-[28px] 2xl:rounded-tr-[58px]" />
          <div className="pointer-events-none absolute -left-10 bottom-4 h-40 w-20 rounded-[50%] border-r border-[#cfad63]/45 opacity-70" />
          <div className="pointer-events-none absolute -right-6 top-11 h-36 w-24 rounded-[50%] border-l border-[#cfad63]/45 opacity-60" />
          <div className="pointer-events-none absolute right-0 top-0 z-[1] h-44 w-32 opacity-85 2xl:h-full 2xl:w-full">
            <NextImage
              src="/flowerUI.png"
              alt=""
              fill
              // sizes="(min-width: 1536px) 160px, 128px"
              className="object-contain object-top-right opacity-50"
            />
          </div>

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0 max-w-[70%]">
              <p className="text-[9px] font-bold uppercase tracking-[0.36em] text-[#687866]">
                Floor Plan
              </p>
              <h3
                className={`${masterPlanSerif.className} mt-1.5 text-[1.75rem] font-semibold leading-none text-[#21462d] 2xl:text-[2.25rem]`}
              >
                {apartment.title} layout
              </h3>
              <div className="mt-2 h-px w-16 bg-[#c4a667]" />
            </div>
            <span className="rounded-full border border-[#d8bd78]/55 bg-[#f8f4e8]/82 px-3.5 py-1.5 text-xs font-bold text-[#58715f] shadow-[0_10px_24px_rgba(33,50,35,0.10),inset_0_1px_0_rgba(255,255,255,0.92)]">
              {apartment.floorLabel || apartment.floor}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onExpand(apartment)}
            data-preserve-flat-selection="true"
            className="group relative z-10 mx-auto mt-2 block h-[clamp(11.5rem,28dvh,15rem)] w-[78%] max-w-[20rem] cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a667] 2xl:mt-3 2xl:h-[clamp(13rem,28dvh,17rem)] 2xl:w-[80%]"
            aria-label={`Enlarge ${apartment.title} floor plan`}
          >
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center transition duration-500 ${
                isFloorPlanLoaded
                  ? "scale-[0.98] opacity-0"
                  : "scale-100 opacity-100"
              }`}
              role="status"
              aria-label={
                currentFloorPlanLoadState === "error"
                  ? "Floor plan could not be loaded"
                  : "Loading floor plan"
              }
            >
              <div className="absolute inset-[12%] rounded-[40%] bg-[radial-gradient(circle,rgba(196,166,103,0.16)_0%,rgba(196,166,103,0.05)_48%,transparent_72%)] animate-pulse" />
              <NextImage
                src={SITE_ICON_URL}
                alt=""
                width={1152}
                height={1004}
                sizes="112px"
                className="relative h-auto w-24 select-none object-contain opacity-55 drop-shadow-[0_8px_18px_rgba(33,70,45,0.12)] 2xl:w-28"
              />
              <p className="relative mt-2 text-[8px] font-bold uppercase tracking-[0.3em] text-[#687866]/75">
                {currentFloorPlanLoadState === "error"
                  ? "Plan unavailable"
                  : "Preparing floor plan"}
              </p>
              {currentFloorPlanLoadState !== "error" ? (
                <div className="relative mt-3 h-px w-20 overflow-hidden bg-[#c4a667]/20">
                  <motion.div
                    className="absolute inset-y-0 w-1/2 bg-[linear-gradient(90deg,transparent,#c4a667,transparent)]"
                    animate={{ x: ["-110%", "220%"] }}
                    transition={{
                      duration: 1.35,
                      ease: "easeInOut",
                      repeat: Infinity,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <SignedImage
              src={apartment.floorPlanImage}
              placeholderSrc={null}
              alt={`${apartment.title} floor plan`}
              fill
              sizes="(min-width: 1536px) 380px, 320px"
              onLoad={() =>
                setFloorPlanLoadState({
                  src: apartment.floorPlanImage,
                  status: "loaded",
                })
              }
              onError={() =>
                setFloorPlanLoadState({
                  src: apartment.floorPlanImage,
                  status: "error",
                })
              }
              className={`z-10 object-contain mix-blend-multiply drop-shadow-[0_18px_30px_rgba(19,61,40,0.16)] transition-opacity duration-500 ${
                isFloorPlanLoaded ? "opacity-100" : "opacity-0"
              } group-hover:scale-[1.025]`}
            />
          </button>

          <div className="relative z-10 mt-2 grid grid-cols-2 gap-2.5">
            <div className="rounded-full border border-[#d8bd78]/45 bg-[#fbfaf4]/88 px-4 py-2 text-xs font-bold text-[#1f3f2b] shadow-[0_12px_26px_rgba(33,50,35,0.09),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
              {apartment.bhk} BHK
            </div>
            <div className="rounded-full border border-[#d8bd78]/45 bg-[#fbfaf4]/88 px-4 py-2 text-right text-xs font-bold text-[#1f3f2b] shadow-[0_12px_26px_rgba(33,50,35,0.09),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
              {apartment.areaSqft} sqft
            </div>
          </div>
        </div>

        <div className="relative z-0 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-[#d7bf80]/30 bg-[linear-gradient(180deg,rgba(31,62,39,0.68),rgba(25,50,32,0.76))] px-5 pb-3 pt-4 text-[#f7efd9] shadow-[0_14px_38px_rgba(21,47,30,0.12)] backdrop-blur-md 2xl:mt-4 2xl:px-6 2xl:pt-5">
          <div className="relative z-10 flex shrink-0 items-end justify-between gap-3 border-b border-[#d9c28a]/22 pb-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#d9c28a]">
                Spatial Composition
              </p>
              <h4
                className={`${masterPlanSerif.className} mt-1.5 text-[1.35rem] font-semibold leading-none text-[#fff6df]`}
              >
                Room Dimensions
              </h4>
            </div>
            <span className="pb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d9c28a]">
              {dimensionItems.length} rooms
            </span>
          </div>

          <div className="custom-scrollbar relative z-10 grid min-h-0 flex-1 grid-cols-2 content-start gap-x-5 overflow-y-auto overscroll-contain pr-2">
            {dimensionItems.length > 0 ? (
              dimensionItems.map((item, index) => (
                <div
                  key={item.key}
                  className="grid min-h-[4.15rem] min-w-0 grid-cols-[1.45rem_minmax(0,1fr)] items-center gap-2 border-b border-[#d9c28a]/16 py-2.5"
                >
                  <span className="text-[9px] font-semibold tracking-[0.12em] text-[#d9c28a]/62">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[13px] font-medium leading-[1.2] text-[#fff6df]">
                      {item.label}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-semibold tabular-nums text-[#d9c28a]">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="col-span-2 py-3 text-xs text-[#f7efd9]/72">
                Room dimensions are not available for this apartment yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MasterPlanModeToggle({
  isTopViewMode,
  onNormalView,
  onTopView,
}: {
  isTopViewMode: boolean;
  onNormalView: () => void;
  onTopView: () => void;
}) {
  return (
    <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/68 p-1.5 text-white shadow-[0_18px_46px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <button
        type="button"
        onClick={() => {
          if (isTopViewMode) {
            onNormalView();
          }
        }}
        className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
          !isTopViewMode
            ? "bg-white text-black shadow-[0_10px_20px_rgba(255,255,255,0.18)]"
            : "text-white/72 hover:text-white"
        }`}
      >
        Normal View
      </button>
      <button
        type="button"
        onClick={() => {
          if (!isTopViewMode) {
            onTopView();
          }
        }}
        className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
          isTopViewMode
            ? "bg-white text-black shadow-[0_10px_20px_rgba(255,255,255,0.18)]"
            : "text-white/72 hover:text-white"
        }`}
      >
        Top View
      </button>
    </div>
  );
}

export default function MasterPlanLayout({
  initialApartments = [],
  initialSignedAssetUrls = {},
  masterPlanConfig,
}: MasterPlanLayoutProps) {
  const router = useRouter();
  primeSignedAssetUrls(initialSignedAssetUrls);
  const specialUnitVideoConfigs = masterPlanConfig
    ? Object.fromEntries(
        Object.entries(masterPlanConfig.unitViewVideos).map(([flat, video]) => [
          flat,
          { forwardUrl: video.forwardKey, reverseUrl: video.reverseKey },
        ]),
      )
    : SPECIAL_UNIT_VIDEO_CONFIGS;
  const masterPlanFallbackImageKey =
    masterPlanConfig?.fallbackImageKey ?? MASTER_PLAN_STAGE_FALLBACK_IMAGE;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedFlatPanelRef = useRef<HTMLDivElement | null>(null);
  const specialUnitVideoRef = useRef<HTMLVideoElement | null>(null);
  const specialUnitWarmupRef = useRef<WarmVideoHandle | null>(null);
  const specialUnitReverseWarmupRef = useRef<WarmVideoHandle | null>(null);
  const specialVideoLoadedUrlRef = useRef<string | null>(null);
  const specialUnitVideoTimeoutRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const lastApartmentSelectionAtRef = useRef(0);
  const inventorySignatureRef = useRef("");
  const currentFrameRef = useRef(1);
  const signedAssetUrls = useSignedAssetUrls([
    masterPlanFallbackImageKey,
    ...Object.values(specialUnitVideoConfigs).flatMap((config) => [
      config.forwardUrl,
      config.reverseUrl,
    ]),
  ]);

  const [search, setSearch] = useState("");
  const [selectedTower, setSelectedTower] = useState<TowerType | null>(null);
  const [filterTower, setFilterTower] = useState<TowerType | null>(null);
  const [apartments, setApartments] =
    useState<InventoryApartment[]>(initialApartments);
  const [isInventoryLoading, setIsInventoryLoading] = useState(
    initialApartments.length === 0,
  );
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [bhk, setBhk] = useState<BhkFilterValue>(null);
  const [facing, setFacing] = useState<FacingFilterValue>(null);
  const [status, setStatus] = useState<StatusFilterValue>(null);
  const [floor, setFloor] = useState(FLOOR_ALL_VALUE);
  const [selectedAreaRange, setSelectedAreaRange] = useState<SelectedAreaRange>(
    { min: null, max: null },
  );

  const isLeaving = false;
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(true);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isDesktopCompactViewport, setIsDesktopCompactViewport] =
    useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isTouchTabletViewport, setIsTouchTabletViewport] = useState(false);
  const [isTopViewMode, setIsTopViewMode] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [isStageInteracting, setIsStageInteracting] = useState(false);
  const [selectedApartment, setSelectedApartment] =
    useState<InventoryApartment | null>(null);
  const [expandedFloorPlan, setExpandedFloorPlan] =
    useState<InventoryApartment | null>(null);
  const [selectedApartmentMeshId, setSelectedApartmentMeshId] = useState<
    string | null
  >(null);
  const [isSpecialVideoOpen, setIsSpecialVideoOpen] = useState(false);
  const [isSpecialVideoLaunching, setIsSpecialVideoLaunching] = useState(false);
  const [isSpecialVideoReady, setIsSpecialVideoReady] = useState(false);
  const [isSpecialVideoQueuedToOpen, setIsSpecialVideoQueuedToOpen] =
    useState(false);
  const [shouldAutoplaySpecialVideo, setShouldAutoplaySpecialVideo] =
    useState(false);
  const [isSpecialVideoCompleted, setIsSpecialVideoCompleted] = useState(false);
  const [isSpecialVideoReversing, setIsSpecialVideoReversing] = useState(false);
  const [specialVideoApartment, setSpecialVideoApartment] =
    useState<InventoryApartment | null>(null);
  const [specialVideoFreezeFrameUrl, setSpecialVideoFreezeFrameUrl] = useState<
    string | null
  >(null);
  const [
    isSpecialVideoFreezeFrameVisible,
    setIsSpecialVideoFreezeFrameVisible,
  ] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const selectedApartmentInventoryId = selectedApartment?.id ?? null;
  const activeHotspot = useMemo(
    () => getNearestMasterPlanHotspot(currentFrame),
    [currentFrame],
  );
  const isSpecialVideoExperienceActive =
    isSpecialVideoLaunching || isSpecialVideoOpen;
  const isSpecialVideoOverlayMounted =
    Boolean(specialVideoApartment) ||
    isSpecialVideoLaunching ||
    isSpecialVideoOpen;
  const shouldUseCompactLayout = isCompactViewport || isTouchTabletViewport;
  const shouldRenderCompactSpecialVideoStage =
    shouldUseCompactLayout && Boolean(specialVideoApartment);
  const shouldShowCompactSpecialVideoPanel =
    shouldUseCompactLayout &&
    Boolean(specialVideoApartment) &&
    !isSpecialVideoReversing;
  const isFlatPanelOpen = Boolean(
    selectedApartment ||
    specialVideoApartment ||
    isSpecialVideoLaunching ||
    isSpecialVideoOpen,
  );
  const shouldEnableCompactStageScrubbing = !isMobileViewport;
  const compactTouchHighlightProfile = isMobileViewport
    ? "mobile"
    : isTouchTabletViewport
      ? "tablet"
      : "desktop";
  const compactStageHeightClassName = shouldUseCompactLayout
    ? "h-[clamp(18.75rem,45svh,27rem)] sm:h-[clamp(20.5rem,48svh,31rem)]"
    : "h-[clamp(20rem,50svh,32rem)]";
  const compactLowerContentClassName = shouldUseCompactLayout
    ? selectedApartment
      ? "-mt-1 min-h-0 flex-1 px-0 pb-0"
      : "-mt-1 min-h-0 flex-1 px-0 pb-0"
    : "mt-2 min-h-0 flex-1 px-3 pb-3";
  const shouldShowDesktopSidebar =
    !shouldUseCompactLayout && !isLeaving && !isFlatPanelOpen;
  const shouldShowTopViewFullscreen =
    isTopViewMode &&
    !selectedTower &&
    !selectedApartment &&
    !isSpecialVideoExperienceActive;
  const shouldHideInlineCompactShell =
    !shouldUseCompactLayout && isSpecialVideoOpen;
  const activeSpecialVideoFlatToken = specialVideoApartment
    ? getApartmentFlatToken(specialVideoApartment)
    : null;
  const activeSpecialVideoConfig = useMemo(() => {
    if (!specialVideoApartment) {
      return null;
    }

    const rawConfig = getSpecialUnitVideoConfig(
      activeSpecialVideoFlatToken!,
      specialUnitVideoConfigs,
    );

    if (!rawConfig) {
      return null;
    }

    const signedForwardUrl = signedAssetUrls[rawConfig.forwardUrl];
    const signedReverseUrl = signedAssetUrls[rawConfig.reverseUrl];

    if (!signedForwardUrl || !signedReverseUrl) {
      return null;
    }

    return {
      forwardUrl: signedForwardUrl,
      reverseUrl: signedReverseUrl,
    };
  }, [
    activeSpecialVideoFlatToken,
    signedAssetUrls,
    specialUnitVideoConfigs,
    specialVideoApartment,
  ]);
  const signedMasterPlanStageFallbackImage =
    signedAssetUrls[masterPlanFallbackImageKey] ?? null;
  const activeSpecialVideoUrl = isSpecialVideoReversing
    ? (activeSpecialVideoConfig?.reverseUrl ?? null)
    : (activeSpecialVideoConfig?.forwardUrl ?? null);

  const captureSpecialVideoFreezeFrame = useCallback(() => {
    const video = specialUnitVideoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setSpecialVideoFreezeFrameUrl(canvas.toDataURL("image/jpeg", 0.92));
      setIsSpecialVideoFreezeFrameVisible(true);
    } catch (error) {
      console.warn("Failed to capture special unit video freeze frame:", error);
      setSpecialVideoFreezeFrameUrl(null);
      setIsSpecialVideoFreezeFrameVisible(false);
    }
  }, []);

  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  useEffect(() => {
    if (initialApartments.length > 0) {
      inventorySignatureRef.current = getApartmentSignature(initialApartments);
    }
  }, [initialApartments]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.dataset.masterPlanFlatOpen = isFlatPanelOpen
      ? "true"
      : "false";

    return () => {
      delete document.body.dataset.masterPlanFlatOpen;
    };
  }, [isFlatPanelOpen]);

  useEffect(() => {
    if (!activeSpecialVideoConfig?.forwardUrl) {
      return;
    }

    cleanupVideoWarmup(specialUnitWarmupRef.current);
    specialUnitWarmupRef.current = createVideoWarmup(
      activeSpecialVideoConfig.forwardUrl,
    );

    return () => {
      if (specialUnitVideoTimeoutRef.current !== null) {
        window.clearTimeout(specialUnitVideoTimeoutRef.current);
        specialUnitVideoTimeoutRef.current = null;
      }

      cleanupVideoWarmup(specialUnitWarmupRef.current);
      specialUnitWarmupRef.current = null;
    };
  }, [activeSpecialVideoConfig?.forwardUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      scheduleAmenityVideoWarmup({ profile: "master-plan" });
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (
      !isSpecialVideoOpen ||
      isSpecialVideoReversing ||
      !activeSpecialVideoConfig?.reverseUrl
    ) {
      return;
    }

    cleanupVideoWarmup(specialUnitReverseWarmupRef.current);
    specialUnitReverseWarmupRef.current = createVideoWarmup(
      activeSpecialVideoConfig.reverseUrl,
    );

    return () => {
      cleanupVideoWarmup(specialUnitReverseWarmupRef.current);
      specialUnitReverseWarmupRef.current = null;
    };
  }, [
    activeSpecialVideoConfig?.reverseUrl,
    isSpecialVideoOpen,
    isSpecialVideoReversing,
  ]);

  useEffect(() => {
    if (!isSpecialVideoOverlayMounted || !activeSpecialVideoUrl) {
      return;
    }

    const video = specialUnitVideoRef.current;

    if (!video) {
      return;
    }

    const markReady = () => {
      specialVideoLoadedUrlRef.current = activeSpecialVideoUrl;
      setIsSpecialVideoReady(true);
    };

    if (video.getAttribute("src") !== activeSpecialVideoUrl) {
      specialVideoLoadedUrlRef.current = null;
      setIsSpecialVideoReady(false);
      video.pause();
      video.currentTime = 0;
      video.src = activeSpecialVideoUrl;
      video.load();
    } else if (
      specialVideoLoadedUrlRef.current === activeSpecialVideoUrl ||
      video.readyState >= 3
    ) {
      markReady();
    }

    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);

    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
    };
  }, [activeSpecialVideoUrl, isSpecialVideoOverlayMounted]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactViewportMedia = window.matchMedia("(max-width: 1279px)");
    const mobileViewportMedia = window.matchMedia("(max-width: 767px)");
    const desktopCompactViewportMedia = window.matchMedia(
      "(min-width: 1280px) and (max-width: 1439px)",
    );
    const touchViewportMedia = window.matchMedia("(max-width: 1366px)");
    const syncCompactViewport = () => {
      setIsCompactViewport(compactViewportMedia.matches);
      setIsMobileViewport(mobileViewportMedia.matches);
      setIsDesktopCompactViewport(desktopCompactViewportMedia.matches);
      setIsTouchTabletViewport(
        touchViewportMedia.matches && window.navigator.maxTouchPoints > 0,
      );
    };

    syncCompactViewport();
    compactViewportMedia.addEventListener("change", syncCompactViewport);
    mobileViewportMedia.addEventListener("change", syncCompactViewport);
    desktopCompactViewportMedia.addEventListener("change", syncCompactViewport);
    touchViewportMedia.addEventListener("change", syncCompactViewport);

    return () => {
      compactViewportMedia.removeEventListener("change", syncCompactViewport);
      mobileViewportMedia.removeEventListener("change", syncCompactViewport);
      desktopCompactViewportMedia.removeEventListener(
        "change",
        syncCompactViewport,
      );
      touchViewportMedia.removeEventListener("change", syncCompactViewport);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let refreshTimeoutId: number | null = null;
    const isVisibleRef = {
      current: document.visibilityState === "visible",
    };

    const clearRefreshTimeout = () => {
      if (refreshTimeoutId !== null) {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = null;
      }
    };

    const loadInventory = async (showLoadingState: boolean) => {
      if (showLoadingState && isMounted) {
        setIsInventoryLoading(true);
      }

      try {
        const nextApartments = await fetchSharedInventory();
        if (!isMounted) {
          return;
        }

        const nextSignature = getApartmentSignature(nextApartments);

        if (nextSignature !== inventorySignatureRef.current) {
          inventorySignatureRef.current = nextSignature;

          if (showLoadingState) {
            setApartments(nextApartments);
          } else {
            startTransition(() => {
              setApartments(nextApartments);
            });
          }
        }

        setInventoryError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setInventoryError(
          error instanceof Error
            ? error.message
            : "Failed to load inventory from the database.",
        );
      } finally {
        if (showLoadingState && isMounted) {
          setIsInventoryLoading(false);
        }
      }
    };

    if (initialApartments.length === 0) {
      void loadInventory(true);
    }

    const queueNextRefresh = () => {
      clearRefreshTimeout();
      if (!isVisibleRef.current || !isMounted) {
        return;
      }

      const jitterMs = Math.round(Math.random() * 3500);
      refreshTimeoutId = window.setTimeout(() => {
        refreshInventory();
        if (isVisibleRef.current) {
          queueNextRefresh();
        }
      }, INVENTORY_REFRESH_INTERVAL + jitterMs);
    };

    const refreshInventory = () => {
      if (!isVisibleRef.current || isStageInteracting) {
        return;
      }

      void loadInventory(false);
    };

    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      if (!isVisibleRef.current) {
        clearRefreshTimeout();
        return;
      }

      refreshInventory();
      queueNextRefresh();
    };

    const handleWindowFocus = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      isVisibleRef.current = true;
      refreshInventory();
      queueNextRefresh();
    };

    queueNextRefresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      clearRefreshTimeout();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [initialApartments.length, isStageInteracting]);

  const normalizedDeferredSearch = useMemo(
    () => deferredSearch.trim().toLowerCase(),
    [deferredSearch],
  );
  const selectedBhkNumber = useMemo(
    () => (bhk === null || bhk === "All" ? null : Number(bhk)),
    [bhk],
  );
  const areaBounds = useMemo<AreaRange>(() => {
    const validAreas = apartments
      .map((apartment) => apartment.areaSqft)
      .filter((area) => Number.isFinite(area) && area > 0);

    if (validAreas.length === 0) {
      return FALLBACK_AREA_RANGE;
    }

    return {
      min: Math.min(...validAreas),
      max: Math.max(...validAreas),
    };
  }, [apartments]);
  const minArea = Math.min(
    Math.max(selectedAreaRange.min ?? areaBounds.min, areaBounds.min),
    areaBounds.max,
  );
  const maxArea = Math.max(
    Math.min(selectedAreaRange.max ?? areaBounds.max, areaBounds.max),
    minArea,
  );
  const isAreaFiltered =
    selectedAreaRange.min !== null || selectedAreaRange.max !== null;
  const handleAreaRangeChange = useCallback(
    (nextRange: AreaRange) => {
      setSelectedAreaRange({
        min:
          nextRange.min <= areaBounds.min + AREA_RANGE_STEP / 2
            ? null
            : nextRange.min,
        max:
          nextRange.max >= areaBounds.max - AREA_RANGE_STEP / 2
            ? null
            : nextRange.max,
      });
    },
    [areaBounds],
  );
  const filterableApartmentsByTower = useMemo(() => {
    const next = new Map<TowerType, FilterableApartmentRow[]>([
      ["Tower A", []],
      ["Tower B", []],
      ["Tower C", []],
      ["Tower D", []],
    ]);

    apartments.forEach((apartment) => {
      next.get(apartment.tower)?.push({
        apartment,
        floorValue: String(apartment.floor),
        searchText: `${apartment.title} ${apartment.flatNumber}`.toLowerCase(),
      });
    });

    next.forEach((rows) => {
      rows.sort((left, right) =>
        compareMasterPlanApartments(left.apartment, right.apartment),
      );
    });

    return next;
  }, [apartments]);
  const hasExplicitUnitFilter =
    normalizedDeferredSearch.length > 0 ||
    bhk !== null ||
    facing !== null ||
    status !== null ||
    floor !== FLOOR_ALL_VALUE ||
    isAreaFiltered;

  const filteredApartments = useMemo(() => {
    if (!filterTower || !hasExplicitUnitFilter) {
      return [];
    }

    const towerRows = filterableApartmentsByTower.get(filterTower) ?? [];
    const hasSearch = normalizedDeferredSearch.length > 0;

    return towerRows.reduce<InventoryApartment[]>((matches, row) => {
      const { apartment } = row;
      const matchesSearch =
        !hasSearch || row.searchText.includes(normalizedDeferredSearch);
      const matchesFloor =
        apartment.floor >= 0 &&
        (floor === FLOOR_ALL_VALUE || row.floorValue === floor);
      const matchesBhk =
        selectedBhkNumber === null || apartment.bhk === selectedBhkNumber;
      const matchesFacing =
        facing === null || facing === "All" || apartment.facing === facing;
      const matchesStatus =
        status === null || status === "All" || apartment.status === status;
      const matchesArea =
        apartment.areaSqft >= minArea && apartment.areaSqft <= maxArea;

      if (
        matchesFloor &&
        matchesSearch &&
        matchesBhk &&
        matchesFacing &&
        matchesStatus &&
        matchesArea
      ) {
        matches.push(apartment);
      }

      return matches;
    }, []);
  }, [
    filterableApartmentsByTower,
    hasExplicitUnitFilter,
    normalizedDeferredSearch,
    filterTower,
    selectedBhkNumber,
    facing,
    status,
    floor,
    minArea,
    maxArea,
  ]);
  const floorOptions = useMemo<FloorFilterOption[]>(() => {
    if (!filterTower) {
      return [{ value: FLOOR_ALL_VALUE, label: "All floors" }];
    }

    const towerRows = filterableApartmentsByTower.get(filterTower) ?? [];
    const floors = new Map<number, string>();

    towerRows.forEach(({ apartment }) => {
      if (apartment.floor < 0) {
        return;
      }

      floors.set(
        apartment.floor,
        apartment.floor === 0
          ? apartment.floorLabel || "G"
          : apartment.floorLabel || String(apartment.floor),
      );
    });

    return [
      { value: FLOOR_ALL_VALUE, label: "All floors" },
      ...Array.from(floors.entries())
        .sort(([a], [b]) => a - b)
        .map(([value, label]) => ({
          value: String(value),
          label: value === 0 ? "G" : label,
        })),
    ];
  }, [filterableApartmentsByTower, filterTower]);
  useEffect(() => {
    if (!floorOptions.some((option) => option.value === floor)) {
      setFloor(FLOOR_ALL_VALUE);
    }
  }, [floor, floorOptions]);

  useEffect(() => {
    if (!shouldUseCompactLayout || !isFlatPanelOpen) {
      return;
    }

    const resetScroll = () => {
      const panelNode = selectedFlatPanelRef.current;
      panelNode?.scrollTo({ top: 0, behavior: "auto" });

      const compactSheet = panelNode?.closest(
        '[data-scroll-area="compact-panel"]',
      );
      if (compactSheet instanceof HTMLElement) {
        compactSheet.scrollTo({ top: 0, behavior: "auto" });
      }
    };

    const frameId = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frameId);
  }, [isFlatPanelOpen, selectedApartmentInventoryId, shouldUseCompactLayout]);

  const hasActiveInventoryFilters = useMemo(
    () => filterTower !== null && hasExplicitUnitFilter,
    [filterTower, hasExplicitUnitFilter],
  );

  const resetFilters = () => {
    setSearch("");
    setFilterTower(null);
    setBhk(null);
    setFacing(null);
    setStatus(null);
    setFloor(FLOOR_ALL_VALUE);
    setSelectedAreaRange({ min: null, max: null });
  };

  const handleTowerSelect = (tower: TowerType) => {
    setIsTopViewMode(false);
    setSelectedTower(tower);
    setFilterTower(null);
    setIsDesktopSidebarOpen(true);
    setIsMobileSheetOpen(true);
  };

  const handleFilterTowerChange = (tower: TowerType) => {
    setFilterTower(tower);
    setSelectedTower(tower);
    setFloor(FLOOR_ALL_VALUE);
  };

  const handleTopViewToggle = useCallback(() => {
    setSelectedApartment(null);
    setSelectedApartmentMeshId(null);
    setSelectedTower(null);
    setIsMobileSheetOpen(true);
    setIsTopViewMode((currentValue) => !currentValue);
  }, []);

  const handleBackToTowerSelect = () => {
    resetFilters();
    setSelectedApartment(null);
    setSelectedApartmentMeshId(null);
    setSelectedTower(null);
    setIsDesktopSidebarOpen(true);
    setIsTopViewMode(false);
    setIsMobileSheetOpen(true);
  };

  const clearSelectedApartment = useCallback(() => {
    setExpandedFloorPlan(null);
    setSelectedApartment(null);
    setSelectedApartmentMeshId(null);

    if (selectedTower) {
      setIsDesktopSidebarOpen(true);
      setIsMobileSheetOpen(true);
    }
  }, [selectedTower]);

  useEffect(() => {
    if (!expandedFloorPlan) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedFloorPlan(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedFloorPlan]);

  const closeSpecialUnitVideo = useCallback(() => {
    if (specialUnitVideoTimeoutRef.current !== null) {
      window.clearTimeout(specialUnitVideoTimeoutRef.current);
      specialUnitVideoTimeoutRef.current = null;
    }

    const video = specialUnitVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }

    setIsSpecialVideoLaunching(false);
    setIsSpecialVideoQueuedToOpen(false);
    setIsSpecialVideoReady(false);
    setShouldAutoplaySpecialVideo(false);
    setIsSpecialVideoOpen(false);
    setIsSpecialVideoCompleted(false);
    setIsSpecialVideoReversing(false);
    setSpecialVideoApartment(null);
    setSpecialVideoFreezeFrameUrl(null);
    setIsSpecialVideoFreezeFrameVisible(false);
    setIsDesktopSidebarOpen(true);
    specialVideoLoadedUrlRef.current = null;
  }, []);

  const handleNormalViewToggle = useCallback(() => {
    closeSpecialUnitVideo();
    setSelectedApartment(null);
    setSelectedApartmentMeshId(null);
    setSelectedTower(null);
    currentFrameRef.current = SPECIAL_UNIT_VIDEO_FRAME;
    setCurrentFrame(SPECIAL_UNIT_VIDEO_FRAME);
    setIsMobileSheetOpen(true);
    setIsTopViewMode(false);
  }, [closeSpecialUnitVideo]);

  const handleSpecialVideoBack = useCallback(() => {
    if (isSpecialVideoReversing) {
      return;
    }

    captureSpecialVideoFreezeFrame();
    setSelectedApartment(null);
    setSelectedApartmentMeshId(null);
    setIsSpecialVideoCompleted(false);
    setIsSpecialVideoReversing(true);
    setShouldAutoplaySpecialVideo(true);
  }, [captureSpecialVideoFreezeFrame, isSpecialVideoReversing]);

  const handleApartmentSelect = useCallback(
    (apartment: InventoryApartment | null, apartmentMeshId: string | null) => {
      if (!apartment || !apartmentMeshId) {
        return;
      }

      lastApartmentSelectionAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();

      setSelectedTower(apartment.tower);

      if (isSpecialVideoApartment(apartment, specialUnitVideoConfigs)) {
        setIsDesktopSidebarOpen(false);
        setSelectedApartment(null);
        setSelectedApartmentMeshId(null);
        setIsMobileSheetOpen(false);
        setIsSpecialVideoCompleted(false);
        setIsSpecialVideoReversing(false);
        setIsSpecialVideoReady(false);
        setIsSpecialVideoQueuedToOpen(false);
        setShouldAutoplaySpecialVideo(true);
        setSpecialVideoApartment(apartment);
        setSpecialVideoFreezeFrameUrl(null);
        setIsSpecialVideoFreezeFrameVisible(false);
        specialVideoLoadedUrlRef.current = null;

        if (specialUnitVideoTimeoutRef.current !== null) {
          window.clearTimeout(specialUnitVideoTimeoutRef.current);
          specialUnitVideoTimeoutRef.current = null;
        }

        if (activeHotspot === SPECIAL_UNIT_VIDEO_HOTSPOT) {
          setIsSpecialVideoLaunching(true);
          setIsSpecialVideoOpen(false);
          setIsSpecialVideoQueuedToOpen(true);
          return;
        }

        setIsSpecialVideoLaunching(true);
        setIsSpecialVideoOpen(false);
        const navigationDelayMs =
          getMasterPlanFrameTransitionDuration(
            currentFrameRef.current,
            SPECIAL_UNIT_VIDEO_FRAME,
          ) + 80;
        currentFrameRef.current = SPECIAL_UNIT_VIDEO_FRAME;
        setCurrentFrame(SPECIAL_UNIT_VIDEO_FRAME);
        specialUnitVideoTimeoutRef.current = window.setTimeout(
          () => {
            specialUnitVideoTimeoutRef.current = null;
            setIsSpecialVideoQueuedToOpen(true);
          },
          Math.max(navigationDelayMs, SPECIAL_UNIT_VIDEO_NAVIGATION_DELAY_MS),
        );
        return;
      }

      closeSpecialUnitVideo();
      setIsDesktopSidebarOpen(false);
      setSelectedApartment(apartment);
      setSelectedApartmentMeshId(apartmentMeshId);
      setIsMobileSheetOpen(false);
    },
    [activeHotspot, closeSpecialUnitVideo, specialUnitVideoConfigs],
  );

  const handleApartmentListSelect = useCallback(
    (apartment: InventoryApartment) => {
      const apartmentMeshId = getApartmentMeshId(apartment);

      if (!apartmentMeshId) {
        return;
      }

      handleApartmentSelect(apartment, apartmentMeshId);
    },
    [handleApartmentSelect],
  );

  useEffect(() => {
    if (!selectedApartment) {
      return;
    }

    if (selectedApartment.floor < 0) {
      clearSelectedApartment();
      return;
    }

    if (selectedTower && selectedApartment.tower !== selectedTower) {
      clearSelectedApartment();
    }
  }, [clearSelectedApartment, selectedApartment, selectedTower]);

  useEffect(() => {
    if (
      !isSpecialVideoLaunching ||
      !isSpecialVideoQueuedToOpen ||
      !isSpecialVideoReady
    ) {
      return;
    }

    setIsSpecialVideoLaunching(false);
    setIsSpecialVideoOpen(true);
    setIsSpecialVideoQueuedToOpen(false);
  }, [
    isSpecialVideoLaunching,
    isSpecialVideoQueuedToOpen,
    isSpecialVideoReady,
  ]);

  useEffect(() => {
    if (!selectedApartment) {
      return;
    }

    const syncedApartment =
      apartments.find((apartment) => apartment.id === selectedApartment.id) ??
      null;

    if (!syncedApartment) {
      setSelectedApartment(null);
      setSelectedApartmentMeshId(null);
      return;
    }

    if (syncedApartment !== selectedApartment) {
      setSelectedApartment(syncedApartment);
    }
  }, [apartments, selectedApartment]);

  useEffect(() => {
    if (!selectedApartment || shouldUseCompactLayout) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const selectionAgeMs =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        lastApartmentSelectionAtRef.current;

      if (selectionAgeMs < 450) {
        return;
      }

      const target = event.target;

      if (
        target instanceof Element &&
        target.closest('[data-preserve-flat-selection="true"]')
      ) {
        return;
      }

      if (
        selectedFlatPanelRef.current &&
        target instanceof Node &&
        selectedFlatPanelRef.current.contains(target)
      ) {
        return;
      }

      clearSelectedApartment();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [clearSelectedApartment, selectedApartment, shouldUseCompactLayout]);

  useEffect(() => {
    if (!isSpecialVideoOpen || !shouldAutoplaySpecialVideo) {
      return;
    }

    const video = specialUnitVideoRef.current;

    if (!video) {
      return;
    }

    if (!activeSpecialVideoUrl) {
      return;
    }

    if (video.getAttribute("src") !== activeSpecialVideoUrl) {
      video.src = activeSpecialVideoUrl;
      video.load();
    }

    const playVideo = () => {
      const handlePlaying = () => {
        video.removeEventListener("playing", handlePlaying);
        setIsSpecialVideoFreezeFrameVisible(false);
      };

      video.addEventListener("playing", handlePlaying);
      video.currentTime = 0;
      setShouldAutoplaySpecialVideo(false);
      void video.play().catch(() => {
        video.removeEventListener("playing", handlePlaying);
        // playback may still require a second user gesture on some devices
      });
    };

    if (video.readyState >= 3) {
      playVideo();
      return;
    }

    const handleCanPlay = () => {
      video.removeEventListener("canplay", handleCanPlay);
      playVideo();
    };

    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [activeSpecialVideoUrl, isSpecialVideoOpen, shouldAutoplaySpecialVideo]);

  useEffect(() => {
    if (!isSpecialVideoOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleSpecialVideoBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSpecialVideoBack, isSpecialVideoOpen]);

  const wrapFrame = useCallback(
    (frame: number) =>
      ((frame - 1 + TOTAL_MASTER_PLAN_FRAMES) % TOTAL_MASTER_PLAN_FRAMES) + 1,
    [],
  );

  const setWrappedFrame = useCallback(
    (frame: number) => {
      const nextFrame = wrapFrame(frame);
      currentFrameRef.current = nextFrame;
      setCurrentFrame(nextFrame);
    },
    [wrapFrame],
  );

  const getNextHotspotFrame = useCallback(
    (frame: number, direction: 1 | -1) => {
      const normalizedFrame = wrapFrame(frame);

      if (direction === 1) {
        return (
          MASTER_PLAN_SNAP_FRAMES.find(
            (snapFrame) => snapFrame > normalizedFrame,
          ) ?? MASTER_PLAN_SNAP_FRAMES[0]
        );
      }

      const previousSnapFrames = MASTER_PLAN_SNAP_FRAMES.filter(
        (snapFrame) => snapFrame < normalizedFrame,
      );

      return previousSnapFrames.at(-1) ?? MASTER_PLAN_SNAP_FRAMES.at(-1) ?? 1;
    },
    [wrapFrame],
  );

  const goToHotspot = useCallback(
    (direction: 1 | -1) => {
      if (leavingRef.current) return;

      const targetFrame = getNextHotspotFrame(
        currentFrameRef.current,
        direction,
      );
      if (targetFrame === currentFrameRef.current) {
        return;
      }
      currentFrameRef.current = targetFrame;
      setCurrentFrame(targetFrame);
    },
    [getNextHotspotFrame],
  );

  useEffect(() => {
    const getScrollAreaElement = (
      target: EventTarget | null,
      event?: Event,
    ) => {
      const composedPath = event?.composedPath?.() ?? [];

      for (const pathNode of composedPath) {
        if (pathNode instanceof HTMLElement && pathNode.dataset.scrollArea) {
          return pathNode;
        }

        if (pathNode instanceof Element) {
          const scrollArea = pathNode.closest("[data-scroll-area]");

          if (scrollArea instanceof HTMLElement) {
            return scrollArea;
          }
        }
      }

      if (target instanceof HTMLElement) {
        return target.closest("[data-scroll-area]");
      }

      if (target instanceof Node) {
        return target.parentElement?.closest("[data-scroll-area]") ?? null;
      }

      return null;
    };

    const isInsideScrollArea = (target: EventTarget | null, event?: Event) => {
      return Boolean(getScrollAreaElement(target, event));
    };
    const blockAllScrollLikeActions = (e: Event) => {
      if (leavingRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (leavingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isInsideScrollArea(target, e)) return;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (leavingRef.current) {
        const blockedKeys = ["ArrowUp", "PageUp", "Home", " "];

        if (blockedKeys.includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (isInsideScrollArea(e.target)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToHotspot(-1);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToHotspot(1);
        return;
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown, { passive: false });

    window.addEventListener("scroll", blockAllScrollLikeActions, {
      passive: false,
    });
    document.addEventListener(
      "gesturestart",
      blockAllScrollLikeActions as EventListener,
      { passive: false },
    );

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", blockAllScrollLikeActions);
      document.removeEventListener(
        "gesturestart",
        blockAllScrollLikeActions as EventListener,
      );
    };
  }, [goToHotspot]);

  return (
    <div
      ref={rootRef}
      className="relative app-screen w-full bg-black text-zinc-900 [overflow-anchor:none] dark:text-white"
    >
      {shouldShowTopViewFullscreen ? <MasterPlanTopViewStage /> : null}

      {!shouldUseCompactLayout && !shouldShowTopViewFullscreen ? (
        isTopViewMode && !selectedTower ? (
          <MasterPlanTopViewStage />
        ) : (
          <MasterPlanFrameHoverStage
            apartments={apartments}
            currentFrame={currentFrame}
            dragEnabled
            filteredApartments={
              hasActiveInventoryFilters ? filteredApartments : []
            }
            inventoryError={inventoryError}
            inventoryState={
              isInventoryLoading
                ? "loading"
                : inventoryError
                  ? "error"
                  : "ready"
            }
            onApartmentSelect={handleApartmentSelect}
            onInteractionChange={(isInteracting) => {
              setIsStageInteracting(isInteracting);

              // After the user begins rotating, keep the stage clear for selecting
              // flats. The existing Filters dock remains available to restore this rail.
              if (isInteracting) {
                setIsDesktopSidebarOpen(false);
              }
            }}
            onSetFrame={setWrappedFrame}
            selectedApartmentId={selectedApartmentMeshId}
            selectedTower={selectedTower}
            config={masterPlanConfig}
            touchHighlightProfile="desktop"
          />
        )
      ) : null}

      {!shouldUseCompactLayout &&
      !isTopViewMode &&
      !isLeaving &&
      !isSpecialVideoOpen ? (
        <div
          className={`pointer-events-none absolute inset-x-0 z-40 flex justify-center px-4 ${
            isDesktopCompactViewport ? "top-8" : "top-24 sm:top-28 md:top-30"
          }`}
        >
          <MasterPlanHotspotControls
            onPrevious={() => goToHotspot(-1)}
            onNext={() => goToHotspot(1)}
          />
        </div>
      ) : null}

      {!isLeaving && !isSpecialVideoOpen ? (
        <button
          type="button"
          data-preserve-flat-selection="true"
          onClick={() => {
            const searchParams = new URLSearchParams();
            if (selectedApartment) {
              searchParams.append("units", selectedApartment.id);
            }
            searchParams.set("frame", String(currentFrame));
            router.push(`/master-plan/compare?${searchParams.toString()}`);
          }}
          className="absolute left-4 top-4 z-50 inline-flex h-10 items-center gap-2 rounded-full border border-white/45 bg-white/68 px-4 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#294733] shadow-[0_12px_30px_rgba(15,32,20,0.16)] backdrop-blur-xl transition hover:bg-white/85 sm:left-6 sm:top-6 sm:h-11 sm:text-[11px]"
        >
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          {selectedApartment ? "Compare this flat" : "Compare flats"}
        </button>
      ) : null}

      {shouldShowTopViewFullscreen ? (
        <div
          className={`pointer-events-none absolute inset-x-0 z-40 flex justify-center px-4 ${
            isDesktopCompactViewport ? "top-8" : "top-24 sm:top-28 md:top-30"
          }`}
        >
          <MasterPlanModeToggle
            isTopViewMode
            onNormalView={handleNormalViewToggle}
            onTopView={handleTopViewToggle}
          />
        </div>
      ) : null}

      {!shouldShowTopViewFullscreen ? (
        <div
          className={`relative z-10 h-full flex-col transition-opacity duration-300 ${
            shouldUseCompactLayout ? "flex" : "flex xl:hidden"
          } ${
            shouldHideInlineCompactShell
              ? "pointer-events-none opacity-0"
              : "opacity-100"
          }`}
        >
          <div className="relative w-full shrink-0">
            <div
              className={`relative overflow-hidden ${compactStageHeightClassName}`}
            >
              <div className="absolute inset-0">
                {shouldRenderCompactSpecialVideoStage ? (
                  <div className="absolute inset-0 bg-black">
                    <div
                      className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${
                        isSpecialVideoReady ? "opacity-0" : "opacity-100"
                      }`}
                      style={{
                        backgroundImage: signedMasterPlanStageFallbackImage
                          ? `url('${signedMasterPlanStageFallbackImage}')`
                          : undefined,
                      }}
                    />

                    <video
                      ref={specialUnitVideoRef}
                      muted
                      playsInline
                      preload="auto"
                      poster={signedMasterPlanStageFallbackImage ?? undefined}
                      crossOrigin="anonymous"
                      disablePictureInPicture
                      className={`h-full w-full object-cover transition-opacity duration-300 ${
                        isSpecialVideoReady ? "opacity-100" : "opacity-0"
                      }`}
                      onEnded={() => {
                        if (isSpecialVideoReversing) {
                          closeSpecialUnitVideo();
                          return;
                        }

                        setIsSpecialVideoCompleted(true);
                      }}
                    />

                    {specialVideoFreezeFrameUrl ? (
                      <div
                        className={`pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-200 ${
                          isSpecialVideoFreezeFrameVisible
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                        style={{
                          backgroundImage: `url('${specialVideoFreezeFrameUrl}')`,
                        }}
                      />
                    ) : null}

                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.02)_48%,rgba(0,0,0,0.26)_100%)]" />
                  </div>
                ) : isTopViewMode && !selectedTower ? (
                  <MasterPlanTopViewStage />
                ) : (
                  <MasterPlanFrameHoverStage
                    apartments={apartments}
                    currentFrame={currentFrame}
                    dragEnabled={shouldEnableCompactStageScrubbing}
                    filteredApartments={
                      hasActiveInventoryFilters ? filteredApartments : []
                    }
                    inventoryError={inventoryError}
                    inventoryState={
                      isInventoryLoading
                        ? "loading"
                        : inventoryError
                          ? "error"
                          : "ready"
                    }
                    onApartmentSelect={handleApartmentSelect}
                    onInteractionChange={setIsStageInteracting}
                    onSetFrame={setWrappedFrame}
                    selectedApartmentId={selectedApartmentMeshId}
                    selectedTower={selectedTower}
                    config={masterPlanConfig}
                    touchHighlightProfile={compactTouchHighlightProfile}
                  />
                )}
              </div>

              {!isTopViewMode &&
              !isLeaving &&
              !shouldRenderCompactSpecialVideoStage ? (
                <div
                  className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4 ${
                    shouldUseCompactLayout
                      ? "bottom-3"
                      : "bottom-[max(env(safe-area-inset-bottom),1rem)]"
                  }`}
                >
                  <MasterPlanHotspotControls
                    compact
                    onPrevious={() => goToHotspot(-1)}
                    onNext={() => goToHotspot(1)}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className={compactLowerContentClassName}>
            <div
              className={
                selectedApartment || shouldShowCompactSpecialVideoPanel
                  ? "flex h-full min-h-0 flex-col overflow-hidden"
                  : "surface-contain flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/92 shadow-[0_24px_64px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/70"
              }
            >
              {selectedApartment ? (
                <div
                  className="custom-scrollbar flex min-h-0 flex-1 items-start justify-center overflow-y-auto overscroll-contain px-0 pb-[max(env(safe-area-inset-bottom),0rem)] pt-0 [-webkit-overflow-scrolling:touch] touch-pan-y"
                  data-scroll-area="compact-panel"
                >
                  <SelectedFlatDetailsPanel
                    ref={selectedFlatPanelRef}
                    apartment={selectedApartment}
                    compact
                    onClose={clearSelectedApartment}
                  />
                </div>
              ) : shouldShowCompactSpecialVideoPanel &&
                specialVideoApartment ? (
                <div
                  className="custom-scrollbar flex min-h-0 flex-1 items-start justify-center overflow-y-auto overscroll-contain px-0 pb-[max(env(safe-area-inset-bottom),0rem)] pt-0 [-webkit-overflow-scrolling:touch] touch-pan-y"
                  data-scroll-area="compact-panel"
                >
                  <SelectedFlatDetailsPanel
                    ref={selectedFlatPanelRef}
                    apartment={specialVideoApartment}
                    compact
                    onClose={handleSpecialVideoBack}
                  />
                </div>
              ) : selectedTower ? (
                <div
                  className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-2 pb-2.5 pt-2 sm:gap-3 sm:px-2.5"
                  data-scroll-area="compact-panel"
                >
                  <MasterPlanFiltersCard
                    search={search}
                    onSearchChange={setSearch}
                    selectedTower={filterTower}
                    onTowerChange={handleFilterTowerChange}
                    bhk={bhk}
                    onBhkChange={setBhk}
                    facing={facing}
                    onFacingChange={setFacing}
                    status={status}
                    onStatusChange={setStatus}
                    floor={floor}
                    floorOptions={floorOptions}
                    onFloorChange={setFloor}
                    areaBounds={areaBounds}
                    minArea={minArea}
                    maxArea={maxArea}
                    isAreaFiltered={isAreaFiltered}
                    onAreaRangeChange={handleAreaRangeChange}
                    onReset={resetFilters}
                    onBack={handleBackToTowerSelect}
                    compact
                  />

                  <MasterPlanResultsCard
                    filteredApartments={filteredApartments}
                    hasSelectedBlock={filterTower !== null}
                    hasUnitSelection={hasExplicitUnitFilter}
                    isInventoryLoading={isInventoryLoading}
                    inventoryError={inventoryError}
                    onApartmentSelect={handleApartmentListSelect}
                    selectedApartmentId={selectedApartmentInventoryId}
                    compact
                  />
                </div>
              ) : (
                <div
                  className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 pb-2.5 pt-2 [-webkit-overflow-scrolling:touch] touch-pan-y sm:px-2.5"
                  data-scroll-area="compact-panel"
                >
                  <TowerSelect
                    embedded
                    isTopViewActive={isTopViewMode}
                    mobile
                    onTopViewClick={handleTopViewToggle}
                    selectedTower={selectedTower}
                    onSelectTower={handleTowerSelect}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!shouldShowTopViewFullscreen ? (
        <div
          className={`pointer-events-none relative z-10 h-full w-full px-4 py-6 transition-opacity duration-500 md:px-6 lg:px-8 ${
            shouldUseCompactLayout ? "hidden" : "hidden xl:block"
          } ${isSpecialVideoOpen ? "opacity-0" : "opacity-100"}`}
        >
          <div
            className={`grid h-full gap-6 ${
              shouldShowDesktopSidebar && isDesktopSidebarOpen
                ? selectedTower
                  ? isDesktopCompactViewport
                    ? "xl:grid-cols-[minmax(0,1fr)_300px]"
                    : "xl:grid-cols-[minmax(0,1fr)_clamp(280px,22vw,320px)] 2xl:grid-cols-[minmax(0,1fr)_340px]"
                  : isDesktopCompactViewport
                    ? "xl:grid-cols-[minmax(0,1fr)_290px]"
                    : "xl:grid-cols-[minmax(0,1fr)_clamp(270px,20vw,300px)] 2xl:grid-cols-[minmax(0,1fr)_320px]"
                : selectedTower
                  ? "xl:grid-cols-[minmax(0,1fr)]"
                  : "xl:grid-cols-[minmax(0,1fr)]"
            }`}
          >
            {!selectedApartment ? (
              <div
                className={`pointer-events-none ${
                  shouldUseCompactLayout ? "hidden" : "hidden xl:block"
                }`}
              />
            ) : null}

            <AnimatePresence>
              {selectedApartment ? (
                <motion.div
                  initial={{ opacity: 0, x: 24, y: 12 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 24, y: 12 }}
                  transition={{ duration: 0.26, ease: smoothEase }}
                  className="pointer-events-none absolute left-4 top-[clamp(4.5rem,14vh,8.5rem)] z-40 hidden xl:block xl:origin-top-left xl:scale-[0.86] 2xl:left-7 2xl:scale-[0.92]"
                >
                  <SelectedFlatPlanPanel
                    apartment={selectedApartment}
                    onExpand={setExpandedFloorPlan}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {selectedApartment ? (
                <motion.div
                  initial={{ opacity: 0, x: 24, y: 12 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 24, y: 12 }}
                  transition={{ duration: 0.26, ease: smoothEase }}
                  className="pointer-events-none absolute right-4 top-[clamp(4.5rem,14vh,8.5rem)] z-40 w-full max-w-[22rem] overflow-visible xl:origin-top-right xl:scale-[0.9] 2xl:right-7 2xl:max-w-[24rem] 2xl:scale-[0.94]"
                >
                  <SelectedFlatDetailsPanel
                    ref={selectedFlatPanelRef}
                    apartment={selectedApartment}
                    compact
                    desktopEnhancedCompact
                    onClose={clearSelectedApartment}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {shouldShowDesktopSidebar && !isDesktopSidebarOpen ? (
                <motion.button
                  key="desktop-sidebar-open"
                  type="button"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.24, ease: smoothEase }}
                  onClick={() => setIsDesktopSidebarOpen(true)}
                  className="pointer-events-auto absolute right-4 top-8 z-40 hidden h-10 items-center gap-2 rounded-full border border-white/50 bg-[linear-gradient(145deg,rgba(250,249,242,0.72),rgba(234,238,227,0.46))] px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#31533b] shadow-[0_12px_28px_rgba(15,40,24,0.12),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-md transition hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.86),rgba(234,240,228,0.62))] xl:inline-flex"
                  aria-label="Open filters"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </motion.button>
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {shouldShowDesktopSidebar && isDesktopSidebarOpen ? (
                <motion.aside
                  key="sidebar"
                  variants={panelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="pointer-events-auto gpu-layer min-w-0 hidden overflow-visible xl:col-start-2 xl:block xl:h-full"
                >
                  <div
                    className={`custom-scrollbar sticky ml-auto min-h-0 w-full overflow-hidden pr-1 [overflow-anchor:none] ${
                      selectedTower
                        ? isDesktopCompactViewport
                          ? "max-w-[300px]"
                          : "max-w-[clamp(280px,22vw,320px)] 2xl:max-w-[340px]"
                        : isDesktopCompactViewport
                          ? "max-w-[290px]"
                          : "max-w-[clamp(270px,20vw,300px)] 2xl:max-w-[320px]"
                    }`}
                    style={{
                      height:
                        "calc(100dvh - max(env(safe-area-inset-top), 1.5rem) - 1.5rem)",
                      top: "max(env(safe-area-inset-top), 1.5rem)",
                    }}
                  >
                    <div
                      className={`relative flex h-full min-h-0 flex-col overflow-hidden ${
                        isDesktopCompactViewport ? "gap-4" : "gap-6"
                      }`}
                      data-scroll-area="sidebar"
                    >
                      {selectedTower ? (
                        <>
                          <MasterPlanFiltersCard
                            search={search}
                            onSearchChange={setSearch}
                            selectedTower={filterTower}
                            onTowerChange={handleFilterTowerChange}
                            bhk={bhk}
                            onBhkChange={setBhk}
                            facing={facing}
                            onFacingChange={setFacing}
                            status={status}
                            onStatusChange={setStatus}
                            floor={floor}
                            floorOptions={floorOptions}
                            onFloorChange={setFloor}
                            areaBounds={areaBounds}
                            minArea={minArea}
                            maxArea={maxArea}
                            isAreaFiltered={isAreaFiltered}
                            onAreaRangeChange={handleAreaRangeChange}
                            onClosePanel={() => setIsDesktopSidebarOpen(false)}
                            onReset={resetFilters}
                            onBack={handleBackToTowerSelect}
                            compactDesktop={isDesktopCompactViewport}
                          />

                          <MasterPlanResultsCard
                            filteredApartments={filteredApartments}
                            hasSelectedBlock={filterTower !== null}
                            hasUnitSelection={hasExplicitUnitFilter}
                            isInventoryLoading={isInventoryLoading}
                            inventoryError={inventoryError}
                            onApartmentSelect={handleApartmentListSelect}
                            selectedApartmentId={selectedApartmentInventoryId}
                            compactDesktop={isDesktopCompactViewport}
                          />
                        </>
                      ) : (
                        <TowerSelect
                          compactDesktop={isDesktopCompactViewport}
                          embedded
                          isTopViewActive={isTopViewMode}
                          onClose={() => setIsDesktopSidebarOpen(false)}
                          onTopViewClick={handleTopViewToggle}
                          selectedTower={selectedTower}
                          onSelectTower={handleTowerSelect}
                        />
                      )}
                    </div>
                  </div>
                </motion.aside>
              ) : null}
            </AnimatePresence>
          </div>

          {!isLeaving ? (
            <>
              <AnimatePresence>
                {selectedTower && isMobileSheetOpen && !selectedApartment ? (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMobileSheetOpen(false)}
                    className={`pointer-events-auto absolute inset-0 z-20 bg-black/10 backdrop-blur-[1px] ${
                      shouldUseCompactLayout ? "" : "xl:hidden"
                    }`}
                    aria-label="Close master plan panel"
                  />
                ) : null}
              </AnimatePresence>

              {!isMobileSheetOpen && selectedTower && !selectedApartment ? (
                <button
                  type="button"
                  onClick={() => setIsMobileSheetOpen(true)}
                  className={`pointer-events-auto absolute right-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-3 text-sm font-medium text-zinc-900 shadow-[0_14px_36px_rgba(15,23,42,0.18)] backdrop-blur-xl ${
                    shouldUseCompactLayout ? "" : "xl:hidden"
                  } ${
                    shouldUseCompactLayout
                      ? "bottom-[calc(env(safe-area-inset-bottom)+0.85rem)]"
                      : "bottom-6"
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {filteredApartments.length} units
                </button>
              ) : null}

              {!selectedApartment && !shouldShowCompactSpecialVideoPanel ? (
                <motion.div
                  initial={false}
                  animate={
                    isMobileSheetOpen
                      ? { y: 0, opacity: 1 }
                      : { y: "110%", opacity: 0 }
                  }
                  transition={{ duration: 0.45, ease: smoothEase }}
                  className={`gpu-layer absolute inset-x-0 z-30 ${
                    shouldUseCompactLayout ? "" : "xl:hidden"
                  } ${
                    isMobileSheetOpen
                      ? "pointer-events-auto"
                      : "pointer-events-none"
                  } ${shouldUseCompactLayout ? "bottom-0" : "bottom-3"}`}
                >
                  <div
                    className={`surface-contain flex min-h-0 flex-col overflow-hidden overscroll-none rounded-t-[26px] border border-white/60 border-b-0 bg-white/92 shadow-[0_-20px_50px_rgba(15,23,42,0.20)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/70 sm:mx-1 sm:rounded-t-[28px] sm:rounded-b-none ${
                      selectedTower
                        ? "h-[min(84dvh,48rem)] max-h-[min(84dvh,48rem)]"
                        : "h-auto"
                    }`}
                    data-scroll-area={
                      selectedTower ? "mobile-sheet" : undefined
                    }
                  >
                    {selectedTower ? (
                      <>
                        <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-3 dark:border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-white/20" />
                            <div>
                              <p className="text-sm font-semibold">
                                Master Plan
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {filteredApartments.length} matching units
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsMobileSheetOpen(false)}
                            className="rounded-xl border border-zinc-200 bg-white/80 p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                            aria-label="Close master plan panel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-2 pb-2.5 pt-2 sm:gap-3 sm:px-2.5">
                          <MasterPlanFiltersCard
                            search={search}
                            onSearchChange={setSearch}
                            selectedTower={filterTower}
                            onTowerChange={handleFilterTowerChange}
                            bhk={bhk}
                            onBhkChange={setBhk}
                            facing={facing}
                            onFacingChange={setFacing}
                            status={status}
                            onStatusChange={setStatus}
                            floor={floor}
                            floorOptions={floorOptions}
                            onFloorChange={setFloor}
                            areaBounds={areaBounds}
                            minArea={minArea}
                            maxArea={maxArea}
                            isAreaFiltered={isAreaFiltered}
                            onAreaRangeChange={handleAreaRangeChange}
                            onReset={resetFilters}
                            onBack={handleBackToTowerSelect}
                            compact
                          />

                          <MasterPlanResultsCard
                            filteredApartments={filteredApartments}
                            hasSelectedBlock={filterTower !== null}
                            hasUnitSelection={hasExplicitUnitFilter}
                            isInventoryLoading={isInventoryLoading}
                            inventoryError={inventoryError}
                            onApartmentSelect={handleApartmentListSelect}
                            selectedApartmentId={selectedApartmentInventoryId}
                            compact
                          />
                        </div>
                      </>
                    ) : (
                      <div className="p-4">
                        <TowerSelect
                          embedded
                          isTopViewActive={isTopViewMode}
                          mobile
                          onTopViewClick={handleTopViewToggle}
                          selectedTower={selectedTower}
                          onSelectTower={handleTowerSelect}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <AnimatePresence>
        {!shouldUseCompactLayout && isSpecialVideoOverlayMounted ? (
          <motion.div
            initial={false}
            animate={{
              opacity: isSpecialVideoOpen ? 1 : 0,
              scale: isSpecialVideoOpen ? 1 : 1.02,
            }}
            exit={{ opacity: 0, scale: 1.015 }}
            transition={{ duration: 0.38, ease: smoothEase }}
            className={`absolute inset-0 z-[70] overflow-hidden bg-black ${
              isSpecialVideoOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <div className="absolute inset-0">
              <video
                ref={specialUnitVideoRef}
                muted
                playsInline
                preload="auto"
                crossOrigin="anonymous"
                disablePictureInPicture
                className="h-full w-full object-cover"
                onEnded={() => {
                  if (isSpecialVideoReversing) {
                    closeSpecialUnitVideo();
                    return;
                  }

                  setIsSpecialVideoCompleted(true);
                }}
              />
            </div>

            {specialVideoFreezeFrameUrl ? (
              <div
                className={`pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-200 ${
                  isSpecialVideoFreezeFrameVisible ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  backgroundImage: `url('${specialVideoFreezeFrameUrl}')`,
                }}
              />
            ) : null}

            <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
              <button
                type="button"
                onClick={handleSpecialVideoBack}
                className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/78 px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-[0_18px_44px_rgba(15,23,42,0.18)] backdrop-blur-xl transition hover:bg-white"
                aria-label={`Go back from unit ${activeSpecialVideoFlatToken ?? "special"} preview`}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>

            <AnimatePresence>
              {isSpecialVideoCompleted &&
              !isSpecialVideoReversing &&
              specialVideoApartment ? (
                <motion.div
                  initial={{ opacity: 0, x: -24, y: 12 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: -24, y: 12 }}
                  transition={{ duration: 0.28, ease: smoothEase }}
                  className="pointer-events-none absolute left-4 top-[clamp(4.5rem,14vh,8.5rem)] z-20 hidden xl:block xl:origin-top-left xl:scale-[0.86] 2xl:left-7 2xl:scale-[0.92]"
                >
                  <SelectedFlatPlanPanel
                    apartment={specialVideoApartment}
                    onExpand={setExpandedFloorPlan}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {isSpecialVideoCompleted &&
              !isSpecialVideoReversing &&
              specialVideoApartment ? (
                <motion.div
                  initial={{ opacity: 0, x: 24, y: 12 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 24, y: 12 }}
                  transition={{ duration: 0.28, ease: smoothEase }}
                  className="pointer-events-none absolute right-4 top-[clamp(4.5rem,14vh,8.5rem)] z-20 w-full max-w-[22rem] overflow-visible xl:origin-top-right xl:scale-[0.9] 2xl:right-7 2xl:max-w-[24rem] 2xl:scale-[0.94]"
                >
                  <SelectedFlatDetailsPanel
                    apartment={specialVideoApartment}
                    compact
                    desktopEnhancedCompact
                    onClose={handleSpecialVideoBack}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {expandedFloorPlan ? (
          <motion.div
            className="fixed inset-0 z-[160] flex items-center justify-center p-5 sm:p-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            data-preserve-flat-selection="true"
          >
            <button
              type="button"
              onClick={() => setExpandedFloorPlan(null)}
              className="absolute inset-0 bg-black/62 backdrop-blur-[3px]"
              aria-label="Close enlarged floor plan"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.3, ease: smoothEase }}
              className="pointer-events-none relative h-[min(88dvh,60rem)] w-[min(92vw,78rem)]"
            >
              <SignedImage
                src={expandedFloorPlan.floorPlanImage}
                placeholderSrc={null}
                alt={`${expandedFloorPlan.title} enlarged floor plan`}
                fill
                sizes="92vw"
                className="object-contain drop-shadow-[0_28px_70px_rgba(0,0,0,0.46)]"
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MasterPlanFiltersCard({
  search,
  onSearchChange,
  selectedTower,
  onTowerChange,
  bhk,
  onBhkChange,
  facing,
  onFacingChange,
  status,
  onStatusChange,
  floor,
  floorOptions,
  onFloorChange,
  areaBounds,
  minArea,
  maxArea,
  isAreaFiltered,
  onAreaRangeChange,
  onClosePanel,
  onReset,
  onBack,
  compact = false,
  compactDesktop = false,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTower: TowerType | null;
  onTowerChange: (tower: TowerType) => void;
  bhk: BhkFilterValue;
  onBhkChange: (value: BhkFilterValue) => void;
  facing: FacingFilterValue;
  onFacingChange: (value: FacingFilterValue) => void;
  status: StatusFilterValue;
  onStatusChange: (value: StatusFilterValue) => void;
  floor: string;
  floorOptions: FloorFilterOption[];
  onFloorChange: (value: string) => void;
  areaBounds: AreaRange;
  minArea: number;
  maxArea: number;
  isAreaFiltered: boolean;
  onAreaRangeChange: (range: AreaRange) => void;
  onClosePanel?: () => void;
  onReset: () => void;
  onBack: () => void;
  compact?: boolean;
  compactDesktop?: boolean;
}) {
  const activeFilterCount =
    Number(selectedTower !== null) +
    Number(search.trim().length > 0) +
    Number(bhk !== null) +
    Number(facing !== null) +
    Number(status !== null) +
    Number(floor !== FLOOR_ALL_VALUE) +
    Number(isAreaFiltered);
  const [isCompactOpen, setIsCompactOpen] = useState(compact);
  const [isDesktopFilterOpen, setIsDesktopFilterOpen] = useState(true);
  const handleSearchInputChange = (value: string) => {
    onSearchChange(value.replace(/\D+/g, ""));
  };
  const towerOptions: TowerType[] = [
    "Tower A",
    "Tower B",
    "Tower C",
    "Tower D",
  ];
  const searchControl = (
    <div
      className={`group flex items-center rounded-full border transition ${
        compact
          ? "gap-2 border-[#e7e4d8] bg-[#f7f6ef] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_12px_24px_rgba(33,50,35,0.10)] focus-within:border-[#cfd9c6] focus-within:bg-[#fbfaf4]"
          : compactDesktop
            ? "gap-2 border-[#e7e4d8] bg-[#f7f6ef] px-3 py-[0.58rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_20px_rgba(33,50,35,0.09)] focus-within:border-[#cfd9c6] focus-within:bg-[#fbfaf4] dark:border-white/10 dark:bg-white/8 dark:focus-within:border-emerald-200/24"
            : "gap-2.5 border-[#e7e4d8] bg-[#f7f6ef] px-3.5 py-[0.72rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_12px_24px_rgba(33,50,35,0.10)] focus-within:border-[#cfd9c6] focus-within:bg-[#fbfaf4] dark:border-white/10 dark:bg-white/8 dark:focus-within:border-emerald-200/24"
      }`}
    >
      <Search
        className={`shrink-0 text-[#556f61] transition group-focus-within:text-[#23482f] dark:text-emerald-100/60 dark:group-focus-within:text-white ${compact || compactDesktop ? "h-3.5 w-3.5" : "h-4 w-4"}`}
      />
      <input
        value={search}
        onChange={(e) => handleSearchInputChange(e.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Search unit number"
        className={`w-full bg-transparent font-medium outline-none ${
          compact
            ? "text-xs text-[#1f3f2b] placeholder:text-[#718277] sm:text-[13px]"
            : compactDesktop
              ? "text-[12px] text-[#1f3f2b] placeholder:text-[#718277] dark:text-white"
              : "text-[13px] text-[#1f3f2b] placeholder:text-[#718277] dark:text-white"
        }`}
      />
    </div>
  );

  if (compact) {
    return (
      <motion.div className="surface-contain shrink-0 rounded-[28px] border border-[#ded8c9] bg-[#f3f2ea]/95 p-3 text-[#1f3f2b] shadow-[0_22px_48px_rgba(25,43,30,0.18),inset_0_1px_0_rgba(255,255,255,0.94)] backdrop-blur-xl sm:rounded-[30px] sm:p-3.5">
        <LiquidGlassFilterStyles />
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/42 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] transition hover:bg-white/62"
            aria-label="Back to tower selection"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#58715f]">
                Filters
              </p>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#e3dece] bg-[#fbfaf4] px-2 py-0.5 text-[10px] font-medium text-[#456859]">
                <Building2 className="h-3 w-3" />
                {selectedTower
                  ? formatBlockLabel(selectedTower)
                  : "Choose a block"}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-[#718277]">
              {activeFilterCount > 0
                ? `${activeFilterCount} active refinements`
                : "Search first, expand for details"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {isCompactOpen ? (
              <>
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-100/65 bg-white/42 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-900 transition hover:bg-white/62"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompactOpen(false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/50 bg-white/36 px-2.5 text-[10px] font-semibold text-emerald-950/78 transition hover:bg-white/58"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  Close filters
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsCompactOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/50 bg-white/36 px-2.5 text-[10px] font-semibold text-emerald-950/78 transition hover:bg-white/58"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Filters
              </button>
            )}
          </div>
        </div>

        <div className="mt-2.5">{searchControl}</div>

        {activeFilterCount > 0 && !isCompactOpen ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {bhk !== null ? (
              <FilterChip label={bhk === "All" ? "All BHK" : `${bhk} BHK`} />
            ) : null}
            {floor !== FLOOR_ALL_VALUE ? (
              <FilterChip
                label={
                  floorOptions.find((option) => option.value === floor)
                    ?.label ?? `Floor ${floor}`
                }
              />
            ) : null}
            {facing !== null ? (
              <FilterChip
                label={facing === "All" ? "All facings" : facing}
              />
            ) : null}
            {status !== null ? (
              <FilterChip
                label={status === "All" ? "All statuses" : status}
              />
            ) : null}
            {isAreaFiltered ? (
              <FilterChip
                label={`${formatAreaSqft(minArea)}–${formatAreaSqft(maxArea)} sqft`}
              />
            ) : null}
          </div>
        ) : null}

        {isCompactOpen ? (
          <div className="mt-2.5 max-h-[31svh] space-y-2.5 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] sm:max-h-[36svh]">
            <FilterBlock compact compactDark label="Block">
              <FilterPillGroup
                options={towerOptions}
                value={selectedTower}
                onChange={onTowerChange}
                getLabel={formatBlockLabel}
                compactDark
              />
            </FilterBlock>

            <FilterBlock compact compactDark label="BHK">
              <FilterPillGroup
                options={bhkOptions}
                value={bhk}
                onChange={onBhkChange}
                getLabel={(item) => (item === "All" ? "All" : `${item} BHK`)}
                compactDark
              />
            </FilterBlock>

            <FilterBlock compact compactDark label="Floor">
              <FilterDropdown
                value={floor}
                options={floorOptions}
                onChange={onFloorChange}
                compactDark
              />
            </FilterBlock>

            <FilterBlock compact compactDark label="Facing">
              <FilterPillGroup
                options={facingOptions}
                value={facing}
                onChange={onFacingChange}
                compactDark
              />
            </FilterBlock>

            <FilterBlock compact compactDark label="Status">
              <FilterPillGroup
                options={statusOptions}
                value={status}
                onChange={onStatusChange}
                compactDark
              />
            </FilterBlock>

            <FilterBlock
              compact
              compactDark
              label={`Area Range: ${formatAreaSqft(minArea)} – ${formatAreaSqft(maxArea)} sqft`}
            >
              <AreaRangeSlider
                bounds={areaBounds}
                value={{ min: minArea, max: maxArea }}
                onChange={onAreaRangeChange}
                compact
              />
            </FilterBlock>
          </div>
        ) : null}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`surface-contain custom-scrollbar relative shrink-0 overscroll-contain border border-[#ded8c9]/82 bg-[#f3f2ea]/78 text-[#1f3f2b] shadow-[0_20px_56px_rgba(25,43,30,0.13),inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-md [-webkit-overflow-scrolling:touch] dark:border-emerald-100/10 dark:bg-emerald-950/45 dark:text-white dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${
        compactDesktop
          ? "max-h-[62%] overflow-y-auto rounded-[34px] rounded-tr-[64px] p-4"
          : "max-h-[68%] overflow-y-auto rounded-[42px] rounded-tr-[88px] p-5"
      }`}
    >
      <LiquidGlassFilterStyles />
      <div
        className={`pointer-events-none absolute rounded-full border border-[#d8d0bd]/45 opacity-45 ${compactDesktop ? "-right-6 bottom-2 h-32 w-32" : "-right-8 bottom-2 h-40 w-40"}`}
      />
      <NextImage
        src="/LEAF UI.png"
        alt=""
        aria-hidden="true"
        width={660}
        height={660}
        className={`pointer-events-none absolute z-0 w-full opacity-45 mix-blend-multiply ${compactDesktop ? "-bottom-12 -right-8" : "-bottom-16 -right-10 sm:-bottom-16 sm:-right-12 sm:w-full"}`}
      />
      <div
        className={`flex items-start justify-between gap-3 ${compactDesktop ? "mb-4" : "mb-5"}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <p
              className={`font-bold uppercase text-[#58715f] ${compactDesktop ? "text-[9px] tracking-[0.28em]" : "text-[10px] tracking-[0.32em]"}`}
            >
              Filters
            </p>
            <button
              type="button"
              onClick={onBack}
              className="relative z-20 rounded-full border border-[#d8d0bd] bg-[#fbfaf4]/82 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#557568] transition hover:bg-white hover:text-[#21492f]"
            >
              Clear all
            </button>
          </div>
          <h2
            className={`${masterPlanSerif.className} mt-1 font-medium leading-none text-[#21492f] ${compactDesktop ? "text-[1.7rem]" : "text-[2rem]"}`}
          >
            Find Your Residence
          </h2>
          <div
            className={`bg-[#c4a667] ${compactDesktop ? "mt-1.5 h-px w-6" : "mt-2 h-px w-7"}`}
          />
          <p
            className={`font-medium text-[#718277] ${compactDesktop ? "mt-1.5 text-[12px]" : "mt-2 text-[13px]"}`}
          >
            Refined living. Curated for you.
          </p>
        </div>

        <div
          className={`flex shrink-0 items-center gap-1.5 ${compactDesktop ? "mr-2" : "mr-4"}`}
        >
          <button
            type="button"
            onClick={onBack}
            title="Back"
            aria-label="Back"
            className={`inline-flex items-center justify-center rounded-full border border-[#ded8c9] bg-[#fbfaf4] text-[#456859] shadow-[0_10px_24px_rgba(33,50,35,0.10)] transition hover:bg-white ${compactDesktop ? "h-8 w-8" : "h-9 w-9"}`}
          >
            <ArrowLeft className={compactDesktop ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </button>

          <button
            type="button"
            onClick={onClosePanel ?? onReset}
            title={onClosePanel ? "Close filters" : "Reset filters"}
            aria-label={onClosePanel ? "Close filters" : "Reset filters"}
            className={`inline-flex cursor-pointer items-center justify-center rounded-full border border-[#ded8c9] bg-[#fbfaf4] text-[#456859] shadow-[0_10px_24px_rgba(33,50,35,0.10)] transition hover:bg-white ${compactDesktop ? "h-8 w-8" : "h-9 w-9"}`}
          >
            <X className={compactDesktop ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </button>
          <button
            type="button"
            onClick={() => setIsDesktopFilterOpen((value) => !value)}
            title={isDesktopFilterOpen ? "Collapse filters" : "Expand filters"}
            className={`inline-flex items-center justify-center rounded-full border border-[#ded8c9] bg-[#fbfaf4] text-[#456859] shadow-[0_12px_24px_rgba(33,50,35,0.14)] transition hover:bg-white ${compactDesktop ? "h-8 w-8" : "h-9 w-9"}`}
            aria-label={
              isDesktopFilterOpen ? "Collapse filters" : "Expand filters"
            }
            aria-expanded={isDesktopFilterOpen}
          >
            {isDesktopFilterOpen ? (
              <ChevronUp
                className={compactDesktop ? "h-3.5 w-3.5" : "h-4 w-4"}
              />
            ) : (
              <ChevronDown
                className={compactDesktop ? "h-3.5 w-3.5" : "h-4 w-4"}
              />
            )}
          </button>
        </div>
      </div>

      <div
        className={`relative z-10 ${compact ? "space-y-3" : compactDesktop ? "space-y-4" : "space-y-5"}`}
      >
        <FilterBlock label="Search Unit" compactDesktop={compactDesktop}>
          {searchControl}
        </FilterBlock>

        {isDesktopFilterOpen ? (
          <>
            <FilterBlock label="Block" compactDesktop={compactDesktop}>
              <FilterPillGroup
                options={towerOptions}
                value={selectedTower}
                onChange={onTowerChange}
                getLabel={formatBlockLabel}
                compactDesktop={compactDesktop}
              />
            </FilterBlock>

            <FilterBlock label="BHK" compactDesktop={compactDesktop}>
              <FilterPillGroup
                options={bhkOptions}
                value={bhk}
                onChange={onBhkChange}
                getLabel={(item) => (item === "All" ? "All" : `${item} BHK`)}
                compactDesktop={compactDesktop}
              />
            </FilterBlock>

            <FilterBlock label="Floor" compactDesktop={compactDesktop}>
              <FilterDropdown
                value={floor}
                options={floorOptions}
                onChange={onFloorChange}
                compactDesktop={compactDesktop}
              />
            </FilterBlock>

            <FilterBlock label="Facing" compactDesktop={compactDesktop}>
              <FilterPillGroup
                options={facingOptions}
                value={facing}
                onChange={onFacingChange}
                compactDesktop={compactDesktop}
              />
            </FilterBlock>

            <FilterBlock label="Status" compactDesktop={compactDesktop}>
              <FilterPillGroup
                options={statusOptions}
                value={status}
                onChange={onStatusChange}
                compactDesktop={compactDesktop}
              />
            </FilterBlock>

            <FilterBlock
              label={`Area Range: ${formatAreaSqft(minArea)} – ${formatAreaSqft(maxArea)} sqft`}
              compactDesktop={compactDesktop}
            >
              <AreaRangeSlider
                bounds={areaBounds}
                value={{ min: minArea, max: maxArea }}
                onChange={onAreaRangeChange}
                compactDesktop={compactDesktop}
              />
            </FilterBlock>
          </>
        ) : activeFilterCount > 0 ? (
          <div className="flex flex-wrap gap-2">
            {bhk !== null ? (
              <FilterChip label={bhk === "All" ? "All BHK" : `${bhk} BHK`} />
            ) : null}
            {floor !== FLOOR_ALL_VALUE ? (
              <FilterChip
                label={
                  floorOptions.find((option) => option.value === floor)
                    ?.label ?? `Floor ${floor}`
                }
              />
            ) : null}
            {facing !== null ? (
              <FilterChip
                label={facing === "All" ? "All facings" : facing}
              />
            ) : null}
            {status !== null ? (
              <FilterChip
                label={status === "All" ? "All statuses" : status}
              />
            ) : null}
            {isAreaFiltered ? (
              <FilterChip
                label={`${formatAreaSqft(minArea)}–${formatAreaSqft(maxArea)} sqft`}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function MasterPlanResultsCard({
  filteredApartments,
  hasSelectedBlock,
  hasUnitSelection,
  isInventoryLoading,
  inventoryError,
  onApartmentSelect,
  selectedApartmentId,
  compact = false,
  compactDesktop = false,
}: {
  filteredApartments: InventoryApartment[];
  hasSelectedBlock: boolean;
  hasUnitSelection: boolean;
  isInventoryLoading: boolean;
  inventoryError: string | null;
  onApartmentSelect: (apartment: InventoryApartment) => void;
  selectedApartmentId: string | null;
  compact?: boolean;
  compactDesktop?: boolean;
}) {
  const scrollableId = useId();
  const paginationKey = useMemo(
    () => filteredApartments.map((apartment) => apartment.id).join("|"),
    [filteredApartments],
  );
  const [pagination, setPagination] = useState({
    key: "",
    visibleCount: MATCHING_FLATS_PAGE_SIZE,
  });
  const visibleCount =
    pagination.key === paginationKey
      ? pagination.visibleCount
      : MATCHING_FLATS_PAGE_SIZE;
  const visibleApartments = useMemo(
    () => filteredApartments.slice(0, visibleCount),
    [filteredApartments, visibleCount],
  );
  const hasMoreApartments = visibleCount < filteredApartments.length;

  const loadMoreApartments = useCallback(() => {
    setPagination((current) => {
      const currentVisibleCount =
        current.key === paginationKey
          ? current.visibleCount
          : MATCHING_FLATS_PAGE_SIZE;

      return {
        key: paginationKey,
        visibleCount: Math.min(
          currentVisibleCount + MATCHING_FLATS_PAGE_SIZE,
          filteredApartments.length,
        ),
      };
    });
  }, [filteredApartments.length, paginationKey]);

  return (
    <motion.div
      className={`surface-contain flex min-h-0 flex-col rounded-[30px] border border-[#ded8c9]/82 bg-[#f3f2ea]/78 text-[#1f3f2b] shadow-[0_20px_56px_rgba(25,43,30,0.13),inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-md dark:border-emerald-100/10 dark:bg-emerald-950/45 dark:text-white dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${
        compact
          ? "min-h-0 flex-1 overflow-hidden p-3"
          : compactDesktop
            ? "min-h-[12rem] flex-1 overflow-hidden p-3.5"
            : "min-h-[13rem] flex-1 overflow-hidden p-4"
      }`}
    >
      <div
        className={`flex items-center justify-between ${compact ? "mb-3" : compactDesktop ? "mb-3.5" : "mb-4"}`}
      >
        <div>
          <h3
            className={`${masterPlanSerif.className} ${compact ? "text-[1.65rem]" : compactDesktop ? "text-[1.55rem]" : "text-[1.8rem]"} font-medium leading-none text-[#21492f]`}
          >
            Matching Flats
          </h3>
        </div>
        <span
          className={`rounded-full border border-[#ded8c9] bg-[#fbfaf4] font-semibold text-[#456f49] shadow-[0_10px_22px_rgba(33,50,35,0.10),inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-white/5 dark:text-white ${
            compact
              ? "px-3 py-1 text-[11px]"
              : compactDesktop
                ? "px-2.5 py-1 text-[11px]"
                : "px-3 py-1 text-xs"
          }`}
        >
          {hasSelectedBlock && hasUnitSelection
            ? `${filteredApartments.length} units`
            : hasSelectedBlock
              ? "Select preference"
              : "Select block"}
        </span>
      </div>

      <motion.div
        variants={staggerWrap}
        initial="hidden"
        animate="visible"
        className={`custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none] [-webkit-overflow-scrolling:touch] touch-pan-y ${
          compact ? "pr-1" : compactDesktop ? "pr-1.5" : "pr-2"
        }`}
        id={scrollableId}
        data-scroll-area="results"
      >
        <div
          className={
            compact
              ? "space-y-3 pb-1"
              : compactDesktop
                ? "space-y-2.5"
                : "space-y-3"
          }
        >
          <AnimatePresence initial={false}>
            {isInventoryLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-center justify-center rounded-[22px] border border-dashed border-emerald-100/55 bg-emerald-50/38 px-4 text-center dark:border-white/10 dark:bg-white/5 ${compactDesktop ? "h-[190px]" : "h-[220px]"}`}
              >
                <div>
                  <p className="text-sm font-semibold">Loading flats</p>
                  <p className="mt-1 text-xs text-emerald-950/58">
                    Pulling the latest block inventory.
                  </p>
                </div>
              </motion.div>
            ) : inventoryError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-center justify-center rounded-[22px] border border-dashed border-rose-200 bg-rose-50/80 px-4 text-center ${compactDesktop ? "h-[190px]" : "h-[220px]"}`}
              >
                <div>
                  <p className="text-sm font-semibold text-rose-700">
                    Inventory could not be loaded
                  </p>
                  <p className="mt-1 text-xs text-rose-600">{inventoryError}</p>
                </div>
              </motion.div>
            ) : filteredApartments.length > 0 ? (
              <InfiniteScroll
                dataLength={visibleApartments.length}
                next={loadMoreApartments}
                hasMore={hasMoreApartments}
                scrollableTarget={scrollableId}
                loader={<MatchingFlatsInlineLoader compact={compact} />}
                className={
                  compact
                    ? "space-y-2.5 pb-1"
                    : compactDesktop
                      ? "space-y-2.5"
                      : "space-y-3"
                }
                style={{ overflow: "visible" }}
              >
                {visibleApartments.map((apartment) => {
                  return (
                    <motion.button
                      key={apartment.id}
                      layout="position"
                      variants={itemAnim}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onClick={() => {
                        // if (!isViewableAtHotspot) {
                        //   return;
                        // }

                        onApartmentSelect(apartment);
                      }}
                      className={`group relative grid w-full overflow-hidden text-left transition duration-200 hover:-translate-y-0.5 ${
                        apartment.id === selectedApartmentId
                          ? "border-[#345d3e]/30 bg-[#fbfaf4] shadow-[0_18px_38px_rgba(34,50,35,0.20),inset_0_1px_0_rgba(255,255,255,0.98)]"
                          : "border-[#ddd8ca] bg-[#fbfaf4] shadow-[0_14px_30px_rgba(34,50,35,0.13),inset_0_1px_0_rgba(255,255,255,0.98)] hover:border-[#c9c0ac] hover:shadow-[0_20px_42px_rgba(34,50,35,0.18),inset_0_1px_0_rgba(255,255,255,0.98)]"
                      } ${
                        compact
                          ? "grid-cols-[minmax(0,1fr)_5.4rem] items-stretch rounded-[18px] border"
                          : compactDesktop
                            ? "grid-cols-[minmax(0,1fr)_5.3rem] items-stretch rounded-[20px] border"
                            : "grid-cols-[minmax(0,1fr)_6rem] items-stretch rounded-[22px] border"
                      }`}
                    >
                      <div
                        className={`min-w-0 w-full cursor-pointer ${compact ? "px-4 py-3" : compactDesktop ? "px-3.5 py-2.5" : "px-4 py-3"}`}
                      >
                        <div
                          className={`flex flex-wrap items-center ${compact ? "gap-2" : compactDesktop ? "gap-2" : "gap-2.5"}`}
                        >
                          <p
                            className={`${masterPlanSerif.className} font-semibold text-[#21492f] dark:text-white ${
                              compact
                                ? "text-[1.55rem] leading-none"
                                : compactDesktop
                                  ? "text-[1.28rem] leading-none"
                                  : "text-[1.45rem] leading-none"
                            }`}
                          >
                            {apartment.title}
                          </p>
                          <span
                            className={`rounded-full font-semibold ${
                              compact
                                ? "px-2 py-0.5 text-[9px]"
                                : compactDesktop
                                  ? "px-1.5 py-0.5 text-[9px]"
                                  : "px-2 py-0.5 text-[10px]"
                            } ${
                              apartment.status === "Available"
                                ? "bg-[#d8f7de] text-[#087144] ring-1 ring-[#b6ecc6]"
                                : apartment.status === "Sold"
                                  ? "bg-[#ffe3ea] text-[#bd1748] ring-1 ring-[#ffc7d5]"
                                  : "bg-[#fff0c9] text-[#92640d] ring-1 ring-[#f4d88d]"
                            }`}
                          >
                            {apartment.status}
                          </span>
                          {/* {!isViewableAtHotspot ? (
                            <span
                              className={`rounded-full bg-zinc-200 font-semibold text-zinc-600 dark:bg-white/8 dark:text-zinc-300 ${
                                compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
                              }`}
                            >
                              Not viewable here
                            </span>
                          ) : null} */}
                        </div>

                        <div
                          className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[#617568] dark:text-zinc-400 ${
                            compact
                              ? "text-[10px]"
                              : compactDesktop
                                ? "text-[11px]"
                                : "text-xs"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Building2
                              className={
                                compact
                                  ? "h-3 w-3"
                                  : compactDesktop
                                    ? "h-3 w-3"
                                    : "h-3.5 w-3.5"
                              }
                            />
                            {formatBlockLabel(apartment.tower)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <BedDouble
                              className={
                                compact
                                  ? "h-3 w-3"
                                  : compactDesktop
                                    ? "h-3 w-3"
                                    : "h-3.5 w-3.5"
                              }
                            />
                            {apartment.bhk} BHK
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin
                              className={
                                compact
                                  ? "h-3 w-3"
                                  : compactDesktop
                                    ? "h-3 w-3"
                                    : "h-3.5 w-3.5"
                              }
                            />
                            {apartment.facing}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Ruler
                              className={
                                compact
                                  ? "h-3 w-3"
                                  : compactDesktop
                                    ? "h-3 w-3"
                                    : "h-3.5 w-3.5"
                              }
                            />
                            Floor {apartment.floorLabel}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`flex flex-col items-center justify-center border-l border-[#e2ddcf] bg-[#f6f4eb] text-center text-[#557568] ${compactDesktop ? "px-1.5" : "px-2"}`}
                      >
                        <p
                          className={`${masterPlanSerif.className} ${compactDesktop ? "text-[1.45rem]" : "text-[1.7rem]"} font-semibold leading-none text-[#456f49]`}
                        >
                          {apartment.areaSqft}
                        </p>
                        <p
                          className={`mt-1 font-bold uppercase text-[#718277] ${compactDesktop ? "text-[7px] tracking-[0.24em]" : "text-[8px] tracking-[0.32em]"}`}
                        >
                          Sqft
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </InfiniteScroll>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-center justify-center rounded-[22px] border border-dashed border-emerald-100/55 bg-emerald-50/38 px-4 text-center dark:border-white/10 dark:bg-white/5 ${compactDesktop ? "h-[190px]" : "h-[220px]"}`}
              >
                <div>
                  <p className="text-sm font-semibold">
                    {!hasSelectedBlock
                      ? "Choose a block"
                      : !hasUnitSelection
                        ? "Choose a preference"
                        : "No flats found"}
                  </p>
                  <p className="mt-1 text-xs text-emerald-950/58">
                    {!hasSelectedBlock
                      ? "Select Block A, B, C or D to begin."
                      : !hasUnitSelection
                        ? "Select All or choose a specific option to view flats."
                        : "Try changing the filters."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AreaRangeSlider({
  bounds,
  value,
  onChange,
  compact = false,
  compactDesktop = false,
}: {
  bounds: AreaRange;
  value: AreaRange;
  onChange: (range: AreaRange) => void;
  compact?: boolean;
  compactDesktop?: boolean;
}) {
  const totalRange = Math.max(bounds.max - bounds.min, AREA_RANGE_STEP);
  const minPosition = ((value.min - bounds.min) / totalRange) * 100;
  const maxPosition = ((value.max - bounds.min) / totalRange) * 100;
  const normalizeValue = (nextValue: number) =>
    Math.round(nextValue / AREA_RANGE_STEP) * AREA_RANGE_STEP;

  return (
    <div>
      <div className="mp-area-range relative h-7 w-full">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full border border-[#b9beb5] bg-[#e7e7e3] shadow-[inset_0_1px_2px_rgba(30,56,38,0.14)] dark:border-white/20 dark:bg-white/10" />
        <div
          className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#466f46] shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]"
          style={{
            left: `${Math.max(0, Math.min(100, minPosition))}%`,
            width: `${Math.max(0, Math.min(100, maxPosition - minPosition))}%`,
          }}
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={AREA_RANGE_STEP}
          value={value.min}
          onChange={(event) =>
            onChange({
              min: Math.min(
                normalizeValue(Number(event.target.value)),
                value.max,
              ),
              max: value.max,
            })
          }
          aria-label="Minimum flat area"
          aria-valuetext={`${formatAreaSqft(value.min)} square feet`}
          className="mp-area-range__input"
          style={{ zIndex: value.min >= value.max - totalRange * 0.08 ? 4 : 3 }}
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={AREA_RANGE_STEP}
          value={value.max}
          onChange={(event) =>
            onChange({
              min: value.min,
              max: Math.max(
                normalizeValue(Number(event.target.value)),
                value.min,
              ),
            })
          }
          aria-label="Maximum flat area"
          aria-valuetext={`${formatAreaSqft(value.max)} square feet`}
          className="mp-area-range__input"
          style={{ zIndex: 3 }}
        />
      </div>

      <div
        className={`mt-1 flex items-center justify-between font-semibold uppercase text-[#718277] dark:text-emerald-50/60 ${
          compact
            ? "text-[9px] tracking-[0.12em] text-emerald-950/52"
            : compactDesktop
              ? "text-[8px] tracking-[0.12em]"
              : "text-[9px] tracking-[0.14em]"
        }`}
      >
        <span>{formatAreaSqft(bounds.min)} sqft</span>
        <span>{formatAreaSqft(bounds.max)} sqft</span>
      </div>
    </div>
  );
}

function MatchingFlatsInlineLoader({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 ${
        compact ? "py-3" : "py-4"
      }`}
    >
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-white/20 dark:border-t-white" />
      Loading more flats
    </div>
  );
}

function LiquidGlassFilterStyles() {
  return (
    <style jsx global>{`
      .mp-liquid-switcher {
        --option-count: 3;
        --active-index: 0;
        --switcher-width: 100%;
        position: relative;
        display: grid;
        grid-template-columns: repeat(var(--option-count), minmax(0, 1fr));
        align-items: center;
        gap: 0;
        width: min(100%, var(--switcher-width));
        min-width: 0;
        min-inline-size: 0;
        height: 42px;
        box-sizing: border-box;
        padding: 5px;
        margin: 0;
        border: 0;
        border-radius: 999px;
        isolation: isolate;
        overflow: hidden;
        background: #fbfaf4;
        box-shadow:
          inset 0 0 0 1px rgba(222, 216, 201, 0.95),
          inset 0 1px 0 rgba(255, 255, 255, 0.95),
          0 10px 24px rgba(33, 50, 35, 0.12);
      }

      .mp-liquid-switcher--compact {
        height: 40px;
      }

      .mp-liquid-switcher--desktop-compact {
        height: 40px;
      }

      .mp-liquid-switcher::after {
        content: "";
        position: absolute;
        z-index: 1;
        left: 5px;
        top: 5px;
        width: calc((100% - 10px) / var(--option-count));
        height: calc(100% - 10px);
        border-radius: inherit;
        background: linear-gradient(180deg, #537a54, #335f37);
        transform: translateX(calc(var(--active-index) * 100%));
        transform-origin: center;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.24),
          inset 0 -1px 0 rgba(0, 0, 0, 0.16),
          0 8px 16px rgba(37, 83, 43, 0.28);
        opacity: var(--selection-opacity, 1);
        transition:
          transform 420ms cubic-bezier(1, 0, 0.4, 1),
          opacity 180ms ease,
          background-color 420ms cubic-bezier(1, 0, 0.4, 1),
          box-shadow 420ms cubic-bezier(1, 0, 0.4, 1);
        animation: mpLiquidToggle 440ms ease;
      }

      .mp-liquid-switcher__legend,
      .mp-liquid-switcher__input {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        border: 0;
        white-space: nowrap;
        clip-path: inset(100%);
        clip: rect(0 0 0 0);
        overflow: hidden;
      }

      .mp-liquid-switcher__option {
        position: relative;
        z-index: 2;
        display: flex;
        min-width: 0;
        height: 100%;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        cursor: pointer;
        color: #819085;
        transition:
          color 160ms ease,
          transform 200ms cubic-bezier(0.5, 0, 0, 1);
      }

      .mp-liquid-switcher__option:hover {
        color: #315f37;
      }

      .mp-liquid-switcher__option:hover .mp-liquid-switcher__label {
        transform: scale(1.08);
      }

      .mp-liquid-switcher__option[data-active="true"] {
        cursor: auto;
        color: #fffaf0;
      }

      .mp-liquid-switcher__option[data-active="true"]
        .mp-liquid-switcher__label {
        transform: scale(1);
      }

      .mp-liquid-switcher__label {
        display: inline-flex;
        min-width: 0;
        align-items: center;
        justify-content: center;
        gap: 5px;
        max-width: 100%;
        overflow: hidden;
        padding: 0 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 9.5px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        line-height: 1;
        transition: transform 200ms cubic-bezier(0.5, 0, 0, 1);
      }

      .mp-liquid-switcher__text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .mp-liquid-switcher__icon {
        width: 12px;
        height: 12px;
        flex: 0 0 auto;
      }

      @media (min-width: 640px) {
        .mp-liquid-switcher__label {
          font-size: 10.5px;
        }
      }

      .mp-liquid-switcher--desktop-compact .mp-liquid-switcher__label {
        gap: 4px;
        padding: 0 6px;
        font-size: 9px;
        letter-spacing: 0.11em;
      }

      .mp-liquid-switcher--desktop-compact .mp-liquid-switcher__icon {
        width: 11px;
        height: 11px;
      }

      .mp-liquid-switcher--dense .mp-liquid-switcher__label {
        gap: 3px;
        padding: 0 4px;
        font-size: 9px;
        letter-spacing: 0.08em;
      }

      .mp-liquid-switcher--dense .mp-liquid-switcher__icon {
        display: none;
      }

      @keyframes mpLiquidToggle {
        0% {
          scale: 1 1;
        }
        50% {
          scale: 1.06 1;
        }
        100% {
          scale: 1 1;
        }
      }

      .mp-area-range__input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 28px;
        margin: 0;
        appearance: none;
        background: transparent;
        pointer-events: none;
        outline: none;
      }

      .mp-area-range__input::-webkit-slider-runnable-track {
        height: 8px;
        background: transparent;
      }

      .mp-area-range__input::-moz-range-track {
        height: 8px;
        background: transparent;
        border: 0;
      }

      .mp-area-range__input::-webkit-slider-thumb {
        width: 20px;
        height: 20px;
        margin-top: -6px;
        appearance: none;
        border: 2px solid #f7f6ef;
        border-radius: 999px;
        background: #466f46;
        box-shadow:
          0 0 0 1px rgba(38, 77, 44, 0.24),
          0 3px 8px rgba(25, 63, 32, 0.3);
        cursor: grab;
        pointer-events: auto;
      }

      .mp-area-range__input::-moz-range-thumb {
        width: 17px;
        height: 17px;
        border: 2px solid #f7f6ef;
        border-radius: 999px;
        background: #466f46;
        box-shadow:
          0 0 0 1px rgba(38, 77, 44, 0.24),
          0 3px 8px rgba(25, 63, 32, 0.3);
        cursor: grab;
        pointer-events: auto;
      }

      .mp-area-range__input:active::-webkit-slider-thumb,
      .mp-area-range__input:active::-moz-range-thumb {
        cursor: grabbing;
      }

      .mp-area-range__input:focus-visible::-webkit-slider-thumb {
        outline: 3px solid rgba(70, 111, 70, 0.28);
        outline-offset: 2px;
      }

      .mp-area-range__input:focus-visible::-moz-range-thumb {
        outline: 3px solid rgba(70, 111, 70, 0.28);
        outline-offset: 2px;
      }
    `}</style>
  );
}

function FilterPillGroup<T extends string>({
  options,
  value,
  onChange,
  getLabel = (item) => item,
  compactDark = false,
  compactDesktop = false,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
  compactDark?: boolean;
  compactDesktop?: boolean;
}) {
  const name = useId();
  const selectedIndex = options.findIndex((item) => item === value);
  const activeIndex = Math.max(0, selectedIndex);
  const switcherWidthRem = options.length >= 5 ? 100 : options.length * 6.45;
  const switcherStyle = {
    "--option-count": options.length,
    "--active-index": activeIndex,
    "--selection-opacity": selectedIndex >= 0 ? 1 : 0,
    "--switcher-width":
      options.length >= 5 ? "100%" : `${switcherWidthRem.toFixed(2)}rem`,
  } as CSSProperties;

  return (
    <fieldset
      className={`mp-liquid-switcher ${compactDark ? "mp-liquid-switcher--compact" : ""} ${compactDesktop ? "mp-liquid-switcher--desktop-compact" : ""} ${options.length >= 4 ? "mp-liquid-switcher--dense" : ""}`}
      style={switcherStyle}
    >
      <legend className="mp-liquid-switcher__legend">Choose filter</legend>
      {options.map((item) => {
        const isActive = value === item;
        const shouldShowTowerIcon = item.startsWith("Tower ");

        return (
          <label
            key={item}
            className="mp-liquid-switcher__option"
            data-active={isActive ? "true" : "false"}
          >
            <input
              className="mp-liquid-switcher__input"
              type="radio"
              name={name}
              value={item}
              checked={isActive}
              onChange={() => onChange(item)}
            />
            <span className="mp-liquid-switcher__label">
              {shouldShowTowerIcon ? (
                <Building2 className="mp-liquid-switcher__icon" aria-hidden />
              ) : null}
              <span className="mp-liquid-switcher__text">{getLabel(item)}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function FilterDropdown({
  value,
  options,
  onChange,
  compactDark = false,
  compactDesktop = false,
}: {
  value: string;
  options: FloorFilterOption[];
  onChange: (value: string) => void;
  compactDark?: boolean;
  compactDesktop?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full appearance-none rounded-full border px-3 pr-8 font-semibold outline-none transition ${
          compactDesktop ? "h-10 text-[10px]" : "h-9 text-[11px]"
        } ${
          compactDark
            ? "border-[#ded8c9] bg-[#fbfaf4] text-[#1f3f2b] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_22px_rgba(33,50,35,0.08)] focus:border-[#cfd9c6] focus:bg-white"
            : "border-[#ded8c9] bg-[#fbfaf4] text-[#1f3f2b] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_22px_rgba(33,50,35,0.08)] focus:border-[#cfd9c6] focus:bg-white dark:border-white/10 dark:bg-white/8 dark:text-white"
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        className={`pointer-events-none absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 border-b border-r ${
          compactDark
            ? "border-[#718277]"
            : "border-[#718277] dark:border-zinc-300"
        }`}
      />
    </div>
  );
}

function FilterBlock({
  label,
  children,
  compact = false,
  compactDark = false,
  compactDesktop = false,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
  compactDark?: boolean;
  compactDesktop?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${compact ? "space-y-1.5" : compactDesktop ? "space-y-1.5" : "space-y-2"} ${className}`}
    >
      <label
        className={`block font-semibold ${
          compactDark ? "text-[#58715f]" : "text-[#58715f] dark:text-zinc-300"
        } ${
          compact
            ? "text-[9px] uppercase tracking-[0.18em]"
            : compactDesktop
              ? "text-[9px] uppercase tracking-[0.18em]"
              : "text-[10px] uppercase tracking-[0.22em]"
        }`}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[#ded8c9] bg-[#fbfaf4] px-2 py-0.5 text-[10px] font-medium text-[#456859] dark:border-white/10 dark:bg-white/8 dark:text-zinc-200">
      {label}
    </span>
  );
}
