import { connectToDatabase } from "@/lib/mongodb";
import {
  resolveMappedApartment,
  type MappedApartment,
} from "@/lib/floor-plan-mapping";
import type { InventoryDocument } from "@/models/Inventory";
import type {
  InventoryAdminRow,
  InventoryApartment,
  InventoryStatus,
} from "@/types/inventory";

type InventoryRawDocument = Partial<InventoryDocument> & {
  _id: { toString(): string };
  tower?: string;
  floor?: string | number;
  unit?: string;
  status?: InventoryStatus | "Booked" | string;
};

type NormalizedInventoryRecord = {
  id: string;
  mapped: MappedApartment;
  status: InventoryStatus;
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
      if (trimmed) return trimmed;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
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

function estimatePriceLakhs(areaSqft: number, bhk: number) {
  const rateByBhk = bhk >= 3 ? 0.074 : bhk === 2 ? 0.066 : 0.061;
  return Math.max(45, Math.round(areaSqft * rateByBhk));
}

function reportInvalidInventoryDoc(
  doc: InventoryRawDocument,
  issues: string[],
) {
  if (issues.length === 0) return;

  const docId = getDocumentId(doc);
  const issueKey = `${docId}:${issues.join("|")}`;
  if (loggedInventoryIssues.has(issueKey)) return;

  loggedInventoryIssues.add(issueKey);
  console.warn(
    `Skipping invalid TULA inventory record ${docId}: ${issues.join("; ")}`,
  );
}

function normalizeInventoryDoc(
  doc: InventoryRawDocument,
): NormalizedInventoryRecord | null {
  const tower = getFirstStringValue(doc.Tower, doc.tower);
  const floor = getFirstStringValue(doc.Floor, doc.floor);
  const flatNumber = getFirstStringValue(doc.Flat_Number, doc.unit);
  const status = normalizeStatus(doc.status);
  const mapped = resolveMappedApartment({ tower, floor, flatNumber });
  const issues: string[] = [];

  if (!tower) issues.push("missing tower");
  if (!floor) issues.push("missing floor");
  if (!flatNumber) issues.push("missing flat number");
  if (!status) issues.push(`invalid status \"${String(doc.status)}\"`);
  if (tower && floor && flatNumber && !mapped) {
    issues.push(`no floor-plan mapping for ${tower}/${floor}/${flatNumber}`);
  }

  if (!mapped || !status) {
    reportInvalidInventoryDoc(doc, issues);
    return null;
  }

  return { id: getDocumentId(doc), mapped, status };
}

function toApartment(record: NormalizedInventoryRecord): InventoryApartment {
  const { id, mapped, status } = record;
  return {
    id,
    unitKey: mapped.unitKey,
    title: mapped.unitLabel,
    flatNumber: mapped.flat,
    tower: mapped.tower,
    bhk: mapped.bhk,
    unitType: mapped.unitType,
    priceLakhs: estimatePriceLakhs(mapped.saleableAreaSqft, mapped.bhk),
    areaSqft: mapped.saleableAreaSqft,
    carpetAreaSqft: mapped.carpetAreaSqft,
    balconyAreaSqft: mapped.balconyAreaSqft,
    floor: mapped.floor,
    floorLabel: mapped.floorLabel,
    floorRange: mapped.floorRange,
    facing: mapped.facing,
    status,
    roomDimensions: mapped.roomDimensions,
    floorPlanId: mapped.floorPlanId,
    floorPlanImage: mapped.floorPlanImage,
    floorPlanR2Key: mapped.floorPlanR2Key,
    floorPlanSourcePath: mapped.floorPlanSourcePath,
  };
}

function toAdminRow(record: NormalizedInventoryRecord): InventoryAdminRow {
  const { id, mapped, status } = record;
  return {
    id,
    unitKey: mapped.unitKey,
    tower: mapped.tower,
    floor: mapped.floorLabel,
    flatNumber: mapped.unitLabel,
    bhk: mapped.bhkLabel,
    unitType: mapped.unitType,
    facing: mapped.facing,
    areaSqft: mapped.saleableAreaSqft,
    carpetAreaSqft: mapped.carpetAreaSqft,
    balconyAreaSqft: mapped.balconyAreaSqft,
    floorRange: mapped.floorRange,
    roomDimensions: mapped.roomDimensions,
    floorPlanId: mapped.floorPlanId,
    floorPlanImage: mapped.floorPlanImage,
    status,
  };
}

function normalizeAndDeduplicate(inventoryDocs: InventoryRawDocument[]) {
  const records = new Map<string, NormalizedInventoryRecord>();

  for (const doc of inventoryDocs) {
    const normalized = normalizeInventoryDoc(doc);
    if (!normalized) continue;

    const existing = records.get(normalized.mapped.unitKey);
    if (!existing || existing.status === "Available") {
      records.set(normalized.mapped.unitKey, normalized);
    }
  }

  return Array.from(records.values());
}

async function getNormalizedInventory() {
  const connection = await connectToDatabase();
  const inventoryDocs = await connection.connection.db!
    .collection("inventory")
    .find({})
    .toArray();

  return normalizeAndDeduplicate(
    inventoryDocs as unknown as InventoryRawDocument[],
  );
}

export async function getInventoryApartments() {
  const records = await getNormalizedInventory();

  return records.map(toApartment).sort((left, right) => {
    if (left.tower !== right.tower) {
      return left.tower.localeCompare(right.tower);
    }

    if (left.floor !== right.floor) return left.floor - right.floor;
    return left.flatNumber.localeCompare(right.flatNumber);
  });
}

export async function getInventoryAdminRows() {
  const records = await getNormalizedInventory();

  return records.map(toAdminRow).sort((left, right) => {
    if (left.tower !== right.tower) {
      return left.tower.localeCompare(right.tower);
    }

    const leftMapped = resolveMappedApartment({
      tower: left.tower,
      floor: left.floor,
      flatNumber: left.flatNumber,
    });
    const rightMapped = resolveMappedApartment({
      tower: right.tower,
      floor: right.floor,
      flatNumber: right.flatNumber,
    });
    if (leftMapped && rightMapped && leftMapped.floor !== rightMapped.floor) {
      return leftMapped.floor - rightMapped.floor;
    }

    return left.flatNumber.localeCompare(right.flatNumber, undefined, {
      numeric: true,
    });
  });
}
