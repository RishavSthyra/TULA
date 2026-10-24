import { Suspense } from "react";
import InteriorPanoWalkthrough, {
  type InteriorPanoMinimapConfig,
} from "@/components/tour/InteriorPanoWalkthrough";
import TulaInteriorMinimap from "@/assets/floorplans/tula-interior-minimap.png";
import kitchenFoyerNavData from "@/data/Interior Kitchen and Foyer_Pano_pano_walkthrough_data.json";
import { buildPageMetadata } from "@/lib/metadata";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import type { InteriorDeveloperConfig } from "@/types/developer-config";

const KITCHEN_FOYER_PANO_BASE_PATH =
  "TULA/Panos/interior-kitchen-foyer-v1/";
const KITCHEN_FOYER_BARE_SHELL_PANO_BASE_PATH =
  "TULA/Panos/interior-kitchen-foyer-bare-shell-v1/";
const KITCHEN_FOYER_BALCONY_PANO_BASE_PATH =
  "TULA/Panos/interior-balcony-v1/";

const KITCHEN_FOYER_BLOCKED_NAVIGATION_PAIRS = [
  ["spline_pano_01_F0006", "spline_pano_05_F0025"],
  ["spline_pano_01_F0007", "spline_pano_05_F0025"],
  ["spline_pano_01_F0008", "spline_pano_01_F0012"],
  ["spline_pano_01_F0008", "spline_pano_05_F0024"],
  ["spline_pano_01_F0009", "spline_pano_01_F0012"],
  ["spline_pano_01_F0010", "spline_pano_04_F0023"],
  ["spline_pano_03_F0017", "spline_pano_04_F0021"],
] as const;

const KITCHEN_FOYER_ADDITIONAL_NAVIGATION_PAIRS = [
  ["spline_pano_01_F0006", "spline_pano_01_F0007"],
  ["spline_pano_03_F0018", "spline_pano_04_F0019"],
] as const;

const KITCHEN_FOYER_EXCLUDED_NODE_IDS = new Set([
  "spline_pano_02_F0015",
]);

const KITCHEN_FOYER_NODES = (
  kitchenFoyerNavData as ExteriorPanoNodeSource[]
).filter(({ id }) => !KITCHEN_FOYER_EXCLUDED_NODE_IDS.has(id));

// Confirmed local placement for the two real balcony renders. The modelling
// team confirmed X/Z; visual verification established that both use negative Y.
const KITCHEN_FOYER_BALCONY_NODES: ExteriorPanoNodeSource[] = [
  {
    id: "tula_balcony_render2",
    x: -725.467,
    y: -271.595,
    z: 150,
    pitch: 0,
    yaw: 0,
    roll: 0,
    frame: 9001,
    image_filename: "render2.png",
    facing_axis: "+X",
    forward_vector: { x: 1, y: 0, z: 0 },
    right_vector: { x: 0, y: -1, z: 0 },
    left_vector: { x: 0, y: 1, z: 0 },
  },
  {
    id: "tula_balcony_render3",
    x: 139.376,
    y: -271.595,
    z: 150,
    pitch: 0,
    yaw: 0,
    roll: 0,
    frame: 9002,
    image_filename: "render3.png",
    facing_axis: "+X",
    forward_vector: { x: 1, y: 0, z: 0 },
    right_vector: { x: 0, y: -1, z: 0 },
    left_vector: { x: 0, y: 1, z: 0 },
  },
];

const KITCHEN_FOYER_NAVIGATION_YAW_OVERRIDES = [
  ["spline_pano_03_F0018", "spline_pano_04_F0019", 0],
  ["spline_pano_04_F0019", "spline_pano_03_F0018", 180],
] as const;

