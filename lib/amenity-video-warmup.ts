import amenitiesPageData from "@/data/amenitiesPage.json";
import { getSignedAssetUrls } from "@/src/lib/signed-assets";

type AmenitySeedItem = {
  id: string;
  videoSrc?: string;
};

type WarmProfile = "home" | "master-plan" | "amenities";
type NavigatorConnectionLike = {
  effectiveType?: string;
  saveData?: boolean;
};

type WarmSchedule = {
  aggressiveCount: number;
  initialDelayMs: number;
  intervalMs: number;
  maxCount: number;
};

const AMENITY_VIDEO_ITEMS = (
  amenitiesPageData as { items: AmenitySeedItem[] }
).items.filter(
  (item): item is Required<Pick<AmenitySeedItem, "id" | "videoSrc">> =>
    Boolean(item.videoSrc && item.videoSrc.trim()),
);

const warmedAmenityVideoUrls = new Set<string>();
const queuedAmenityVideoUrls = new Set<string>();
let amenityVideoSignMapPromise: Promise<Record<string, string>> | null = null;

function getAmenityVideoItemsOrdered(currentAmenityId?: string) {
  if (!currentAmenityId) {
    return [...AMENITY_VIDEO_ITEMS];
  }

  const currentIndex = AMENITY_VIDEO_ITEMS.findIndex(
    (item) => item.id === currentAmenityId,
  );

  if (currentIndex < 0) {
    return [...AMENITY_VIDEO_ITEMS];
  }

  return [
    ...AMENITY_VIDEO_ITEMS.slice(currentIndex),
    ...AMENITY_VIDEO_ITEMS.slice(0, currentIndex),
  ];
}

function isConstrainedAmenityWarmupEnvironment() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const nav = navigator as Navigator & {
    connection?: NavigatorConnectionLike;
    deviceMemory?: number;
  };

  const effectiveType = nav.connection?.effectiveType ?? "";
  const saveData = nav.connection?.saveData === true;
  const lowBandwidth =
    saveData || effectiveType === "slow-2g" || effectiveType === "2g";
  const lowMemory =
    typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  const lowCpu =
    typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4;

  return lowBandwidth || lowMemory || lowCpu;
}

function getWarmSchedule(profile: WarmProfile): WarmSchedule {
  const constrained = isConstrainedAmenityWarmupEnvironment();

  switch (profile) {
    case "home":
      return {
        aggressiveCount: 0,
        initialDelayMs: constrained ? 1800 : 1100,
        intervalMs: constrained ? 2100 : 1350,
        maxCount: constrained ? 4 : 6,
      };
    case "master-plan":
      return {
        aggressiveCount: 0,
        initialDelayMs: constrained ? 2400 : 1600,
        intervalMs: constrained ? 2400 : 1700,
        maxCount: constrained ? 3 : 5,
      };
    case "amenities":
      return {
        aggressiveCount: constrained ? 2 : 3,
        initialDelayMs: 0,
        intervalMs: constrained ? 950 : 650,
        maxCount: AMENITY_VIDEO_ITEMS.length,
      };
    default:
      return {
        aggressiveCount: 0,
        initialDelayMs: 1200,
        intervalMs: 1400,
        maxCount: 4,
      };
  }
}

function warmAmenityVideoSource(
  src: string,
  preloadMode: "auto" | "metadata",
  releaseDelayMs: number,
) {
  if (typeof document === "undefined") {
    return;
  }

  const preloadLink = document.createElement("link");
  preloadLink.rel = "preload";
  preloadLink.as = "video";
  preloadLink.href = src;
  preloadLink.crossOrigin = "anonymous";
  document.head.appendChild(preloadLink);

  const video = document.createElement("video");
  video.preload = preloadMode;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.src = src;

  const release = () => {
    window.setTimeout(() => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      preloadLink.remove();
    }, releaseDelayMs);
  };

  const markWarmed = () => {
    warmedAmenityVideoUrls.add(src);
    release();
  };

  video.addEventListener("loadedmetadata", markWarmed, { once: true });
  video.addEventListener("canplay", markWarmed, { once: true });
  video.addEventListener(
    "error",
    () => {
      release();
    },
    { once: true },
  );
  video.load();
}

async function getSignedAmenityVideoSources() {
  if (!amenityVideoSignMapPromise) {
    amenityVideoSignMapPromise = getSignedAssetUrls(
      AMENITY_VIDEO_ITEMS.map((item) => item.videoSrc),
    ).catch((error) => {
      amenityVideoSignMapPromise = null;
      throw error;
    });
  }

  return amenityVideoSignMapPromise;
}

export function scheduleAmenityVideoWarmup({
  currentAmenityId,
  profile,
}: {
  currentAmenityId?: string;
  profile: WarmProfile;
}) {
  if (typeof window === "undefined") {
    return;
  }

  void getSignedAmenityVideoSources()
    .then((signedSrcByKey) => {
      const orderedItems = getAmenityVideoItemsOrdered(currentAmenityId);
      const { aggressiveCount, initialDelayMs, intervalMs, maxCount } =
        getWarmSchedule(profile);

      orderedItems.slice(0, maxCount).forEach((item, index) => {
        const src = signedSrcByKey[item.videoSrc];

        if (!src || warmedAmenityVideoUrls.has(src) || queuedAmenityVideoUrls.has(src)) {
          return;
        }

        queuedAmenityVideoUrls.add(src);

        const isAggressive = index < aggressiveCount;
        const delayMs =
          initialDelayMs +
          (isAggressive
            ? index * 180
            : aggressiveCount * 180 + (index - aggressiveCount) * intervalMs);

        window.setTimeout(() => {
          queuedAmenityVideoUrls.delete(src);

          if (warmedAmenityVideoUrls.has(src)) {
            return;
          }

          warmAmenityVideoSource(
            src,
            isAggressive ? "auto" : "metadata",
            isAggressive ? 5000 : 1500,
          );
        }, delayMs);
      });
    })
    .catch(() => undefined);
}
