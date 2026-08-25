export type TowerType = "Tower A" | "Tower B" | "Tower C" | "Tower D";

export type InventoryStatus = "Available" | "Reserved" | "Sold";

export type InventoryFacing = "North" | "South" | "East" | "West";

export type InventoryApartment = {
  id: string;
  unitKey: string;
  title: string;
  flatNumber: string;
  tower: TowerType;
  bhk: number;
  unitType: string;
  priceLakhs: number;
  areaSqft: number;
  carpetAreaSqft: number;
  balconyAreaSqft: number;
  floor: number;
  floorLabel: string;
  floorRange: string;
  facing: InventoryFacing;
  status: InventoryStatus;
  roomDimensions: string;
  floorPlanId: string;
  floorPlanImage: string;
  floorPlanR2Key: string;
  floorPlanSourcePath: string;
};

export type InventoryAdminRow = {
  id: string;
  unitKey: string;
  tower: TowerType;
  floor: string;
  flatNumber: string;
  bhk: string;
  unitType: string;
  facing: InventoryFacing;
  areaSqft: number;
  carpetAreaSqft: number;
  balconyAreaSqft: number;
  floorRange: string;
  roomDimensions: string;
  floorPlanId: string;
  floorPlanImage: string;
  status: InventoryStatus;
};
