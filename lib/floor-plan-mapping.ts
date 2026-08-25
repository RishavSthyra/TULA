import floorPlanMappingJson from "@/data/floor_plan_mapping.json";
import type {
  InventoryFacing,
  TowerType,
} from "@/types/inventory";

type MappingAreas = {
  saleable_sft: number;
  carpet_sft: number;
  balcony_sft: number;
};

type MappingRecord = {
  tower: string;
  flat: string;
  floors: string[];
  floor_range: string;
  plan_id: string;
  type: string;
  facing: string;
  areas: MappingAreas;
  room_dimensions: string;
  floorPlanImage: string;
  floorPlanSourcePath: string;
};

type FloorPlanMappingData = {
  floor_plans: Array<{ id: string; source_path: string }>;
  unit_mappings: MappingRecord[];
};

export type MappedApartment = {
  unitKey: string;
  unitLabel: string;
  tower: TowerType;
  towerCode: "A" | "B" | "C" | "D";
  flat: string;
  floor: number;
  floorLabel: string;
  floorRange: string;
  bhk: number;
  bhkLabel: string;
  unitType: string;
  facing: InventoryFacing;
  saleableAreaSqft: number;
  carpetAreaSqft: number;
  balconyAreaSqft: number;
  roomDimensions: string;
  floorPlanId: string;
  floorPlanImage: string;
  floorPlanR2Key: string;
  floorPlanSourcePath: string;
};

const mappingData = floorPlanMappingJson as FloorPlanMappingData;
const TOWER_CODES = ["A", "B", "C", "D"] as const;
const FLOOR_PLAN_CDN_BASE_URL =
  "https://cdn.sthyra.com/TULA/Images/New%20Floor%20Plans";

export const TOWERS: TowerType[] = [
  "Tower A",
  "Tower B",
  "Tower C",
  "Tower D",
];

export function normalizeTower(value?: string | null): TowerType | null {
  if (!value) return null;

  const normalized = value.trim().toUpperCase().replace(/^TOWER\s*/, "");
  if (!TOWER_CODES.includes(normalized as (typeof TOWER_CODES)[number])) {
    return null;
  }

  return `Tower ${normalized}` as TowerType;
}

export function getTowerCode(tower: TowerType) {
  return tower.slice(-1) as MappedApartment["towerCode"];
}

export function parseFloorValue(value: string | number) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 && value <= 13 ? value : null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "G" || normalized === "GROUND") return 0;

  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 13
    ? parsed
    : null;
}

export function normalizeFlatNumber(value?: string | null) {
  if (!value) return null;

  const digits = value.match(/\d/g)?.join("") ?? "";
  if (!digits) return null;

  const flat = Number.parseInt(digits.slice(-2), 10);
  return Number.isInteger(flat) && flat > 0
    ? String(flat).padStart(2, "0")
    : null;
}

export function getUnitKey(tower: TowerType, floor: number, flat: string) {
  return `${getTowerCode(tower)}:${floor}:${flat}`;
}

export function getUnitLabel(tower: TowerType, floor: number, flat: string) {
  const floorToken = floor === 0 ? "G" : String(floor);
  return `${getTowerCode(tower)}-${floorToken}${flat}`;
}

function parseBhk(type: string) {
  const parsed = Number.parseFloat(type);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid BHK type in floor-plan mapping: ${type}`);
  }
  return parsed;
}

function toFloorPlanCdnUrl(sourcePath: string) {
  const encodedPath = sourcePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${FLOOR_PLAN_CDN_BASE_URL}/${encodedPath}`;
}

function floorLabelToNumber(label: string) {
  const floor = parseFloorValue(label);
  if (floor === null) {
    throw new Error(`Invalid floor label in floor-plan mapping: ${label}`);
  }
  return floor;
}

function createMappedApartment(
  mapping: MappingRecord,
  floor: number,
): MappedApartment {
  const tower = normalizeTower(mapping.tower);
  const flat = normalizeFlatNumber(mapping.flat);
  const facing = `${mapping.facing.slice(0, 1).toUpperCase()}${mapping.facing
    .slice(1)
    .toLowerCase()}` as InventoryFacing;

  if (!tower || !flat) {
    throw new Error(
      `Invalid tower/flat mapping: ${mapping.tower}/${mapping.flat}`,
    );
  }

  if (!["North", "South", "East", "West"].includes(facing)) {
    throw new Error(`Invalid facing in floor-plan mapping: ${mapping.facing}`);
  }

  const bhk = parseBhk(mapping.type);
  return {
    unitKey: getUnitKey(tower, floor, flat),
    unitLabel: getUnitLabel(tower, floor, flat),
    tower,
    towerCode: getTowerCode(tower),
    flat,
    floor,
    floorLabel: floor === 0 ? "G" : String(floor),
    floorRange: mapping.floor_range,
    bhk,
    bhkLabel: `${bhk} BHK`,
    unitType: mapping.type,
    facing,
    saleableAreaSqft: mapping.areas.saleable_sft,
    carpetAreaSqft: mapping.areas.carpet_sft,
    balconyAreaSqft: mapping.areas.balcony_sft,
    roomDimensions: mapping.room_dimensions,
    floorPlanId: mapping.plan_id,
    floorPlanImage: toFloorPlanCdnUrl(mapping.floorPlanSourcePath),
    floorPlanR2Key: mapping.floorPlanImage,
    floorPlanSourcePath: mapping.floorPlanSourcePath,
  };
}

const mappedApartments = mappingData.unit_mappings.flatMap((mapping) =>
  mapping.floors.map((floor) =>
    createMappedApartment(mapping, floorLabelToNumber(floor)),
  ),
);

const mappedApartmentsByKey = new Map<string, MappedApartment>();
for (const apartment of mappedApartments) {
  if (mappedApartmentsByKey.has(apartment.unitKey)) {
    throw new Error(`Duplicate apartment mapping: ${apartment.unitKey}`);
  }
  mappedApartmentsByKey.set(apartment.unitKey, apartment);
}

if (mappedApartmentsByKey.size !== 294) {
  throw new Error(
    `Expected 294 mapped apartments, found ${mappedApartmentsByKey.size}`,
  );
}

export function getMappedApartments() {
  return Array.from(mappedApartmentsByKey.values());
}

export function resolveMappedApartment(options: {
  tower: string;
  floor: string | number;
  flatNumber: string;
}) {
  const tower = normalizeTower(options.tower);
  const floor = parseFloorValue(options.floor);
  const flat = normalizeFlatNumber(options.flatNumber);

  if (!tower || floor === null || !flat) return null;
  return mappedApartmentsByKey.get(getUnitKey(tower, floor, flat)) ?? null;
}

export function getFloorPlanSourcePaths() {
  return mappingData.floor_plans.map((plan) => plan.source_path);
}
