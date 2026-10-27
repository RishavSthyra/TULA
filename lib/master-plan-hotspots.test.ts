import assert from "node:assert/strict";
import test from "node:test";

import {
  MASTER_PLAN_HOTSPOT_FRAMES,
  MASTER_PLAN_HOTSPOT_KEYS,
  getApartmentUnitEnding,
  getNearestMasterPlanHotspot,
  isApartmentIdAllowedAtHotspot,
  isFlatNumberAllowedAtHotspot,
  isInventoryApartmentAllowedAtHotspot,
  type MasterPlanHotspotKey,
} from "./master-plan-hotspots";
import type { TowerType } from "@/types/inventory";

const ALLOWED_ENDINGS: Record<
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

const TOWERS = ["Tower A", "Tower B", "Tower C", "Tower D"] as const;
const UNIT_ENDINGS = ["01", "02", "03", "04", "05", "06"] as const;

test("matches the complete hotspot tower and unit-ending allowlist", () => {
  MASTER_PLAN_HOTSPOT_KEYS.forEach((hotspot) => {
    TOWERS.forEach((tower) => {
      const towerCode = tower.at(-1);

      UNIT_ENDINGS.forEach((unitEnding) => {
        const expected =
          ALLOWED_ENDINGS[hotspot][tower]?.includes(unitEnding) ?? false;

        assert.equal(
          isFlatNumberAllowedAtHotspot(
            hotspot,
            tower,
            `${towerCode}-12${unitEnding}`,
          ),
          expected,
          `${hotspot} ${tower} ${unitEnding}`,
        );
      });
    });
  });
});

test("treats X as every non-negative floor", () => {
  ["00", "01", "07", "12"].forEach((floorCode) => {
    assert.equal(
      isApartmentIdAllowedAtHotspot(
        `Block_A_${floorCode}_${floorCode}05`,
        "A1",
      ),
      true,
    );
    assert.equal(
      isApartmentIdAllowedAtHotspot(
        `Block_A_${floorCode}_${floorCode}06`,
        "A1",
      ),
      false,
    );
  });
});

test("normalizes one- and two-digit flat endings", () => {
  assert.equal(getApartmentUnitEnding("Tower A - 5"), "05");
  assert.equal(getApartmentUnitEnding("A-1205"), "05");
  assert.equal(getApartmentUnitEnding("G05"), "05");
  assert.equal(getApartmentUnitEnding("no flat"), null);
});

test("rejects malformed, unknown, and negative-floor apartment ids", () => {
  [
    null,
    "",
    "Block_E_01_0105",
    "Block_A_-1_0105",
    "Block_A_01",
    "Block_A_01_FOO",
    "Block_A_01_0105_extra",
    "Unknown_A_01_0105",
  ].forEach((apartmentId) => {
    assert.equal(
      isApartmentIdAllowedAtHotspot(apartmentId, "A1"),
      false,
      String(apartmentId),
    );
  });
});

test("rejects inventory apartments on negative floors", () => {
  assert.equal(
    isInventoryApartmentAllowedAtHotspot(
      {
        floor: -1,
        flatNumber: "A-05",
        tower: "Tower A",
      } as Parameters<typeof isInventoryApartmentAllowedAtHotspot>[0],
      "A1",
    ),
    false,
  );
});

test("maps each camera-stop frame to its hotspot", () => {
  MASTER_PLAN_HOTSPOT_FRAMES.forEach((frame, index) => {
    assert.equal(
      getNearestMasterPlanHotspot(frame),
      MASTER_PLAN_HOTSPOT_KEYS[index],
    );
  });
});

test("reverses the quarter-turn hotspot order for the new orbit", () => {
  const expectedKeys = ["A1", "A4", "A3", "A2"] as const;

  MASTER_PLAN_HOTSPOT_FRAMES.forEach((frame, index) => {
    assert.equal(getNearestMasterPlanHotspot(frame, true), expectedKeys[index]);
  });
});
