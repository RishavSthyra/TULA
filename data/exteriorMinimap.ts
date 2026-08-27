export type ExteriorMinimapCoordinate = {
  x: number;
  y: number;
};

export type ExteriorMinimapLocation = {
  id: string;
  name: string;
  coordinate: ExteriorMinimapCoordinate;
  exteriorAmenityId?: string;
};

export const EXTERIOR_MINIMAP_IMAGE_URL =
  "https://cdn.sthyra.com/TULA/Images/Mini%20Map%20final.avif";

// World-space calibration supplied in metres. Three corners are enough to
// preserve the minimap's angled right edge with an affine projection.
export const EXTERIOR_MINIMAP_BOUNDS = {
  topLeft: {
    x: -139.546,
    y: 110.85,
  },
  topRight: {
    x: 174.211,
    y: 110.85,
  },
  bottomRight: {
    x: 145.597,
    y: -106.671,
  },
} as const;

export const EXTERIOR_MINIMAP_IMAGE_LAYOUT = {
  width: 2982,
  height: 2110,
} as const;

// Pano node positions are exported in centimetres; minimap calibration and
// location coordinates are provided in metres.
export const EXTERIOR_PANO_WORLD_UNITS_PER_METRE = 100;

// This list is intentionally independent from the Amenities page and the
// exterior walkthrough menu. `exteriorAmenityId` only enables navigation for
// a marker that already has an exterior walkthrough destination.
export const EXTERIOR_MINIMAP_LOCATIONS: ExteriorMinimapLocation[] = [
  {
    id: "clubhouse",
    name: "Clubhouse",
    coordinate: { x: 128.616, y: 74.46 },
    exteriorAmenityId: "clubhouse",
  },
  {
    id: "play-lawn",
    name: "Play Lawn",
    coordinate: { x: 60.263, y: 21.173 },
    exteriorAmenityId: "play-lawn",
  },
  {
    id: "amphitheater",
    name: "Amphitheater",
    coordinate: { x: 48.812, y: -3.737 },
    exteriorAmenityId: "amphitheater",
  },
  {
    id: "kids-play-area",
    name: "Kids Play Area",
    coordinate: { x: 50.821, y: -21.415 },
    exteriorAmenityId: "children-park",
  },
  {
    id: "swimming-pool",
    name: "Swimming Pool",
    coordinate: { x: -1.811, y: 30.816 },
    exteriorAmenityId: "swimming-pool",
  },
  {
    id: "gazebo",
    name: "Gazebo",
    coordinate: { x: 24.103, y: 24.588 },
  },
  {
    id: "pool-bar-area",
    name: "Pool Bar Area",
    coordinate: { x: 14.066, y: 21.776 },
  },
  {
    id: "pet-park",
    name: "Pet Park",
    coordinate: { x: -63.215, y: 43.936 },
  },
  {
    id: "fountain-and-mosaic-trees",
    name: "Fountain and Mosaic Trees",
    coordinate: { x: -84.806, y: 87.687 },
  },
  {
    id: "butterfly-garden",
    name: "Butterfly Garden",
    coordinate: { x: -43.754, y: 90.457 },
    exteriorAmenityId: "butterfly-garden",
  },
  {
    id: "sports-area",
    name: "Sports Area",
    coordinate: { x: 103.898, y: -69.087 },
  },
];
