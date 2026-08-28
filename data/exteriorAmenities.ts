import amenityCoordinates from "@/data/AminetiesCoordinates.json";
import legacyExteriorNodes from "@/data/trifecta_pano_walkthrough_data_Exterior1.json";
import exteriorNodes from "@/data/TULA Landscape 20082026 PANO_pano_walkthrough_data_2.json";
import { EXTERIOR_PANO_CDN_BASE_PATH } from "@/lib/exterior-tour/assets";
import { exteriorImageFilenameToPanoId } from "@/lib/exterior-tour/nodes";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";

type AmenityCoordinate = {
  x: number;
  y: number;
  z: number;
};

type ExteriorAmenityStartingPanoInput = {
  name: string;
  yaw?: number;
  pitch?: number;
  roll?: number;
  facingAxis?: string;
  angle?: number;
  viewYaw?: number;
  viewPitch?: number;
  viewZoom?: number;
};

export type ExteriorAmenityStartingPano = {
  name: string;
  nodeId: string;
  yaw: number;
  pitch: number;
  roll: number;
  facingAxis?: string;
  angle: number;
  viewYaw: number;
  viewPitch: number;
  viewZoom?: number;
};

type ExteriorAmenityDefinition = {
  id: string;
  name: string;
  coordinateKey?: string;
  image?: string;
  description: string;
  nodeIds: string[];
  primaryNodeId?: string;
  startingPano?: ExteriorAmenityStartingPanoInput;
};

export type ExteriorAmenity = {
  id: string;
  name: string;
  image: string;
  description: string;
  nodeIds: string[];
  primaryNodeId: string;
  startingPano: ExteriorAmenityStartingPano;
  coordinate: AmenityCoordinate;
  summary: string;
};

const coordinateMap = amenityCoordinates as Record<string, AmenityCoordinate>;
const exteriorNodeSources = exteriorNodes as ExteriorPanoNodeSource[];
const legacyExteriorNodeSources = legacyExteriorNodes as ExteriorPanoNodeSource[];

function isIgnoredPanoId(value: string) {
  return /\.0000(?:\.[^/.]+)?$/i.test(value);
}

function normalizePanoNodeId(panoId: string) {
  const withoutExtension = panoId.replace(/\.[^.]+$/, "");

  if (isIgnoredPanoId(withoutExtension)) {
    return null;
  }

  return withoutExtension.replace(/^LS_/, "");
}

const exteriorNodeSourceMap = new Map<string, ExteriorPanoNodeSource>(
  exteriorNodeSources.map((node) => [node.id, node]),
);
const legacyExteriorNodeSourceMap = new Map<string, ExteriorPanoNodeSource>(
  legacyExteriorNodeSources.map((node) => [node.id, node]),
);
const availableNodeIds = new Set(exteriorNodeSourceMap.keys());
const remappedLegacyNodeIds = new Map<string, string>();

function resolveAvailablePanoNodeId(panoId: string) {
  const normalizedNodeId = normalizePanoNodeId(panoId);

  if (!normalizedNodeId) {
    return null;
  }

  if (availableNodeIds.has(normalizedNodeId)) {
    return normalizedNodeId;
  }

  const cachedNodeId = remappedLegacyNodeIds.get(normalizedNodeId);
  if (cachedNodeId) {
    return cachedNodeId;
  }

  const legacyNode = legacyExteriorNodeSourceMap.get(normalizedNodeId);
  if (!legacyNode) {
    return null;
  }

  let nearestNodeId: string | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const candidate of exteriorNodeSources) {
    const deltaX = candidate.x - legacyNode.x;
    const deltaY = candidate.y - legacyNode.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearestNodeId = candidate.id;
    }
  }

  if (nearestNodeId) {
    remappedLegacyNodeIds.set(normalizedNodeId, nearestNodeId);
  }

  return nearestNodeId;
}

function pano(panoId: string) {
  const nodeId = normalizePanoNodeId(panoId);

  if (!nodeId) {
    throw new Error(`Ignored exterior pano "${panoId}"`);
  }

  return nodeId;
}

