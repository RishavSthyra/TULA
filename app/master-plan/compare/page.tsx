import { unstable_cache } from "next/cache";
import UnitComparisonPage from "@/components/UnitComparisonPage";
import { getInventoryApartments } from "@/lib/inventory";
import { buildPageMetadata } from "@/lib/metadata";
import type { InventoryApartment } from "@/types/inventory";

export const metadata = buildPageMetadata({
  title: "Compare Residences",
  description: "Compare TULA Whispers of Trees residences side by side.",
});

export const revalidate = 30;

const getCachedInventoryApartments = unstable_cache(
  getInventoryApartments,
  ["master-plan-comparison-inventory"],
  { revalidate: 30, tags: ["inventory"] },
);

type ComparisonSearchParams = Record<string, string | string[] | undefined>;

export default async function MasterPlanComparePage({
  searchParams,
}: {
  searchParams: Promise<ComparisonSearchParams>;
}) {
  let apartments: InventoryApartment[] = [];

  try {
    apartments = await getCachedInventoryApartments();
  } catch {
    console.error("Failed to load inventory for residence comparison.");
  }

  const params = await searchParams;
  const initialUnitIds = Array.isArray(params.units)
    ? params.units
    : params.units
      ? [params.units]
      : [];

  return (
    <UnitComparisonPage
      apartments={apartments}
      initialUnitIds={initialUnitIds}
    />
  );
}
