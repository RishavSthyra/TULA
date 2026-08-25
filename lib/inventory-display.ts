import type { TowerType } from "@/types/inventory";

export function formatBlockLabel(tower: TowerType) {
  return tower.replace(/^Tower\s+/, "Block ");
}
