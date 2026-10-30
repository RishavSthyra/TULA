const LOCAL_ASSET_KEY_PREFIX = "local:";

export const MASTER_PLAN_ORBIT_VIDEO_URL =
  "https://cdn.sthyra.com/TULA/Videos/LS_Building_Orbit_360_60fps_GOP3_v2.mp4";
export const MASTER_PLAN_ORBIT_FALLBACK_IMAGE_URL =
  "https://cdn.sthyra.com/TULA/Images/LS_Building_Orbit_360_60fps_GOP3_first_frame.avif";

export function isLocalAssetKey(key: string | null | undefined) {
  return typeof key === "string" && key.startsWith(LOCAL_ASSET_KEY_PREFIX);
}

export function isRemoteAssetUrl(key: string | null | undefined) {
  return typeof key === "string" && /^https?:\/\//i.test(key);
}

export function toLocalPublicAssetPath(key: string) {
  const normalizedKey = isLocalAssetKey(key)
    ? key.slice(LOCAL_ASSET_KEY_PREFIX.length)
    : key;

  return `/${normalizedKey.replace(/^\/+/, "")}`;
}

export function filterSignableAssetKeys(keys: string[]) {
  return keys.filter(
    (key) => key && !isLocalAssetKey(key) && !isRemoteAssetUrl(key),
  );
}
