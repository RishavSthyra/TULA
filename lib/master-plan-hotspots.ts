import type { InventoryApartment, TowerType } from "@/types/inventory";

export const MASTER_PLAN_HOTSPOT_FRAMES = [1, 91, 181, 271] as const;
export const MASTER_PLAN_HOTSPOT_KEYS = ["A1", "A2", "A3", "A4"] as const;

export type MasterPlanHotspotKey = (typeof MASTER_PLAN_HOTSPOT_KEYS)[number];

const HOTSPOT_ALLOWED_UNIT_ENDINGS: Record<
  MasterPlanHotspotKey,
  Partial<Record<TowerType, readonly string[]>>
> = {
  A1: {
    "Tower A": ["04", "05"],
    "Tower B": ["01", "05", "06"],
    "Tower C": ["01", "02"],
    "Tower D": ["04"],
  },
  A2: {
    "Tower C": ["05"],
    "Tower D": ["02", "03"],
  },
  A3: {
    "Tower A": ["02", "03"],
    "Tower B": ["02", "03", "04"],
    "Tower C": ["03", "04"],
  },
  A4: {
    "Tower A": ["01"],
    "Tower D": ["01", "05"],
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

  const digits = flatNumber.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return digits.slice(-2).padStart(2, "0");
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

  const allowedEndings = HOTSPOT_ALLOWED_UNIT_ENDINGS[hotspot][tower];

  return allowedEndings?.includes(unitEnding) ?? false;
}

export function isInventoryApartmentAllowedAtHotspot(
  apartment: InventoryApartment,
  hotspot: MasterPlanHotspotKey,
) {
  if (apartment.floor < 0) {
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
) {
  if (!apartmentId) {
    return false;
  }

  const [
    scope = "",
    rawTowerCode = "",
    floorCode = "",
    unitCode = "",
    ...extraParts
  ] = apartmentId.split("_");
  const towerCode = rawTowerCode.toUpperCase();

  if (
    (scope !== "Block" && scope !== "Tower") ||
    !["A", "B", "C", "D"].includes(towerCode) ||
    !/^\d+$/.test(floorCode) ||
    Number(floorCode) < 0 ||
    !unitCode ||
    extraParts.length > 0
  ) {
    return false;
  }

  const tower = `Tower ${towerCode}` as TowerType;

  return isFlatNumberAllowedAtHotspot(hotspot, tower, unitCode);
}
