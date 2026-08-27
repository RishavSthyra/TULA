export type ExteriorMinimapCoordinate = {
  x: number;
  y: number;
};

export type ExteriorMinimapLocation = {
  id: string;
  name: string;
  coordinate: ExteriorMinimapCoordinate;
  exteriorAmenityId?: string;
  startingPanoFrame: number;
  panoFrames: number[];
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
// project's full amenity catalogue. The pano fields drive both minimap and
// hamburger quick navigation; `exteriorAmenityId` only reuses existing card
// imagery and descriptive copy when available.
export const EXTERIOR_MINIMAP_LOCATIONS: ExteriorMinimapLocation[] = [
  {
    id: "entrance",
    name: "Entrance",
    coordinate: { x: 151.16409, y: 3.07576 },
    exteriorAmenityId: "entrance",
    startingPanoFrame: 0,
    panoFrames: [0],
  },
  {
    id: "clubhouse",
    name: "Clubhouse",
    coordinate: { x: 128.616, y: 74.46 },
    exteriorAmenityId: "clubhouse",
    startingPanoFrame: 209,
    panoFrames: [209],
  },
  {
    id: "sports-area",
    name: "Sports Area",
    coordinate: { x: 103.898, y: -69.087 },
    startingPanoFrame: 14,
    panoFrames: [14],
  },
  {
    id: "play-lawn",
    name: "Play Lawn",
    coordinate: { x: 60.263, y: 21.173 },
    exteriorAmenityId: "play-lawn",
    startingPanoFrame: 85,
    panoFrames: [85],
  },
  {
    id: "amphitheater",
    name: "Amphitheater",
    coordinate: { x: 48.812, y: -3.737 },
    exteriorAmenityId: "amphitheater",
    startingPanoFrame: 47,
    panoFrames: [47],
  },
  {
    id: "kids-play-area",
    name: "Kids Play Area",
    coordinate: { x: 50.821, y: -21.415 },
    exteriorAmenityId: "children-park",
    startingPanoFrame: 44,
    panoFrames: [44],
  },
  {
    id: "garden-walk",
    name: "Garden Walk",
    coordinate: { x: 39.35738, y: 12.46738 },
    startingPanoFrame: 53,
    panoFrames: [53],
  },
  {
    id: "swimming-pool",
    name: "Swimming Pool",
    coordinate: { x: -1.811, y: 30.816 },
    exteriorAmenityId: "swimming-pool",
    startingPanoFrame: 66,
    panoFrames: [66],
  },
  {
    id: "gazebo",
    name: "Gazebo",
    coordinate: { x: 24.103, y: 24.588 },
    startingPanoFrame: 211,
    panoFrames: [211],
  },
  {
    id: "pool-bar-area",
    name: "Pool Bar Area",
    coordinate: { x: 14.066, y: 21.776 },
    startingPanoFrame: 61,
    panoFrames: [61],
  },
  {
    id: "pet-park",
    name: "Pet Park",
    coordinate: { x: -63.215, y: 43.936 },
    startingPanoFrame: 146,
    panoFrames: [146],
  },
  {
    id: "fountain-and-mosaic-trees",
    name: "Fountain and Mosaic Trees",
    coordinate: { x: -84.806, y: 87.687 },
    startingPanoFrame: 180,
    panoFrames: [180],
  },
  {
    id: "butterfly-garden",
    name: "Butterfly Garden",
    coordinate: { x: -43.754, y: 90.457 },
    exteriorAmenityId: "butterfly-garden",
    startingPanoFrame: 186,
    panoFrames: [186],
  },
];
