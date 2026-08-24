const LOCAL_ASSET_KEY_PREFIX = "local:";

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
