"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import pLimit from "p-limit";
import poidata from "@/data/poi.json";
import { Map as MapView,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MapControls,
  MapClusterLayer,
  useMap,
  MapRoute,
  type MapRef,
} from "@/components/ui/map";
import {
  BriefcaseBusiness,
  Cross,
  Loader2,
  ChevronDown,
  ChevronUp,
  School,
  Store,
  Trees,
  BusFront,
  Landmark,
  Search,
  MapPinned,
  X,
  Layers,
} from "lucide-react";
import {
  MdKeyboardArrowLeft,
  MdOutlineMap,
  MdOutlinePublic,
  MdOutlineTerrain,
} from "react-icons/md";

const styles = {
  default: undefined,
  openstreetmap: "https://tiles.openfreemap.org/styles/bright",
  openstreetmap3d: "https://tiles.openfreemap.org/styles/liberty",
};

type StyleKey = keyof typeof styles;

const styleOptions: Array<{
  key: StyleKey;
  label: string;
  shortLabel: string;
  icon: typeof MdOutlineMap;
}> = [
  {
    key: "default",
    label: "Default Carto",
    shortLabel: "Carto",
    icon: MdOutlineMap,
  },
  {
    key: "openstreetmap",
    label: "OpenStreetMap",
    shortLabel: "OSM",
    icon: MdOutlinePublic,
  },
  {
    key: "openstreetmap3d",
    label: "OpenStreetMap 3D",
    shortLabel: "3D",
    icon: MdOutlineTerrain,
  },
];

type RouteData = {
  id: number;
  name: string;
  coordinates: [number, number][];
  duration: number;
  distance: number;
};

type UserLocation = {
  longitude: number;
  latitude: number;
  accuracy?: number;
};

type PoiCategory =
  | "park"
  | "mall"
  | "bus_stop"
  | "school"
  | "hospital"
  | "landmark"
  | "IT Company";

export type Poi = {
  id: number;
  name: string;
  category: PoiCategory;
  lng: number;
  lat: number;
  distanceLabel: string;
  timeLabel: string;
  rating?: number;
  featured?: boolean;
  image?: string;
};

type ClusterPoiProperties = {
  poiId: number;
  name: string;
  category: PoiCategory;
};

const centerPlace = {
  name: "Whisper of Trees",
  lng: 77.63036955360322,
  lat: 13.153818578384746, 
};

const projectCard = {
  title: "Whisper of Trees | TULA",
  description:
    "A premium residential community positioned at the heart of a fast-growing neighborhood, with strong access to workplaces, schools, retail, healthcare, and everyday conveniences.",
  image: "/VeranzaFavicon.svg",
};

const pois : Poi[] = poidata as Poi[];
const DEFAULT_SELECTED_CATEGORIES: PoiCategory[] = [
  "park",
  "mall",
  "bus_stop",
  "school",
  "hospital",
  "landmark",
  "IT Company",
];
const CATEGORY_ORDER = DEFAULT_SELECTED_CATEGORIES;
const ROUTE_CACHE_KEY = "veranza-poi-routes-v1";
const ROUTE_REQUEST_TIMEOUT = 12000;
const ROUTE_REQUEST_SPACING = 220;
const MAX_CONCURRENT_ROUTE_REQUESTS = 2;
const POI_CLUSTER_MAX_ZOOM = 12;
const POI_CLUSTER_SWITCH_ZOOM = 12.8;
const POI_CLUSTER_RADIUS = 58;
const ROUTE_ANIMATION_DURATION = 2600;
const ROUTE_ANIMATION_WINDOW_SIZE = 30;
const provisionalRouteCache = new Map<number, RouteData>();

type IdleWindow = Window &
  typeof globalThis & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
  };

