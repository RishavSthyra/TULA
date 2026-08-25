import mongoose, { Schema, type Model } from "mongoose";
import type { InventoryFacing, InventoryStatus, TowerType } from "@/types/inventory";

export type InventoryDocument = {
  Unit_Key: string;
  Tower: TowerType;
  Floor: string;
  Flat_Number: string;
  BHK: string;
  Unit_Type: string;
  Facing: InventoryFacing;
  Super_Built_Up_Area_sqft: string;
  RERA_Carpet_Area_sqft: string;
  Balcony_Area_sqft: string;
  Floor_Range: string;
  Room_Dimensions?: string;
  Floor_Plan_Id: string;
  Floor_Plan_Image: string;
  Floor_Plan_R2_Key: string;
  Floor_Plan_Source_Path: string;
  status?: InventoryStatus | "Booked";
};

const inventorySchema = new Schema<InventoryDocument>(
  {
    Unit_Key: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      trim: true,
    },
    Tower: {
      type: String,
      required: true,
      enum: ["Tower A", "Tower B", "Tower C", "Tower D"],
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
    Unit_Type: {
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
    RERA_Carpet_Area_sqft: {
      type: String,
      required: true,
      trim: true,
    },
    Balcony_Area_sqft: {
      type: String,
      required: true,
      trim: true,
    },
    Floor_Range: {
      type: String,
      required: true,
      trim: true,
    },
    Room_Dimensions: {
      type: String,
      default: "",
      trim: true,
    },
    Floor_Plan_Id: {
      type: String,
      required: true,
      trim: true,
    },
    Floor_Plan_Image: {
      type: String,
      required: true,
      trim: true,
    },
    Floor_Plan_R2_Key: {
      type: String,
      required: true,
      trim: true,
    },
    Floor_Plan_Source_Path: {
      type: String,
      required: true,
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