function range(prefix: string, start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) =>
    pano(`${prefix}${String(start + index).padStart(4, "0")}`),
  );
}

const exteriorNodeCoordinateMap = new Map<string, AmenityCoordinate>(
  exteriorNodeSources
    .filter(
      (node) =>
        !isIgnoredPanoId(node.id) && !isIgnoredPanoId(node.image_filename),
    )
    .map((node) => [
      node.id,
      {
        x: node.x,
        y: node.y,
        z: node.z,
      },
    ]),
);

function startingPano(
  name: string,
  options: Omit<ExteriorAmenityStartingPanoInput, "name"> = {},
): ExteriorAmenityStartingPanoInput {
  return {
    name,
    ...options,
  };
}

function ids(...groups: Array<string | string[]>) {
  const resolved: string[] = [];

  for (const id of groups.flat()) {
    const nodeId = resolveAvailablePanoNodeId(id);

    if (!nodeId || !availableNodeIds.has(nodeId) || resolved.includes(nodeId)) {
      continue;
    }

    resolved.push(nodeId);
  }

  return resolved;
}

function getAmenityCoordinate(
  amenity: ExteriorAmenityDefinition,
  primaryNodeId: string,
) {
  if (amenity.coordinateKey) {
    const coordinate = coordinateMap[amenity.coordinateKey];

    if (coordinate) {
      return coordinate;
    }
  }

  const nodeCoordinate = exteriorNodeCoordinateMap.get(primaryNodeId);

  if (!nodeCoordinate) {
    throw new Error(`Missing amenity coordinate for "${amenity.name}"`);
  }

  return nodeCoordinate;
}

function createSummary(nodeIds: string[]) {
  return `${nodeIds.length} pano ${nodeIds.length === 1 ? "stop" : "stops"}`;
}

export const AMENITY_IMAGE_PLACEHOLDER_URL =
  "images/amenities-compressed/preview/Amphi Theatre.avif";

