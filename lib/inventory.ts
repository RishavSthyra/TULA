import { connectToDatabase } from "@/lib/mongodb";
import type { InventoryDocument } from "@/models/Inventory";
import type {
  InventoryAdminRow,
  InventoryApartment,
  InventoryFacing,
  InventoryStatus,
  TowerType,
} from "@/types/inventory";

type InventoryRawDocument = Partial<InventoryDocument> & {
  _id: { toString(): string };
  tower?: string;
  floor?: string | number;
  unit?: string;
  type?: string;
  facing?: string;
  area?: string | number;
  rooms?: string;
  status?: InventoryStatus | "Booked" | string;
};

type NormalizedInventoryRecord = {
  id: string;
  flatNumber: string;
  tower: TowerType;
  bhk: number;
  bhkLabel: string;
  areaSqft: number;
  floor: number;
  floorLabel: string;
  facing: InventoryFacing;
  status: InventoryStatus;
  roomDimensions: string;
};

const loggedInventoryIssues = new Set<string>();

function getDocumentId(doc: InventoryRawDocument) {
  return doc._id?.toString?.() || "unknown";
}

function getFirstStringValue(
  ...values: Array<string | number | undefined | null>
) {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function normalizeTower(value?: string): TowerType | null {
  if (value === "Tower A" || value === "Tower B") {
    return value;
  }

  return null;
}

export function normalizeStatus(
  value?: InventoryStatus | "Booked" | string,
) {
  if (value == null || value === "" || value === "Available") {
    return "Available";
  }

  if (value === "Reserved") return "Reserved";
  if (value === "Sold" || value === "Booked") return "Sold";

  return null;
}

export function parseInventoryStatusInput(value: unknown): InventoryStatus | null {
  if (value === "Available" || value === "Reserved" || value === "Sold") {
    return value;
  }

  return null;
}

function normalizeFacing(value?: string): InventoryFacing | null {
  if (value === "North" || value === "South" || value === "East" || value === "West") {
    return value;
  }

  return null;
}

function parseBhk(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseArea(value: string | number) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseFloorValue(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.toUpperCase() === "G") return 0;

  const parsed = Number.parseInt(normalizedValue, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function estimatePriceLakhs(areaSqft: number, bhk: number) {
  const rateByBhk = bhk >= 3 ? 0.074 : bhk === 2 ? 0.066 : 0.061;
  return Math.max(45, Math.round(areaSqft * rateByBhk));
}

function reportInvalidInventoryDoc(
  doc: InventoryRawDocument,
  issues: string[],
) {
  if (issues.length === 0) {
    return;
  }

  const docId = getDocumentId(doc);
  const issueKey = `${docId}:${issues.join("|")}`;

  if (loggedInventoryIssues.has(issueKey)) {
    return;
  }

  loggedInventoryIssues.add(issueKey);
  console.warn(
    `Skipping invalid inventory record ${docId}: ${issues.join("; ")}`,
  );
}

function normalizeInventoryDoc(
  doc: InventoryRawDocument,
): NormalizedInventoryRecord | null {
  const flatNumber = getFirstStringValue(doc.Flat_Number, doc.unit);
  const towerValue = getFirstStringValue(doc.Tower, doc.tower);
  const bhkLabel = getFirstStringValue(doc.BHK, doc.type);
  const floorLabel = getFirstStringValue(doc.Floor, doc.floor);
  const facingValue = getFirstStringValue(doc.Facing, doc.facing);
  const areaValue = doc.Super_Built_Up_Area_sqft ?? doc.area ?? "";
  const roomDimensions = getFirstStringValue(doc.Room_Dimensions, doc.rooms);

  const tower = normalizeTower(towerValue || undefined);
  const bhk = parseBhk(bhkLabel);
  const areaSqft = parseArea(areaValue);
  const floor = parseFloorValue(floorLabel);
  const facing = normalizeFacing(facingValue || undefined);
  const status = normalizeStatus(doc.status);
  const issues: string[] = [];

  if (!flatNumber) {
    issues.push("missing flat number");
  }

  if (!tower) {
    issues.push(`invalid tower "${towerValue || "empty"}"`);
  }

  if (bhk === null) {
    issues.push(`invalid BHK "${bhkLabel || "empty"}"`);
  }

  if (areaSqft === null) {
    issues.push(`invalid area "${String(areaValue || "empty")}"`);
  }

  if (floor === null) {
    issues.push(`invalid floor "${floorLabel || "empty"}"`);
  }

  if (!facing) {
    issues.push(`invalid facing "${facingValue || "empty"}"`);
  }

  if (!status) {
    issues.push(`invalid status "${String(doc.status || "empty")}"`);
  }

  if (
    issues.length > 0 ||
    !tower ||
    bhk === null ||
    areaSqft === null ||
    floor === null ||
    !facing ||
    !status
  ) {
    reportInvalidInventoryDoc(doc, issues);
    return null;
  }

  return {
    id: getDocumentId(doc),
    flatNumber,
    tower,
    bhk,
    bhkLabel,
    areaSqft,
    floor,
    floorLabel,
    facing,
    status,
    roomDimensions,
  };
}

export function mapInventoryDocToApartment(
  doc: InventoryRawDocument,
): InventoryApartment | null {
  const normalized = normalizeInventoryDoc(doc);
  if (!normalized) {
    return null;
  }

  return {
    id: normalized.id,
    title: normalized.flatNumber.toUpperCase(),
    flatNumber: normalized.flatNumber,
    tower: normalized.tower,
    bhk: normalized.bhk,
    priceLakhs: estimatePriceLakhs(normalized.areaSqft, normalized.bhk),
    areaSqft: normalized.areaSqft,
    floor: normalized.floor,
    floorLabel: normalized.floorLabel,
    facing: normalized.facing,
    status: normalized.status,
    roomDimensions: normalized.roomDimensions,
  };
}

export function mapInventoryDocToAdminRow(
  doc: InventoryRawDocument,
): InventoryAdminRow | null {
  const normalized = normalizeInventoryDoc(doc);
  if (!normalized) {
    return null;
  }

  return {
    id: normalized.id,
    tower: normalized.tower,
    floor: normalized.floorLabel,
    flatNumber: normalized.flatNumber,
    bhk: normalized.bhkLabel,
    facing: normalized.facing,
    areaSqft: normalized.areaSqft,
    roomDimensions: normalized.roomDimensions,
    status: normalized.status,
  };
}

export async function getInventoryApartments() {
  const connection = await connectToDatabase();
  const inventoryDocs = await connection.connection.db!
    .collection("inventory")
    .find({})
    .toArray();

  return inventoryDocs
    .map((doc) => mapInventoryDocToApartment(doc as InventoryRawDocument))
    .filter((doc): doc is InventoryApartment => Boolean(doc))
    .sort((left, right) => {
      if (left.tower !== right.tower) {
        return left.tower.localeCompare(right.tower);
      }

      if (left.floor !== right.floor) {
        return left.floor - right.floor;
      }

      return left.flatNumber.localeCompare(right.flatNumber);
    });
}

export async function getInventoryAdminRows() {
  const connection = await connectToDatabase();
  const inventoryDocs = await connection.connection.db!
    .collection("inventory")
    .find({})
    .toArray();

  return inventoryDocs
    .map((doc) => mapInventoryDocToAdminRow(doc as InventoryRawDocument))
    .filter((doc): doc is InventoryAdminRow => Boolean(doc))
    .sort((left, right) => {
      if (left.tower !== right.tower) {
        return left.tower.localeCompare(right.tower);
      }

      const leftFloor = parseFloorValue(left.floor) ?? Number.MAX_SAFE_INTEGER;
      const rightFloor = parseFloorValue(right.floor) ?? Number.MAX_SAFE_INTEGER;
      if (leftFloor !== rightFloor) {
        return leftFloor - rightFloor;
      }

      return left.flatNumber.localeCompare(right.flatNumber);
    });
}
