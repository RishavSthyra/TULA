# Exterior Panorama Optimised Base Path Design

## Goal

Move the existing exterior walkthrough panorama sequence to the optimized CDN directory without changing its nodes, navigation, tile layout, or viewer behavior.

## Source Mapping

- Current base key: `TULA/Panos/exterior-pano-remaining`
- New base key: `TULA/Panos/exterior-pano-remaining-optimised`
- Initial node: `PANO_Spline_F0000`
- New initial preview key: `TULA/Panos/exterior-pano-remaining-optimised/LS_PANO_Spline_F0000/preview.jpg`
- Tile paths remain relative to each panorama folder, such as `tiles/tile_{col}_{row}.jpg`.

The application will continue combining the configured base key, the node's `pano_id`, and its relative preview or tile path. For example, the first tile resolves to:

`https://cdn.sthyra.com/TULA/Panos/exterior-pano-remaining-optimised/LS_PANO_Spline_F0000/tiles/tile_0_0.jpg`

## Configuration Changes

Update only `panoBasePath` and `initialPreviewKey` in these locations:

1. The repository's default exterior runtime configuration.
2. The MongoDB draft exterior configuration.
3. The exterior section inside the MongoDB published runtime configuration.

All other published and draft configuration fields must remain unchanged. In particular, preserve the complete exterior node list, initial node ID, minimap assets, fallback assets, titles, amenity data, published version, and configuration history.

## Failure Handling

The database updates must target the existing global draft and published documents. If either document is absent, stop and report the missing record instead of creating a partial configuration. The repository default remains a safe fallback.

## Validation

After the replacement:

- search the active source tree for the old exterior base key;
- confirm the repository default uses the new base and preview keys;
- read back the MongoDB draft and published values;
- confirm the node counts and initial node IDs were not altered;
- run TypeScript and relevant lint checks.

No screenshot or image-based verification is required.
