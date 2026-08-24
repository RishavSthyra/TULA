# Exterior Panorama Source Replacement Design

## Goal

Replace the current exterior walkthrough panorama sequence with the new 221-node `PANO_Spline` sequence while preserving the existing viewer experience and loading behavior. Apply the change to both repository defaults and the stored MongoDB draft/published runtime configuration.

## Source Data and Asset Paths

- Navigation data: `data/TULA Landscape 20082026 PANO_pano_walkthrough_data_2.json`
- Node range: `PANO_Spline_F0000` through `PANO_Spline_F0220`
- Panorama folder range: `LS_PANO_Spline_F0000` through `LS_PANO_Spline_F0220`
- R2/CDN base key: `TULA/Panos/exterior-pano-remaining`
- Temporary initial node: `PANO_Spline_F0000`
- Initial preview key: `TULA/Panos/exterior-pano-remaining/LS_PANO_Spline_F0000/preview.jpg`

The initial node is intentionally temporary and may be changed in a later task. This change must keep `PANO_Spline_F0000` as the starting node.

## Viewer and Loading Behavior

The existing `ExteriorPanoWalkthrough` loading pipeline remains unchanged. The new source uses the already-supported panorama metadata schema:

- Equirectangular size: 12,288 × 6,144
- Grid: 16 columns × 8 rows
- Tile size: 768 × 768
- Preview: `preview.jpg`
- Tile template: `tiles/tile_{col}_{row}.jpg`

The replacement retains:

- initial preview preloading and CDN preconnection;
- preview-first panorama display;
- signed metadata, preview, and tile URLs;
- active and neighboring pano tile warmup;
- bounded resolved-panorama caching;
- directional and sequential navigation;
- device-specific warmup profiles;
- transitions, retries, and preview fallbacks.

No preload limits, concurrency values, transition behavior, or viewer controls will be changed in this task.

## Amenity Compatibility

The new spline uses different node identifiers. Existing amenity definitions will retain their current names, descriptions, images, and grouping, but their old pano stops will be mapped to the nearest new node using planar `x`/`y` coordinates. Duplicate mapped stops within an amenity will be removed while preserving order.

This is a temporary compatibility layer. The new spline does not pass close to every old amenity location, so some mappings are approximate. Amenity naming/content and final starting viewpoints are explicitly deferred.

## Minimap Scope

The existing minimap image, bounds, layout, styling, and controls remain untouched. Recalibrating the minimap for the new spline is deferred to a later task.

## Repository Changes

The implementation will:

1. Use the new navigation JSON for the default exterior runtime configuration.
2. Change the default exterior pano base key, initial node, and initial preview key.
3. Add a deterministic amenity-node compatibility mapping from old locations to new nodes without changing amenity presentation content.
4. Preserve unrelated working-tree changes.

## Stored Runtime Configuration

MongoDB currently contains a published runtime configuration pinned to the old 201-node tour. The implementation will update only the exterior and exterior-amenity fields required for this replacement in:

- the draft exterior configuration;
- the draft amenities configuration;
- the published runtime configuration.

Other runtime sections must not be overwritten. The published version and timestamp will be advanced so the update is auditable. Runtime cache invalidation or expiry must allow the new published data to become visible.

## Validation

Before completion, verify:

- the new JSON contains 221 unique nodes covering `F0000`–`F0220`;
- generated pano IDs match all CDN folder names;
- `F0000` metadata, preview, and representative tiles are reachable;
- amenity mappings resolve only to nodes present in the new graph;
- TypeScript/lint checks for changed files pass;
- a production build succeeds;
- the exterior walkthrough starts at `PANO_Spline_F0000` and loads its preview/tiles;
- MongoDB draft and published exterior configurations report the new base key, 221 nodes, and `PANO_Spline_F0000` initial node.

## Out of Scope

- Selecting the final initial pano
- Renaming or rewriting amenities
- Retuning amenity-specific camera angles
- Replacing or recalibrating the minimap
- Redesigning viewer UI or navigation
- Changing preload, cache, concurrency, or transition tuning