// These are the final, hand-placed positions for the furnished minimap. Keep
// them as explicit percentages: the render-world coordinates do not align
// precisely enough with the floor-plan artwork to derive them automatically.
const KITCHEN_FOYER_MINIMAP_POINTS = {
  spline_pano_01_F0000: { left: 11.58, top: 75.4 },
  spline_pano_01_F0001: { left: 11.69, top: 61.26 },
  spline_pano_01_F0002: { left: 19.71, top: 60.89 },
  spline_pano_01_F0003: { left: 30.01, top: 61.55 },
  spline_pano_01_F0004: { left: 39.48, top: 62 },
  spline_pano_01_F0005: { left: 48, top: 62.18 },
  spline_pano_01_F0006: { left: 56.19, top: 61.7 },
  spline_pano_01_F0007: { left: 66.34, top: 61.07 },
  spline_pano_01_F0008: { left: 77.75, top: 60.28 },
  spline_pano_01_F0009: { left: 78.04, top: 49.21 },
  spline_pano_01_F0010: { left: 80.59, top: 37.46 },
  spline_pano_01_F0011: { left: 86.33, top: 30.46 },
  spline_pano_02_F0013: { left: 18.3, top: 47.76 },
  spline_pano_02_F0014: { left: 13.76, top: 36.66 },
  spline_pano_03_F0016: { left: 38.2, top: 52.54 },
  spline_pano_03_F0017: { left: 37.31, top: 40.64 },
  spline_pano_03_F0018: { left: 48.1, top: 77.9 },
  spline_pano_04_F0019: { left: 47.56, top: 69.93 },
  spline_pano_04_F0020: { left: 46.39, top: 55.53 },
  spline_pano_04_F0021: { left: 47.96, top: 45.65 },
  spline_pano_04_F0022: { left: 53.39, top: 42.61 },
  spline_pano_05_F0024: { left: 65.61, top: 75.92 },
  spline_pano_05_F0026: { left: 60.22, top: 53.7 },
  spline_pano_05_F0027: { left: 60.13, top: 45.78 },
  // Hand-placed balcony positions for the confirmed negative-Y nodes.
  // They do not alter any of the existing hand-placed furnished-tour dots.
  tula_balcony_render2: { left: 15.87, top: 23.43 },
  tula_balcony_render3: { left: 60.09, top: 22.37 },
} satisfies NonNullable<InteriorPanoMinimapConfig["pointPositions"]>;

// Kept as data rather than removed, so the four dots can be previewed again
// immediately with `?all-points=1` on the interior-tour URL.
const KITCHEN_FOYER_HIDDEN_MINIMAP_NODE_IDS = [
  "spline_pano_01_F0009",
  "spline_pano_04_F0019",
  "spline_pano_04_F0020",
  "spline_pano_04_F0022",
] as const;

const KITCHEN_FOYER_MINIMAP = {
  image: TulaInteriorMinimap,
  worldBounds: {
    bottomLeft: { x: -850, y: -450 },
    topRight: { x: 800, y: 400 },
  },
  pointPositions: KITCHEN_FOYER_MINIMAP_POINTS,
  hiddenNodeIds: KITCHEN_FOYER_HIDDEN_MINIMAP_NODE_IDS,
  // These are the panos that have a confirmed hand-placed dot. F0012 was
  // explicitly excluded; F0015 is not a usable pano; F0023/F0025 have no
  // confirmed location, so they are not guessed on the plan.
  visibleNodeIds: Object.keys(KITCHEN_FOYER_MINIMAP_POINTS),
} satisfies InteriorPanoMinimapConfig;

const kitchenFoyerConfig: InteriorDeveloperConfig = {
  furnishedPanoBasePath: KITCHEN_FOYER_PANO_BASE_PATH,
  bareShellPanoBasePath: KITCHEN_FOYER_BARE_SHELL_PANO_BASE_PATH,
  balconyPanoBasePath: KITCHEN_FOYER_BALCONY_PANO_BASE_PATH,
  furnishedNodes: KITCHEN_FOYER_NODES,
  bareShellNodes: KITCHEN_FOYER_NODES,
  balconyNodes: KITCHEN_FOYER_BALCONY_NODES,
  furnishedInitialNodeId: "spline_pano_03_F0018",
  bareShellInitialNodeId: "spline_pano_03_F0018",
};

export const metadata = buildPageMetadata({
  title: "Kitchen and Foyer Interior Walkthrough",
  description:
    "Explore the TULA kitchen and foyer through an interactive panoramic walkthrough.",
  keywords: [
    "TULA interior walkthrough",
    "kitchen panorama",
    "foyer panorama",
  ],
});

export default function InteriorKitchenFoyerPage() {
  return (
    <main className="h-dvh w-full bg-[#0a0a0a]">
      <Suspense fallback={<div className="h-full w-full bg-[#0a0a0a]" />}>
        <InteriorPanoWalkthrough
          className="h-full w-full rounded-none border-0"
          config={kitchenFoyerConfig}
          initialNodeId="spline_pano_03_F0018"
          additionalNavigationPairs={KITCHEN_FOYER_ADDITIONAL_NAVIGATION_PAIRS}
          blockedNavigationPairs={KITCHEN_FOYER_BLOCKED_NAVIGATION_PAIRS}
          navigationYawOverrides={KITCHEN_FOYER_NAVIGATION_YAW_OVERRIDES}
          minimap={KITCHEN_FOYER_MINIMAP}
          showMinimap
          showModeToggle
          showDimensionsToggle={false}
          preserveNodeOnModeToggle
          panoOnly
          preserveViewDirection
        />
      </Suspense>
    </main>
  );
}