function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hours}h ${remaining}m`;
}

function getAnimatedSegment(
  coordinates: [number, number][] | undefined,
  progress: number,
  windowSize = 30,
) {
  if (!coordinates || coordinates.length === 0) return [];

  if (coordinates.length <= 2) return coordinates;

  const maxIndex = coordinates.length - 1;
  const headIndex = Math.max(1, Math.floor(progress * maxIndex));
  const startIndex = Math.max(0, headIndex - windowSize);

  return coordinates.slice(startIndex, headIndex + 1);
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function parseDurationLabel(label: string) {
  const normalized = label.toLowerCase();
  const hoursMatch = normalized.match(/(\d+)\s*h/);
  const minutesMatch = normalized.match(/(\d+)\s*(?:m|min)/);

  const hours = hoursMatch ? Number.parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? Number.parseInt(minutesMatch[1], 10) : 0;

  return hours * 3600 + minutes * 60;
}

function parseDistanceLabel(label: string) {
  const normalized = label.toLowerCase();
  const kmMatch = normalized.match(/([\d.]+)\s*km/);
  if (kmMatch) {
    return Number.parseFloat(kmMatch[1]) * 1000;
  }

  const meterMatch = normalized.match(/([\d.]+)\s*m/);
  if (meterMatch) {
    return Number.parseFloat(meterMatch[1]);
  }

  return 0;
}

function buildCurvedRouteCoordinates(
  start: { lng: number; lat: number },
  end: { lng: number; lat: number },
): [number, number][] {
  const deltaLng = end.lng - start.lng;
  const deltaLat = end.lat - start.lat;
  const offsetLng = -deltaLat * 0.12;
  const offsetLat = deltaLng * 0.12;

  return [
    [start.lng, start.lat],
    [
      start.lng + deltaLng * 0.28 + offsetLng * 0.35,
      start.lat + deltaLat * 0.28 + offsetLat * 0.35,
    ],
    [
      start.lng + deltaLng * 0.56 + offsetLng * 0.12,
      start.lat + deltaLat * 0.56 + offsetLat * 0.12,
    ],
    [
      start.lng + deltaLng * 0.82 - offsetLng * 0.08,
      start.lat + deltaLat * 0.82 - offsetLat * 0.08,
    ],
    [end.lng, end.lat],
  ];
}

function buildProvisionalRoute(poi: Poi): RouteData {
  return {
    id: poi.id,
    name: poi.name,
    coordinates: buildCurvedRouteCoordinates(
      { lng: centerPlace.lng, lat: centerPlace.lat },
      { lng: poi.lng, lat: poi.lat },
    ),
    duration: parseDurationLabel(poi.timeLabel),
    distance: parseDistanceLabel(poi.distanceLabel),
  };
}

function getProvisionalRoute(poi: Poi) {
  const cached = provisionalRouteCache.get(poi.id);
  if (cached) {
    return cached;
  }

  const route = buildProvisionalRoute(poi);
  provisionalRouteCache.set(poi.id, route);
  return route;
}

function buildUserFallbackRoute(location: UserLocation): RouteData {
  return {
    id: -1,
    name: "Your Route to Trifecta Veranza",
    coordinates: buildCurvedRouteCoordinates(
      { lng: location.longitude, lat: location.latitude },
      { lng: centerPlace.lng, lat: centerPlace.lat },
    ),
    duration: 0,
    distance: 0,
  };
}

function buildAccuracyPolygon(
  longitude: number,
  latitude: number,
  radiusMeters: number,
  points = 48,
): [number, number][] {
  const latitudeCos = Math.max(
    Math.cos((latitude * Math.PI) / 180),
    0.00001,
  );

  const coordinates: [number, number][] = [];

  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const lngOffset =
      ((radiusMeters * Math.cos(angle)) / (111320 * latitudeCos));
    const latOffset = (radiusMeters * Math.sin(angle)) / 111320;

    coordinates.push([longitude + lngOffset, latitude + latOffset]);
  }

  return coordinates;
}

function isLngLatCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function parseRouteCoordinates(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const coordinates = value.map((coordinate) => {
    if (!isLngLatCoordinate(coordinate)) {
      return null;
    }

    return [coordinate[0], coordinate[1]] as [number, number];
  });

  return coordinates.every(Boolean) ? (coordinates as [number, number][]) : null;
}

function abortableDelay(ms: number, signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      globalThis.clearTimeout(timeoutId);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timeoutId = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);

    signal.addEventListener("abort", abort, { once: true });
  });
}

function waitForIdle(signal: AbortSignal, timeout = 700) {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  return new Promise<void>((resolve, reject) => {
    const hostWindow =
      typeof window === "undefined" ? null : (window as IdleWindow);
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      if (idleId !== null) {
        hostWindow?.cancelIdleCallback?.(idleId);
      }
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", abort, { once: true });

    if (hostWindow && typeof hostWindow.requestIdleCallback === "function") {
      idleId = hostWindow.requestIdleCallback(finish, { timeout });
      return;
    }

    timeoutId = globalThis.setTimeout(finish, 0);
  });
}

async function fetchRouteBetweenPoints({
  from,
  to,
  id,
  name,
  timeout = 12000,
  signal,
}: {
  from: { lng: number; lat: number };
  to: { lng: number; lat: number };
  id: number;
  name: string;
  timeout?: number;
  signal?: AbortSignal;
}): Promise<RouteData | null> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeout);
  const abortFromCaller = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
      {
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.warn("Route fetch failed:", name, response.status);
      return null;
    }

    const data = await response.json();
    const route = data?.routes?.[0];
    const coordinates = parseRouteCoordinates(route?.geometry?.coordinates);

    if (!coordinates) {
      console.warn("Invalid route:", name);
      return null;
    }

    return {
      id,
      name,
      coordinates,
      duration:
        typeof route.duration === "number" && Number.isFinite(route.duration)
          ? route.duration
          : 0,
      distance:
        typeof route.distance === "number" && Number.isFinite(route.distance)
          ? route.distance
          : 0,
    };
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      console.warn("Route fetch error:", name, err);
    }
    return null;
  } finally {
    signal?.removeEventListener("abort", abortFromCaller);
    globalThis.clearTimeout(timeoutId);
  }
}

function upsertRouteById(routes: RouteData[], nextRoute: RouteData) {
  const existingIndex = routes.findIndex((route) => route.id === nextRoute.id);

  if (existingIndex === -1) {
    return [...routes, nextRoute];
  }

  const nextRoutes = [...routes];
  nextRoutes[existingIndex] = nextRoute;
  return nextRoutes;
}

function getRouteCacheKey(poi: Poi) {
  return `${centerPlace.lng},${centerPlace.lat}:${poi.lng},${poi.lat}`;
}

function loadRouteCache() {
  try {
    if (typeof sessionStorage === "undefined") {
      return {} as Record<string, RouteData>;
    }

    const raw = sessionStorage.getItem(ROUTE_CACHE_KEY);
    if (!raw) return {} as Record<string, RouteData>;
    return JSON.parse(raw) as Record<string, RouteData>;
  } catch {
    return {} as Record<string, RouteData>;
  }
}

function saveRouteCache(cache: Record<string, RouteData>) {
  try {
    if (typeof sessionStorage === "undefined") {
      return;
    }

    sessionStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage failures
  }
}

async function loadRouteCacheDuringIdle(signal: AbortSignal) {
  await waitForIdle(signal);
  if (signal.aborted) {
    return {} as Record<string, RouteData>;
  }

  return loadRouteCache();
}

const categoryMeta: Record<
  PoiCategory,
  {
    label: string;
    color: string;
    glow: string;
    panelClass: string;
    pinColor: string;
    routeColor: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeBg: string;
    badgeRing: string;
    badgeIcon: string;
  }
> = {
  park: {
    label: "Parks",
    color: "text-emerald-600",
    glow: "bg-emerald-400/20",
    panelClass: "border-emerald-300/70 bg-emerald-50/85",
    pinColor: "text-emerald-600",
    routeColor: "#10b981",
    icon: Trees,
    badgeBg: "bg-emerald-500",
    badgeRing: "ring-emerald-200/80",
    badgeIcon: "text-white",
  },
  mall: {
    label: "Malls",
    color: "text-fuchsia-600",
    glow: "bg-fuchsia-400/20",
    panelClass: "border-fuchsia-300/70 bg-fuchsia-50/85",
    pinColor: "text-fuchsia-600",
    routeColor: "#d946ef",
    icon: Store,
    badgeBg: "bg-fuchsia-500",
    badgeRing: "ring-fuchsia-200/80",
    badgeIcon: "text-white",
  },
  bus_stop: {
    label: "Bus Stops",
    color: "text-amber-600",
    glow: "bg-amber-400/20",
    panelClass: "border-amber-300/70 bg-amber-50/85",
    pinColor: "text-amber-600",
    routeColor: "#f59e0b",
    icon: BusFront,
    badgeBg: "bg-amber-500",
    badgeRing: "ring-amber-200/80",
    badgeIcon: "text-white",
  },
  school: {
    label: "Schools",
    color: "text-sky-600",
    glow: "bg-sky-400/20",
    panelClass: "border-sky-300/70 bg-sky-50/85",
    pinColor: "text-sky-600",
    routeColor: "#0ea5e9",
    icon: School,
    badgeBg: "bg-sky-500",
    badgeRing: "ring-sky-200/80",
    badgeIcon: "text-white",
  },
  hospital: {
    label: "Hospitals",
    color: "text-rose-600",
    glow: "bg-rose-400/20",
    panelClass: "border-rose-300/70 bg-rose-50/85",
    pinColor: "text-rose-600",
    routeColor: "#f43f5e",
    icon: Cross,
    badgeBg: "bg-rose-500",
    badgeRing: "ring-rose-200/80",
    badgeIcon: "text-white",
  },
  landmark: {
    label: "Landmarks",
    color: "text-violet-600",
    glow: "bg-violet-400/20",
    panelClass: "border-violet-300/70 bg-violet-50/85",
    pinColor: "text-violet-600",
    routeColor: "#8b5cf6",
    icon: Landmark,
    badgeBg: "bg-violet-500",
    badgeRing: "ring-violet-200/80",
    badgeIcon: "text-white",
  },
  "IT Company": {
    label: "IT Company",
    color: "text-emerald-700",
    glow: "bg-emerald-500/20",
    panelClass: "border-emerald-300/70 bg-emerald-50/85",
    pinColor: "text-emerald-700",
    routeColor: "#059669",
    icon: BriefcaseBusiness,
    badgeBg: "bg-teal-600",
    badgeRing: "ring-teal-200/80",
    badgeIcon: "text-white",
  },
};

const CategoryBadge = memo(function CategoryBadge({
  category,
  selected = false,
  size = "md",
}: {
  category: PoiCategory;
  selected?: boolean;
  size?: "sm" | "md";
}) {
  const meta = categoryMeta[category];
  const Icon = meta.icon;

  const sizeClass = size === "sm" ? "h-9 w-9" : "h-11 w-11";

  const iconSizeClass = size === "sm" ? "size-4" : "size-5";

  return (
    <div className="relative flex items-center justify-center">
      <div
        className={`absolute inset-0 rounded-full blur-md transition-all duration-300 ${meta.glow} ${
          selected ? "scale-125 opacity-80" : "opacity-40"
        }`}
      />
      <div
        className={`relative flex items-center justify-center rounded-full shadow-2xl  transition-all duration-300 ${sizeClass} ${meta.badgeBg} ${
          selected ? "scale-100" : "group-hover:scale-100"
        }`}
      >
        <Icon
          className={`${iconSizeClass} ${meta.badgeIcon}`}
          // strokeWidth={2.2}
        />
      </div>
    </div>
  );
});

const CategoryFilterChip = memo(function CategoryFilterChip({
  active,
  category,
  onClick,
}: {
  active: boolean;
  category: PoiCategory;
  onClick: (category: PoiCategory) => void;
}) {
  const meta = categoryMeta[category];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(category)}
      className={`flex min-h-12 items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-all [@media(max-height:850px)]:min-h-10 [@media(max-height:850px)]:gap-1.5 [@media(max-height:850px)]:px-2 [@media(max-height:850px)]:py-1.5 ${
        active
          ? `${meta.panelClass} shadow-sm`
          : "border-slate-200 bg-white/70 hover:bg-slate-50"
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border [@media(max-height:850px)]:h-7 [@media(max-height:850px)]:w-7 ${
          active ? "border-white/70 bg-white/70" : "border-slate-200 bg-slate-50"
        }`}
      >
        <Icon
          className={`size-4 ${
            active ? meta.color : "text-slate-500"
          }`}
        />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-900">
          {meta.label}
        </p>
      </div>
    </button>
  );
});

const PoiMarker = memo(function PoiMarker({
  poi,
  isSelected,
  onMarkerClick,
  onViewRoute,
}: {
  poi: Poi;
  isSelected: boolean;
  onMarkerClick: (poi: Poi) => void;
  onViewRoute: (poi: Poi) => void;
}) {
  const meta = categoryMeta[poi.category];

  return (
    <MapMarker longitude={poi.lng} latitude={poi.lat}>
      <MarkerContent>
        <button
          type="button"
          onClick={() => onMarkerClick(poi)}
          className="group relative"
        >
          <CategoryBadge
            category={poi.category}
            selected={isSelected}
            size="md"
          />
        </button>
      </MarkerContent>

      <MarkerTooltip>{poi.name}</MarkerTooltip>

      <MarkerPopup className="bg-transparent shadow-none border-none">
        <div className="w-70 overflow-hidden rounded-2xl border border-slate-200 bg-white  shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
          {poi.image ? (
            <div className="h-36 w-full overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={poi.image}
                alt={poi.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-36 w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
              No image
            </div>
          )}

          <div className="space-y-3 p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                {meta.label}
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                {poi.name}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {poi.rating && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                  ★ {poi.rating.toFixed(1)}
                </span>
              )}

              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1">
                {poi.distanceLabel}
              </span>

              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1">
                {poi.timeLabel}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onViewRoute(poi)}
                className="flex-1 rounded-xl cursor-pointer bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                View Route
              </button>

              <button
                type="button"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`,
                    "_blank",
                  )
                }
                className="rounded-xl cursor-pointer border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      </MarkerPopup>
    </MapMarker>
  );
});

