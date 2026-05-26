import FloorPlan2D_01 from "@/assets/Tower_A_01_2D.webp";
import FloorPlan3D_01 from "@/assets/Tower_A_01_3D.webp";

import FloorPlan2D_02 from "@/assets/Tower_A_02_2D.webp";
import FloorPlan3D_02 from "@/assets/Tower_A_02_3D.webp";

import FloorPlan2D_03 from "@/assets/Tower_A_03_2D.webp";
import FloorPlan3D_03 from "@/assets/Tower_A_03_3D.webp";

import FloorPlan2D_04 from "@/assets/Tower_A_04_2D.webp";
import FloorPlan3D_04 from "@/assets/Tower_A_04_3D.webp";

import FloorPlan2D_05 from "@/assets/Tower_A_05_2D.webp";
import FloorPlan3D_05 from "@/assets/Tower_A_05_3D.webp";

import FloorPlan2D_06 from "@/assets/Tower_A_06_2D.webp";
import FloorPlan3D_06 from "@/assets/Tower_A_05_3D.webp";

import type { StaticImageData } from "next/image";

export type UnitPlanSpec = {
  name: string;
  size: string;
};

export type UnitPlanItem = {
  id: string;
  series: string;
  towerA: string;
  towerB?: string;
  bhk: string;
  facing: string;
  areaLabel: string;
  areaValue: string;
  description: string;
  image2D: StaticImageData;
  image3D: StaticImageData;
  specs: UnitPlanSpec[];
};

