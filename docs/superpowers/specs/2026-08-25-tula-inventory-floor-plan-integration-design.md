# TULA inventory and floor-plan integration

## Goal

Integrate the validated `data/floor_plan_mapping.json` into the existing Trifecta-style inventory workflow, connect that workflow to the MongoDB deployment configured by `TULA_MONGO_DB`, upsert all 294 apartments, and display the correct local floor-plan image and mapped unit details throughout the masterplan and unit-detail interfaces.

## Source-of-truth boundaries

- MongoDB owns mutable inventory state: document identity, availability status, and administrator updates.
- `data/floor_plan_mapping.json` owns CAD-derived layout data: tower, flat, applicable floors, unit type, facing, saleable/carpet/balcony areas, room dimensions, plan ID, and image mapping.
- The seed process copies the mapped fields into MongoDB for a complete, inspectable inventory collection.
- Server-side inventory normalization also resolves the JSON mapping by tower, flat, and floor. This ensures corrected CAD data is used by the UI even if a previously seeded Mongo document contains stale descriptive fields.

## MongoDB connection

- Replace the inventory connection URI source with `TULA_MONGO_DB`.
- Retain the existing cached Mongoose connection because the legacy schema, admin routes, and ObjectId-based updates already depend on Mongoose.
- Pass MongoDB Stable API v1 options with strict mode and deprecation errors enabled.
- Use the database encoded in the connection string unless `MONGODB_DB_NAME` is explicitly configured.
- Never log or expose the connection string.

## Inventory schema

The existing Trifecta fields remain compatible:

- `Tower`
- `Floor`
- `Flat_Number`
- `BHK`
- `Facing`
- `Super_Built_Up_Area_sqft`
- `Room_Dimensions`
- `status`

The schema will support Towers A, B, C, and D and add:

- `Unit_Key`: stable unique key in `tower:floor:flat` form
- `Unit_Type`
- `RERA_Carpet_Area_sqft`
- `Balcony_Area_sqft`
- `Floor_Range`
- `Floor_Plan_Id`
- `Floor_Plan_Image`: browser-safe local public URL for current rendering
- `Floor_Plan_R2_Key`: future Cloudflare R2 object key
- `Floor_Plan_Source_Path`: original path under `public/New Floor Plans`

`Unit_Key` receives a unique index so repeated seed runs are idempotent.

## Seeding and preservation rules

- Expand the 50 floor-range mappings into exactly 294 apartment records.
- Generate unit labels using the DWG convention, such as `A-G01`, `A-101`, and `A-1301`.
- Upsert by `Unit_Key`.
- Update all structural and mapped fields on every run.
- Set `status` to `Available` only for newly inserted records; preserve existing `Available`, `Reserved`, or `Sold` values.
- Do not delete unrelated MongoDB records automatically.
- Add an npm seed command and run it once against the configured TULA deployment after validation.

## Runtime mapping and types

- Build a typed mapping resolver keyed by normalized tower code, two-digit flat number, and numeric floor.
- Expand `TowerType` and every tower parser/filter to Towers A-D.
- Add mapped unit fields to `InventoryApartment` and `InventoryAdminRow`.
- Normalize 2, 3, 3.5, and 4 BHK values without truncating 3.5 BHK.
- MongoDB supplies the document ID and status; mapped JSON values supply layout descriptions and images.
- If a MongoDB record cannot resolve to a mapping, log it once and skip it instead of displaying a wrong plan.

## UI integration

- Replace the old `unitPlans[flat-ending]` floor-plan lookup with `apartment.floorPlanImage`.
- Replace the hardcoded preview frame in `SelectedFlatDetailsPanel` with the selected apartment’s mapped local image.
- Continue using the existing pipe-separated room-dimension parser, now populated from mapped JSON.
- Display mapped saleable area as the primary area and expose carpet/balcony area and unit type where the unit panels have relevant detail sections.
- Add Towers C and D to masterplan filters, tower selection, and admin filters.
- Make hotspot filtering safe for all four towers. Where the copied two-tower hotspot configuration has no C/D positional definition, do not hide valid C/D inventory solely because that legacy lookup is absent.

## Local image strategy and R2 migration

- Current image URLs resolve from `public/New Floor Plans` and URL-encode path segments safely.
- Components consume a single `floorPlanImage` field and do not construct storage URLs themselves.
- `Floor_Plan_R2_Key` remains available in each record. A later migration can change the server-side image resolver to return signed R2 URLs without changing panel components.

## Error handling

- Missing `TULA_MONGO_DB` produces a clear server startup/seed error.
- The seed command verifies mapping coverage and local image existence before connecting or writing.
- Bulk-write failures report counts and fail with a nonzero exit code without printing credentials.
- Runtime records with invalid tower/floor/flat/status values are reported once and excluded.
- Existing admin status updates continue to use MongoDB ObjectIds and remain status-only mutations.

## Verification

- Assert 46 unique floor-plan records and 50 logical mapping ranges.
- Assert exactly 294 unique `Unit_Key` values with no missing or overlapping apartment assignments.
- Assert every local image exists.
- Run the seed command and verify 294 successful upserts/matches while preserving statuses.
- Run targeted mapping tests, TypeScript checking, ESLint, and the production build.
- Inspect representative ground, first, even, and odd units from each tower in the masterplan and detail panels.

## Out of scope

- Uploading floor plans to Cloudflare R2.
- Redesigning the existing masterplan or unit-detail UI.
- Inventing tower hotspot coordinates not present in the supplied mapping or CAD data.
