# Exterior Panorama Changed CDN Migration

## Goal

Move the exterior walkthrough runtime completely to the new Cloudflare R2 panorama hierarchy while retaining the existing navigation and coordinate data.

## Asset contract

- Canonical base key: `TULA/Panos/exterior-pano-changed`.
- New panorama folders use `PANO.00000`, `PANO.00001`, and equivalent five-digit frame numbers.
- Initial preview key: `TULA/Panos/exterior-pano-changed/PANO.00000/preview.jpg`.
- Metadata URL format: `{base}/{panoFolder}/meta.json`.
- Tile URL format is taken from metadata, with JPEG fallback `tiles/tile_{col}_{row}.jpg`.

## Node mapping

Keep the existing exterior JSON untouched because it contains navigation positions, orientation, and neighborhood source data. Convert only its exterior filename frame suffix at graph-build time:

- `LS_PANO_Spline_F0000.png` becomes `PANO.00000`.
- `LS_PANO_Spline_F0020.png` becomes `PANO.00020`.

This preserves deliberate gaps such as the missing frame 19 rather than incorrectly renumbering later panoramas by array position.

## Runtime configuration

- Update the default developer configuration to the new base and initial preview.
- Force the exterior walkthrough page to use the canonical base and preview so a previously published database configuration cannot keep the old directory active.
- Do not change the local generator output directory as part of this CDN-only migration.

## Verification

- Verify exterior node-to-folder conversion for representative frames.
- Run linting and TypeScript checks.
- Probe three representative CDN panoramas. Temporary non-200 responses are reported but do not fail the implementation because uploads are still in progress.
