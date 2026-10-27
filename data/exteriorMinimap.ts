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
  viewYawOffsetDegrees?: number;
};

export const EXTERIOR_MINIMAP_IMAGE_URL =
  "https://cdn.sthyra.com/TULA/Images/masterplan%20new%20compressed.avif";

// Maps exterior render-world metres to the replacement 16:9 minimap.
export const EXTERIOR_MINIMAP_PROJECTION = {
  left: {
    x: 0.002544112514,
    y: 0.000672513718,
    offset: 0.493112438728,
  },
  top: {
    x: -0.00042922394,
    y: -0.004846913241,
    offset: 0.524160977532,
  },
} as const;

export const EXTERIOR_MINIMAP_IMAGE_LAYOUT = {
  width: 7680,
  height: 4320,
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
    startingPanoFrame: 2,
    panoFrames: [2],
    viewYawOffsetDegrees: 240,
  },
  {
    id: "clubhouse",
    name: "Clubhouse",
    coordinate: { x: 105.616, y: 45.46 },
    exteriorAmenityId: "clubhouse",
    startingPanoFrame: 241,
    panoFrames: [241],
        viewYawOffsetDegrees: 35,
  },
    {
    id: "yoga",
    name: "Yoga",
    coordinate: { x:-129.806, y: 90.687 },
    exteriorAmenityId: "clubhouse",
    startingPanoFrame: 180,
    panoFrames: [180],
        viewYawOffsetDegrees: 135,
  },
  {
    id: "sports-area",
    name: "Sports Area",
    coordinate: { x: 131.898, y: -65.087 },
    startingPanoFrame: 25,
    panoFrames: [25],
  },
  {
    id: "play-lawn",
    name: "Play Lawn",
    coordinate: { x: 60.263, y: 21.173 },
    exteriorAmenityId: "play-lawn",
    startingPanoFrame: 106,
    panoFrames: [106],
  },
  {
    id: "amphitheater",
    name: "Amphitheater",
    coordinate: { x: 48.812, y: -3.737 },
    exteriorAmenityId: "amphitheater",
    startingPanoFrame: 53,
    panoFrames: [53],
    viewYawOffsetDegrees: 240,
  },
  {
    id: "kids-play-area",
    name: "Kids Play Area",
    coordinate: { x: 70.821, y: -21.415 },
    exteriorAmenityId: "children-park",
    startingPanoFrame: 47,
    panoFrames: [47],
    viewYawOffsetDegrees: 180,
  },
  {
    id: "garden-walk",
    name: "Garden Walk",
    coordinate: { x: 39.35738, y: 12.46738 },
    startingPanoFrame: 59,
    panoFrames: [59],
  },
  {
    id: "swimming-pool",
    name: "Swimming Pool",
    coordinate: { x: -7.8, y: 39.816 },
    exteriorAmenityId: "swimming-pool",
    startingPanoFrame: 75,
    panoFrames: [75],
  },
  {
    id: "gazebo",
    name: "Gazebo",
    coordinate: { x: 14.103, y: 35.588 },
    startingPanoFrame: 80,
    panoFrames: [80],
      viewYawOffsetDegrees: 240,
  },
  {
    id: "pool-bar-area",
    name: "Pool Bar Area",
    coordinate: { x: -17.066, y: 25.776 },
    startingPanoFrame: 70,
    panoFrames: [70],
        viewYawOffsetDegrees: 80,
  },
  {
    id: "pet-park",
    name: "Pet Park",
    coordinate: { x: -63.215, y: 50.936 },
    startingPanoFrame: 167,
    panoFrames: [167],
    viewYawOffsetDegrees: 280,
  },
  {
    id: "fountain-and-mosaic-trees",
    name: "Fountain and Mosaic Trees",
    coordinate: { x: -105.806, y: 93.687 },
    startingPanoFrame: 202,
    panoFrames: [202],
    viewYawOffsetDegrees: 150,
  },
  {
    id: "butterfly-garden",
    name: "Butterfly Garden",
    coordinate: { x: -43.754, y: 90.457 },
    exteriorAmenityId: "butterfly-garden",
    startingPanoFrame: 210,
    panoFrames: [210],
        viewYawOffsetDegrees: 300,
  },
];
