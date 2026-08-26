# Exterior Walkthrough Targeted Loading Design

## Goal

Make the exterior walkthrough open and navigate quickly on average internet connections without changing its UI, responsive behavior, transitions, navigation graph, or final 12K panorama quality.

The walkthrough must support both adjacent movement and distant jumps, such as selecting pano 120 from pano 20 through the minimap or amenity controls.

## Current Problem

The current warmup profiles can fetch every tile in the active panorama and every tile for several neighboring panoramas. Desktop may warm up the active panorama plus ten neighboring panoramas. The initial cover also waits for the second panorama's full manual tile warmup.

With panoramas measuring approximately 25–38 MB each, these background requests can consume hundreds of megabytes, compete with the selected destination, and make both initial entry and navigation slower.

## Selected Approach

Use targeted preview-first loading.

Every navigation target follows this sequence:

1. Resolve and display the target's lightweight preview.
2. Prioritize only the tiles around the target's starting camera direction.
3. Allow Photo Sphere Viewer to request additional visible tiles as the user turns or zooms.
4. Warm a small surrounding tile ring only after the critical target work completes.
5. Do not download complete neighboring panoramas in the background.

This keeps distant jumps responsive without preloading every possible destination.

## Loading Profiles

Profiles remain device-aware but use bounded request counts.

### Desktop

- Active targeted warmup: at most 20 tiles.
- Active surrounding warmup: at most 12 additional tiles.
- Neighbor destinations: at most 2 likely nodes.
- Each neighbor: preview plus at most 8 focus tiles.
- Manual tile concurrency: at most 6 requests per batch.

### Compact and Touch Devices

- Active targeted warmup: at most 12 tiles.
- Active surrounding warmup: at most 6 additional tiles.
- Neighbor destinations: at most 1 likely node.
- Each neighbor: preview plus at most 4 focus tiles.
- Manual tile concurrency: at most 3 requests per batch.

Apple touch fallback behavior remains preview-based and unchanged except that it must not trigger unnecessary tile warmups.

## Initial Entry

The branded initial cover must depend only on the first panorama becoming usable. It must not wait for a complete second-panorama tile warmup.

After the first panorama is usable, the cover is dismissed. The next likely panorama preview and its small focus-tile set may warm in the background without blocking entry.

## Distant Navigation

When the user selects a distant panorama or amenity:

1. Mark all previous background warmup runs as stale.
2. Resolve and preload the selected target preview at high priority.
3. Show the existing transition overlay using that preview.
4. Switch Photo Sphere Viewer to the selected panorama.
5. Warm the selected starting viewport tiles at high priority.
6. Resume only a small amount of low-priority neighboring work after the destination is usable.

The existing camera alignment, transition styling, controls, minimap behavior, and responsive layout remain unchanged.

## Cancellation and Scheduling

Warmup work receives a generation token. Starting a navigation or a newer warmup increments the token. Workers check that token before resolving another tile, so stale batches stop scheduling new requests.

Already-started browser image requests may finish, but bounded concurrency and small batches prevent them from monopolizing the connection. Critical destination loading is never queued behind a complete neighboring panorama.

## Asset Resolution

The existing signed-asset cache remains in use. Metadata and signed URL results continue to be cached. This change does not alter asset authorization or CDN paths.

WebP tile metadata will be used automatically after the new tiles and matching `meta.json` files are uploaded. Until then, the same loading strategy works with the current JPEG tiles.

## Failure Handling

- If target tile loading fails, keep the target preview visible while Photo Sphere Viewer retries or falls back through the existing error path.
- Neighbor warmup failures remain non-blocking.
- A failed or missing neighbor must never keep the initial cover visible.
- Stale warmup cancellation must not change the selected node or show an error.

## Scope Boundaries

This implementation will not:

- Change the walkthrough UI or responsiveness.
- Change panorama naming, amenity naming, minimap coordinates, or navigation data.
- Generate a multiresolution pyramid.
- Change tile quality or format.
- Replace Photo Sphere Viewer.

## Verification

Static verification:

- ESLint passes for changed files.
- TypeScript compilation passes.
- Existing unrelated working-tree changes remain untouched.

Behavior verification:

- Initial cover dismisses when the first panorama is usable and does not wait for a full second panorama.
- Adjacent movement displays the destination preview before detailed tiles finish.
- A distant jump prioritizes its preview and focus tiles over stale neighbor work.
- Desktop background warmup never schedules complete tile sets for ten neighbors.
- Compact devices use the lower request limits.
- Existing UI and responsive classes are unchanged.

Network acceptance criteria:

- Initial background warmup is bounded to the first visible tile set plus one small next-target warmup.
- A navigation run schedules no more than the profile's target and surrounding limits manually.
- Neighbor warmup stays within the profile's node and tile limits.
