import {
  getMasterPlanFramePreloadSequence,
  getMasterPlanFrameCdnUrl,
} from "@/data/masterPlanFrameCdnUrls";

type IdleCapableWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

type PreloadFrameOptions = {
  decode?: boolean;
  fetchPriority?: "auto" | "high" | "low";
};

type PreloadFramesOptions = {
  batchSize?: number;
  count?: number;
  decode?: boolean;
  initialHighPriorityCount?: number;
};

const CLOUDINARY_ORIGIN = "https://res.cloudinary.com";
const activePreloadImages = new Set<HTMLImageElement>();
const loadedFrameUrls = new Set<string>();
const cachedFrameImages = new Map<string, HTMLImageElement>();
const pendingFrameLoads = new Map<string, Promise<void>>();
let connectionHintsReady = false;

function cleanupImage(image: HTMLImageElement) {
  activePreloadImages.delete(image);
  image.onload = null;
  image.onerror = null;
}

export function ensureMasterPlanFrameConnectionHints() {
  if (typeof document === "undefined" || connectionHintsReady) {
    return;
  }

  const hints = [
    { rel: "dns-prefetch", href: CLOUDINARY_ORIGIN },
    { rel: "preconnect", href: CLOUDINARY_ORIGIN, crossOrigin: "anonymous" },
  ] as const;

  hints.forEach((attributes) => {
    const selector = `link[rel="${attributes.rel}"][href="${attributes.href}"]`;

    if (document.head.querySelector(selector)) {
      return;
    }

    const link = document.createElement("link");
    link.rel = attributes.rel;
    link.href = attributes.href;

    if ("crossOrigin" in attributes) {
      link.crossOrigin = attributes.crossOrigin;
    }

    document.head.appendChild(link);
  });

  connectionHintsReady = true;
}

export function preloadMasterPlanFrame(
  frame: number,
  { decode = false, fetchPriority = "auto" }: PreloadFrameOptions = {},
) {
  if (typeof window === "undefined") {
    return Promise.resolve<HTMLImageElement | null>(null);
  }

  const url = getMasterPlanFrameCdnUrl(frame);
  const cachedImage = cachedFrameImages.get(url);

  if (loadedFrameUrls.has(url) && cachedImage) {
    return Promise.resolve(cachedImage);
  }

  const existingLoad = pendingFrameLoads.get(url);

  if (existingLoad) {
    return existingLoad.then(() => cachedFrameImages.get(url) ?? null);
  }

  const image = new window.Image();
  image.decoding = "async";

  if ("fetchPriority" in image) {
    image.fetchPriority = fetchPriority;
  }

  const loadPromise = new Promise<void>((resolve, reject) => {
    const finishSuccess = () => {
      loadedFrameUrls.add(url);
      cachedFrameImages.set(url, image);
      pendingFrameLoads.delete(url);
      cleanupImage(image);
      resolve();
    };

    const finishFailure = () => {
      pendingFrameLoads.delete(url);
      cleanupImage(image);
      reject(new Error(`Failed to preload master plan frame: ${url}`));
    };

    const finalizeAfterLoad = () => {
      if (decode && typeof image.decode === "function") {
        void image.decode().then(finishSuccess).catch(finishSuccess);
        return;
      }

      finishSuccess();
    };

    image.onload = finalizeAfterLoad;
    image.onerror = finishFailure;
    activePreloadImages.add(image);
    image.src = url;

    if (image.complete && image.naturalWidth > 0) {
      finalizeAfterLoad();
    }
  });

  pendingFrameLoads.set(url, loadPromise);
  return loadPromise.then(() => cachedFrameImages.get(url) ?? null);
}

export function getCachedMasterPlanFrameImage(frame: number) {
  return cachedFrameImages.get(getMasterPlanFrameCdnUrl(frame)) ?? null;
}

export function preloadMasterPlanFrames(
  frames: number[],
  {
    batchSize = 4,
    decode = true,
    initialHighPriorityCount = 4,
  }: PreloadFramesOptions = {},
) {
  if (typeof window === "undefined" || frames.length === 0) {
    return () => undefined;
  }

  ensureMasterPlanFrameConnectionHints();

  const idleWindow = window as IdleCapableWindow;
  let cancelled = false;
  let idleHandle: number | null = null;
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
  let index = 0;

  const runBatch = () => {
    if (cancelled) {
      return;
    }

    const nextFrames = frames.slice(index, index + batchSize);

    nextFrames.forEach((frame, batchIndex) => {
      preloadMasterPlanFrame(frame, {
        decode,
        fetchPriority:
          index + batchIndex < initialHighPriorityCount ? "high" : "low",
      });
    });

    index += nextFrames.length;

    if (cancelled || index >= frames.length) {
      return;
    }

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleHandle = idleWindow.requestIdleCallback(runBatch, {
        timeout: 500,
      });
      return;
    }

    timeoutHandle = globalThis.setTimeout(runBatch, 48);
  };

  runBatch();

  return () => {
    cancelled = true;

    if (
      idleHandle !== null &&
      typeof idleWindow.cancelIdleCallback === "function"
    ) {
      idleWindow.cancelIdleCallback(idleHandle);
    }

    if (timeoutHandle !== null) {
      globalThis.clearTimeout(timeoutHandle);
    }
  };
}

export function preloadMasterPlanFrameWindow(
  startFrame: number,
  { count = 24, ...options }: PreloadFramesOptions = {},
) {
  return preloadMasterPlanFrames(
    getMasterPlanFramePreloadSequence(startFrame, count),
    options,
  );
}
