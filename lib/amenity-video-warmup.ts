import amenitiesPageData from "@/data/amenitiesPage.json";
import {
  isDirectAssetUrl,
  resolveAmenitiesFinalAssetUrl,
} from "@/lib/amenities-final-assets";
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

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type WarmQueueItem = {
  intervalMs: number;
  src: string;
};

type ActiveWarmup = {
  cancel: (requeue: boolean) => void;
  src: string;
};

const AMENITY_VIDEO_ITEMS = (
  amenitiesPageData as { items: AmenitySeedItem[] }
).items
  .filter(
    (item): item is Required<Pick<AmenitySeedItem, "id" | "videoSrc">> =>
      Boolean(item.videoSrc && item.videoSrc.trim()),
  )
  .map((item) => ({
    ...item,
    videoSrc: resolveAmenitiesFinalAssetUrl(item.videoSrc),
  }));

const warmedAmenityVideoUrls = new Set<string>();
const queuedAmenityVideoUrls = new Set<string>();
const pendingWarmups: WarmQueueItem[] = [];

let activeWarmup: ActiveWarmup | null = null;
let amenityVideoSignMapPromise: Promise<Record<string, string>> | null = null;
let delayTimerId: number | null = null;
let idleCallbackId: number | null = null;
let visibilityListenerInstalled = false;

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

  const orderedItems: typeof AMENITY_VIDEO_ITEMS = [];
  const addedIds = new Set([currentAmenityId]);

  for (let distance = 1; distance < AMENITY_VIDEO_ITEMS.length; distance += 1) {
    const nextIndex =
      (currentIndex + distance) % AMENITY_VIDEO_ITEMS.length;
    const previousIndex =
      (currentIndex - distance + AMENITY_VIDEO_ITEMS.length) %
      AMENITY_VIDEO_ITEMS.length;

    [nextIndex, previousIndex].forEach((index) => {
      const item = AMENITY_VIDEO_ITEMS[index];

      if (!addedIds.has(item.id)) {
        addedIds.add(item.id);
        orderedItems.push(item);
      }
    });
  }

  return orderedItems;
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
    typeof nav.hardwareConcurrency === "number" &&
    nav.hardwareConcurrency <= 4;

  return lowBandwidth || lowMemory || lowCpu;
}

function getWarmPolicy(profile: WarmProfile) {
  switch (profile) {
    case "home":
      return { initialDelayMs: 1200, intervalMs: 2800, maxCount: 2 };
    case "master-plan":
      return { initialDelayMs: 1600, intervalMs: 3200, maxCount: 2 };
    case "amenities":
      return {
        initialDelayMs: 1800,
        intervalMs: 2600,
        maxCount: AMENITY_VIDEO_ITEMS.length - 1,
      };
  }
}

function clearScheduledWarmup() {
  if (typeof window === "undefined") {
    return;
  }

  if (delayTimerId !== null) {
    window.clearTimeout(delayTimerId);
    delayTimerId = null;
  }

  if (idleCallbackId !== null) {
    (window as IdleWindow).cancelIdleCallback?.(idleCallbackId);
    idleCallbackId = null;
  }
}

function scheduleNextWarmup(delayMs: number) {
  if (
    typeof window === "undefined" ||
    activeWarmup ||
    delayTimerId !== null ||
    idleCallbackId !== null ||
    pendingWarmups.length === 0 ||
    isConstrainedAmenityWarmupEnvironment() ||
    document.visibilityState === "hidden"
  ) {
    return;
  }

  delayTimerId = window.setTimeout(() => {
    delayTimerId = null;
    const idleWindow = window as IdleWindow;
    const begin = () => {
      idleCallbackId = null;
      beginNextWarmup();
    };

    if (idleWindow.requestIdleCallback) {
      idleCallbackId = idleWindow.requestIdleCallback(begin, { timeout: 1600 });
      return;
    }

    delayTimerId = window.setTimeout(begin, 180);
  }, Math.max(0, delayMs));
}