export const unitPlans: UnitPlanItem[] = [
  {
    id: "tower-a-01",
    series: "Series 01",
    towerA: "Tower A - 01",
    towerB: "Tower B - 07",
    bhk: "3 BHK",
    facing: "East facing",
    areaLabel: "Super Built-up Area",
    areaValue: "1745 sq.ft.",
    description:
      "Signature corner layout with expansive living proportions and balanced circulation.",
    image2D: FloorPlan2D_01,
    image3D: FloorPlan3D_01,
    specs: [
      { name: "Foyer", size: `5'1" × 6'4"` },
      { name: "Living & Dining", size: `27'1" × 11'10"` },
      { name: "Kitchen & Utility", size: `11'0" × 11'0"` },
      { name: "M.Toilet", size: `5'0" × 8'0"` },
      { name: "M.Bedroom", size: `16'2" × 11'0"` },
      { name: "Balcony 1", size: `6'0" × 11'10"` },
      { name: "Balcony 2", size: `4'0" × 11'4"` },
      { name: "Bedroom 03", size: `11'0" × 11'4"` },
      { name: "A.Toilet", size: `5'0" × 8'0"` },
      { name: "C.Toilet", size: `5'0" × 8'0"` },
      { name: "Bedroom 02", size: `10'9" × 11'4"` },
    ],
  },

  {
    id: "tower-a-02",
    series: "Series 02",
    towerA: "Tower A - 02",
    towerB: "Tower B - 08",
    bhk: "3 BHK",
    facing: "North facing",
    areaLabel: "Super Built-up Area",
    areaValue: "1340 sq.ft.",
    description:
      "Efficient 3 BHK layout with clear zoning between living, dining, and bedroom spaces.",
    image2D: FloorPlan2D_02,
    image3D: FloorPlan3D_02,
    specs: [
      { name: "Living", size: `14'1" × 10'10"` },
      { name: "Bedroom 02", size: `10'0" × 11'4"` },
      { name: "Kitchen", size: `13'7" × 7'0"` },
      { name: "Utility", size: `5'3" × 5'0"` },
      { name: "M.Toilet", size: `5'0" × 8'0"` },
      { name: "M.Bedroom", size: `12'6" × 11'0"` },
      { name: "Balcony", size: `5'0" × 9'0"` },
      { name: "Dinning", size: `11'3" × 9'0"` },
      { name: "C.Toilet", size: `8'0" × 5'0"` },
      { name: "Bedroom 03", size: `12'0" × 9'0"` },
    ],
  },

  {
    id: "tower-a-03",
    series: "Series 03",
    towerA: "Tower A - 03",
    towerB: "Tower B - 09",
    bhk: "3 BHK",
    facing: "East facing",
    areaLabel: "Super Built-up Area",
    areaValue: "1495 sq.ft.",
    description:
      "Elongated 3 BHK plan with generous living-dining volume and dual balconies.",
    image2D: FloorPlan2D_03,
    image3D: FloorPlan3D_03,
    specs: [
      { name: "Living & Dining", size: `22'9" × 12'0"` },
      { name: "Bedroom 02", size: `11'0" × 12'0"` },
      { name: "C.Toilet", size: `5'0" × 8'0"` },
      { name: "Balcony 2", size: `8'0" × 4'0"` },
      { name: "Bedroom 03", size: `11'0" × 12'0"` },
      { name: "Balcony 1", size: `5'0" × 12'0"` },
      { name: "M.Bedroom", size: `13'6" × 12'0"` },
      { name: "M.Toilet", size: `5'0" × 8'0"` },
      { name: "Kitchen & Utility", size: `8'2" × 12'0"` },
    ],
  },

  {
    id: "tower-a-04",
    series: "Series 04",
    towerA: "Tower A - 04",
    towerB: "Tower B - 10",
    bhk: "3 BHK",
    facing: "West facing",
    areaLabel: "Super Built-up Area",
    areaValue: "1495 sq.ft.",
    description:
      "Mirror variant of the 1495 sq.ft. series with west-facing orientation and balanced bedroom zoning.",
    image2D: FloorPlan2D_04,
    image3D: FloorPlan3D_04,
    specs: [
      { name: "Living & Dining", size: `22'9" × 12'0"` },
      { name: "Bedroom 02", size: `11'0" × 12'0"` },
      { name: "C.Toilet", size: `5'0" × 8'0"` },
      { name: "Balcony 2", size: `8'0" × 4'0"` },
      { name: "Bedroom 03", size: `11'0" × 12'0"` },
      { name: "Balcony 1", size: `5'0" × 12'0"` },
      { name: "Kitchen & Utility", size: `8'2" × 12'0"` },
      { name: "M.Toilet", size: `5'0" × 8'0"` },
      { name: "M.Bedroom", size: `13'6" × 12'0"` },
    ],
  },

  {
    id: "tower-a-05",
    series: "Series 05",
    towerA: "Tower A - 05",
    towerB: "Tower B - 11",
    bhk: "2 BHK",
    facing: "Northfacing",
    areaLabel: "Super Built-up Area",
    areaValue: "1165 sq.ft.",
    description:
      "Compact 2 BHK configuration with efficient circulation and a clear living-dining core.",
    image2D: FloorPlan2D_05,
    image3D: FloorPlan3D_05,
    specs: [
      { name: "Living", size: `13'3" × 11'0"` },
      { name: "Bedroom 02", size: `11'0" × 11'0"` },
      { name: "C.Toilet", size: `5'0" × 8'0"` },
      { name: "M.Bedroom", size: `11'0" × 13'6"` },
      { name: "M.Toilet", size: `5'0" × 8'0"` },
      { name: "Kitchen & Utility", size: `8'0" × 11'6"` },
      { name: "Balcony", size: `5'0" × 9'10"` },
      { name: "Dining", size: `11'10" × 11'0"` },
    ],
  },

  {
    id: "tower-a-06",
    series: "Series 06",
    towerA: "Tower A - 06",
    towerB: "Tower B - 12",
    bhk: "3 BHK",
    facing: "West facing",
    areaLabel: "Super Built-up Area",
    areaValue: "1745 sq.ft.",
    description:
      "Large-format 3 BHK with foyer entry, long living-dining span, and two balconies.",
    image2D: FloorPlan2D_06,
    image3D: FloorPlan3D_06,
    specs: [
      { name: "Foyer", size: `5'3" × 6'4"` },
      { name: "Living & Dining", size: `27'1" × 11'10"` },
      { name: "Bedroom 02", size: `10'9" × 11'4"` },
      { name: "C.Toilet", size: `5'0" × 8'0"` },
      { name: "A.Toilet", size: `5'0" × 8'0"` },
      { name: "Bedroom 03", size: `11'0" × 11'4"` },
      { name: "Balcony 2", size: `4'0" × 11'4"` },
      { name: "Balcony 1", size: `6'0" × 11'10"` },
      { name: "Kitchen & Utility", size: `11'0" × 11'0"` },
      { name: "M.Toilet", size: `5'0" × 8'0"` },
      { name: "M.Bedroom", size: `16'2" × 11'0"` },
    ],
  },
];