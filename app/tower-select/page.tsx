import TowerSelect from "@/components/TowerSelect";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Tower Select",
  description:
    "Choose between towers and continue into the Trifecta Veranza apartment exploration flow.",
  keywords: [
    "tower select",
    "tower chooser",
    "Trifecta Veranza towers",
    "apartment selection",
  ],
});

export default function MasterPlanPage() {
  return (
    <div className="relative h-dvh overflow-hidden bg-zinc-50 dark:bg-black">
      <div className="">
        <TowerSelect />
      </div>
    </div>
  );
}
