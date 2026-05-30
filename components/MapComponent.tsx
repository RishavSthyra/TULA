"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import pLimit from "p-limit";
import poidata from "@/data/poi.json";
import { Map as MapView,
  MapMarker,
  MarkerContent,
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
  X,
  Map as MapIcon,
  SlidersHorizontal,
  LocateFixed,
  Clock3,
  Star,
  Navigation,
  Heart,
  Share2,
  ParkingCircle,
  Coffee,
  Accessibility,
  WalletCards,
  Droplets,
} from "lucide-react";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";

const displaySerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
});

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
  images?: string[];
  image?: string;
};

type ClusterPoiProperties = {
  poiId: number;
  name: string;
  category: PoiCategory;
};

type DistanceFilter = "5km" | "10km" | "all";
type SortMode = "popularity" | "nearest" | "rating";

const centerPlace = {
  name: "Whisper of Trees",
  lng: 77.63036955360322,
  lat: 13.153818578384746, 
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
const PREMIUM_OLIVE_GRADIENT =
  "bg-[radial-gradient(circle_at_32%_25%,#69895e_0%,#45603c_58%,#2a452d_100%)]";
const PREMIUM_OLIVE_BUTTON =
  "bg-[radial-gradient(circle_at_32%_25%,#69895e_0%,#45603c_58%,#2a452d_100%)]";
const PREMIUM_PANEL =
  "border border-[#dfcfac]/80 bg-[linear-gradient(180deg,rgba(255,252,245,0.96)_0%,rgba(245,239,228,0.9)_100%)] shadow-[0_20px_46px_rgba(43,52,37,0.08),inset_0_1px_0_rgba(255,255,255,0.96)]";

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

const PoiMarker = memo(function PoiMarker({
  poi,
  isSelected,
  onMarkerClick,
}: {
  poi: Poi;
  isSelected: boolean;
  onMarkerClick: (poi: Poi) => void;
}) {
  const meta = categoryMeta[poi.category];
  const Icon = meta.icon;

  return (
    <MapMarker longitude={poi.lng} latitude={poi.lat}>
      <MarkerContent>
        <button
          type="button"
          onClick={() => onMarkerClick(poi)}
          className="group relative flex items-center justify-center"
          aria-label={poi.name}
        >
          <span
            className={`relative flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(229,219,190,0.82)] shadow-[0_8px_18px_rgba(47,73,50,0.18)] transition ${PREMIUM_OLIVE_GRADIENT} ${
              isSelected ? "scale-110 ring-4 ring-[#c4d8b7]/70" : ""
            }`}
          >
            <Icon className="size-4 text-white" />
          </span>
        </button>
      </MarkerContent>
      <MarkerTooltip
        offset={10}
        className="rounded-full border border-[#e4d8b7] bg-[#fffaf0] px-3 py-1 text-[0.68rem] font-semibold text-[#31482d] shadow-[0_10px_24px_rgba(43,52,37,0.12)]"
      >
        {poi.name}
      </MarkerTooltip>
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

const nearbyAmenities = [
  { label: "Parking", distance: "200 m", icon: ParkingCircle, color: "text-[#51663f]", bg: "bg-[#eef1e5]" },
  { label: "Cafes", distance: "150 m", icon: Coffee, color: "text-[#8c6f2a]", bg: "bg-[#f6f0df]" },
  { label: "Restroom", distance: "180 m", icon: Accessibility, color: "text-[#51663f]", bg: "bg-[#eef1e5]" },
  { label: "ATM", distance: "220 m", icon: WalletCards, color: "text-[#6f6040]", bg: "bg-[#f4eddc]" },
  { label: "Water", distance: "120 m", icon: Droplets, color: "text-[#51663f]", bg: "bg-[#eef1e5]" },
];

const placeDescriptions: Partial<Record<PoiCategory, string>> = {
  park:
    "A peaceful green escape with open spaces, landscaped surroundings, and room to unwind close to home.",
  mall:
    "A convenient retail destination with dining, essentials, and everyday shopping within easy reach.",
  school:
    "A well-connected education destination for families looking at practical daily access.",
  hospital:
    "A nearby healthcare stop with dependable access for regular and urgent needs.",
  landmark:
    "A recognizable neighborhood reference point that adds orientation and local character.",
  "IT Company":
    "A major workplace hub close to the project, useful for commute planning and daily convenience.",
  bus_stop:
    "A transit point that improves local connectivity for short everyday trips.",
};

function getPoiImages(poi: Poi | null) {
  const images = poi?.images?.filter(Boolean) ?? [];

  if (images.length > 0) {
    return images;
  }

  return poi?.image ? [poi.image] : ["/RGA.webp"];
}

function getPoiImage(poi: Poi | null) {
  return getPoiImages(poi)[0] ?? "/RGA.webp";
}

function getDisplayRoute(route: RouteData | null | undefined, poi: Poi | null) {
  return {
    distance: route ? formatDistance(route.distance) : poi?.distanceLabel ?? "3.7 km",
    duration: route ? formatDuration(route.duration) : poi?.timeLabel ?? "6 min",
  };
}

function getPoiDistanceMeters(poi: Poi, route: RouteData | null | undefined) {
  return route?.distance ?? parseDistanceLabel(poi.distanceLabel);
}

function isPopularPoi(poi: Poi) {
  return Boolean(poi.featured) || (poi.rating ?? 0) >= 4.4;
}

function isPoiOpenNow(poi: Poi, now = new Date()) {
  const hour = now.getHours() + now.getMinutes() / 60;
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  switch (poi.category) {
    case "hospital":
    case "bus_stop":
      return true;
    case "park":
      return hour >= 5.5 && hour <= 20;
    case "mall":
      return hour >= 10 && hour <= 22.5;
    case "school":
      return !isWeekend && hour >= 8 && hour <= 17.5;
    case "landmark":
      return hour >= 9 && hour <= 18.5;
    case "IT Company":
      return !isWeekend && hour >= 8.5 && hour <= 20;
    default:
      return true;
  }
}

function MetricPill({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#e8e0d2] bg-[#fffdf7]/88 px-3 text-[0.78rem] font-medium text-[#3e4b3d] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
      <Icon className="size-3.5 text-[#38583b]" />
      {children}
    </span>
  );
}

function PremiumSelect({
  value,
  onChange,
  options,
  icon: Icon,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  icon: React.ComponentType<{ className?: string }>;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#55684a]" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        className="h-12 w-full appearance-none rounded-full border border-[#e2d8c4] bg-[linear-gradient(180deg,rgba(255,253,248,0.98),rgba(247,242,233,0.96))] pl-10 pr-10 text-xs font-medium text-[#304238] shadow-[0_10px_22px_rgba(43,52,37,0.06),inset_0_1px_0_rgba(255,255,255,0.92)] outline-none transition focus:border-[#cbbd8c]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#55684a]" />
    </div>
  );
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

  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserRouteLoading, setIsUserRouteLoading] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<number | null>(null);
  const [activePoiImage, setActivePoiImage] = useState<{
    poiId: number;
    image: string;
  } | null>(null);
  const [routePoiId, setRoutePoiId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [userRoute, setUserRoute] = useState<RouteData | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(15);

  const [selectedCategories, setSelectedCategories] = useState<PoiCategory[]>(
    DEFAULT_SELECTED_CATEGORIES,
  );
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("5km");
  const [sortMode, setSortMode] = useState<SortMode>("popularity");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
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

  const routeLookup = useMemo(
    () => new Map(routes.map((route) => [route.id, route] as const)),
    [routes],
  );

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

  const visiblePois = useMemo(() => {
    const thresholdMeters =
      distanceFilter === "5km" ? 5000 : distanceFilter === "10km" ? 10000 : Number.POSITIVE_INFINITY;

    const nextPois = filteredPois.filter((poi) => {
      if (openNowOnly && !isPoiOpenNow(poi)) {
        return false;
      }

      return getPoiDistanceMeters(poi, routeLookup.get(poi.id)) <= thresholdMeters;
    });

    nextPois.sort((left, right) => {
      if (sortMode === "nearest") {
        return (
          getPoiDistanceMeters(left, routeLookup.get(left.id)) -
          getPoiDistanceMeters(right, routeLookup.get(right.id))
        );
      }

      if (sortMode === "rating") {
        return (right.rating ?? 0) - (left.rating ?? 0);
      }

      const popularDelta = Number(isPopularPoi(right)) - Number(isPopularPoi(left));
      if (popularDelta !== 0) {
        return popularDelta;
      }

      return (right.rating ?? 0) - (left.rating ?? 0);
    });

    return nextPois;
  }, [distanceFilter, filteredPois, openNowOnly, routeLookup, sortMode]);

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
    setDistanceFilter("5km");
    setSortMode("popularity");
    setOpenNowOnly(false);
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
    visiblePois.find((poi) => poi.id === selectedPoiId) ??
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
    ? "#5d7a44"
    : "#5d7a44";
  const userRouteColor = "#4d6a3d";
  const showClusters = currentZoom < POI_CLUSTER_SWITCH_ZOOM;
  const selectedDisplayPoi = selectedPoi ?? visiblePois[0] ?? pois[0] ?? null;
  const selectedPoiImages = getPoiImages(selectedDisplayPoi);
  const defaultSelectedPoiImage = selectedPoiImages[0] ?? "/RGA.webp";
  const selectedMainImage =
    selectedDisplayPoi &&
    activePoiImage?.poiId === selectedDisplayPoi.id &&
    selectedPoiImages.includes(activePoiImage.image)
      ? activePoiImage.image
      : defaultSelectedPoiImage;
  const selectedMeta = selectedDisplayPoi
    ? categoryMeta[selectedDisplayPoi.category]
    : categoryMeta.park;
  const SelectedIcon = selectedMeta.icon;
  const selectedRouteMetrics = getDisplayRoute(
    selectedDisplayPoi ? routeLookup.get(selectedDisplayPoi.id) : null,
    selectedDisplayPoi,
  );
  const listedPois = visiblePois;
  const selectedIsPopular = selectedDisplayPoi ? isPopularPoi(selectedDisplayPoi) : false;
  const detailDescription =
    (selectedDisplayPoi && placeDescriptions[selectedDisplayPoi.category]) ??
    "A convenient nearby destination selected from the project neighborhood map.";

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

  useEffect(() => {
    const resizeMap = () => {
      mapRef.current?.resize();
    };

    resizeMap();
    window.addEventListener("resize", resizeMap);

    const frameId = window.requestAnimationFrame(resizeMap);

    return () => {
      window.removeEventListener("resize", resizeMap);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <main className="relative min-h-dvh w-full max-w-[100vw] overflow-x-hidden bg-[#f3efe6] text-[#263b2b] xl:h-dvh xl:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_4%,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.38)_34%,transparent_58%),linear-gradient(135deg,#f8f4eb_0%,#eee7da_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.26] [background-image:linear-gradient(rgba(92,112,78,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(92,112,78,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />

      <section className="relative z-10 flex min-h-dvh w-full max-w-full flex-col gap-5 overflow-x-hidden px-4 py-5 sm:px-6 xl:h-dvh xl:pl-[9.25rem] xl:pr-8 2xl:pl-[9.55rem] 2xl:pr-10">
        <header className="grid w-full min-w-0 shrink-0 gap-4 lg:grid-cols-[minmax(21rem,40rem)_1fr_auto] lg:items-end 2xl:grid-cols-[minmax(30rem,41rem)_1fr_auto]">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#445a43]">
              Discover Nearby
            </p>
            <h1 className={`${displaySerif.className} mt-2 text-[2.2rem] font-semibold leading-none text-[#315238] sm:text-[3rem] 2xl:text-[3.35rem]`}>
              Explore Places
            </h1>
            <p className="mt-3 max-w-[22rem] text-sm leading-6 text-[#72796e]">
              Find famous places and everyday essentials around you.
            </p>
          </div>

          <div className="relative lg:mb-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#304638]" />
            <input
              value={search}
              onChange={(e) => applySearchInput(e.target.value)}
              placeholder="Search places, companies, schools..."
              className="h-14 w-full rounded-full border border-[#e1d8c8] bg-[#fffdf8]/88 pl-14 pr-12 text-sm text-[#263b2b] shadow-[0_12px_34px_rgba(39,52,38,0.09),inset_0_1px_0_rgba(255,255,255,0.96)] outline-none placeholder:text-[#8a8d84] focus:border-[#b9c9ae]"
            />
            {search ? (
              <button
                type="button"
                onClick={clearSearchInput}
                className="absolute right-4 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#697465] transition hover:bg-[#f3eddf]"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-3 lg:mb-2 lg:justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="flex size-14 items-center justify-center rounded-full border border-[#e3dacb] bg-[#fffdf8]/90 text-[#304638] shadow-[0_12px_28px_rgba(39,52,38,0.1)] transition hover:bg-white"
              aria-label="Reset nearby filters"
            >
              <SlidersHorizontal className="size-5" />
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${centerPlace.lat},${centerPlace.lng}`,
                  "_blank",
                )
              }
              className="inline-flex h-14 items-center gap-3 rounded-full border border-[#e3dacb] bg-[#fffdf8]/90 px-6 text-sm font-semibold text-[#304638] shadow-[0_12px_28px_rgba(39,52,38,0.1)] transition hover:bg-white"
            >
              <MapIcon className="size-5" />
              View on Map
            </button>
          </div>
        </header>

        <div className="grid w-full min-w-0 max-w-full gap-5 pb-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:pb-0">
          <aside className="order-2 flex min-w-0 max-w-full flex-col gap-4 xl:order-1 xl:min-h-0">
            <section className={`rounded-[1.55rem] p-4 backdrop-blur-xl 2xl:p-5 ${PREMIUM_PANEL}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-[#374c3a]">
                  Categories
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedCategories(DEFAULT_SELECTED_CATEGORIES)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#40543f]"
                >
                  View All
                  <ChevronDown className="-rotate-90 size-4" />
                </button>
              </div>
              <div
                className="flex w-full gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:grid xl:overflow-visible xl:pb-0"
                style={{ gridTemplateColumns: `repeat(${CATEGORY_ORDER.length}, minmax(0, 1fr))` }}
              >
                {CATEGORY_ORDER.map((category) => {
                  const Icon = categoryMeta[category].icon;
                  const active = selectedCategories.includes(category);

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`flex h-[5rem] w-[5rem] shrink-0 flex-col items-center justify-center rounded-[1.15rem] border text-center shadow-[0_10px_22px_rgba(43,52,37,0.06)] transition xl:w-full ${
                        active
                          ? `${PREMIUM_OLIVE_GRADIENT} border-[#5f7544] ring-1 ring-[#d8ca9c]`
                          : "border-[#e8dfd0] bg-[#fffdf8]/92 hover:border-[#cfc7b8]"
                      }`}
                    >
                      <span className={`mb-2 flex size-8 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] ${
                        active
                          ? "border-[#dccc9d] bg-[rgba(255,249,236,0.14)]"
                          : "border-[#e2d7ba] bg-[linear-gradient(180deg,rgba(253,251,245,0.98),rgba(245,238,222,0.92))]"
                      }`}>
                        <Icon className={`size-4.5 ${active ? "text-[#f6edd7]" : "text-[#50653e]"}`} />
                      </span>
                      <span className={`max-w-full px-1 text-[0.67rem] font-semibold leading-tight ${active ? "text-[#f6edd7]" : "text-[#26362a]"}`}>
                        {categoryMeta[category].label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={`rounded-[1.55rem] p-4 backdrop-blur-xl ${PREMIUM_PANEL}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-[#374c3a]">
                  Quick Filters
                </h2>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-[#536150]"
                >
                  Clear All
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
                <PremiumSelect
                  value={distanceFilter}
                  onChange={(value) => setDistanceFilter(value as DistanceFilter)}
                  ariaLabel="Filter nearby places by distance"
                  icon={LocateFixed}
                  options={[
                    { value: "5km", label: "Within 5 km" },
                    { value: "10km", label: "Within 10 km" },
                    { value: "all", label: "All Distances" },
                  ]}
                />
                <PremiumSelect
                  value={sortMode}
                  onChange={(value) => setSortMode(value as SortMode)}
                  ariaLabel="Sort nearby places"
                  icon={ChevronUp}
                  options={[
                    { value: "popularity", label: "Sort by: Popularity" },
                    { value: "nearest", label: "Sort by: Nearby" },
                    { value: "rating", label: "Sort by: Rating" },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => setOpenNowOnly((current) => !current)}
                  className="flex h-12 items-center justify-between rounded-full border border-[#e7dece] bg-[#fffdf8]/88 px-4 text-xs font-medium text-[#304238] shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]"
                >
                  <span className="inline-flex items-center gap-3">
                    <Clock3 className="size-4" />
                    Open Now
                  </span>
                  <span className={`h-5 w-9 rounded-full p-0.5 transition ${openNowOnly ? PREMIUM_OLIVE_BUTTON : "bg-[#d7d6d1]"}`}>
                    <span className={`block size-4 rounded-full bg-white shadow transition ${openNowOnly ? "translate-x-4" : ""}`} />
                  </span>
                </button>
              </div>
            </section>

            <section className={`rounded-[1.55rem] p-4 backdrop-blur-xl xl:min-h-0 xl:flex-1 ${PREMIUM_PANEL}`}>
              <div className="mb-4">
                <h2 className="text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-[#374c3a]">
                  Popular Nearby
                </h2>
                <span className="mt-3 block h-px w-8 bg-[#38583b]" />
              </div>
              <div className="space-y-3 pr-1 xl:h-[calc(100%-2.8rem)] xl:overflow-y-auto">
                {listedPois.map((poi) => {
                  const meta = categoryMeta[poi.category];
                  const Icon = meta.icon;
                  const linkedRoute = routeLookup.get(poi.id);
                  const metrics = getDisplayRoute(linkedRoute, poi);
                  const isSelected = selectedDisplayPoi?.id === poi.id;
                  const isPopular = isPopularPoi(poi);

                  return (
                    <button
                      key={poi.id}
                      type="button"
                      onClick={() => handleFilteredPoiSelection(poi)}
                      className={`group grid w-full grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] items-center gap-3 rounded-[1.35rem] border bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(246,240,230,0.94))] p-3 text-left shadow-[0_14px_28px_rgba(43,52,37,0.06),inset_0_1px_0_rgba(255,255,255,0.92)] transition sm:grid-cols-[8.2rem_1fr_auto] sm:gap-4 sm:rounded-[1.55rem] sm:p-4 ${
                        isSelected
                          ? "border-[#96b184] ring-1 ring-[#d8ca9d]"
                          : "border-[#eadfcb] hover:border-[#d9caac]"
                      }`}
                    >
                      <div className="relative h-[4.8rem] overflow-hidden rounded-[1rem] border border-[#dcca9d]/60 bg-[#e9e1d3] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] sm:h-[5rem] sm:rounded-[1.1rem]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getPoiImage(poi)} alt={poi.name} className="h-full w-full object-cover" />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,248,235,0.18),transparent_45%,rgba(42,69,45,0.12)_100%)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-[#d8cda8] text-white shadow-[0_8px_18px_rgba(33,57,36,0.16)] ${PREMIUM_OLIVE_GRADIENT}`}>
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[1.02rem] font-semibold text-[#213528]">
                              {poi.name}
                            </p>
                            <p className="mt-0.5 text-xs text-[#6f766a]">{meta.label}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-[#eee3d0] bg-white/86 px-2.5 py-1 text-[0.68rem] text-[#405040] shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">{metrics.distance}</span>
                          <span className="rounded-full border border-[#eee3d0] bg-white/86 px-2.5 py-1 text-[0.68rem] text-[#405040] shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">{metrics.duration}</span>
                          {poi.rating ? (
                            <span className="rounded-full border border-[#eee3d0] bg-white/86 px-2.5 py-1 text-[0.68rem] text-[#405040] shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">{poi.rating.toFixed(1)} ★</span>
                          ) : null}
                        </div>
                      </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                        {isPopular ? (
                          <span className="hidden rounded-full border border-[#cfddb9] bg-[#fbfff8] px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[#4f8654] sm:inline-flex">
                            Popular
                          </span>
                        ) : null}
                        <span className="flex size-9 items-center justify-center rounded-full border border-[#e7dcc7] bg-white/82 text-[#415343] transition group-hover:border-[#d4c49f]">
                          <ChevronDown className="-rotate-90 size-5" />
                        </span>
                      </div>
                    </button>
                  );
                })}
                {!visiblePois.length ? (
                  <div className="rounded-2xl border border-[#e8dfd0] bg-white/70 p-6 text-center text-sm text-[#73796f]">
                    No places match your current filters.
                  </div>
                ) : null}
              </div>
            </section>
          </aside>

          <section className="order-1 grid min-w-0 max-w-full gap-5 xl:order-2 xl:min-h-0 xl:grid-rows-[minmax(20rem,0.95fr)_auto_auto]">
            <div className={`relative h-[22rem] w-full min-w-0 max-w-full overflow-hidden rounded-[1.55rem] bg-[#ede6d8] sm:h-[26rem] lg:h-[30rem] xl:h-auto xl:min-h-0 ${PREMIUM_PANEL}`}>
              <div className="pointer-events-none absolute inset-0 z-10 rounded-[1.55rem] shadow-[inset_0_0_0_1px_rgba(245,235,212,0.9),inset_0_0_90px_rgba(244,236,223,0.78)]" />
              <div className="pointer-events-none absolute inset-0 z-10 rounded-[1.55rem] bg-[radial-gradient(circle_at_center,transparent_58%,rgba(244,236,223,0.72)_100%)]" />
              <MapView
                ref={mapRef}
                center={[centerPlace.lng, centerPlace.lat]}
                zoom={15}
                theme="light"
                fadeDuration={0}
                cooperativeGestures
                className="h-full w-full min-w-0 max-w-full"
                onViewportChange={handleViewportChange}
                styles={{ light: MAP_STYLE, dark: MAP_STYLE }}
              >
                <MapControls
                  position="bottom-right"
                  showZoom
                  showCompass
                  showLocate
                  onLocate={handleUserLocate}
                />
                <MapClickClearRoute onClear={clearActiveRoute} suppressRef={suppressNextMapClearRef} />
                {userLocation ? <UserLocationAccuracyLayer location={userLocation} /> : null}
                {userRoute ? (
                  <>
                    <MapRoute id="user-route-outline" coordinates={userRoute.coordinates} color="#ffffff" width={3} opacity={0.6} />
                    <MapRoute id="user-route-base" coordinates={userRoute.coordinates} color={userRouteColor} width={6} opacity={0.18} />
                  </>
                ) : null}
                {userAnimatedCoordinates.length > 1 ? (
                  <MapRoute id="user-route-animated" coordinates={userAnimatedCoordinates} color={userRouteColor} width={5} opacity={1} />
                ) : null}
                {activeRoute ? (
                  <>
                    <MapRoute id="poi-route-outline" coordinates={activeRoute.coordinates} color="#ffffff" width={3} opacity={0.55} />
                    <MapRoute id="poi-route-base" coordinates={activeRoute.coordinates} color={activeRouteColor} width={6} opacity={0.16} />
                  </>
                ) : null}
                {animatedCoordinates.length > 1 ? (
                  <MapRoute id="poi-route-animated" coordinates={animatedCoordinates} color={activeRouteColor} width={5} opacity={1} />
                ) : null}
                {showClusters ? (
                  <MapClusterLayer<ClusterPoiProperties>
                    data={clusterData}
                    clusterRadius={POI_CLUSTER_RADIUS}
                    clusterMaxZoom={POI_CLUSTER_MAX_ZOOM}
                    clusterColors={["#7a8f5a", "#5d7445", "#455933"]}
                    clusterThresholds={[12, 28]}
                    pointColor="#5d7445"
                    onPointClick={handleClusterPointClick}
                  />
                ) : null}
                <MapMarker longitude={centerPlace.lng} latitude={centerPlace.lat}>
                  <MarkerContent>
                    <button
                      type="button"
                      onClick={clearActiveRoute}
                      className="relative flex items-center justify-center"
                      aria-label={centerPlace.name}
                    >
                      <span className="absolute size-16 rounded-full bg-[#6f925f]/20" />
                      <span className="absolute size-10 rounded-full bg-[#6f925f]/30 blur-md" />
                      <span className="relative size-7 rounded-full border-[6px] border-white bg-[#315238] shadow-[0_0_0_12px_rgba(103,137,90,0.18)]" />
                    </button>
                  </MarkerContent>
                </MapMarker>
                {userLocation ? (
                  <MapMarker longitude={userLocation.longitude} latitude={userLocation.latitude}>
                    <MarkerContent>
                      <div className="relative flex items-center justify-center">
                        <div className="absolute size-8 animate-ping rounded-full bg-[#315238]/20" />
                        <div className="relative size-4 rounded-full border-2 border-white bg-[#315238] shadow-[0_0_0_6px_rgba(49,82,56,0.18)]" />
                      </div>
                    </MarkerContent>
                  </MapMarker>
                ) : null}
                {!showClusters
                  ? visiblePois.map((poi) => (
                      <PoiMarker
                        key={poi.id}
                        poi={poi}
                        isSelected={selectedDisplayPoi?.id === poi.id}
                        onMarkerClick={handlePoiMarkerClick}
                      />
                    ))
                  : null}
              </MapView>
            </div>

            <div className="grid min-w-0 max-w-full gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <article className="h-full min-w-0 max-w-full overflow-hidden rounded-[1.55rem]">
                <div className="grid h-full min-h-[20rem] grid-rows-[minmax(0,1fr)_4.25rem] gap-3 overflow-hidden sm:min-h-[15.5rem] sm:grid-cols-[minmax(0,1fr)_4.4rem] sm:grid-rows-none">
                  <div className="relative min-h-0 overflow-hidden rounded-[1.25rem] bg-[#e9e1d3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedMainImage}
                      alt={selectedDisplayPoi?.name ?? "Selected place"}
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,248,235,0.18),transparent_45%,rgba(42,69,45,0.12)_100%)]" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/LEAF UI.png"
                      alt=""
                      className="pointer-events-none absolute -left-5 bottom-0 h-28 w-auto opacity-[0.18] mix-blend-multiply"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-4 z-20 flex size-11 items-center justify-center rounded-full bg-[#fffdf8]/88 text-[#425143] shadow-[0_10px_22px_rgba(43,52,37,0.12)]"
                      aria-label="Close selected place"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  <div className="flex min-h-0 gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:pb-0">
                    {selectedPoiImages.map((image, index) => {
                      const isActive = image === selectedMainImage;

                      return (
                        <button
                          key={`${image}-${index}`}
                          type="button"
                          onClick={() =>
                            selectedDisplayPoi &&
                            setActivePoiImage({
                              poiId: selectedDisplayPoi.id,
                              image,
                            })
                          }
                          className={`relative aspect-square h-full shrink-0 overflow-hidden rounded-[0.9rem] border bg-[#e9e1d3] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition sm:h-auto sm:w-full ${
                            isActive
                              ? "border-[#5d7445] ring-2 ring-[#c7d7b8]"
                              : "border-[#dcca9d]/70 hover:border-[#9fb587]"
                          }`}
                          aria-label={`View image ${index + 1} for ${selectedDisplayPoi?.name ?? "selected place"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>

              <article className={`relative overflow-hidden rounded-[1.55rem] p-5 2xl:p-6 ${PREMIUM_PANEL}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/LEAF UI.png"
                  alt=""
                  className="pointer-events-none absolute -right-6 top-0 h-36 w-auto opacity-[0.15] mix-blend-multiply"
                />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <span className={`flex size-12 shrink-0 items-center justify-center rounded-full border border-[#d8cda8] text-white shadow-[0_10px_20px_rgba(43,52,37,0.14)] ${PREMIUM_OLIVE_GRADIENT}`}>
                      <SelectedIcon className="size-6" />
                    </span>
                    <div>
                      <h2 className={`${displaySerif.className} text-2xl font-semibold leading-tight text-[#263b2b] 2xl:text-3xl`}>
                        {selectedDisplayPoi?.name ?? "Explore Nearby"}
                      </h2>
                      <p className="mt-1 text-sm text-[#777b73]">{selectedMeta.label}</p>
                    </div>
                  </div>
                  {selectedIsPopular ? (
                    <span className="rounded-full border border-[#b9d5ba] bg-[#f9fff7] px-4 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.05em] text-[#2f9a5c]">
                      Popular
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <MetricPill icon={LocateFixed}>{selectedRouteMetrics.distance}</MetricPill>
                  <MetricPill icon={Clock3}>{selectedRouteMetrics.duration}</MetricPill>
                  <MetricPill icon={Star}>{selectedDisplayPoi?.rating?.toFixed(1) ?? "4.4"}</MetricPill>
                </div>
                <p className="mt-5 max-w-[42rem] text-sm leading-6 text-[#757b72]">
                  {detailDescription}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => selectedDisplayPoi && handleViewRoute(selectedDisplayPoi)}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(50,79,45,0.24)] ${PREMIUM_OLIVE_BUTTON}`}
                  >
                    <Navigation className="size-4" />
                    Get Directions
                  </button>
                  <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#e6ddce] bg-[#fffdf8] px-4 text-xs font-semibold text-[#405040]">
                    <Heart className="size-4" />
                    Save
                  </button>
                  <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#e6ddce] bg-[#fffdf8] px-4 text-xs font-semibold text-[#405040]">
                    <Share2 className="size-4" />
                    Share
                  </button>
                </div>
              </article>
            </div>

            <section className={`rounded-[1.55rem] p-5 ${PREMIUM_PANEL}`}>
              <h2 className="mb-5 text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-[#405040]">
                Nearby at this location
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {nearbyAmenities.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${item.bg}`}>
                        <Icon className={`size-5 ${item.color}`} />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-[#303d33]">{item.label}</p>
                        <p className="mt-1 text-xs text-[#777b73]">{item.distance}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </section>
        </div>
      </section>

      {(isLoading || isUserRouteLoading) && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
          <div className="rounded-full border border-[#e3dacb] bg-[#fffdf8]/92 px-5 py-3 text-[#263b2b] shadow-xl backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-[#41683f]" />
              <span className="text-sm text-[#596659]">
                {isUserRouteLoading
                  ? "Tracing your route to Trifecta Veranza..."
                  : "Loading Trifecta Veranza Map..."}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
