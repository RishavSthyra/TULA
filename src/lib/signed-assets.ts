import { readJsonResponse } from "@/lib/utils";

const LEGACY_CDN_ORIGIN = "https://cdn.sthyra.com";
const signedUrlCache = new Map<string, string>();
const pendingSignedUrlCache = new Map<string, Promise<string>>();

function decodeClientKey(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("Invalid asset key encoding.");
  }
}

function normalizeClientR2Key(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Missing asset key.");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);

    if (url.origin !== LEGACY_CDN_ORIGIN) {
      throw new Error("Only legacy asset URLs can be signed.");
    }

    return decodeClientKey(url.pathname.replace(/^\/+/, ""));
  }

  return decodeClientKey(trimmed);
}

async function readSignedAssetResponse(response: Response) {
  const payload = await readJsonResponse<
    { error?: string; url?: string; urls?: Record<string, string> } | null
  >(response, "Signed asset API");

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to sign asset.");
  }

  return payload;
}

export function cdnUrlToR2Key(url: string) {
  return normalizeClientR2Key(url);
}

export function getCachedSignedAssetUrl(key: string) {
  const normalizedKey = normalizeClientR2Key(key);
  return signedUrlCache.get(normalizedKey) ?? null;
}

export function getCachedSignedAssetUrls(keys: string[]) {
  return Object.fromEntries(
    keys
      .map((key) => {
        const cachedUrl = getCachedSignedAssetUrl(key);
        return cachedUrl ? ([key, cachedUrl] as const) : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );
}

export function primeSignedAssetUrl(key: string, signedUrl: string) {
  const normalizedKey = normalizeClientR2Key(key);
  signedUrlCache.set(normalizedKey, signedUrl);
  return signedUrl;
}

export function primeSignedAssetUrls(urls: Record<string, string>) {
  Object.entries(urls).forEach(([key, signedUrl]) => {
    if (!signedUrl) {
      return;
    }

    try {
      primeSignedAssetUrl(key, signedUrl);
    } catch {
      // Ignore invalid seeds so one bad entry never blocks the rest.
    }
  });
}

export async function getSignedAssetUrl(key: string): Promise<string> {
  const normalizedKey = normalizeClientR2Key(key);
  const cached = signedUrlCache.get(normalizedKey);

  if (cached) {
    return cached;
  }

  const pending = pendingSignedUrlCache.get(normalizedKey);

  if (pending) {
    return pending;
  }

  const promise = fetch(
    `/api/sign-asset?key=${encodeURIComponent(normalizedKey)}`,
    {
      cache: "no-store",
    },
  )
    .then(readSignedAssetResponse)
    .then((payload) => {
      if (!payload?.url) {
        throw new Error("Signed asset URL was not returned.");
      }

      signedUrlCache.set(normalizedKey, payload.url);
      return payload.url;
    })
    .finally(() => {
      pendingSignedUrlCache.delete(normalizedKey);
    });

  pendingSignedUrlCache.set(normalizedKey, promise);
  return promise;
}

export async function getSignedAssetUrls(
  keys: string[],
): Promise<Record<string, string>> {
  if (keys.length === 0) {
    return {};
  }

  const normalizedByOriginal = new Map<string, string>();
  const keyPromiseByNormalized = new Map<string, Promise<string>>();
  const missingNormalizedKeys = new Set<string>();

  keys.forEach((key) => {
    const normalized = normalizeClientR2Key(key);
    normalizedByOriginal.set(key, normalized);

    const cached = signedUrlCache.get(normalized);

    if (cached) {
      keyPromiseByNormalized.set(normalized, Promise.resolve(cached));
      return;
    }

    const pending = pendingSignedUrlCache.get(normalized);

    if (pending) {
      keyPromiseByNormalized.set(normalized, pending);
      return;
    }

    if (!keyPromiseByNormalized.has(normalized)) {
      missingNormalizedKeys.add(normalized);
    }
  });

  if (missingNormalizedKeys.size > 0) {
    const missingKeys = [...missingNormalizedKeys];
    const batchPromise = fetch("/api/sign-asset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ keys: missingKeys }),
    }).then(readSignedAssetResponse);

    missingKeys.forEach((normalizedKey) => {
      const pendingUrlPromise = batchPromise
        .then((payload) => {
          const signedUrl = payload?.urls?.[normalizedKey];

          if (!signedUrl) {
            throw new Error(`Missing signed URL for ${normalizedKey}.`);
          }

          signedUrlCache.set(normalizedKey, signedUrl);
          return signedUrl;
        })
        .finally(() => {
          pendingSignedUrlCache.delete(normalizedKey);
        });

      pendingSignedUrlCache.set(normalizedKey, pendingUrlPromise);
      keyPromiseByNormalized.set(normalizedKey, pendingUrlPromise);
    });
  }

  const resolvedUrls = await Promise.all(
    [...new Set(normalizedByOriginal.values())].map(async (normalized) => {
      const promise =
        keyPromiseByNormalized.get(normalized) ??
        Promise.resolve(signedUrlCache.get(normalized));

      const signedUrl = await promise;

      if (!signedUrl) {
        throw new Error(`Missing cached signed URL for ${normalized}.`);
      }

      return [normalized, signedUrl] as const;
    }),
  );
  const resolvedUrlMap = new Map<string, string>(resolvedUrls);

  return Object.fromEntries(
    keys.map((key) => {
      const normalized = normalizedByOriginal.get(key);

      if (!normalized) {
        throw new Error("Failed to normalize asset key.");
      }

      const signedUrl = resolvedUrlMap.get(normalized);

      if (!signedUrl) {
        throw new Error(`Missing cached signed URL for ${normalized}.`);
      }

      return [key, signedUrl];
    }),
  );
}

export async function signCdnAssetUrl(url: string) {
  return getSignedAssetUrl(cdnUrlToR2Key(url));
}

export async function signCdnAssetUrls(
  urls: string[],
): Promise<Record<string, string>> {
  return getSignedAssetUrls(urls);
}
