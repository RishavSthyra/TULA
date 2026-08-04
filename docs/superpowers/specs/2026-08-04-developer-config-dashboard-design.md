# Developer Configuration Dashboard

## Purpose

Add a separate `/developer` route for managing one global website configuration per codebase. It will let a developer switch the rendered-project inputs without editing source files or redeploying: R2 asset keys, master-plan camera/tracking data, pano data, fallback assets, home media, and amenity media.

The route is intentionally unauthenticated for the first implementation at the user's request. It is not production-secure until protected authentication and authorization are added.

## Scope

The dashboard manages configuration only. Large media assets remain in the existing Cloudflare R2 bucket and are delivered by the existing asset worker. JSON files are uploaded through the dashboard, validated, parsed, and persisted as structured MongoDB data; the original upload is not used at runtime.

The editable modules are:

- Home page media: entry video, hero video, loop video, posters, logo, and fallback images.
- Master plan: renderer label, scrub video, frame count/FPS/aspect, fallback image, snap/hotspot frames, A1–A6 camera position/quaternion/FOV data, target-world tower dummies, tower model keys, and unit-view media.
- Interior tour: furnished and bare-shell pano roots, navigation-node imports, pano naming/labels, minimaps, coordinate bounds, and fallback assets.
- Exterior tour: pano root, navigation-node imports, initial node, minimap/fallback assets, amenity images/videos, and amenity-to-pano mappings.
- Shared fallback/preview assets.

## Data Model

Use dedicated MongoDB collections for dashboard editing:

- `developer_home_configs`
- `developer_master_plan_configs`
- `developer_interior_tour_configs`
- `developer_exterior_tour_configs`
- `developer_amenity_configs`
- `developer_fallback_asset_configs`
- `developer_config_revisions`
- `developer_published_runtime_configs`

Each editable document is a singleton versioned record containing a `draft` value, validation status, timestamps, and a revision number. JSON imports are stored as structured data in their relevant configuration record.

Publishing validates every module and atomically writes one denormalized `developer_published_runtime_configs` snapshot. Public routes read only this compact snapshot rather than querying each editing collection. This preserves the structured editor while keeping runtime reads minimal.

All media references are stored as relative R2 keys or R2 base paths, never pre-signed URLs or secrets. The existing signing mechanism creates fresh delivery URLs at render time.

## Master-Plan Alignment Contract

The dashboard stores target-world anchors for each tower:

- Tower A: `dummy_Ta1` through `dummy_Ta4`
- Tower B: `dummy_Tb1` through `dummy_Tb4`

The GLB model must retain its four embedded helpers named `dummy_a1` through `dummy_a4`. Their positions are model-local and remain in the GLB; they are not a second manually maintained source of truth. The dashboard can display/validate them after loading the configured GLB, while the configured target-world anchors are used for the renderer/tracking alignment data.

Each master-plan hotspot has a key, target frame, camera world position, camera quaternion `[x, y, z, w]`, and horizontal FOV. The configuration must supply consistent coordinate space, units, and axis conversion across cameras, target anchors, and exported GLB models.

## Dashboard UX

Use a clean editorial layout:

- A module sidebar: Overview, Home, Master Plan, Interior, Exterior, Amenities, Shared Assets, Publish.
- Standard fields for scalar values and R2 keys.
- Repeatable forms for camera/dummy/hotspot data.
- JSON file chooser plus paste area for large node arrays; imports show parse errors and summary counts before save.
- Per-module validation status.
- Draft preview and explicit publish controls.

There is only one global configuration. A published configuration is what all public visitors receive. Draft edits remain isolated until publish.

## Runtime Flow and Performance

1. Developer edits a module and saves a draft to its dedicated MongoDB collection.
2. Developer previews the draft through a preview-aware route/session.
3. Publish validates all sections and writes one runtime snapshot.
4. Public pages fetch the cached runtime snapshot once per relevant route.
5. The browser requests videos, GLBs, pano previews, tiles, and images directly from the unchanged asset worker/R2 bucket.

MongoDB stores small configuration and pano-navigation metadata only. It must not proxy or contain media blobs. Publishing invalidates the runtime configuration cache so the new snapshot is used without a git push or deployment.

## Error Handling and Validation

- Validate R2 keys as safe relative keys and reject signed URLs.
- Validate master-plan frame numbers, positive FPS, aspect ratio, and exactly the expected A1–A6 hotspot keys unless deliberately configured otherwise.
- Validate camera quaternions are finite and normalized (or normalizable).
- Validate all four target-world anchors exist for each configured tower.
- Validate pano node imports have required node identifiers, positions, orientation values, and image names.
- Validate configured initial pano/amenity node IDs exist in imported exterior data.
- Verify required fallback assets are configured before publishing.
- Leave the currently published snapshot unchanged if any validation fails.

## Public-Code Migration

Current pages import many configuration values statically from source files. They will be changed to resolve the published runtime snapshot and pass it into the existing components. Components preserve their current behavior, but paths and data become props/runtime configuration rather than fixed imports.

The existing R2 bucket and asset worker remain unchanged.

## Testing

- Unit-test schema validation and JSON import parsing.
- API-test draft save, validation errors, preview retrieval, and atomic publish.
- Verify a configuration change updates a public route without a rebuild.
- Verify assets still load through the current signed worker URLs.
- Validate missing files, malformed JSON, unknown pano IDs, invalid quaternions, and incomplete master-plan anchors cannot publish.
- End-to-end test Home, Master Plan, Interior Tour, Exterior Tour, and Amenities with a representative configuration.

## Deliberate Deferred Work

- Authentication and role-based authorization for `/developer`.
- Direct media upload to R2.
- Multiple projects/configurations per codebase.
