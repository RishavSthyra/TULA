# Fast JPEG Panorama Tile Generation

## Goal

Restore the exterior panorama generator's original high-quality JPEG tile output while retaining the safer and faster single-decode processing pipeline.

## Output contract

- Read optimized WebP panoramas from `./raw-panos`.
- Preserve each panorama's original dimensions.
- Keep the existing 16-column by 8-row tile grid.
- Generate tiles as `tiles/tile_{col}_{row}.jpg`.
- Encode tiles at JPEG quality 95 with 4:4:4 chroma subsampling, matching the earlier generator behavior.
- Keep `preview.jpg` at 2000 pixels wide and JPEG quality 90.
- Write `meta.json` with `tileFormat: "jpg"` and `tileUrl: "tiles/tile_{col}_{row}.jpg"`.

## Performance design

- Decode each 12K source panorama once into a shared raw pixel buffer.
- Process one panorama at a time to avoid excessive memory use.
- Encode independent JPEG tiles concurrently with concurrency based on available CPU cores.
- Use fast libjpeg-turbo behavior rather than the slower MozJPEG encoder.
- Keep SIMD enabled.

## Reliability

- Treat a panorama as complete only when its preview, metadata, and all 128 JPEG tiles are present and consistent.
- Skip valid existing JPEG tiles so interrupted runs resume safely.
- Write each tile to a `.partial.jpg` file and rename it only after successful encoding.
- Remove stale partial files before retrying.
- Reject existing WebP tiles in the destination to prevent mixed-format output.

## Verification

- Run the TypeScript compiler and repository linting applicable to the script.
- Run a small smoke generation when a compatible source panorama is locally available.
- Confirm generated metadata references JPEG tiles and the expected tile count is 128.
