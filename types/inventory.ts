export type TowerType = "Tower A" | "Tower B";

export type InventoryStatus = "Available" | "Reserved" | "Sold";

export type InventoryFacing = "North" | "South" | "East" | "West";

export type InventoryApartment = {
  id: string;
  title: string;
  flatNumber: string;
  tower: TowerType;
  bhk: number;
  priceLakhs: number;
  areaSqft: number;
  floor: number;
  floorLabel: string;
  facing: InventoryFacing;
  status: InventoryStatus;
  roomDimensions: string;
};

export type InventoryAdminRow = {
  id: string;
  tower: TowerType;
  floor: string;
  flatNumber: string;
  bhk: string;
  facing: InventoryFacing;
  areaSqft: number;
  roomDimensions: string;
  status: InventoryStatus;
};
