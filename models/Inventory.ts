import mongoose, { Schema, type Model } from "mongoose";
import type { InventoryFacing, InventoryStatus, TowerType } from "@/types/inventory";

export type InventoryDocument = {
  Tower: TowerType;
  Floor: string;
  Flat_Number: string;
  BHK: string;
  Facing: InventoryFacing;
  Super_Built_Up_Area_sqft: string;
  Room_Dimensions?: string;
  status?: InventoryStatus | "Booked";
};

const inventorySchema = new Schema<InventoryDocument>(
  {
    Tower: {
      type: String,
      required: true,
      enum: ["Tower A", "Tower B"],
      trim: true,
    },
    Floor: {
      type: String,
      required: true,
      trim: true,
    },
    Flat_Number: {
      type: String,
      required: true,
      trim: true,
    },
    BHK: {
      type: String,
      required: true,
      trim: true,
    },
    Facing: {
      type: String,
      required: true,
      enum: ["North", "South", "East", "West"],
      trim: true,
    },
    Super_Built_Up_Area_sqft: {
      type: String,
      required: true,
      trim: true,
    },
    Room_Dimensions: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Available", "Reserved", "Sold", "Booked"],
      default: "Available",
    },
  },
  {
    collection: "inventory",
  },
);

const Inventory =
  (mongoose.models.Inventory as Model<InventoryDocument>) ||
  mongoose.model<InventoryDocument>("Inventory", inventorySchema, "inventory");

export default Inventory;
