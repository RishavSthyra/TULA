export type MasterPlanArrowPoint = {
  id: string;
  x: number; 
  y: number; 
  rotation?: number;
  scale?: number;
  label?: string;
};

export const masterPlanArrowPoints: MasterPlanArrowPoint[] = [
  {
    id: "point-1",
    x: 22,
    y: 28,
    rotation: 0,
    scale: 1,
    label: "Tower A",
  },
  {
    id: "point-2",
    x: 48,
    y: 42,
    rotation: 20,
    scale: 1.1,
    label: "Clubhouse",
  },
  {
    id: "point-3",
    x: 70,
    y: 30,
    rotation: -18,
    scale: 0.95,
    label: "Entry",
  },
  {
    id: "point-4",
    x: 60,
    y: 68,
    rotation: 8,
    scale: 1.05,
    label: "Garden",
  },
];