"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  CalendarDays,
  Cross,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  School,
  Store,
  Trees,
  BusFront,
  Landmark,
  X,
  LocateFixed,
  Clock3,
  Star,
  Navigation,
  Heart,
  Share2,
  ListFilter,
  Grid2x2,
  Layers3,
} from "lucide-react";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
const CARTO_MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

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
type MapDisplayMode = "normal" | "carto" | "3d";

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
const FLOATING_PANEL =
  "rounded-[1.6rem] border border-[rgba(75,95,60,0.14)] bg-[rgba(251,249,243,0.94)] shadow-[0_8px_30px_rgba(41,52,35,0.08),0_2px_8px_rgba(41,52,35,0.04)] backdrop-blur-xl";
const FLOATING_BUTTON =
  "inline-flex items-center justify-center rounded-full border border-[rgba(75,95,60,0.14)] bg-[rgba(251,249,243,0.94)] text-[#304638] shadow-[0_8px_30px_rgba(41,52,35,0.08),0_2px_8px_rgba(41,52,35,0.04)] backdrop-blur-xl transition hover:bg-white";
const FLOATING_GHOST_PANEL =
  "rounded-[1.6rem] border border-transparent bg-transparent shadow-none backdrop-blur-0";
const OVERLAY_TRANSITION =
  "transition duration-200 ease-out data-[state=closed]:translate-y-2 data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0 data-[state=open]:translate-y-0 data-[state=open]:scale-100 data-[state=open]:opacity-100";

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
          {isSelected ? (
            <>
              <span className="absolute size-16 rounded-full bg-[#6a8a5d]/16" />
              <span className="absolute size-11 rounded-full bg-[#6a8a5d]/20" />
            </>
          ) : null}
          <span
            className={`relative flex items-center justify-center rounded-full border shadow-[0_8px_18px_rgba(47,73,50,0.18)] transition ${
              isSelected
                ? `h-9 w-9 border-[rgba(229,219,190,0.9)] ${PREMIUM_OLIVE_GRADIENT}`
                : "h-8 w-8 border-[rgba(229,219,190,0.82)] bg-[#fffaf0]"
            }`}
          >
            <Icon className={`size-4 ${isSelected ? "text-white" : "text-[#41593e]"}`} />
          </span>
        </button>
      </MarkerContent>
      <MarkerTooltip
        offset={10}
        className={`rounded-full border border-[#e4d8b7] bg-[#fffaf0] px-3 py-1 text-[0.68rem] font-semibold text-[#31482d] shadow-[0_10px_24px_rgba(43,52,37,0.12)] ${isSelected ? "opacity-100" : ""}`}
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