const amenityDefinitions: ExteriorAmenityDefinition[] = [
  {
    id: "entrance",
    name: "Entrance",
    description:
      "The main arrival sequence into the community, starting at the exterior entry approach.",
    primaryNodeId: pano("LS_BP_panoPath_Exterior_GateEntry_F0001"),
    startingPano: startingPano("LS_BP_panoPath_Exterior_GateEntry_F0001", {
      yaw: -0.0669,
      pitch: 0.4123,
      angle: -1.231,
      viewPitch: 0.714,
    }),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Entry_F", 168, 175),
      pano("LS_BP_panoPath_Exterior2_F0161"),
    ),
  },
  {
    id: "cycle-track",
    name: "Cycle Track",
    coordinateKey: "Wide Cycling Track",
    description:
      "A connected cycling route running through the exterior movement spine and garden edges.",
startingPano: startingPano("LS_BP_panoPath_Exterior_Entry_F0180", {
  yaw: -18.9624,
  pitch: -1.3364,
  angle: -18.9624,
  viewPitch: -1.3364,
}),

    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Entry_F", 176, 178),
      pano("LS_BP_panoPath_Exterior_Entry_F0180"),
      pano("LS_BP_panoPath_Exterior_Entry_F0200"),
      range("LS_BP_panoPath_Exterior_TowerA_Walk_F", 108, 110),
      pano("LS_BP_panoPath_Exterior_TowerA_Walk_F0118"),
      pano("LS_BP_panoPath_Exterior_TowerA_Walk_F0128"),
      pano("LS_BP_panoPath_Exterior2_F0162"),
      pano("LS_BP_panoPath_Exterior2_F0167"),
      range("LS_BP_panoPath_Exterior41_F", 141, 144),
    ),
  },
  {
    id: "general",
    name: "General",
    description:
      "Shared exterior context stops that connect the broader landscape and tower-side routes.",
    startingPano: startingPano("LS_BP_panoPath_Exterior_Transformers_F0133"),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior_Transformers_F0133"),
      range("LS_BP_panoPath_Exterior2_F", 162, 166),
      pano("LS_BP_panoPath_Exterior4_F0013"),
      pano("LS_BP_panoPath_Exterior4_F0014"),
      pano("LS_BP_panoPath_Exterior11_F0042"),
      range("LS_BP_panoPath_Exterior35_F", 104, 107),
    ),
  },
  {
    id: "business-lounge",
    name: "Business Lounge",
    coordinateKey: "Bussiness Lounge",
    description:
      "A composed lounge-side exterior pocket connected to the entry and clubhouse edge.",
startingPano: startingPano("LS_BP_panoPath_Exterior6_F0020", {
  yaw: -112.1653,
  pitch: -0.4468,
  angle: -112.1653,
  viewPitch: -0.4468,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior_Entry_F0179"),
      range("LS_BP_panoPath_Exterior6_F", 19, 21),
    ),
  },
  {
    id: "camp-fire",
    name: "Camp Fire",
    coordinateKey: "CampFire",
    image:
      "images/amenities-compressed/preview/CampFire.avif",
    description:
      "A warm outdoor gathering setting for evening conversations and relaxed community moments.",
startingPano: startingPano("LS_BP_panoPath_Exterior_Entry_F0181", {
  yaw: 94.7766,
  pitch: -2.522,
  angle: 94.7766,
  viewPitch: -2.522,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior_Entry_F0181"),
      pano("LS_BP_panoPath_Exterior0_F0152"),
      range("LS_BP_panoPath_Exterior6_F", 22, 23),
      range("LS_BP_panoPath_Exterior34_F", 101, 102),
      range("LS_BP_panoPath_Exterior38_F", 150, 151),
    ),
  },
  {
    id: "zen-garden",
    name: "Zen Garden",
    coordinateKey: "Zen Garden",
    image:
      "images/amenities-compressed/preview/Zen garden.avif",
    description:
      "A quiet garden sequence with meditative planting, soft paths, and calm pause points.",
startingPano: startingPano("LS_BP_panoPath_Exterior6_F0024", {
  yaw: -51.7306,
  pitch: -0.4398,
  angle: -51.7306,
  viewPitch: -0.4398,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Entry_F", 182, 183),
      range("LS_BP_panoPath_Exterior0_F", 152, 154),
      range("LS_BP_panoPath_Exterior6_F", 24, 25),
    ),
  },
  {
    id: "meditation-deck",
    name: "Meditation Deck",
    description:
      "A calm deck zone placed along the deeper garden route for slower, quieter use.",
startingPano: startingPano("LS_BP_panoPath_Exterior_Entry_F0186", {
  yaw: -101.2601,
  pitch: 1.0588,
  angle: -101.2601,
  viewPitch: 1.0588,
}),

    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Entry_F", 183, 185),
      pano("LS_BP_panoPath_Exterior6_F0026"),
      range("LS_BP_panoPath_Exterior41_F", 141, 143),
      range("LS_BP_panoPath_Exterior42_F", 145, 146),
    ),
  },
  {
    id: "pergola-pathway",
    name: "Pergola Pathway",
    description:
      "A shaded pathway sequence linking the landscaped garden stops and seating edges.",
    startingPano: startingPano("LS_BP_panoPath_Exterior29_F0087"),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Entry_F", 186, 188),
      range("LS_BP_panoPath_Exterior29_F", 87, 88),
    ),
  },
  {
    id: "water-cascade",
    name: "Water Cascade",
    description:
      "A water-feature zone with connected entry path and garden-side viewing stops.",
startingPano: startingPano("LS_BP_panoPath_Exterior17_F0139", {
  yaw: 50.7612,
  pitch: 1.1965,
  angle: 50.7612,
  viewPitch: 1.1965,
}),

    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Entry_F", 189, 191),
      range("LS_BP_panoPath_Exterior17_F", 139, 140),
      pano("LS_BP_panoPath_Exterior41_F0144"),
    ),
  },
  {
    id: "pergola-sitting",
    name: "Pergola Sitting",
    description:
      "A pergola seating pocket placed near the water cascade and garden circulation.",
startingPano: startingPano("LS_BP_panoPath_Exterior_Entry_F0191", {
  yaw: 104.8923,
  pitch: 0.1533,
  angle: 104.8923,
  viewPitch: 0.1533,
}),

    nodeIds: ids(range("LS_BP_panoPath_Exterior_Entry_F", 189, 191)),
  },
  {
    id: "picnic-lawn",
    name: "Picnic Lawn",
    coordinateKey: "PicnicLawn",
    image:
      "images/amenities-compressed/preview/Picnic Lawn.avif",
    description:
      "A relaxed lawn setting for casual picnics, family pauses, and open-air downtime.",
startingPano: startingPano("LS_BP_panoPath_Exterior29_F0092", {
  yaw: -114.0372,
  pitch: 2.6674,
  angle: -114.0372,
  viewPitch: 2.6674,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Entry_F", 192, 193),
      pano("LS_BP_panoPath_Exterior2_1_F0155"),
      pano("LS_BP_panoPath_Exterior2_1_F0157"),
    ),
  },
  {
    id: "butterfly-garden",
    name: "Butterfly Garden",
    coordinateKey: "ButterflyGarden",
    description:
      "A colorful planting zone with a gentle garden route and nature-focused pauses.",
startingPano: startingPano("LS_BP_panoPath_Exterior2_1_F0155", {
  yaw: -33.2426,
  pitch: -0.9569,
  angle: -33.2426,
  viewPitch: -0.9569,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Entry_F", 194, 196),
      pano("LS_BP_panoPath_Exterior2_1_F0156"),
      pano("LS_BP_panoPath_Exterior2_1_F0158"),
      pano("LS_BP_panoPath_Exterior2_1_F0159"),
    ),
  },
  {
    id: "flower-garden",
    name: "Flower Garden",
    coordinateKey: "FlowerGarden",
    description:
      "A bloom-forward garden area with exterior approach views and nearby picnic-lawn context.",
startingPano: startingPano("LS_BP_panoPath_Exterior2_1_F0158", {
  yaw: -24.3114,
  pitch: -3.1615,
  angle: -24.3114,
  viewPitch: -3.1615,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Entry_F", 197, 198),
      pano("LS_BP_panoPath_Exterior2_1_F0157"),
    ),
  },
  {
    id: "children-park",
    name: "Children Park",
    coordinateKey: "Children's Play Area",
    image:
      "images/amenities-compressed/preview/Children Play Area.avif",
    description:
      "A playful outdoor zone for children with connected approach and park-side pano stops.",
 startingPano: startingPano("LS_BP_panoPath_Exterior7_F0029", {
  yaw: -133.7128,
  pitch: 3.5027,
  angle: -133.7128,
  viewPitch: 3.5027,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior_Entry_F0199"),
      pano("LS_BP_panoPath_Exterior2_1_F0160"),
      range("LS_BP_panoPath_Exterior7_F", 27, 30),
    ),
  },
  {
    id: "outside",
    name: "Outside",
    description:
      "The outer gate-entry approach before the route moves into the main community landscape.",
    primaryNodeId: pano("LS_BP_panoPath_Exterior_GateEntry_F0000"),
startingPano: startingPano("LS_BP_panoPath_Exterior_GateEntry_F0000", {
  yaw: 0.1728,
  pitch: 3.0224,
  angle: 0.1728,
  viewPitch: 3.0224,
}),
    nodeIds: ids(range("LS_BP_panoPath_Exterior_GateEntry_F", 0, 4)),
  },
  {
    id: "clubhouse",
    name: "Clubhouse",
    coordinateKey: "Culbhouse",
    description:
      "The clubhouse arrival side with gate-entry approach views and the clubhouse exterior stop.",
startingPano: startingPano("LS_BP_panoPath_Exterior_GateEntry_F0003", {
  yaw: -4.1312,
  pitch: 9.0861,
  angle: -4.1312,
  viewPitch: 9.0861,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_GateEntry_F", 5, 8),
      pano("LS_BP_panoPath_Exterior35_F0103"),
    ),
  },
  {
    id: "play-lawn",
    name: "Play Lawn",
    coordinateKey: "PlayLawn",
    image:
      "images/amenities-compressed/preview/Play Lawn.avif",
    description:
      "A broad active lawn sequence connected to the tower walk and surrounding play edges.",
startingPano: startingPano("LS_BP_panoPath_Exterior26_F0086", {
  yaw: -30.1539,
  pitch: -1.9873,
  angle: -30.1539,
  viewPitch: -1.9873,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_TowerA_Walk_F", 111, 113),
      range("LS_BP_panoPath_Exterior29_F", 89, 92),
      range("LS_BP_panoPath_Exterior30_F", 93, 95),
      pano("LS_BP_panoPath_Exterior31_F0096"),
    ),
  },
  {
    id: "interactive-space",
    name: "Interactive Space",
    coordinateKey: "TraditionalGameZone",
    description:
      "A social activity area with tower-walk access and multiple interactive landscape stops.",
startingPano: startingPano("LS_BP_panoPath_Exterior26_F0085", {
  yaw: 173.4943,
  pitch: -4.938,
  angle: 173.4943,
  viewPitch: -4.938,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_TowerA_Walk_F", 114, 115),
      range("LS_BP_panoPath_Exterior26_F", 85, 86),
      range("LS_BP_panoPath_Exterior37_F", 134, 136),
    ),
  },
  {
    id: "frisbee-lawn",
    name: "Frisbee Lawn",
    coordinateKey: "Frisbee Lawn",
    description:
      "A light active-lawn route for open play and frisbee-style movement.",
    startingPano: startingPano("LS_BP_panoPath_Exterior_TowerA_Walk_F0117", {
  yaw: -138.2476,
  pitch: -5.8637,
  angle: -138.2476,
  viewPitch: -5.8637,
}),
    nodeIds: ids(range("LS_BP_panoPath_Exterior_TowerA_Walk_F", 116, 117)),
  },
  {
    id: "basketball-volleyball-court",
    name: "Basketball & Volleyball Court",
    coordinateKey: "BasketBall&Volleyball court",
    description:
      "A multi-sport court zone covering the tower walk edge and court-side pano sequence.",
   startingPano: startingPano("LS_BP_panoPath_Exterior22_F0075", {
  yaw: 1.4141,
  pitch: -1.7339,
  angle: 1.4141,
  viewPitch: -1.7339,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior_TowerA_Walk_F0118"),
      range("LS_BP_panoPath_Exterior21_F", 70, 73),
      range("LS_BP_panoPath_Exterior22_F", 74, 76),
    ),
  },
  {
    id: "skating-ring",
    name: "Skating Ring",
    coordinateKey: "SkatingRing",
    description:
      "A smooth active loop for skating, connected to the tower walk movement route.",
startingPano: startingPano("LS_BP_panoPath_Exterior18_F0061", {
  yaw: 0.0471,
  pitch: -3.928,
  angle: 0.0471,
  viewPitch: -3.928,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_TowerA_Walk_F", 119, 120),
      pano("LS_BP_panoPath_Exterior18_F0061"),
    ),
  },
  {
    id: "futsal-tennis-court",
    name: "Futsal Court / Tennis Court",
    coordinateKey: "Fustal Court/Tennis Court",
    image:
      "images/amenities-compressed/preview/Tenis Court.avif",
    description:
      "A court cluster for futsal and tennis with adjoining sports-court pano stops.",
startingPano: startingPano("LS_BP_panoPath_Exterior25_F0084", {
  yaw: -178.386,
  pitch: -0.8288,
  angle: -178.386,
  viewPitch: -0.8288,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior_TowerA_Walk_F0121"),
      range("LS_BP_panoPath_Exterior19_F", 62, 65),
      pano("LS_BP_panoPath_Exterior20_F0066"),
      range("LS_BP_panoPath_Exterior25_F", 83, 84),
    ),
  },
  {
    id: "outdoor-gym",
    name: "Outdoor Gym",
    coordinateKey: "Outdoor GYM",
    image:
      "images/amenities-compressed/preview/Outdoor Gym.avif",
    description:
      "An open-air fitness area with tower walk access and dedicated gym-equipment stops.",
startingPano: startingPano("LS_BP_panoPath_Exterior16_F0059", {
  yaw: 1.5365,
  pitch: -3.706,
  angle: 1.5365,
  viewPitch: -3.706,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_TowerA_Walk_F", 122, 123),
      range("LS_BP_panoPath_Exterior16_F", 59, 60),
    ),
  },
  {
    id: "rock-garden",
    name: "Rock Garden",
    coordinateKey: "RockGarden",
    description:
      "A textured landscape pocket with rock-garden views and a tower-walk connection.",
startingPano: startingPano("LS_BP_panoPath_Exterior15_F0056", {
  yaw: -75.7992,
  pitch: -0.0776,
  angle: -75.7992,
  viewPitch: -0.0776,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior_TowerA_Walk_F0124"),
      range("LS_BP_panoPath_Exterior15_F", 55, 58),
    ),
  },
  {
    id: "calisthenics-sand-pit",
    name: "Calisthenics Sand-Pit",
    coordinateKey: "Calisthenics Sand pit",
    image:
      "images/amenities-compressed/preview/Calisthanics Sand Pit.avif",
    description:
      "A bodyweight training and sand-pit activity area with a dedicated tower-walk start.",
    primaryNodeId: pano("LS_BP_panoPath_Exterior_TowerA_Walk_F0125"),
startingPano: startingPano("LS_BP_panoPath_Exterior14_F0054", {
  yaw: 134.9134,
  pitch: -1.0132,
  angle: 134.9134,
  viewPitch: -1.0132,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior_TowerA_Walk_F0125"),
      pano("LS_BP_panoPath_Exterior_TowerA_Walk_F0127"),
      range("LS_BP_panoPath_Exterior14_F", 53, 54),
    ),
  },
  {
    id: "amphitheater",
    name: "Amphitheater",
    coordinateKey: "AmphiTheater",
    image:
      "images/amenities-compressed/preview/Amphi Theatre.avif",
    description:
      "A performance and gathering zone spanning transformer-side and amphitheater seating stops.",
   startingPano: startingPano("LS_BP_panoPath_Exterior13_F0051", {
  yaw: 5.0274,
  pitch: -1.1413,
  angle: 5.0274,
  viewPitch: -1.1413,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior_Transformers_F", 129, 132),
      range("LS_BP_panoPath_Exterior11_F", 43, 46),
      range("LS_BP_panoPath_Exterior12_F", 47, 49),
    ),
  },
  {
    id: "outdoor-party-lawn",
    name: "Outdoor Party Lawn",
    coordinateKey: "Outdoor Party Lawn",
    image:
      "images/amenities-compressed/preview/Outdoor Party Lawn.avif",
    description:
      "A celebration lawn sequence with surrounding party-lawn and amphitheater-side context.",
startingPano: startingPano("LS_BP_panoPath_Exterior10_F0039", {
  yaw: 143.4252,
  pitch: -6.4153,
  angle: 143.4252,
  viewPitch: -6.4153,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior4_F", 9, 12),
      range("LS_BP_panoPath_Exterior9_F", 36, 38),
      range("LS_BP_panoPath_Exterior10_F", 39, 41),
      range("LS_BP_panoPath_Exterior13_F", 50, 52),
    ),
  },
  {
    id: "community-gathering",
    name: "Community Gathering",
    description:
      "A shared social route through gathering spaces, garden connections, and community edges.",
    startingPano: startingPano("LS_BP_panoPath_Exterior43_F0147", {
  yaw: 28.6085,
  pitch: -3.1341,
  angle: 28.6085,
  viewPitch: -3.1341,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior4_F0013"),
      range("LS_BP_panoPath_Exterior5_F", 14, 17),
      pano("LS_BP_panoPath_Exterior6_F0018"),
      range("LS_BP_panoPath_Exterior43_F", 147, 149),
    ),
  },
  {
    id: "swimming-pool",
    name: "Swimming Pool",
    coordinateKey: "SwimmingPool",
    description:
      "The poolside exterior sequence with main swimming-pool and supporting pool-view stops.",
   startingPano: startingPano("LS_BP_panoPath_Exterior8_F0033", {
  yaw: 36.876,
  pitch: 1.7308,
  angle: 36.876,
  viewPitch: 1.7308,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior8_F", 31, 35),
      range("LS_BP_panoPath_Exterior40_F", 137, 138),
    ),
  },
  {
    id: "mini-cricket-stadium",
    name: "Mini Cricket Stadium",
    coordinateKey: "Mini-Cricket Stadium",
    image:
      "images/amenities-compressed/preview/Mini Cricket Stadium.avif",
    description:
      "A compact cricket zone for practice, games, and active community play.",
startingPano: startingPano("LS_BP_panoPath_Exterior20_F0069", {
  yaw: -165.298,
  pitch: -1.2788,
  angle: -165.298,
  viewPitch: -1.2788,
}),
    nodeIds: ids(range("LS_BP_panoPath_Exterior20_F", 67, 69)),
  },
  {
    id: "pickleball-court",
    name: "Pickleball Court",
    coordinateKey: "PickleBallcourt",
    description:
      "A dedicated pickleball court sequence with adjacent court-side viewpoints.",
    startingPano: startingPano("LS_BP_panoPath_Exterior24_F0078", {
  yaw: 1.589,
  pitch: 1.4195,
  angle: 1.589,
  viewPitch: 1.4195,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior23_F0077"),
      range("LS_BP_panoPath_Exterior24_F", 78, 79),
    ),
  },
  {
    id: "tennikoit-court",
    name: "Tennikoit Court",
    coordinateKey: "Tennikoit Court",
    description:
      "A tennikoit play area with court-side stops and surrounding outdoor activity context.",
    startingPano: startingPano("LS_BP_panoPath_Exterior28_F0081", {
  yaw: -0.0449,
  pitch: 1.4155,
  angle: -0.0449,
  viewPitch: 1.4155,
}),
    nodeIds: ids(
      pano("LS_BP_panoPath_Exterior27_F0080"),
      range("LS_BP_panoPath_Exterior28_F", 81, 82),
    ),
  },
  {
    id: "tree-house",
    name: "Tree House",
    description:
      "A playful tree-house zone with connected garden and tower-side exterior stops.",
startingPano: startingPano("LS_BP_panoPath_Exterior32_F0097", {
  yaw: 11.2577,
  pitch: -1.6304,
  angle: 11.2577,
  viewPitch: -1.6304,
}),
    nodeIds: ids(
      range("LS_BP_panoPath_Exterior32_F", 97, 98),
      range("LS_BP_panoPath_Exterior33_F", 99, 100),
    ),
  },
];

function getAmenityPreviewImage(nodeId: string) {
  const currentNodeId = resolveAvailablePanoNodeId(nodeId) ?? nodeId;
  const source = exteriorNodeSourceMap.get(currentNodeId);
  const folderName = source
    ? exteriorImageFilenameToPanoId(source.image_filename)
    : currentNodeId;

  return `${EXTERIOR_PANO_CDN_BASE_PATH}/${folderName}/preview.jpg`;
}

function getAmenityPrimaryNodeId(amenity: ExteriorAmenityDefinition) {
  return amenity.primaryNodeId &&
    amenity.nodeIds.includes(amenity.primaryNodeId)
    ? amenity.primaryNodeId
    : amenity.nodeIds[0];
}

function resolveAmenityStartingPano(
  amenity: ExteriorAmenityDefinition,
  fallbackNodeId: string,
): ExteriorAmenityStartingPano {
  const input = amenity.startingPano ?? startingPano(fallbackNodeId);
  const nodeId = resolveAvailablePanoNodeId(input.name);

  if (!nodeId || !availableNodeIds.has(nodeId)) {
    throw new Error(
      `Missing starting pano "${input.name}" for "${amenity.name}"`,
    );
  }

  const source = exteriorNodeSourceMap.get(nodeId);
  const sourceYaw = source?.yaw ?? 0;
  const sourcePitch = source?.pitch ?? 0;
  const yaw = input.yaw ?? sourceYaw;
  const pitch = input.pitch ?? sourcePitch;
  const roll = input.roll ?? source?.roll ?? 0;
  const angle = input.angle ?? input.viewYaw ?? yaw;

  return {
    name: input.name,
    nodeId,
    yaw,
    pitch,
    roll,
    facingAxis: input.facingAxis ?? source?.facing_axis,
    angle,
    viewYaw: input.yaw ?? input.viewYaw ?? input.angle ?? sourceYaw,
    viewPitch: input.pitch ?? input.viewPitch ?? sourcePitch,
    viewZoom: input.viewZoom,
  };
}

export const EXTERIOR_AMENITY_IMAGE_LINKS = amenityDefinitions.map(
  (amenity) => {
    const fallbackPrimaryNodeId = getAmenityPrimaryNodeId(amenity);
    const primaryNodeId = fallbackPrimaryNodeId
      ? resolveAmenityStartingPano(amenity, fallbackPrimaryNodeId).nodeId
      : null;

    return {
      id: amenity.id,
      image:
        amenity.image ??
        (primaryNodeId && amenity.startingPano
          ? getAmenityPreviewImage(
              normalizePanoNodeId(amenity.startingPano.name) ?? primaryNodeId,
            )
          : AMENITY_IMAGE_PLACEHOLDER_URL),
    };
  },
);

const amenityImageMap = new Map<string, string>(
  EXTERIOR_AMENITY_IMAGE_LINKS.filter(
    (entry) => entry.image && entry.image !== AMENITY_IMAGE_PLACEHOLDER_URL,
  ).map((entry) => [entry.id, entry.image]),
);

function resolveAmenityImage(
  amenity: ExteriorAmenityDefinition,
  primaryNodeId: string,
) {
  const linkedImage = amenityImageMap.get(amenity.id);

  if (linkedImage) {
    return linkedImage;
  }

  if (amenity.image && amenity.image !== AMENITY_IMAGE_PLACEHOLDER_URL) {
    return amenity.image;
  }

  const legacyStartingNodeId = amenity.startingPano
    ? normalizePanoNodeId(amenity.startingPano.name)
    : null;

  return getAmenityPreviewImage(legacyStartingNodeId ?? primaryNodeId);
}

export const exteriorAmenities: ExteriorAmenity[] = amenityDefinitions.map(
  (amenity) => {
    const fallbackPrimaryNodeId = getAmenityPrimaryNodeId(amenity);

    if (!fallbackPrimaryNodeId) {
      throw new Error(`Missing exterior pano nodes for "${amenity.name}"`);
    }

    const startingPano = resolveAmenityStartingPano(
      amenity,
      fallbackPrimaryNodeId,
    );
    const nodeIds = amenity.nodeIds.includes(startingPano.nodeId)
      ? amenity.nodeIds
      : [startingPano.nodeId, ...amenity.nodeIds];
    const primaryNodeId = startingPano.nodeId;

    return {
      ...amenity,
      image: resolveAmenityImage(amenity, primaryNodeId),
      primaryNodeId,
      startingPano,
      nodeIds,
      coordinate: getAmenityCoordinate(amenity, primaryNodeId),
      summary: createSummary(nodeIds),
    };
  },
);
