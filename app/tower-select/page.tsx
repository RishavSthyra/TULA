import TowerSelect from "@/components/TowerSelect";
import { buildPageMetadata } from "@/lib/metadata";
import { TOWER_SELECTION_IMAGE_URL } from "@/lib/tower-selection-assets";

export const metadata = buildPageMetadata({
  title: "Tower Select",
  description:
    "Choose between towers and continue into the TULA Whispers of Trees apartment exploration flow.",
  keywords: [
    "tower select",
    "tower chooser",
    "TULA Whispers of Trees towers",
    "apartment selection",
  ],
});

export default function MasterPlanPage() {
  return (
    <div className="relative h-dvh overflow-hidden bg-zinc-50 dark:bg-black">
      <link
        rel="preload"
        as="image"
        href={TOWER_SELECTION_IMAGE_URL}
        fetchPriority="high"
      />
      <div className="">
        <TowerSelect />
      </div>
    </div>
  );
}
