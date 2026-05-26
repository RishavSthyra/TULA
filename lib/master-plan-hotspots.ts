import type { InventoryApartment, TowerType } from "@/types/inventory";

export const MASTER_PLAN_HOTSPOT_FRAMES = [1, 61, 121, 181, 241, 301] as const;
export const MASTER_PLAN_HOTSPOT_KEYS = [
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
] as const;

export type MasterPlanHotspotKey = (typeof MASTER_PLAN_HOTSPOT_KEYS)[number];

const HOTSPOT_ALLOWED_UNIT_ENDINGS: Record<
  MasterPlanHotspotKey,
  Record<TowerType, readonly string[]>
> = {
  A1: {
    "Tower A": ["1", "2", "5", "6"],
    "Tower B": ["1", "2", "5", "6"],
  },
  A2: {
    "Tower A": ["2", "5"],
    "Tower B": ["5", "6"],
  },
  A3: {
    "Tower A": ["6"],
    "Tower B": ["6"],
  },
  A4: {
    "Tower A": ["3", "4"],
    "Tower B": ["3", "4"],
  },
  A5: {
    "Tower A": ["1", "3"],
    "Tower B": ["4"],
  },
  A6: {
    "Tower A": ["1"],
    "Tower B": ["1"],
  },
};

function wrapMasterPlanFrame(frame: number, totalFrames = 360) {
  return ((frame - 1 + totalFrames) % totalFrames) + 1;
}

export function getNearestMasterPlanHotspot(
  frame: number,
): MasterPlanHotspotKey {
  const normalizedFrame = wrapMasterPlanFrame(frame);
  let closestIndex = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;

  MASTER_PLAN_HOTSPOT_FRAMES.forEach((snapFrame, index) => {
    const directDistance = Math.abs(snapFrame - normalizedFrame);
    const wrappedDistance = 360 - directDistance;
    const distance = Math.min(directDistance, wrappedDistance);

    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestIndex = index;
    }
  });

  return MASTER_PLAN_HOTSPOT_KEYS[closestIndex] ?? MASTER_PLAN_HOTSPOT_KEYS[0];
}

export function getApartmentUnitEnding(
  flatNumber: string | null | undefined,
): string | null {
  if (!flatNumber) {
    return null;
  }

  const digitMatches = flatNumber.match(/\d/g);
  return digitMatches?.at(-1) ?? null;
}

export function isFlatNumberAllowedAtHotspot(
  hotspot: MasterPlanHotspotKey,
  tower: TowerType,
  flatNumber: string | null | undefined,
) {
  const unitEnding = getApartmentUnitEnding(flatNumber);

  if (!unitEnding) {
    return false;
  }

  return HOTSPOT_ALLOWED_UNIT_ENDINGS[hotspot][tower].includes(unitEnding);
}

export function isInventoryApartmentAllowedAtHotspot(
  apartment: InventoryApartment,
  hotspot: MasterPlanHotspotKey,
) {
  if (apartment.floor <= 0) {
    return false;
  }

  return isFlatNumberAllowedAtHotspot(
    hotspot,
    apartment.tower,
    apartment.flatNumber || apartment.title,
  );
}

export function isApartmentIdAllowedAtHotspot(
  apartmentId: string | null,
  hotspot: MasterPlanHotspotKey,
  fallbackTower: TowerType | null,
) {
  if (!apartmentId) {
    return false;
  }

  const [, towerCode = "", , unitCode = ""] = apartmentId.split("_");
  const tower =
    towerCode === "B"
      ? "Tower B"
      : fallbackTower === "Tower B"
        ? "Tower B"
        : "Tower A";

  return isFlatNumberAllowedAtHotspot(hotspot, tower, unitCode);
}