function ThreeDBuildingsLayer({
  active,
}: {
  active: boolean;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "openfreemap-3d-buildings";
    const layerId = "openfreemap-3d-buildings-layer";

    const removeBuildings = () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore style teardown races
      }
    };

    if (!active) {
      removeBuildings();
      return;
    }

    const layers = map.getStyle().layers ?? [];
    const labelLayerId = layers.find(
      (layer) => layer.type === "symbol" && Boolean(layer.layout?.["text-field"]),
    )?.id;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
      });
    }

    if (!map.getLayer(layerId)) {
      map.addLayer(
        {
          id: layerId,
          type: "fill-extrusion",
          source: sourceId,
          "source-layer": "building",
          minzoom: 15,
          filter: ["!=", ["get", "hide_3d"], true],
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "render_height"],
              0,
              "#d7d6cf",
              60,
              "#c9ccb8",
              160,
              "#b3b89e",
            ],
            "fill-extrusion-opacity": 0.92,
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              16,
              ["get", "render_height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              16,
              ["coalesce", ["get", "render_min_height"], 0],
            ],
          },
        },
        labelLayerId,
      );
    }

    return () => {
      removeBuildings();
    };
  }, [active, isLoaded, map]);

  return null;
}

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
  className,
  selectClassName,
  iconClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  icon: React.ComponentType<{ className?: string }>;
  ariaLabel: string;
  className?: string;
  selectClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Icon
        className={`pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#55684a] ${iconClassName ?? ""}`}
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        className={`h-11 w-full appearance-none rounded-full border border-[#e2d8c4] bg-[rgba(255,253,248,0.96)] pl-10 pr-10 text-sm font-medium text-[#304238] outline-none transition focus:border-[#cbbd8c] ${selectClassName ?? ""}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[#55684a] ${iconClassName ?? ""}`}
      />
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
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [showFilters, setShowFilters] = useState(true);
  const [showPopular, setShowPopular] = useState(true);
  const [showPoiDetails, setShowPoiDetails] = useState(false);
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(true);
  const [mobilePopularExpanded, setMobilePopularExpanded] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<PoiCategory[]>(
    DEFAULT_SELECTED_CATEGORIES,
  );
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("5km");
  const [sortMode, setSortMode] = useState<SortMode>("popularity");
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>("normal");
  const isMobileLayout = viewportWidth < 768;
  const isTabletLayout = viewportWidth >= 768 && viewportWidth < 1280;
  const isCompactDesktop = viewportWidth >= 1280 && viewportWidth < 1560;
  const filterInsetClass = "left-4 right-4 top-4";
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
    const syncViewportWidth = () => {
      const nextWidth = window.innerWidth;
      setViewportWidth(nextWidth);

      if (nextWidth < 768) {
        setMobilePopularExpanded(false);
        setIsMobileFiltersOpen(false);
      }
    };

    syncViewportWidth();
    window.addEventListener("resize", syncViewportWidth);

    return () => {
      window.removeEventListener("resize", syncViewportWidth);
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
    const q = "";
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
  }, [poiIndexes.byCategory, selectedCategories]);

  const visiblePois = useMemo(() => {
    const thresholdMeters =
      distanceFilter === "5km" ? 5000 : distanceFilter === "10km" ? 10000 : Number.POSITIVE_INFINITY;

    const nextPois = filteredPois.filter((poi) => {
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
  }, [distanceFilter, filteredPois, routeLookup, sortMode]);

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
    setShowPoiDetails(true);
    setShowDesktopSidebar(false);
    setMobilePopularExpanded(false);

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
    setSelectedCategories(DEFAULT_SELECTED_CATEGORIES);
    setDistanceFilter("5km");
    setSortMode("popularity");
    setMapDisplayMode("normal");
    setShowFilters(true);
    setShowPopular(true);
    setShowPoiDetails(false);
    setShowDesktopSidebar(true);
    mapRef.current?.flyTo?.({
      center: [centerPlace.lng, centerPlace.lat],
      zoom: 15,
      duration: 1200,
    });
  }, []);

  const clearActiveRoute = useCallback(() => {
    setRoutePoiId(null);
    setSelectedPoiId(null);
    setShowPoiDetails(false);
    setShowDesktopSidebar(true);
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
    setShowPoiDetails(true);
    setShowDesktopSidebar(false);

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
      setShowPoiDetails(true);
      setShowDesktopSidebar(false);
      setMobilePopularExpanded(false);

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
  const desktopSidebarVisible = !isMobileLayout && showDesktopSidebar && !showPoiDetails;
  const desktopSidebarWidthClass = isTabletLayout
    ? "w-[20rem]"
    : isCompactDesktop
      ? "w-[23rem]"
      : "w-[28rem]";
  const desktopSidebarPanelPaddingClass = isTabletLayout ? "p-4" : isCompactDesktop ? "p-4.5" : "p-5";
  const desktopSidebarHeaderEyebrowClass = isTabletLayout
    ? "text-[0.64rem] tracking-[0.18em]"
    : isCompactDesktop
      ? "text-[0.68rem] tracking-[0.2em]"
      : "text-[0.72rem] tracking-[0.22em]";
  const desktopSidebarTitleClass = isTabletLayout
    ? "text-[2rem] leading-[0.94]"
    : isCompactDesktop
      ? "text-[2.25rem] leading-[0.93]"
      : "text-[2.6rem] leading-[0.92]";
  const desktopSidebarBodyCopyClass = isTabletLayout
    ? "max-w-[11rem] text-[0.92rem] leading-6"
    : isCompactDesktop
      ? "max-w-[12rem] text-[0.96rem] leading-6"
      : "max-w-[13rem] text-sm leading-6";
  const desktopSidebarActionTextClass = isTabletLayout ? "text-[0.92rem]" : "text-sm";
  const desktopSidebarCloseButtonClass = isTabletLayout ? "size-10" : "size-11";
  const desktopSidebarTileGridClass = isTabletLayout ? "gap-2" : "gap-2.5";
  const desktopSidebarTileClass = isTabletLayout
    ? "rounded-[1rem] px-2 py-2 text-[0.8rem]"
    : isCompactDesktop
      ? "rounded-[1.05rem] px-2.5 py-2.5 text-[0.86rem]"
      : "rounded-[1.1rem] px-2.5 py-2.5 text-[0.92rem]";
  const desktopSidebarTileIconWrapClass = isTabletLayout
    ? "size-7 rounded-[0.8rem]"
    : isCompactDesktop
      ? "size-7.5 rounded-[0.9rem]"
      : "size-8 rounded-[0.95rem]";
  const desktopSidebarTileIconClass = isTabletLayout
    ? "size-4"
    : isCompactDesktop
      ? "size-[1.05rem]"
      : "size-[1.125rem]";
  const desktopSidebarTileLabelClass = isTabletLayout
    ? "max-w-[4.4rem] whitespace-nowrap text-[0.68rem]"
    : isCompactDesktop
      ? "max-w-[5rem] whitespace-nowrap text-[0.72rem]"
      : "max-w-[5.4rem] whitespace-nowrap text-[0.76rem]";
  const desktopSidebarFilterLabelClass = isTabletLayout
    ? "text-[0.64rem] tracking-[0.18em]"
    : isCompactDesktop
      ? "text-[0.68rem] tracking-[0.2em]"
      : "text-[0.72rem] tracking-[0.22em]";
  const desktopSidebarControlHeightClass = isTabletLayout ? "h-10" : "h-12";
  const desktopSidebarControlTextClass = isTabletLayout ? "text-[0.95rem]" : "text-sm";
  const desktopSidebarControlRadiusClass = isTabletLayout ? "rounded-[1rem]" : "rounded-[1.1rem]";
  const desktopSidebarControlIconClass = isTabletLayout ? "text-[#d7dfcb] size-3.5" : "text-[#d7dfcb]";
  const activeMapStyle = mapDisplayMode === "carto" ? CARTO_MAP_STYLE : MAP_STYLE;
  const activeProjection = { type: "mercator" } as const;
  const popularPanelPaddingClass = isTabletLayout ? "p-3.5" : "p-4";
  const popularPanelTitleClass = isTabletLayout ? "text-[1.5rem]" : "text-lg";
  const popularPanelDescriptionClass = isTabletLayout ? "text-[0.72rem]" : "text-xs";
  const popularItemImageClass = isTabletLayout ? "h-[4.2rem] w-[4.4rem]" : "h-[4.8rem] w-[5.2rem]";
  const popularItemTitleClass = isTabletLayout ? "text-[0.9rem]" : "text-[0.98rem]";
  const popularItemMetaClass = isTabletLayout ? "text-[0.68rem]" : "text-[0.72rem]";
  const popularItemArrowClass = isTabletLayout ? "size-8" : "size-9";
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
  const extraImageCount = Math.max(selectedPoiImages.length - 3, 0);
  const sidePreviewImages = selectedPoiImages.slice(1, 3);
  const topCategories = useMemo(
    () => [
      { id: "all", label: "All", icon: Grid2x2, active: selectedCategories.length === CATEGORY_ORDER.length },
      ...CATEGORY_ORDER.map((category) => ({
        id: category,
        label: categoryMeta[category].label,
        icon: categoryMeta[category].icon,
        active: selectedCategories.includes(category),
      })),
    ],
    [selectedCategories],
  );
  const desktopSidebarCategories = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        id: category,
        label: categoryMeta[category].label,
        icon: categoryMeta[category].icon,
        active: selectedCategories.includes(category),
      })),
    [selectedCategories],
  );
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const timeoutId = window.setTimeout(() => {
      map.easeTo({
        pitch: mapDisplayMode === "3d" ? 55 : 0,
        bearing: mapDisplayMode === "3d" ? -18 : 0,
        duration: 900,
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [mapDisplayMode]);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#f3efe6] text-[#263b2b]">
      <div className="absolute inset-0">
        <MapView
          ref={mapRef}
          center={[centerPlace.lng, centerPlace.lat]}
          zoom={15}
          theme="light"
          projection={activeProjection}
          canvasContextAttributes={{ antialias: true }}
          fadeDuration={0}
          className="h-full w-full"
          onViewportChange={handleViewportChange}
          styles={{ light: activeMapStyle, dark: activeMapStyle }}
        >
          <ThreeDBuildingsLayer active={mapDisplayMode === "3d"} />
          <MapControls
            position="bottom-right"
            showZoom
            showCompass
            showLocate
            onLocate={handleUserLocate}
            className={
              isMobileLayout
                ? `right-4 ${showPoiDetails ? "bottom-[22rem]" : showPopular && mobilePopularExpanded ? "bottom-[20rem]" : "bottom-[8.75rem]"}`
                : `right-6 ${showPoiDetails ? "bottom-[26rem]" : "bottom-8"}`
            }
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://cdn.sthyra.com/TULA/Images/Whisper_of_Tree_Logo_Gold%202.avif"
                  alt={centerPlace.name}
                  className="h-16 w-16 object-contain"
                />
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
                  isSelected={selectedPoiId === poi.id}
                  onMarkerClick={handlePoiMarkerClick}
                />
              ))
            : null}
        </MapView>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(248,245,236,0.96)_0%,rgba(248,245,236,0.52)_16%,rgba(248,245,236,0.06)_44%,transparent_58%),radial-gradient(circle_at_80%_86%,rgba(248,245,236,0.58)_0%,rgba(248,245,236,0.18)_24%,transparent_48%)]" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        {isMobileLayout ? (
          showFilters ? (
            <section
              className={`absolute ${filterInsetClass} max-w-[calc(100vw-2rem)] ${OVERLAY_TRANSITION}`}
              data-state="open"
            >
              <div className={`pointer-events-auto ${FLOATING_PANEL} p-3 ${isMobileLayout ? "rounded-[1.35rem]" : "rounded-[1.6rem]"}`}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {topCategories.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (item.id === "all") {
                                clearPoiSelection();
                                setSelectedCategories(DEFAULT_SELECTED_CATEGORIES);
                                return;
                              }

                              toggleCategory(item.id as PoiCategory);
                            }}
                            className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.82rem] font-medium transition ${
                              item.active
                                ? `${PREMIUM_OLIVE_GRADIENT} border-[#51663f] text-[#f8f5ec]`
                                : "border-[rgba(75,95,60,0.12)] bg-white/74 text-[#43533f] hover:bg-white"
                            }`}
                          >
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              <Icon className="size-4" />
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {isMobileFiltersOpen ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <PremiumSelect
                          className="min-w-[10.5rem] flex-1 basis-[10.5rem]"
                          value={distanceFilter}
                          onChange={(value) => setDistanceFilter(value as DistanceFilter)}
                          ariaLabel="Filter nearby places by distance"
                          icon={LocateFixed}
                          selectClassName="h-10 text-[0.82rem]"
                          iconClassName="size-3.5"
                          options={[
                            { value: "5km", label: "Within 5 km" },
                            { value: "10km", label: "Within 10 km" },
                            { value: "all", label: "All Distances" },
                          ]}
                        />
                        <PremiumSelect
                          className="min-w-[10.5rem] flex-1 basis-[10.5rem]"
                          value={sortMode}
                          onChange={(value) => setSortMode(value as SortMode)}
                          ariaLabel="Sort nearby places"
                          icon={ChevronUp}
                          selectClassName="h-10 text-[0.82rem]"
                          iconClassName="size-3.5"
                          options={[
                            { value: "popularity", label: "Sort by: Popularity" },
                            { value: "nearest", label: "Sort by: Nearby" },
                            { value: "rating", label: "Sort by: Rating" },
                          ]}
                        />
                        <PremiumSelect
                          className="min-w-[10rem] flex-1 basis-[10rem]"
                          value={mapDisplayMode}
                          onChange={(value) => setMapDisplayMode(value as MapDisplayMode)}
                          ariaLabel="Change map style"
                          icon={Layers3}
                          selectClassName="h-10 text-[0.82rem]"
                          iconClassName="size-3.5"
                          options={[
                            { value: "normal", label: "Map: Normal" },
                            { value: "carto", label: "Map: Carto" },
                            { value: "3d", label: "Map: 3D" },
                          ]}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 xl:self-start">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="whitespace-nowrap px-2 text-sm font-medium text-[#4b5f48] transition hover:text-[#2c3f2b]"
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFilters(false);
                        setIsMobileFiltersOpen(false);
                      }}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[rgba(75,95,60,0.12)] bg-white/75 text-[#4b5f48]"
                      aria-label="Collapse filter controls"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className={`absolute right-4 top-[5.25rem] pointer-events-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium ${FLOATING_BUTTON}`}
            >
              <ListFilter className="size-4" />
              Filters
            </button>
          )
        ) : desktopSidebarVisible ? (
          <section
            className={`absolute right-6 top-6 bottom-6 ${desktopSidebarWidthClass} pointer-events-none ${OVERLAY_TRANSITION}`}
            data-state="open"
          >
            <div className="flex h-full flex-col gap-6 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className={`pointer-events-auto ${FLOATING_GHOST_PANEL} p-0`}>
                <div className={`relative overflow-hidden rounded-[2rem] border border-[#d8bd78]/55 bg-[linear-gradient(180deg,rgba(35,65,42,0.96),rgba(28,54,36,0.98))] text-[#f5ecd7] shadow-[0_18px_38px_rgba(25,55,34,0.22),inset_0_1px_0_rgba(255,255,255,0.14)] ${desktopSidebarPanelPaddingClass}`}>
                  <div className="pointer-events-none absolute inset-[8px] rounded-[1.65rem] border border-[#d9c28a]/18" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/flowerUI.png"
                    alt=""
                    className="pointer-events-none absolute -right-6 -top-3 z-0 h-88 w-auto opacity-40 select-none"
                  />
                  <div className="relative mb-5 flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-semibold uppercase text-[#d7dfcb] ${desktopSidebarHeaderEyebrowClass}`}>
                        Discover Nearby
                      </p>
                      <h2 className={`${displaySerif.className} mt-2 font-semibold text-[#f7f3e8] ${desktopSidebarTitleClass}`}>
                        Explore Places
                      </h2>
                      <p className={`mt-3 text-[#d7dfcb]/80 ${desktopSidebarBodyCopyClass}`}>
                        Everything you need, just moments away.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetFilters}
                        className={`whitespace-nowrap px-2 font-medium text-[#eef2e7] transition hover:text-white ${desktopSidebarActionTextClass}`}
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDesktopSidebar(false)}
                        className={`flex shrink-0 items-center justify-center rounded-full border border-[rgba(235,239,229,0.18)] bg-white/10 text-[#f4f7ee] ${desktopSidebarCloseButtonClass}`}
                        aria-label="Close sidebar"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className={`grid grid-cols-4 ${desktopSidebarTileGridClass}`}>
                    {desktopSidebarCategories.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleCategory(item.id as PoiCategory)}
                          className={`group aspect-square border transition ${desktopSidebarTileClass} ${
                            item.active
                              ? "border-[rgba(225,234,212,0.28)] bg-white/14 text-[#fbf8ef] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                              : "border-[rgba(225,234,212,0.12)] bg-white/5 text-[#d6dec9] hover:bg-white/9"
                          }`}
                        >
                          <span className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
                            <span className={`flex items-center justify-center ${desktopSidebarTileIconWrapClass} ${item.active ? "bg-white/12" : "bg-transparent"}`}>
                              <Icon className={desktopSidebarTileIconClass} />
                            </span>
                            <span className={`leading-tight ${desktopSidebarTileLabelClass}`}>{item.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5">
                    <p className={`font-semibold uppercase text-[#d7dfcb] ${desktopSidebarFilterLabelClass}`}>
                      Quick Filters
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    <PremiumSelect
                      className="w-full"
                      value={distanceFilter}
                      onChange={(value) => setDistanceFilter(value as DistanceFilter)}
                      ariaLabel="Filter nearby places by distance"
                      icon={LocateFixed}
                      iconClassName={desktopSidebarControlIconClass}
                      selectClassName={`${desktopSidebarControlHeightClass} ${desktopSidebarControlRadiusClass} border-[rgba(225,234,212,0.14)] bg-white/7 text-[#f7f3e8] focus:border-[rgba(225,234,212,0.28)] ${desktopSidebarControlTextClass}`}
                      options={[
                        { value: "5km", label: "Within 5 km" },
                        { value: "10km", label: "Within 10 km" },
                        { value: "all", label: "All Distances" },
                      ]}
                    />
                    <PremiumSelect
                      className="w-full"
                      value={sortMode}
                      onChange={(value) => setSortMode(value as SortMode)}
                      ariaLabel="Sort nearby places"
                      icon={ChevronUp}
                      iconClassName={desktopSidebarControlIconClass}
                      selectClassName={`${desktopSidebarControlHeightClass} ${desktopSidebarControlRadiusClass} border-[rgba(225,234,212,0.14)] bg-white/7 text-[#f7f3e8] focus:border-[rgba(225,234,212,0.28)] ${desktopSidebarControlTextClass}`}
                      options={[
                        { value: "popularity", label: "Sort by: Popularity" },
                        { value: "nearest", label: "Sort by: Nearby" },
                        { value: "rating", label: "Sort by: Rating" },
                      ]}
                    />
                    <PremiumSelect
                      className="w-full"
                      value={mapDisplayMode}
                      onChange={(value) => setMapDisplayMode(value as MapDisplayMode)}
                      ariaLabel="Change map style"
                      icon={Layers3}
                      iconClassName={desktopSidebarControlIconClass}
                      selectClassName={`${desktopSidebarControlHeightClass} ${desktopSidebarControlRadiusClass} border-[rgba(225,234,212,0.14)] bg-white/7 text-[#f7f3e8] focus:border-[rgba(225,234,212,0.28)] ${desktopSidebarControlTextClass}`}
                      options={[
                        { value: "normal", label: "Map: Normal" },
                        { value: "carto", label: "Map: Carto" },
                        { value: "3d", label: "Map: 3D" },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <div className={`pointer-events-auto ${FLOATING_GHOST_PANEL} p-0`}>
                <div className={`rounded-[1.8rem] border border-[rgba(255,255,255,0.55)] bg-[rgba(251,249,243,0.9)] shadow-[0_18px_44px_rgba(32,44,27,0.12)] backdrop-blur-xl ${popularPanelPaddingClass}`}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className={`font-semibold text-[#223326] ${popularPanelTitleClass}`}>Popular Nearby</h2>
                      <p className={`mt-1 text-[#6d746b] ${popularPanelDescriptionClass}`}>Browse the best-rated places around the project.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(DEFAULT_SELECTED_CATEGORIES)}
                      className={`whitespace-nowrap font-medium text-[#4c6047] ${desktopSidebarActionTextClass}`}
                    >
                      View all
                    </button>
                  </div>
                  <div className="max-h-[46vh] space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {listedPois.map((poi) => {
                      const meta = categoryMeta[poi.category];
                      const linkedRoute = routeLookup.get(poi.id);
                      const metrics = getDisplayRoute(linkedRoute, poi);
                      const isSelected = selectedPoiId === poi.id;

                      return (
                        <button
                          key={poi.id}
                          type="button"
                          onClick={() => handleFilteredPoiSelection(poi)}
                          className={`group flex w-full items-center gap-3 rounded-[1.2rem] border px-3 py-3 text-left transition ${
                            isSelected
                              ? "border-[#9fb587] bg-white/88"
                              : "border-[rgba(75,95,60,0.08)] bg-white/72 hover:border-[rgba(75,95,60,0.12)] hover:bg-white/88"
                          }`}
                        >
                          <div className={`relative shrink-0 overflow-hidden rounded-[1rem] border border-[rgba(75,95,60,0.14)] bg-[#e9e1d3] ${popularItemImageClass}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getPoiImage(poi)} alt={poi.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate font-semibold text-[#243428] ${popularItemTitleClass}`}>{poi.name}</p>
                            <p className="mt-0.5 text-xs text-[#6f766a]">{meta.label}</p>
                            <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[#4e5e49] ${popularItemMetaClass}`}>
                              <span>{metrics.distance}</span>
                              <span>{metrics.duration}</span>
                              {poi.rating ? <span>{poi.rating.toFixed(1)} ★</span> : null}
                            </div>
                          </div>
                          <span className={`flex shrink-0 items-center justify-center rounded-full border border-[rgba(75,95,60,0.12)] bg-white/82 text-[#445642] ${popularItemArrowClass}`}>
                            <ChevronRight className="size-4" />
                          </span>
                        </button>
                      );
                    })}
                    {!visiblePois.length ? (
                      <div className="rounded-2xl border border-[#e8dfd0] bg-white/70 p-6 text-center text-sm text-[#73796f]">
                        No places match your current filters.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={() => setShowDesktopSidebar(true)}
            className={`absolute right-6 top-6 pointer-events-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium ${FLOATING_BUTTON}`}
          >
            <ListFilter className="size-4" />
            Sidebar
          </button>
        )}

        {!isMobileLayout && showPoiDetails && selectedDisplayPoi ? (
          <section
            className={`absolute bottom-6 right-6 w-[26rem] ${isTabletLayout ? "w-[22rem]" : ""} ${FLOATING_PANEL} ${OVERLAY_TRANSITION}`}
            data-state="open"
          >
            <div className="pointer-events-auto p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(75,95,60,0.12)] bg-white/76 px-3 py-1.5 text-xs font-semibold text-[#41533f]">
                  <SelectedIcon className="size-3.5" />
                  {selectedMeta.label}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[rgba(75,95,60,0.12)] bg-white/78 text-[#4e5e49]"
                    aria-label="Save this place"
                  >
                    <Heart className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={clearActiveRoute}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[rgba(75,95,60,0.12)] bg-white/78 text-[#4e5e49]"
                    aria-label="Close selected place details"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className={`grid gap-3 ${sidePreviewImages.length > 0 || extraImageCount > 0 ? "grid-cols-[minmax(0,1fr)_5.25rem]" : "grid-cols-1"}`}>
                <div className="relative overflow-hidden rounded-[1.2rem] border border-[rgba(75,95,60,0.14)] bg-[#e9e1d3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedMainImage}
                    alt={selectedDisplayPoi.name}
                    className="h-[13rem] w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(42,69,45,0.12))]" />
                </div>
                {sidePreviewImages.length > 0 || extraImageCount > 0 ? (
                  <div className="flex flex-col gap-3">
                    {sidePreviewImages.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() =>
                          setActivePoiImage({
                            poiId: selectedDisplayPoi.id,
                            image,
                          })
                        }
                        className="overflow-hidden rounded-[1rem] border border-[rgba(75,95,60,0.14)] bg-[#e9e1d3]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt="" className="h-[5rem] w-full object-cover" />
                      </button>
                    ))}
                    {extraImageCount > 0 ? (
                      <div className={`flex flex-1 items-center justify-center rounded-[1rem] text-sm font-semibold text-[#f8f5ec] ${PREMIUM_OLIVE_GRADIENT}`}>
                        +{extraImageCount}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-5">
                <h2 className={`${displaySerif.className} text-[2rem] font-semibold leading-tight text-[#253529]`}>
                  {selectedDisplayPoi.name}
                </h2>
                <p className="mt-1 text-sm text-[#70766d]">Bengaluru, Karnataka</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MetricPill icon={LocateFixed}>{selectedRouteMetrics.distance}</MetricPill>
                  <MetricPill icon={Clock3}>{selectedRouteMetrics.duration}</MetricPill>
                  <MetricPill icon={Star}>{selectedDisplayPoi.rating?.toFixed(1) ?? "4.4"}</MetricPill>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#72786f]">{detailDescription}</p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#e6ddce] bg-[#fffdf8] px-4 text-[0.95rem] font-semibold text-[#405040]"
                >
                  <CalendarDays className="size-4" />
                  Schedule Visit
                </button>
                <button className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#e6ddce] bg-[#fffdf8] px-4 text-[0.95rem] font-semibold text-[#405040]">
                  <Share2 className="size-4" />
                  Share
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleViewRoute(selectedDisplayPoi)}
                className={`mt-3 inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[0.98rem] font-semibold text-white shadow-[0_10px_20px_rgba(50,79,45,0.24)] ${PREMIUM_OLIVE_BUTTON}`}
              >
                <Navigation className="size-4" />
                Get Directions
              </button>
            </div>
          </section>
        ) : null}

        {isMobileLayout ? (
          <>
            {showPopular && !showPoiDetails ? (
              <section
                className={`absolute inset-x-3 ${FLOATING_PANEL} ${OVERLAY_TRANSITION}`}
                style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
                data-state="open"
              >
                <div className="pointer-events-auto p-2.5">
                  <button
                    type="button"
                    onClick={() => setMobilePopularExpanded((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left"
                  >
                    <div>
                      <p className="text-[0.92rem] font-semibold text-[#223326]">Popular Nearby</p>
                      <p className="text-[0.72rem] text-[#6d746b]">{mobilePopularExpanded ? "Tap to collapse" : "Swipe through the best nearby places"}</p>
                    </div>
                    <ChevronUp className={`size-3.5 text-[#445642] transition ${mobilePopularExpanded ? "" : "rotate-180"}`} />
                  </button>
                  {mobilePopularExpanded ? (
                    <div className="mt-2 max-h-[48dvh] space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {listedPois.map((poi) => {
                        const meta = categoryMeta[poi.category];
                        const linkedRoute = routeLookup.get(poi.id);
                        const metrics = getDisplayRoute(linkedRoute, poi);

                        return (
                          <button
                            key={poi.id}
                            type="button"
                            onClick={() => handleFilteredPoiSelection(poi)}
                            className="flex w-full items-center gap-2.5 rounded-[1rem] border border-transparent bg-white/55 px-2 py-2 text-left"
                          >
                            <div className="relative h-[3.8rem] w-[4.2rem] shrink-0 overflow-hidden rounded-[0.9rem] border border-[rgba(75,95,60,0.14)] bg-[#e9e1d3]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={getPoiImage(poi)} alt={poi.name} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[0.84rem] font-semibold text-[#243428]">{poi.name}</p>
                              <p className="text-[0.72rem] text-[#6f766a]">{meta.label}</p>
                              <div className="mt-1 flex flex-wrap gap-x-2 text-[0.66rem] text-[#4e5e49]">
                                <span>{metrics.distance}</span>
                                <span>{metrics.duration}</span>
                                {poi.rating ? <span>{poi.rating.toFixed(1)} ★</span> : null}
                              </div>
                            </div>
                            <ChevronRight className="size-3.5 text-[#4d5c49]" />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {showPoiDetails && selectedDisplayPoi ? (
              <section
                className={`absolute inset-x-3 ${FLOATING_PANEL} ${OVERLAY_TRANSITION}`}
                style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
                data-state="open"
              >
                <div className="pointer-events-auto p-3">
                  <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#d8d1c0]" />
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(75,95,60,0.12)] bg-white/80 px-3 py-1 text-xs font-semibold text-[#41533f]">
                      <SelectedIcon className="size-3.5" />
                      {selectedMeta.label}
                    </span>
                    <button
                      type="button"
                      onClick={clearActiveRoute}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[rgba(75,95,60,0.12)] bg-white/78 text-[#4e5e49]"
                      aria-label="Close selected place details"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-[1.2rem] border border-[rgba(75,95,60,0.14)] bg-[#e9e1d3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedMainImage} alt={selectedDisplayPoi.name} className="h-44 w-full object-cover" />
                  </div>
                  <div className="mt-4">
                    <h2 className={`${displaySerif.className} text-[1.8rem] font-semibold leading-tight text-[#253529]`}>
                      {selectedDisplayPoi.name}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <MetricPill icon={LocateFixed}>{selectedRouteMetrics.distance}</MetricPill>
                      <MetricPill icon={Clock3}>{selectedRouteMetrics.duration}</MetricPill>
                      <MetricPill icon={Star}>{selectedDisplayPoi.rating?.toFixed(1) ?? "4.4"}</MetricPill>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#72786f]">{detailDescription}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#e6ddce] bg-[#fffdf8] px-4 text-sm font-semibold text-[#405040]"
                    >
                      <CalendarDays className="size-4" />
                      Schedule Visit
                    </button>
                    <button className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#e6ddce] bg-[#fffdf8] px-4 text-sm font-semibold text-[#405040]">
                      <Share2 className="size-4" />
                      Share
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewRoute(selectedDisplayPoi)}
                    className={`mt-3 inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(50,79,45,0.24)] ${PREMIUM_OLIVE_BUTTON}`}
                  >
                    <Navigation className="size-4" />
                    Get Directions
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

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
