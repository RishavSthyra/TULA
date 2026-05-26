import rawAmenities from "./AminetiesCoordinates.json";

export type MasterPlanAmenityCoordinate = {
  x: number;
  y: number;
  z: number;
};

export type MasterPlanAmenity = {
  id: string;
  iconKey: MasterPlanAmenityIconKey;
  label: string;
  coordinate: MasterPlanAmenityCoordinate;
};

export type MasterPlanAmenityIconKey =
  | "bird"
  | "business"
  | "clubhouse"
  | "fire"
  | "fitness"
  | "flower"
  | "garden"
  | "nature"
  | "party"
  | "pet"
  | "play"
  | "pool"
  | "rock"
  | "sport"
  | "theater"
  | "track";

const AMENITY_LABEL_OVERRIDES: Record<string, string> = {
  AdventureClimbing_SandPit: "Adventure Climbing / Sand Pit",
  AdventureClimbingSandPit: "Adventure Climbing / Sand Pit",
  AdventureClimbing_Sand_Pit: "Adventure Climbing / Sand Pit",
  AdventureClimbing_Sandpit: "Adventure Climbing / Sand Pit",
  AdventureClimbingSandpit: "Adventure Climbing / Sand Pit",
  AmphiTheater: "Amphitheater",
  BasketBallVolleyballCourt: "Basketball & Volleyball Court",
  BirdPath: "Bird Path",
  BussinessLounge: "Business Lounge",
  CalisthenicsSandPit: "Calisthenics Sand Pit",
  CampFire: "Camp Fire",
  ChildrensPlayArea: "Children's Play Area",
  Culbhouse: "Clubhouse",
  FlowerGarden: "Flower Garden",
  FrisbeeLawn: "Frisbee Lawn",
  FruitGarden: "Fruit Garden",
  FustalCourtTennisCourt: "Futsal Court / Tennis Court",
  G3ClubHouse: "G+3 Clubhouse",
  HammockGarden: "Hammock Garden",
  KidsPool: "Kids Pool",
  LillyPond: "Lily Pond",
  MiyaWakiForest: "Miyawaki Forest",
  MiniCricketStadium: "Mini-Cricket Stadium",
  OutdoorGYM: "Outdoor Gym",
  OutdoorPartyLawn: "Outdoor Party Lawn",
  PetPark: "Pet Park",
  PickleBallcourt: "Pickleball Court",
  PicnicLawn: "Picnic Lawn",
  PineIsland: "Pine Island",
  PlayLawn: "Play Lawn",
  Poolbar: "Pool Bar",
  RockGarden: "Rock Garden",
  SkatingRing: "Skating Ring",
  SwimmingPool: "Swimming Pool",
  TanningLedge: "Tanning Ledge",
  TennikoitCourt: "Tennikoit Court",
  TheWoodsTropicalTrees: "The Woods - Tropical Trees",
  TraditionalGameZone: "Traditional Game Zone",
  WideCyclingTrack: "Wide Cycling Track",
  ZenGarden: "Zen Garden",
};

function normalizeAmenityToken(value: string) {
  return value.replace(/[^a-z0-9]/gi, "");
}

function formatAmenityLabel(label: string) {
  const normalizedToken = normalizeAmenityToken(label);
  const overrideMatch = Object.entries(AMENITY_LABEL_OVERRIDES).find(
    ([token]) => token.toLowerCase() === normalizedToken.toLowerCase(),
  );

  if (overrideMatch) {
    return overrideMatch[1];
  }

  return label
    .replace(/_/g, " ")
    .replace(/&/g, " & ")
    .replace(/-/g, " - ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function createAmenityId(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferAmenityIconKey(label: string): MasterPlanAmenityIconKey {
  const normalizedLabel = formatAmenityLabel(label).toLowerCase();

  if (
    normalizedLabel.includes("clubhouse") ||
    normalizedLabel.includes("club house")
  ) {
    return "clubhouse";
  }

  if (normalizedLabel.includes("business")) {
    return "business";
  }

  if (normalizedLabel.includes("amphitheater")) {
    return "theater";
  }

  if (
    normalizedLabel.includes("pool") ||
    normalizedLabel.includes("tanning")
  ) {
    return "pool";
  }

  if (normalizedLabel.includes("camp fire")) {
    return "fire";
  }

  if (
    normalizedLabel.includes("gym") ||
    normalizedLabel.includes("calisthenics")
  ) {
    return "fitness";
  }

  if (
    normalizedLabel.includes("cycling") ||
    normalizedLabel.includes("track")
  ) {
    return "track";
  }

  if (normalizedLabel.includes("bird")) {
    return "bird";
  }

  if (normalizedLabel.includes("pet")) {
    return "pet";
  }

  if (
    normalizedLabel.includes("play") ||
    normalizedLabel.includes("children") ||
    normalizedLabel.includes("adventure")
  ) {
    return "play";
  }

  if (
    normalizedLabel.includes("court") ||
    normalizedLabel.includes("stadium") ||
    normalizedLabel.includes("skating") ||
    normalizedLabel.includes("frisbee") ||
    normalizedLabel.includes("game zone")
  ) {
    return "sport";
  }

  if (
    normalizedLabel.includes("rock")
  ) {
    return "rock";
  }

  if (
    normalizedLabel.includes("party") ||
    normalizedLabel.includes("picnic")
  ) {
    return "party";
  }

  if (
    normalizedLabel.includes("butterfly") ||
    normalizedLabel.includes("flower") ||
    normalizedLabel.includes("lily")
  ) {
    return "flower";
  }

  if (
    normalizedLabel.includes("garden") ||
    normalizedLabel.includes("forest") ||
    normalizedLabel.includes("woods") ||
    normalizedLabel.includes("trees") ||
    normalizedLabel.includes("park") ||
    normalizedLabel.includes("island")
  ) {
    return "garden";
  }

  return "nature";
}

export const masterPlanAmenities = Object.entries(
  rawAmenities as Record<string, MasterPlanAmenityCoordinate>,
).map(([label, coordinate]) => ({
  coordinate,
  id: createAmenityId(label),
  iconKey: inferAmenityIconKey(label),
  label: formatAmenityLabel(label),
})) satisfies MasterPlanAmenity[];
