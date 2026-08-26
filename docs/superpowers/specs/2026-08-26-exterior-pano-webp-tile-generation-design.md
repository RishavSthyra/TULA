# Exterior Panorama WebP Tile Generation Design

## Goal

Update `scripts/generate-panos.ts` so optimized 12K quality-92 WebP panoramas are converted into independently loadable quality-92 WebP tiles. The generated panorama must remain 12,288×6,144 with a 16×8 grid of 768×768 tiles and should normally total approximately 25–35 MB, depending on image content.

## Compression Constraint

A compressed WebP panorama cannot be cropped into independent image files without decoding it. The generator will therefore decode each input panorama exactly once into a shared raw pixel buffer. Cropping that buffer does not reduce quality. Each crop is then encoded as a new quality-92 WebP tile, which introduces a very small second-generation lossy compression step.

The generator will not use lossless WebP tile encoding because that substantially increases aggregate output size. It will not generate JPEG tiles because converting the WebP source to JPEG would use a different codec and defeat the selected WebP filesize target.

## Input and Output

- Input directory: `./raw-panos`.
- Accepted panorama format: `.webp` only, because this workflow expects the already optimized quality-92 panoramas.
- Output directory: `./public/exterior-pano-remaining-optimised`, matching the optimized CDN directory name.
- Panorama folder naming remains derived from the source basename, including the existing `NewLS_` to `LS_` normalization.
- Existing input panoramas are never modified or deleted.

Using a dedicated output directory prevents old JPEG tiles from remaining beside new WebP tiles and inflating the upload size.

## Tile Encoding

Each 768×768 crop will use Sharp's WebP encoder with:

```ts
{
  quality: 92,
  effort: 6,
  preset: "picture",
  smartSubsample: true,
}
```

The input panorama is decoded once per file. All 128 tiles are extracted from the shared decoded buffer. Existing one-panorama-at-a-time processing remains in place to keep memory stable.

## Preview and Metadata

The preview remains a 2,000-pixel-wide JPEG at quality 90 for fast base-layer display and compatibility with the current walkthrough.

After all tiles complete successfully, `meta.json` will contain the actual source dimensions and calculated tile dimensions:

```json
{
  "width": 12288,
  "height": 6144,
  "cols": 16,
  "rows": 8,
  "tileWidth": 768,
  "tileHeight": 768,
  "preview": "preview.jpg",
  "tileFormat": "webp",
  "tileUrl": "tiles/tile_{col}_{row}.webp"
}
```

Dimensions are still derived from the source rather than hardcoded into each metadata file. Non-divisible or non-square tile layouts remain hard errors.

## Resume and Conflict Safety

- A panorama is considered complete only when its metadata declares WebP tiles and exactly 128 final `.webp` tiles exist.
- Tile writes use a temporary filename and rename only after successful encoding, preventing interrupted files from being mistaken for completed tiles.
- Temporary tile files are ignored during completion checks and replaced when that tile is retried.
- If a panorama output folder contains legacy `.jpg` tile files, generation stops for that panorama with a clear instruction to use the dedicated clean optimized output directory. The generator will not delete existing assets automatically.
- `meta.json` is written only after the preview and every tile complete.

## Application Compatibility

The exterior walkthrough already reads `preview`, `tileFormat`, and `tileUrl` from each panorama's `meta.json`. No viewer, navigation, preload, cache, signed URL, or runtime configuration changes are required for WebP tiles.

The optimized CDN base remains `TULA/Panos/exterior-pano-remaining-optimised`. Once regenerated assets are uploaded, the CDN metadata and tile extensions must match the generated `.webp` paths.

## Validation

Before completion:

- run the generator against a representative quality-92 WebP panorama;
- confirm the source remains 12,288×6,144;
- confirm 128 WebP tiles at 768×768;
- confirm `meta.json` declares WebP tiles and the JPEG preview correctly;
- verify no JPEG tiles are present in the generated panorama folder;
- report the input size, preview size, aggregate tile size, and total panorama-folder size;
- decode representative tiles to confirm they are valid WebP images;
- run ESLint or the repository's relevant script check and TypeScript validation;
- confirm no unrelated working-tree changes were modified.