function beginNextWarmup() {
  if (
    activeWarmup ||
    isConstrainedAmenityWarmupEnvironment() ||
    document.visibilityState === "hidden"
  ) {
    return;
  }

  const item = pendingWarmups.shift();

  if (!item) {
    return;
  }

  queuedAmenityVideoUrls.delete(item.src);

  if (warmedAmenityVideoUrls.has(item.src)) {
    scheduleNextWarmup(0);
    return;
  }

  const video = document.createElement("video");
  let settled = false;
  let timeoutId: number | null = null;

  video.preload = "metadata";
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.src = item.src;

  const finish = (warmed: boolean, requeue = false) => {
    if (settled) {
      return;
    }

    settled = true;

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    video.removeEventListener("error", handleError);
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (warmed) {
      warmedAmenityVideoUrls.add(item.src);
    } else if (requeue && !queuedAmenityVideoUrls.has(item.src)) {
      queuedAmenityVideoUrls.add(item.src);
      pendingWarmups.unshift(item);
    }

    activeWarmup = null;

    if (!requeue) {
      scheduleNextWarmup(item.intervalMs);
    }
  };

  const handleLoadedMetadata = () => finish(true);
  const handleError = () => finish(false);

  activeWarmup = {
    src: item.src,
    cancel: (requeue) => finish(false, requeue),
  };

  video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
  video.addEventListener("error", handleError, { once: true });
  timeoutId = window.setTimeout(handleError, 12000);
  video.load();
}

function installVisibilityListener() {
  if (visibilityListenerInstalled || typeof document === "undefined") {
    return;
  }

  visibilityListenerInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      clearScheduledWarmup();
      activeWarmup?.cancel(true);
      return;
    }

    scheduleNextWarmup(500);
  });
}

function replacePendingWarmups(items: WarmQueueItem[]) {
  pendingWarmups.forEach((item) => queuedAmenityVideoUrls.delete(item.src));
  pendingWarmups.length = 0;

  items.forEach((item) => {
    if (
      item.src === activeWarmup?.src ||
      warmedAmenityVideoUrls.has(item.src) ||
      queuedAmenityVideoUrls.has(item.src)
    ) {
      return;
    }

    queuedAmenityVideoUrls.add(item.src);
    pendingWarmups.push(item);
  });
}

function appendPendingWarmups(items: WarmQueueItem[]) {
  items.forEach((item) => {
    if (
      item.src === activeWarmup?.src ||
      warmedAmenityVideoUrls.has(item.src) ||
      queuedAmenityVideoUrls.has(item.src)
    ) {
      return;
    }

    queuedAmenityVideoUrls.add(item.src);
    pendingWarmups.push(item);
  });
}

async function getSignedAmenityVideoSources() {
  if (!amenityVideoSignMapPromise) {
    const directUrls = Object.fromEntries(
      AMENITY_VIDEO_ITEMS.filter((item) =>
        isDirectAssetUrl(item.videoSrc),
      ).map((item) => [item.videoSrc, item.videoSrc]),
    );
    const signableKeys = AMENITY_VIDEO_ITEMS.filter(
      (item) => !isDirectAssetUrl(item.videoSrc),
    ).map((item) => item.videoSrc);

    amenityVideoSignMapPromise = (
      signableKeys.length > 0
        ? getSignedAssetUrls(signableKeys)
        : Promise.resolve({})
    )
      .then((signedUrls) => ({ ...directUrls, ...signedUrls }))
      .catch((error) => {
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
  if (
    typeof window === "undefined" ||
    isConstrainedAmenityWarmupEnvironment()
  ) {
    return;
  }

  installVisibilityListener();

  void getSignedAmenityVideoSources()
    .then((signedSrcByKey) => {
      const policy = getWarmPolicy(profile);
      const items = getAmenityVideoItemsOrdered(currentAmenityId)
        .slice(0, policy.maxCount)
        .flatMap((item) => {
          const src = signedSrcByKey[item.videoSrc];
          return src ? [{ src, intervalMs: policy.intervalMs }] : [];
        });

      if (profile === "amenities") {
        activeWarmup?.cancel(false);
        replacePendingWarmups(items);
        clearScheduledWarmup();
      } else {
        appendPendingWarmups(items);
      }

      scheduleNextWarmup(policy.initialDelayMs);
    })
    .catch(() => undefined);
}
