type FetchPriority = "high" | "low" | "auto";

type BrowserImage = HTMLImageElement & {
  fetchPriority?: FetchPriority;
};

type BrowserLink = HTMLLinkElement & {
  fetchPriority?: FetchPriority;
};

type IdleCallbackHandle = number;
type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: (deadline: IdleDeadline) => void,
      options?: { timeout?: number },
    ) => IdleCallbackHandle;
    cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
  };

type BrochureImageWarmupOptions = {
  criticalCount?: number;
  priorityUrls?: string[];
  concurrency?: number;
  idleTimeoutMs?: number;
};

type BrochureImagePreloadOptions = {
  priorityUrls?: string[];
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
};

const warmedBrochureImageUrls = new Set<string>();
const queuedBrochureImageUrls = new Set<string>();
const pendingBrochureImageUrls = new Map<string, Promise<void>>();

function dedupeUrls(urls: string[]) {
  return [...new Set(urls.filter(Boolean))];
}

function preloadBrochureImage(
  url: string,
  fetchPriority: FetchPriority,
): Promise<void> {
  if (typeof document === "undefined" || warmedBrochureImageUrls.has(url)) {
    return Promise.resolve();
  }

  const pendingPreload = pendingBrochureImageUrls.get(url);

  if (pendingPreload) {
    return pendingPreload;
  }

  queuedBrochureImageUrls.add(url);
  const preloadPromise = new Promise<void>((resolve) => {
    const preloadLink = document.createElement("link") as BrowserLink;
    preloadLink.rel = "preload";
    preloadLink.as = "image";
    preloadLink.href = url;
    preloadLink.fetchPriority = fetchPriority;
    document.head.appendChild(preloadLink);

    const image = new window.Image() as BrowserImage;
    image.decoding = "async";
    image.fetchPriority = fetchPriority;

    let settled = false;

    const finish = (didLoad: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      image.onload = null;
      image.onerror = null;
      preloadLink.remove();

      if (didLoad) {
        warmedBrochureImageUrls.add(url);
      }

      resolve();
    };

    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = url;

    if (image.complete) {
      finish(image.naturalWidth > 0);
      return;
    }

    if (typeof image.decode === "function") {
      void image.decode().then(
        () => finish(true),
        () => undefined,
      );
    }
  }).finally(() => {
    queuedBrochureImageUrls.delete(url);
    pendingBrochureImageUrls.delete(url);
  });

  pendingBrochureImageUrls.set(url, preloadPromise);
  return preloadPromise;
}

export async function preloadBrochureImageSet(
  urls: string[],
  {
    priorityUrls = [],
    concurrency = 6,
    onProgress,
  }: BrochureImagePreloadOptions = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const baseQueue = dedupeUrls(urls);
  const priorityQueue = dedupeUrls(priorityUrls).filter((url) =>
    baseQueue.includes(url),
  );
  const queue = [
    ...priorityQueue,
    ...baseQueue.filter((url) => !priorityQueue.includes(url)),
  ];
  const priorityUrlSet = new Set(priorityQueue);
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));
  let nextQueueIndex = 0;
  let completed = 0;

  onProgress?.(completed, queue.length);

  const runWorker = async () => {
    while (nextQueueIndex < queue.length) {
      const url = queue[nextQueueIndex];
      nextQueueIndex += 1;

      await preloadBrochureImage(
        url,
        priorityUrlSet.has(url) ? "high" : "low",
      );

      completed += 1;
      onProgress?.(completed, queue.length);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, runWorker));
}

export function scheduleBrochureImageWarmup(
  urls: string[],
  {
    criticalCount = 2,
    priorityUrls = [],
    concurrency = 2,
    idleTimeoutMs = 400,
  }: BrochureImageWarmupOptions = {},
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const runtimeWindow = window as IdleWindow;
  const baseQueue = dedupeUrls(urls);
  const criticalQueue = dedupeUrls([
    ...baseQueue.slice(0, criticalCount),
    ...priorityUrls,
  ]);
  const queue = [
    ...criticalQueue,
    ...baseQueue.filter((url) => !criticalQueue.includes(url)),
  ];

  if (queue.length === 0) {
    return () => undefined;
  }

  let cancelled = false;
  let nextQueueIndex = 0;
  let activeTasks = 0;
  let idleHandle: IdleCallbackHandle | null = null;
  let timerHandle: number | null = null;

  const clearScheduledPump = () => {
    if (idleHandle !== null && runtimeWindow.cancelIdleCallback) {
      runtimeWindow.cancelIdleCallback(idleHandle);
      idleHandle = null;
    }

    if (timerHandle !== null) {
      window.clearTimeout(timerHandle);
      timerHandle = null;
    }
  };

  const pumpQueue = () => {
    if (cancelled) {
      return;
    }

    clearScheduledPump();

    while (activeTasks < concurrency && nextQueueIndex < queue.length) {
      const url = queue[nextQueueIndex];
      nextQueueIndex += 1;

      if (
        !url ||
        warmedBrochureImageUrls.has(url) ||
        queuedBrochureImageUrls.has(url)
      ) {
        continue;
      }

      queuedBrochureImageUrls.add(url);
      activeTasks += 1;

      const fetchPriority = criticalQueue.includes(url) ? "high" : "low";

      void preloadBrochureImage(url, fetchPriority).finally(() => {
        activeTasks = Math.max(0, activeTasks - 1);

        if (cancelled || nextQueueIndex >= queue.length) {
          return;
        }

        scheduleNextPump();
      });
    }
  };

  const scheduleNextPump = () => {
    if (
      cancelled ||
      nextQueueIndex >= queue.length ||
      activeTasks >= concurrency
    ) {
      return;
    }

    clearScheduledPump();

    if (runtimeWindow.requestIdleCallback) {
      idleHandle = runtimeWindow.requestIdleCallback(() => {
        idleHandle = null;
        pumpQueue();
      }, { timeout: idleTimeoutMs });
      return;
    }

    timerHandle = window.setTimeout(() => {
      timerHandle = null;
      pumpQueue();
    }, 120);
  };

  pumpQueue();
  scheduleNextPump();

  return () => {
    cancelled = true;
    clearScheduledPump();
  };
}
