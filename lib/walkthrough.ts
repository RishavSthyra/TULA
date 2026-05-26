import type { InventoryApartment, TowerType } from "@/types/inventory";

type SearchParamsLike = {
  get: (name: string) => string | null;
};

export type WalkthroughMode = "furnished" | "bare-shell";

export type WalkthroughContext = {
  apartmentId: string | null;
  flatNumber: string | null;
  tower: TowerType | null;
  floorLabel: string | null;
  bhk: number | null;
};

export function buildWalkthroughHref(options?: {
  apartment?: Pick<
    InventoryApartment,
    "id" | "flatNumber" | "tower" | "floorLabel" | "bhk"
  >;
  mode?: WalkthroughMode;
}) {
  const params = new URLSearchParams();

  if (options?.mode === "bare-shell") {
    params.set("mode", "bare-shell");
  }

  if (options?.apartment) {
    params.set("apartmentId", options.apartment.id);
    params.set("flatNumber", options.apartment.flatNumber);
    params.set("tower", options.apartment.tower);
    params.set("floorLabel", options.apartment.floorLabel);
    params.set("bhk", String(options.apartment.bhk));
  }

  const query = params.toString();
  return query ? `/walkthrough?${query}` : "/walkthrough";
}

export function getWalkthroughMode(searchParams: SearchParamsLike): WalkthroughMode {
  return searchParams.get("mode") === "bare-shell" ? "bare-shell" : "furnished";
}

export function getWalkthroughContext(
  searchParams: SearchParamsLike,
): WalkthroughContext {
  const tower = searchParams.get("tower");
  const bhkValue = Number(searchParams.get("bhk"));

  return {
    apartmentId: searchParams.get("apartmentId"),
    flatNumber: searchParams.get("flatNumber"),
    tower: tower === "Tower A" || tower === "Tower B" ? tower : null,
    floorLabel: searchParams.get("floorLabel"),
    bhk: Number.isFinite(bhkValue) && bhkValue > 0 ? bhkValue : null,
  };
}
