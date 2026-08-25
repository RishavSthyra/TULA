import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

async function findUnavailableFloorPlanImages(urls: string[]) {
  const checks = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(15_000),
        });

        return response.ok ? null : `${url} (${response.status})`;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "request failed";
        return `${url} (${reason})`;
      }
    }),
  );

  return checks.filter((check): check is string => check !== null);
}

async function seedTulaInventory() {
  const [{ connectToDatabase }, { getMappedApartments }, inventoryModule] =
    await Promise.all([
      import("@/lib/mongodb"),
      import("@/lib/floor-plan-mapping"),
      import("@/models/Inventory"),
    ]);
  const Inventory = inventoryModule.default;
  const apartments = getMappedApartments();
  const unitKeys = new Set(apartments.map((apartment) => apartment.unitKey));

  if (apartments.length !== 294 || unitKeys.size !== 294) {
    throw new Error(
      `Inventory seed requires 294 unique apartments; received ${apartments.length}/${unitKeys.size}.`,
    );
  }

  const floorPlanImageUrls = Array.from(
    new Set(apartments.map((apartment) => apartment.floorPlanImage)),
  );
  const unavailableImages = await findUnavailableFloorPlanImages(
    floorPlanImageUrls,
  );
  if (unavailableImages.length > 0) {
    throw new Error(
      `Inventory seed stopped because ${unavailableImages.length} R2 floor-plan images are unavailable:\n${unavailableImages.join("\n")}`,
    );
  }

  await connectToDatabase();

  const operations = apartments.map((apartment) => ({
    updateOne: {
      filter: {
        $or: [
          { Unit_Key: apartment.unitKey },
          {
            Tower: apartment.tower,
            Floor: { $in: getFloorAliases(apartment.floor) },
            Flat_Number: {
              $in: [apartment.unitLabel, apartment.flat],
            },
          },
        ],
      },
      update: {
        $set: {
          Unit_Key: apartment.unitKey,
          Tower: apartment.tower,
          Floor: apartment.floorLabel,
          Flat_Number: apartment.unitLabel,
          BHK: apartment.bhkLabel,
          Unit_Type: apartment.unitType,
          Facing: apartment.facing,
          Super_Built_Up_Area_sqft: String(apartment.saleableAreaSqft),
          RERA_Carpet_Area_sqft: String(apartment.carpetAreaSqft),
          Balcony_Area_sqft: String(apartment.balconyAreaSqft),
          Floor_Range: apartment.floorRange,
          Room_Dimensions: apartment.roomDimensions,
          Floor_Plan_Id: apartment.floorPlanId,
          Floor_Plan_Image: apartment.floorPlanImage,
          Floor_Plan_R2_Key: apartment.floorPlanR2Key,
          Floor_Plan_Source_Path: apartment.floorPlanSourcePath,
        },
        $setOnInsert: { status: "Available" as const },
      },
      upsert: true,
    },
  }));

  const result = await Inventory.bulkWrite(operations, { ordered: false });
  await Inventory.collection.createIndex(
    { Unit_Key: 1 },
    { unique: true, sparse: true },
  );

  const storedCount = await Inventory.countDocuments({
    Unit_Key: { $in: Array.from(unitKeys) },
  });
  if (storedCount !== 294) {
    throw new Error(
      `Inventory verification failed: expected 294 mapped records, found ${storedCount}.`,
    );
  }

  console.log(
    `TULA inventory ready: ${storedCount} mapped apartments (${result.upsertedCount} inserted, ${result.modifiedCount} updated, ${result.matchedCount} matched).`,
  );
}

function getFloorAliases(floor: number) {
  if (floor === 0) return ["G", "Ground", "GROUND", "0"];

  const suffix =
    floor % 100 >= 11 && floor % 100 <= 13
      ? "th"
      : floor % 10 === 1
        ? "st"
        : floor % 10 === 2
          ? "nd"
          : floor % 10 === 3
            ? "rd"
            : "th";
  return [String(floor), `${floor}${suffix}`, `${floor}${suffix.toUpperCase()}`];
}

seedTulaInventory()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "TULA inventory seed failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = await import("mongoose");
    await mongoose.default.disconnect();
  });
