import "server-only";

import crypto from "crypto";

export const LEGACY_CDN_ORIGIN = "https://cdn.sthyra.com";
export const DEFAULT_ASSET_WORKER_DOMAIN =
  "https://curly-leaf-d240.aasish.workers.dev";
const MAX_R2_KEY_LENGTH = 2048;

export class AssetConfigurationError extends Error {}
export class InvalidR2KeyError extends Error {}

function decodeR2Key(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new InvalidR2KeyError("Invalid asset key encoding.");
  }
}

function stripLegacyOrigin(value: string) {
  const url = new URL(value);

  if (url.origin !== LEGACY_CDN_ORIGIN) {
    throw new InvalidR2KeyError("Only legacy asset URLs can be converted.");
  }

  return url.pathname.replace(/^\/+/, "");
}

function isLegacyCdnAssetUrl(value: string) {
  return value.startsWith(`${LEGACY_CDN_ORIGIN}/`);
}

export function normalizeAndValidateR2Key(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new InvalidR2KeyError("Missing asset key.");
  }

  const normalizedCandidate =
    /^https?:\/\//i.test(trimmed) ? stripLegacyOrigin(trimmed) : trimmed;
  const decoded = decodeR2Key(normalizedCandidate);

  if (!decoded) {
    throw new InvalidR2KeyError("Missing asset key.");
  }

  if (decoded.length > MAX_R2_KEY_LENGTH) {
    throw new InvalidR2KeyError("Asset key is too long.");
  }

  if (decoded.startsWith("/")) {
    throw new InvalidR2KeyError("Asset key must be relative.");
  }

  if (
    decoded.includes("../") ||
    decoded.includes("..\\") ||
    decoded.includes("\\")
  ) {
    throw new InvalidR2KeyError("Unsafe asset key path.");
  }

  if (
    decoded.includes("\0") ||
    /[\u0000-\u001F\u007F]/.test(decoded)
  ) {
    throw new InvalidR2KeyError("Asset key contains invalid characters.");
  }

  return decoded;
}

export function encodeR2KeyForWorkerPath(key: string) {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

export function getAssetWorkerDomain() {
  return (process.env.ASSET_WORKER_DOMAIN || DEFAULT_ASSET_WORKER_DOMAIN).replace(
    /\/+$/,
    "",
  );
}

export function getAssetSecret() {
  const secret = process.env.ASSET_SECRET;

  if (!secret) {
    throw new AssetConfigurationError(
      "ASSET_SECRET is not configured. Add it to .env.local and your deployment environment.",
    );
  }

  return secret;
}

export function createAssetSignature(key: string, secret = getAssetSecret()) {
  return crypto.createHmac("sha256", secret).update(key).digest("hex");
}

export function createSignedWorkerUrl(key: string) {
  const signature = createAssetSignature(key);
  const encodedKey = encodeR2KeyForWorkerPath(key);
  return `${getAssetWorkerDomain()}/${encodedKey}?sig=${signature}`;
}

export function signR2AssetKey(input: string) {
  const normalizedKey = normalizeAndValidateR2Key(input);
  return createSignedWorkerUrl(normalizedKey);
}

export function signR2AssetKeys(inputs: string[]) {
  const normalizedByOriginal = new Map<string, string>();
  const signedByNormalized = new Map<string, string>();

  inputs.forEach((input) => {
    const normalized = normalizeAndValidateR2Key(input);
    normalizedByOriginal.set(input, normalized);

    if (!signedByNormalized.has(normalized)) {
      signedByNormalized.set(normalized, createSignedWorkerUrl(normalized));
    }
  });

  return Object.fromEntries(
    inputs.map((input) => {
      const normalized = normalizedByOriginal.get(input);

      if (!normalized) {
        throw new InvalidR2KeyError("Missing normalized asset key.");
      }

      return [input, signedByNormalized.get(normalized) ?? createSignedWorkerUrl(normalized)];
    }),
  );
}

export function cdnUrlToR2Key(input: string) {
  return normalizeAndValidateR2Key(input);
}

export async function signLegacyCdnUrlsInValue<T>(value: T): Promise<T> {
  const signedByUrl = new Map<string, string>();
  const pendingUrls = new Set<string>();

  const collectUrls = (input: unknown) => {
    if (typeof input === "string") {
      if (isLegacyCdnAssetUrl(input)) {
        pendingUrls.add(input);
      }
      return;
    }

    if (Array.isArray(input)) {
      input.forEach(collectUrls);
      return;
    }

    if (!input || typeof input !== "object") {
      return;
    }

    Object.values(input).forEach(collectUrls);
  };

  collectUrls(value);

  if (pendingUrls.size > 0) {
    const signedUrls = signR2AssetKeys([...pendingUrls]);
    Object.entries(signedUrls).forEach(([originalUrl, signedUrl]) => {
      signedByUrl.set(originalUrl, signedUrl);
    });
  }

  const replaceUrls = (input: unknown): unknown => {
    if (typeof input === "string") {
      return signedByUrl.get(input) ?? input;
    }

    if (Array.isArray(input)) {
      return input.map(replaceUrls);
    }

    if (!input || typeof input !== "object") {
      return input;
    }

    return Object.fromEntries(
      Object.entries(input).map(([key, nestedValue]) => [
        key,
        replaceUrls(nestedValue),
      ]),
    );
  };

  return replaceUrls(value) as T;
}
