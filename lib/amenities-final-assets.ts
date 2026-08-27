export const LOCAL_AMENITIES_FINAL_BASE_URL = "/AmenitiesGoodExpoOptimized";
export const CDN_AMENITIES_FINAL_BASE_URL =
  "https://cdn.sthyra.com/TULA/Videos/AmenitiesGoodExpoOptimized";

function getConfiguredAmenitiesFinalBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL?.trim().replace(/\/+$/, "") ||
    CDN_AMENITIES_FINAL_BASE_URL
  );
}

export function resolveAmenitiesFinalAssetUrl(value: string) {
  if (!value.startsWith(LOCAL_AMENITIES_FINAL_BASE_URL)) {
    return value;
  }

  const baseUrl = getConfiguredAmenitiesFinalBaseUrl();
  return `${baseUrl}${value.slice(LOCAL_AMENITIES_FINAL_BASE_URL.length)}`;
}

export function isDirectAssetUrl(value: string) {
  return /^(?:https?:\/\/|\/|blob:|data:)/i.test(value.trim());
}

export function isHlsAssetUrl(value?: string) {
  return Boolean(value && /\.m3u8(?:$|[?#])/i.test(value));
}