function useAnimatedRouteProgress(active: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) return;

    let frameId = 0;
    let start: number | null = null;

    const animate = (time: number) => {
      if (start === null) start = time;

      const elapsed = time - start;
      setProgress((elapsed % ROUTE_ANIMATION_DURATION) / ROUTE_ANIMATION_DURATION);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [active]);

  return active ? progress : 0;
}

function MapClickClearRoute({
  onClear,
  suppressRef,
}: {
  onClear: () => void;
  suppressRef: React.MutableRefObject<boolean>;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleMapClick = () => {
      if (suppressRef.current) {
        suppressRef.current = false;
        return;
      }

      onClear();
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [map, isLoaded, onClear, suppressRef]);

  return null;
}

function UserLocationAccuracyLayer({
  location,
}: {
  location: UserLocation;
}) {
  const { map, isLoaded } = useMap();
  const accuracyRadius = Math.max(location.accuracy ?? 0, 35);
  const polygon = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          buildAccuracyPolygon(
            location.longitude,
            location.latitude,
            accuracyRadius,
          ),
        ],
      },
    }),
    [accuracyRadius, location.latitude, location.longitude],
  );

  useEffect(() => {
    if (!isLoaded || !map) return;

    const sourceId = "user-location-accuracy-source";
    const fillLayerId = "user-location-accuracy-fill";
    const outlineLayerId = "user-location-accuracy-outline";

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: polygon,
      });
    }

    if (!map.getLayer(fillLayerId)) {
      map.addLayer({
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#0f766e",
          "fill-opacity": 0.14,
        },
      });
    }

    if (!map.getLayer(outlineLayerId)) {
      map.addLayer({
        id: outlineLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#0f766e",
          "line-width": 2,
          "line-opacity": 0.3,
        },
      });
    }

    return () => {
      try {
        if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore map style teardown races
      }
    };
  }, [isLoaded, map, polygon]);

  useEffect(() => {
    if (!isLoaded || !map) return;

    const source = map.getSource(
      "user-location-accuracy-source",
    ) as { setData?: (data: unknown) => void } | null;

    source?.setData?.(polygon);
  }, [isLoaded, map, polygon]);

  return null;
}


export function CustomStyleExample() {
  const mapRef = useRef<MapRef>(null);
  const suppressNextMapClearRef = useRef(false);
  const userRouteRequestRef = useRef(0);
  const currentZoomRef = useRef(15);
  const hasSyncedViewportRef = useRef(false);
  const mountedRef = useRef(false);
  const userRouteAbortRef = useRef<AbortController | null>(null);
  const routeCacheRef = useRef<Record<string, RouteData>>({});
  const routeCacheWriteChainRef = useRef<Promise<void>>(Promise.resolve());

  const [style, setStyle] = useState<StyleKey>("default");
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserRouteLoading, setIsUserRouteLoading] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<number | null>(null);
  const [routePoiId, setRoutePoiId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [userRoute, setUserRoute] = useState<RouteData | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isDesktopCategoriesOpen, setIsDesktopCategoriesOpen] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(15);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const [selectedCategories, setSelectedCategories] = useState<PoiCategory[]>(
    DEFAULT_SELECTED_CATEGORIES,
  );

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const selectedStyle = styles[style];
  const is3D = style === "openstreetmap3d";
  const poiIndexes = useMemo(() => {
    const byCategory = new Map<PoiCategory, Poi[]>(
      CATEGORY_ORDER.map((category) => [
        category,
        pois.filter((poi) => poi.category === category),
      ]),
    );
    const clusterFeatureById = new Map<
      number,
      GeoJSON.Feature<GeoJSON.Point, ClusterPoiProperties>
    >(
      pois.map((poi) => [
        poi.id,
        {
          type: "Feature",
          properties: {
            poiId: poi.id,
            name: poi.name,
            category: poi.category,
          },
          geometry: {
            type: "Point",
            coordinates: [poi.lng, poi.lat],
          },
        },
      ]),
    );

    return {
      byCategory,
      clusterFeatureById,
    };
  }, []);
  const enqueueRouteCacheSave = useCallback((signal: AbortSignal) => {
    const snapshot = { ...routeCacheRef.current };

    routeCacheWriteChainRef.current = routeCacheWriteChainRef.current
      .catch(() => undefined)
      .then(async () => {
        await waitForIdle(signal, 1200);
        if (!signal.aborted) {
          saveRouteCache(snapshot);
        }
      })
      .catch(() => undefined);

    return routeCacheWriteChainRef.current;
  }, []);

  useEffect(() => {
    mapRef.current?.easeTo?.({
      pitch: is3D ? 55 : 0,
      duration: 500,
    });
  }, [is3D]);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      userRouteAbortRef.current?.abort();
      userRouteAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const limit = pLimit(MAX_CONCURRENT_ROUTE_REQUESTS);

    async function runQueue() {
      await waitForIdle(controller.signal).catch(() => undefined);
      if (controller.signal.aborted) {
        return;
      }

      setIsLoading(true);
      routeCacheRef.current = await loadRouteCacheDuringIdle(controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      const initialResults: RouteData[] = [];
      const uncachedPois: Poi[] = [];

      for (const poi of pois) {
        const cacheKey = getRouteCacheKey(poi);
        const cached = routeCacheRef.current[cacheKey];
        if (cached) {
          initialResults.push(cached);
          continue;
        }

        initialResults.push(getProvisionalRoute(poi));
        uncachedPois.push(poi);
      }

      if (!controller.signal.aborted && mountedRef.current) {
        setRoutes(initialResults);
      }

      if (uncachedPois.length === 0) {
        if (!controller.signal.aborted && mountedRef.current) {
          setIsLoading(false);
        }
        return;
      }

      const tasks = uncachedPois.map((poi, index) =>
        limit(async () => {
          await abortableDelay(index * ROUTE_REQUEST_SPACING, controller.signal);

          const result = await fetchRouteBetweenPoints({
            from: { lng: centerPlace.lng, lat: centerPlace.lat },
            to: { lng: poi.lng, lat: poi.lat },
            id: poi.id,
            name: poi.name,
            timeout: ROUTE_REQUEST_TIMEOUT,
            signal: controller.signal,
          });

          if (!result || controller.signal.aborted || !mountedRef.current) {
            return;
          }

          const cacheKey = getRouteCacheKey(poi);
          routeCacheRef.current = {
            ...routeCacheRef.current,
            [cacheKey]: result,
          };
          void enqueueRouteCacheSave(controller.signal);
          setRoutes((prev) => upsertRouteById(prev, result));
        }),
      );

      await Promise.allSettled(tasks);

      if (!controller.signal.aborted && mountedRef.current) {
        setIsLoading(false);
      }
    }

    void runQueue();

    return () => {
      controller.abort();
    };
  }, [enqueueRouteCacheSave]);

  const filteredPois = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const selectedCategorySet = new Set(selectedCategories);
    const categoryPois =
      selectedCategories.length === CATEGORY_ORDER.length
        ? pois
        : selectedCategories.flatMap(
            (category) => poiIndexes.byCategory.get(category) ?? [],
          );

    if (!q) {
      return categoryPois;
    }

    return categoryPois.filter((poi) => {
      const matchesCategory = selectedCategorySet.has(poi.category);
      const matchesSearch =
        poi.name.toLowerCase().includes(q) ||
        categoryMeta[poi.category].label.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [deferredSearch, poiIndexes.byCategory, selectedCategories]);

  const visiblePois = filteredPois;
  const clusterData = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Point, ClusterPoiProperties>
  >(
    () => ({
      type: "FeatureCollection",
      features: visiblePois
        .map((poi) => poiIndexes.clusterFeatureById.get(poi.id))
        .filter(
          (
            feature,
          ): feature is GeoJSON.Feature<
            GeoJSON.Point,
            ClusterPoiProperties
          > => Boolean(feature),
        ),
    }),
    [poiIndexes.clusterFeatureById, visiblePois],
  );
  const routeLookup = useMemo(
    () => new Map(routes.map((route) => [route.id, route] as const)),
    [routes],
  );

  const clearPoiSelection = useCallback(() => {
    setRoutePoiId(null);
    setSelectedPoiId(null);
  }, []);

  const applySearchInput = useCallback((value: string) => {
    clearPoiSelection();
    setSearch(value);
  }, [clearPoiSelection]);

  const clearSearchInput = useCallback(() => {
    clearPoiSelection();
    setSearch("");
  }, [clearPoiSelection]);

  const toggleCategory = useCallback((category: PoiCategory) => {
    clearPoiSelection();
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category],
    );
  }, [clearPoiSelection]);

  const handlePoiMarkerClick = useCallback((poi: Poi) => {
    userRouteRequestRef.current += 1;
    userRouteAbortRef.current?.abort();
    setUserRoute(null);
    setIsUserRouteLoading(false);
    suppressNextMapClearRef.current = true;
    setRoutePoiId(null);
    setSelectedPoiId(poi.id);

    mapRef.current?.flyTo?.({
      center: [poi.lng, poi.lat],
      zoom: 16.8,
      duration: 1200,
    });
  }, []);

  const handleFilteredPoiSelection = useCallback((poi: Poi) => {
    setIsFilterOpen(false);
    setIsMobileFiltersOpen(false);
    handlePoiMarkerClick(poi);
  }, [handlePoiMarkerClick]);

  const resetFilters = useCallback(() => {
    userRouteRequestRef.current += 1;
    userRouteAbortRef.current?.abort();
    setSelectedPoiId(null);
    setRoutePoiId(null);
    setUserLocation(null);
    setUserRoute(null);
    setIsUserRouteLoading(false);
    setSearch("");
    setSelectedCategories(DEFAULT_SELECTED_CATEGORIES);
    mapRef.current?.flyTo?.({
      center: [centerPlace.lng, centerPlace.lat],
      zoom: 15,
      duration: 1200,
    });
  }, []);

  const clearActiveRoute = useCallback(() => {
    setRoutePoiId(null);
    setSelectedPoiId(null);
  }, []);

  const stopAllRouteAnimations = useCallback(() => {
    userRouteRequestRef.current += 1;
    userRouteAbortRef.current?.abort();
    setRoutePoiId(null);
    setSelectedPoiId(null);
    setUserRoute(null);
    setIsUserRouteLoading(false);
  }, []);

  const handleViewRoute = useCallback((poi: Poi) => {
    userRouteRequestRef.current += 1;
    userRouteAbortRef.current?.abort();
    setUserRoute(null);
    setIsUserRouteLoading(false);
    suppressNextMapClearRef.current = true;
    setSelectedPoiId(poi.id);
    setRoutePoiId(poi.id);

    mapRef.current?.flyTo?.({
      center: [poi.lng, poi.lat],
      zoom: 13.8,
      duration: 1200,
    });
  }, []);

  const handleClusterPointClick = useCallback(
    (
      feature: GeoJSON.Feature<GeoJSON.Point, ClusterPoiProperties>,
      coordinates: [number, number],
    ) => {
      const poiId = feature.properties?.poiId;
      if (typeof poiId !== "number") return;

      const poi = visiblePois.find((item) => item.id === poiId);
      if (!poi) return;

      userRouteRequestRef.current += 1;
      userRouteAbortRef.current?.abort();
      setUserRoute(null);
      setIsUserRouteLoading(false);
      suppressNextMapClearRef.current = true;
      setRoutePoiId(null);
      setSelectedPoiId(poi.id);

      mapRef.current?.flyTo?.({
        center: coordinates,
        zoom: 16.2,
        duration: 1000,
      });
    },
    [visiblePois],
  );

  const handleUserLocate = useCallback(async (coords: UserLocation) => {
    const requestId = userRouteRequestRef.current + 1;
    userRouteRequestRef.current = requestId;
    userRouteAbortRef.current?.abort();
    const controller = new AbortController();
    userRouteAbortRef.current = controller;

    suppressNextMapClearRef.current = true;
    setSelectedPoiId(null);
    setRoutePoiId(null);
    setUserLocation(coords);

    const fallbackRoute = buildUserFallbackRoute(coords);
    setUserRoute(fallbackRoute);
    setIsUserRouteLoading(true);

    mapRef.current?.fitBounds(
      [
        [
          Math.min(coords.longitude, centerPlace.lng),
          Math.min(coords.latitude, centerPlace.lat),
        ],
        [
          Math.max(coords.longitude, centerPlace.lng),
          Math.max(coords.latitude, centerPlace.lat),
        ],
      ],
      {
        padding: {
          top: 120,
          right: 80,
          bottom: isMobileFiltersOpen ? 340 : 140,
          left: 80,
        },
        duration: 1500,
      },
    );

    const fetchedRoute = await fetchRouteBetweenPoints({
      from: { lng: coords.longitude, lat: coords.latitude },
      to: { lng: centerPlace.lng, lat: centerPlace.lat },
      id: -1,
      name: "Your Route to Trifecta Veranza",
      timeout: ROUTE_REQUEST_TIMEOUT,
      signal: controller.signal,
    });

    if (
      controller.signal.aborted ||
      !mountedRef.current ||
      userRouteRequestRef.current !== requestId
    ) {
      return;
    }

    if (fetchedRoute) {
      setUserRoute(fetchedRoute);
    }

    setIsUserRouteLoading(false);
    if (userRouteAbortRef.current === controller) {
      userRouteAbortRef.current = null;
    }
  }, [isMobileFiltersOpen]);

  
  const selectedPoi =
    filteredPois.find((poi) => poi.id === selectedPoiId) ??
    pois.find((poi) => poi.id === selectedPoiId) ??
    null;

  const activeRoute = routePoiId !== null ? routeLookup.get(routePoiId) ?? null : null;
  const routeProgress = useAnimatedRouteProgress(Boolean(activeRoute));
  const userRouteProgress = useAnimatedRouteProgress(Boolean(userRoute));

  const animatedCoordinates = useMemo(() => {
    if (!activeRoute) return [];

    if (!Array.isArray(activeRoute.coordinates)) return [];

    if (activeRoute.coordinates.length < 2) return [];

    return getAnimatedSegment(
      activeRoute.coordinates,
      routeProgress,
      ROUTE_ANIMATION_WINDOW_SIZE,
    );
  }, [activeRoute, routeProgress]);

  const userAnimatedCoordinates = useMemo(() => {
    if (!userRoute) return [];

    if (!Array.isArray(userRoute.coordinates)) return [];

    if (userRoute.coordinates.length < 2) return [];

    return getAnimatedSegment(
      userRoute.coordinates,
      userRouteProgress,
      ROUTE_ANIMATION_WINDOW_SIZE,
    );
  }, [userRoute, userRouteProgress]);

  const activeRouteColor = selectedPoi
    ? categoryMeta[selectedPoi.category].routeColor
    : "#22d3ee";
  const userRouteColor = "#0f766e";
  const showClusters = currentZoom < POI_CLUSTER_SWITCH_ZOOM;
  const showFloatingStyleControl =
    viewport.width > 0 &&
    (viewport.width < 1536 || viewport.height <= 850) &&
    !isMobileFiltersOpen;
  const handleViewportChange = useCallback((viewport: { zoom: number }) => {
    const nextZoom = viewport.zoom;

    if (!hasSyncedViewportRef.current) {
      hasSyncedViewportRef.current = true;
      currentZoomRef.current = nextZoom;
      setCurrentZoom(nextZoom);
      return;
    }

    const wasClustered = currentZoomRef.current < POI_CLUSTER_SWITCH_ZOOM;
    const willCluster = nextZoom < POI_CLUSTER_SWITCH_ZOOM;

    currentZoomRef.current = nextZoom;
    setCurrentZoom(nextZoom);

    if (!wasClustered && willCluster) {
      stopAllRouteAnimations();
    }
  }, [stopAllRouteAnimations]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-100">
      <MapView
        ref={mapRef}
        center={[centerPlace.lng, centerPlace.lat]}
        zoom={15}
        fadeDuration={0}
        onViewportChange={handleViewportChange}
        styles={
          selectedStyle
            ? { light: selectedStyle, dark: selectedStyle }
            : undefined
        }
      >
        <MapControls
          position="bottom-right"
          showZoom
          showCompass
          showLocate
          showFullscreen
          onLocate={handleUserLocate}
        />

        <MapClickClearRoute
          onClear={clearActiveRoute}
          suppressRef={suppressNextMapClearRef}
        />

        {userLocation ? (
          <UserLocationAccuracyLayer location={userLocation} />
        ) : null}
        {userRoute && (
          <>
            <MapRoute
              id="user-route-outline"
              coordinates={userRoute.coordinates}
              color="#ffffff"
              width={3}
              opacity={0.6}
            />

            <MapRoute
              id="user-route-base"
              coordinates={userRoute.coordinates}
              color={userRouteColor}
              width={6}
              opacity={0.18}
            />
          </>
        )}

        {userAnimatedCoordinates.length > 1 && (
          <MapRoute
            id="user-route-animated"
            coordinates={userAnimatedCoordinates}
            color={userRouteColor}
            width={5}
            opacity={1}
          />
        )}
        {activeRoute && (
          <>
            <MapRoute
              id="poi-route-outline"
              coordinates={activeRoute.coordinates}
              color="#ffffff"
              width={3}
              opacity={0.55}
            />

            <MapRoute
              id="poi-route-base"
              coordinates={activeRoute.coordinates}
              color={activeRouteColor}
              width={6}
              opacity={0.16}
            />
          </>
        )}

        {animatedCoordinates.length > 1 && (
          <MapRoute
            id="poi-route-animated"
            coordinates={animatedCoordinates}
            color={activeRouteColor}
            width={5}
            opacity={1}
          />
        )}

        {showClusters ? (
          <MapClusterLayer<ClusterPoiProperties>
            data={clusterData}
            clusterRadius={POI_CLUSTER_RADIUS}
            clusterMaxZoom={POI_CLUSTER_MAX_ZOOM}
            clusterColors={["#0f766e", "#0ea5e9", "#1d4ed8"]}
            clusterThresholds={[12, 28]}
            pointColor="#0891b2"
            onPointClick={handleClusterPointClick}
          />
        ) : null}

        <MapMarker longitude={centerPlace.lng} latitude={centerPlace.lat}>
          <MarkerContent>
            <button
              type="button"
              onClick={clearActiveRoute}
              className="relative flex items-center justify-center"
            >
              {/* <div className="absolute size-12 animate-ping rounded-full bg-cyan-400/20" /> */}
              {/* <div className="absolute size-8 rounded-full bg-cyan-400/15 blur-md" /> */}
              {/* <FaMapMarkerAlt className="size-8 text-red-600 opacity-90 drop-shadow-[0_8px_16px_rgba(34,211,238,0.22)]" /> */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={projectCard.image} alt={projectCard.title} />
            </button>
          </MarkerContent>

          <MarkerTooltip>{centerPlace.name}</MarkerTooltip>

          <MarkerPopup className="bg-transparent border-none shadow-none">
            <div className="w-70 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
              <div className="h-36 w-full overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={projectCard.image}
                  alt={projectCard.title}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-3 p-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Project Spotlight
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">
                    {projectCard.title}
                  </h3>
                </div>

                <p className="text-sm leading-6 text-slate-600">
                  {projectCard.description}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      mapRef.current?.flyTo?.({
                        center: [centerPlace.lng, centerPlace.lat],
                        zoom: 15,
                        duration: 1200,
                      })
                    }
                    className="flex-1 rounded-xl cursor-pointer bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    View Project
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/search/?api=1&query=${centerPlace.lat},${centerPlace.lng}`,
                        "_blank",
                      )
                    }
                    className="rounded-xl cursor-pointer border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Open
                  </button>
                </div>
              </div>
            </div>
          </MarkerPopup>
        </MapMarker>

        {userLocation ? (
          <MapMarker
            longitude={userLocation.longitude}
            latitude={userLocation.latitude}
          >
            <MarkerContent>
              <div className="relative flex items-center justify-center">
                <div className="absolute size-8 animate-ping rounded-full bg-teal-500/20" />
                <div className="absolute size-6 rounded-full bg-teal-500/20 blur-md" />
                <div className="relative size-4 rounded-full border-2 border-white bg-teal-600 shadow-[0_0_0_6px_rgba(15,118,110,0.18)]" />
              </div>
            </MarkerContent>

            <MarkerTooltip>Your Location</MarkerTooltip>

            <MarkerPopup>
              <div className="space-y-2">
                <p className="font-medium text-slate-900">Your Location</p>
                <p className="text-xs text-slate-600">
                  {userLocation.latitude.toFixed(6)},{" "}
                  {userLocation.longitude.toFixed(6)}
                </p>
                <p className="text-xs text-slate-600">
                  Accuracy radius:{" "}
                  {Math.round(Math.max(userLocation.accuracy ?? 0, 35))} m
                </p>
                <p className="text-xs text-slate-600">
                  Route shown to Trifecta Veranza
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        ) : null}

        {!showClusters
          ? visiblePois.map((poi) => (
              <PoiMarker
                key={poi.id}
                poi={poi}
                isSelected={selectedPoiId === poi.id}
                onMarkerClick={handlePoiMarkerClick}
                onViewRoute={handleViewRoute}
              />
            ))
          : null}
      </MapView>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_30%),linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0.06))]" />

      <>
        {isMobileFiltersOpen ? (
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(false)}
            className="absolute inset-0 z-30 bg-slate-900/10 backdrop-blur-[1px] xl:hidden"
            aria-label="Close nearby filters"
          />
        ) : null}

        {/* Mobile / Tablet open button */}
        <div
          className={`absolute right-4 top-4 z-30 xl:hidden ${
            isMobileFiltersOpen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(true)}
            className="flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl transition hover:bg-white"
          >
            <Layers className="size-4" />
            Filters
          </button>
        </div>

        {showFloatingStyleControl ? (
          <div className="absolute left-4 top-4 z-30">
            <div className="rounded-[24px] border border-white/65 bg-white/28 px-3 py-2.5 text-slate-900 shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur-xl">
              <div className="flex items-start gap-2.5">
                {styleOptions.map((option) => {
                  const isActive = style === option.key;
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setStyle(option.key)}
                      aria-label={`Switch map style to ${option.label}`}
                      title={option.label}
                      className="group flex flex-col items-center gap-1.5"
                    >
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-full border text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-200 ${
                          isActive
                            ? "border-cyan-300 bg-white/92 text-cyan-700 ring-2 ring-cyan-200/80"
                            : "border-white/70 bg-white/58 hover:bg-white/78"
                        }`}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span
                        className={`text-[10px] font-medium tracking-[0.01em] transition-colors ${
                          isActive ? "text-slate-900" : "text-slate-600"
                        }`}
                      >
                        {option.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* Desktop side panel */}
        <div
          className={`absolute bottom-3 right-3 top-3 z-20 hidden max-w-[calc(100vw-1.5rem)] transition-all duration-500 xl:block 2xl:bottom-4 2xl:right-4 2xl:top-4 ${
            isFilterOpen
              ? "w-85 lg:w-92.5 translate-x-0"
              : "w-85 lg:w-92.5 translate-x-[calc(100%+10px)]"
          }`}
        >
          <div className="relative h-full min-h-0">
            {/* Left bulge handle */}
            <button
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={`absolute left-0 top-1/2 z-30 flex h-auto py-5  w-auto pl-3 pr-2 cursor-pointer -translate-x-full 
              -translate-y-1/2 items-center justify-center rounded-l-full border ${isFilterOpen ? "border-white/70 bg-white/80 text-slate-700 hover:bg-black hover:shadow-2xl hover:text-slate-100" : "border-white/70 bg-neutral-900 text-slate-100 "}  backdrop-blur-xl transition hover:scale-105 `}
              aria-label={isFilterOpen ? "Close filters" : "Open filters"}
            >
              <div className="flex flex-row items-center gap-1">
                {/* <Layers className="size-4" /> */}
                <MdKeyboardArrowLeft className="text-2xl" />
              </div>
            </button>

            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/60 bg-white/72 text-slate-900 shadow-[0_10px_34px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
              <div className="shrink-0 border-b border-slate-200/80 p-4 [@media(max-height:850px)]:p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500 [@media(max-height:850px)]:text-[10px]">
                      Nearby Filters
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900 [@media(max-height:850px)]:text-lg">
                      Famous Places
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 [@media(max-height:850px)]:p-1.5"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="relative mt-4 [@media(max-height:850px)]:mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => applySearchInput(e.target.value)}
                    placeholder="Search places, companies, schools..."
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white/85 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-300 [@media(max-height:850px)]:h-9"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={clearSearchInput}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-b border-slate-200/80 p-4 [@media(max-height:850px)]:p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-800 [@media(max-height:850px)]:text-xs">
                    Categories
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setIsDesktopCategoriesOpen((currentValue) => !currentValue)
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white/75 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-white"
                    aria-expanded={isDesktopCategoriesOpen}
                    aria-label={
                      isDesktopCategoriesOpen
                        ? "Collapse categories"
                        : "Expand categories"
                    }
                  >
                    {isDesktopCategoriesOpen ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                    {isDesktopCategoriesOpen ? "Hide" : "Show"}
                  </button>
                </div>

                {isDesktopCategoriesOpen ? (
                  <div className="mt-3 grid grid-cols-2 gap-1.5 [@media(max-height:850px)]:mt-2">
                    {CATEGORY_ORDER.map(
                      (category) => {
                        const active = selectedCategories.includes(category);

                        return (
                          <CategoryFilterChip
                            key={category}
                            active={active}
                            category={category}
                            onClick={toggleCategory}
                          />
                        );
                      },
                    )}
                  </div>
                ) : selectedCategories.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedCategories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full border border-slate-200 bg-white/65 px-2 py-1 text-[10px] font-medium text-slate-600"
                      >
                        {categoryMeta[category].label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-hidden p-4 pb-2 [@media(max-height:850px)]:p-3 [@media(max-height:850px)]:pb-2">
                <div className="mb-3 flex shrink-0 items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">
                    Featured & Nearby
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      mapRef.current?.flyTo?.({
                        center: [centerPlace.lng, centerPlace.lat],
                        zoom: 15,
                        duration: 1200,
                      })
                    }
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
                  >
                    Recenter
                  </button>
                </div>

                <div className="h-[calc(100%-3rem)] min-h-0 space-y-2 overflow-y-auto pr-1">
                  {visiblePois.map(
                    (poi) => {
                      const meta = categoryMeta[poi.category];
                      const isSelected = selectedPoi?.id === poi.id;
                      const linkedRoute = routeLookup.get(poi.id);

                      return (
                        <button
                          key={poi.id}
                          type="button"
                          onClick={() => handleFilteredPoiSelection(poi)}
                          className={`w-full rounded-3xl border p-4 text-left transition-all [@media(max-height:850px)]:rounded-2xl [@media(max-height:850px)]:p-3 ${
                            isSelected
                              ? "border-cyan-300 bg-cyan-50 shadow-sm"
                              : "border-slate-200 bg-white/75 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3">
                              <CategoryBadge
                                category={poi.category}
                                selected={isSelected}
                                size="sm"
                              />

                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {poi.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {meta.label}
                                </p>
                              </div>
                            </div>

                            {poi.featured && (
                              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] uppercase tracking-wide text-cyan-700">
                                Popular
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="rounded-full bg-slate-100 px-2 py-1">
                              {linkedRoute
                                ? formatDistance(linkedRoute.distance)
                                : poi.distanceLabel}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-1">
                              {linkedRoute
                                ? formatDuration(linkedRoute.duration)
                                : poi.timeLabel}
                            </span>
                            {poi.rating && (
                              <span className="rounded-full bg-slate-100 px-2 py-1">
                                {poi.rating.toFixed(1)} ★
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    },
                  )}

                  {!filteredPois.length && (
                    <div className="rounded-3xl border border-slate-200 bg-white/75 p-6 text-center text-sm text-slate-500">
                      No places match your current filters.
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200/80 p-4 [@media(max-height:850px)]:p-3">
                <div className="mb-2 grid grid-cols-2 gap-2 [@media(max-height:850px)]:mb-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      mapRef.current?.flyTo?.({
                        center: [centerPlace.lng, centerPlace.lat],
                        zoom: 15,
                        duration: 1200,
                      })
                    }
                    className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm text-slate-800 transition hover:bg-slate-50 [@media(max-height:850px)]:py-2 [@media(max-height:850px)]:text-xs"
                  >
                    <MapPinned className="size-4" />
                    Project
                  </button>

                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm text-slate-800 transition hover:bg-slate-50 [@media(max-height:850px)]:py-2 [@media(max-height:850px)]:text-xs"
                  >
                    <X className="size-4" />
                    Reset
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 [@media(max-height:850px)]:hidden">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Map Style
                  </p>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value as StyleKey)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none [@media(max-height:850px)]:py-1.5 [@media(max-height:850px)]:text-xs"
                  >
                    <option value="default">Default (Carto)</option>
                    <option value="openstreetmap">OpenStreetMap</option>
                    <option value="openstreetmap3d">OpenStreetMap 3D</option>
                  </select>
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 p-3 [@media(max-height:850px)]:hidden">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Route Mode
                  </p>
                  <p className="mt-1 text-sm text-slate-700 [@media(max-height:850px)]:text-xs">
                    Click any POI to show an animated route from the project
                    center.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet bottom sheet */}
        <div
          className={`absolute inset-x-3 bottom-3 z-40 rounded-[30px] border border-white/60 bg-white/92 shadow-[0_-16px_40px_rgba(15,23,42,0.2)] backdrop-blur-2xl transition-all duration-500 xl:hidden ${
            isMobileFiltersOpen
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-[calc(100%+1rem)] opacity-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-14 rounded-full bg-slate-300" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Nearby Filters
                </p>
                <p className="text-xs text-slate-500">
                  Browse places from the bottom sheet
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(false)}
              className="absolute right-4 rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-500"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto p-4">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Nearby Filters
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">
                Famous Places
              </h3>

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => applySearchInput(e.target.value)}
                  placeholder="Search places, companies, schools..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white/85 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-300"
                />
                {search && (
                  <button
                    type="button"
                    onClick={clearSearchInput}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-3 text-sm font-medium text-slate-800">
                Categories
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_ORDER.map(
                  (category) => {
                    const active = selectedCategories.includes(category);

                    return (
                      <CategoryFilterChip
                        key={category}
                        active={active}
                        category={category}
                        onClick={toggleCategory}
                      />
                    );
                  },
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">
                  Filtered Locations
                </p>
                <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {filteredPois.length} spots
                </span>
              </div>

              <div className="max-h-[28vh] space-y-2 overflow-y-auto pr-1">
                {visiblePois
                  .slice(0, 8)
                  .map((poi) => {
                    const meta = categoryMeta[poi.category];
                    const isSelected = selectedPoi?.id === poi.id;
                    const linkedRoute = routeLookup.get(poi.id);

                    return (
                      <button
                        key={poi.id}
                        type="button"
                        onClick={() => handleFilteredPoiSelection(poi)}
                        className={`w-full rounded-2xl border p-3 text-left transition-all ${
                          isSelected
                            ? "border-cyan-300 bg-cyan-50 shadow-sm"
                            : "border-slate-200 bg-white/75 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <CategoryBadge
                            category={poi.category}
                            selected={isSelected}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {poi.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {meta.label}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                              <span className="rounded-full bg-slate-100 px-2 py-1">
                                {linkedRoute
                                  ? formatDistance(linkedRoute.distance)
                                  : poi.distanceLabel}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-1">
                                {linkedRoute
                                  ? formatDuration(linkedRoute.duration)
                                  : poi.timeLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                {!filteredPois.length && (
                  <div className="rounded-2xl border border-slate-200 bg-white/75 p-4 text-center text-sm text-slate-500">
                    No places match your current filters.
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  mapRef.current?.flyTo?.({
                    center: [centerPlace.lng, centerPlace.lat],
                    zoom: 15,
                    duration: 1200,
                  })
                }
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm text-slate-800"
              >
                <MapPinned className="size-4" />
                Project
              </button>

              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm text-slate-800"
              >
                <X className="size-4" />
                Reset
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Map Style
              </p>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as StyleKey)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
              >
                <option value="default">Default (Carto)</option>
                <option value="openstreetmap">OpenStreetMap</option>
                <option value="openstreetmap3d">OpenStreetMap 3D</option>
              </select>
            </div>
          </div>
        </div>
      </>

      {(isLoading || isUserRouteLoading) && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
          <div className="rounded-full border border-white/70 bg-white/88 px-5 py-3 text-slate-900 shadow-xl backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-cyan-600" />
              <span className="text-sm text-slate-700">
                {isUserRouteLoading
                  ? "Tracing your route to Trifecta Veranza..."
                  : "Loading Trifecta Veranza Map..."}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
