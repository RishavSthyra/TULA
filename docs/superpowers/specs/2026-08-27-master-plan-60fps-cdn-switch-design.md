# Masterplan 60 FPS CDN Switch Design

## Goal

Use the new scrub-optimized TULA video on the masterplan page for every device tier and synchronize the interaction pipeline at the video's native 60 fps.

## Media Source

Replace the current TULA masterplan asset with:

`https://cdn.sthyra.com/TULA/Videos/360_video_scrub_gop3.mp4`

The deployed asset has been verified as:

- H.264 High
- 3840×2160
- 60 fps
- 361 video frames
- fixed three-frame GOP with a repeating `I P P` structure
- no B-frames
- approximately 6.02 seconds

## Configuration

Update `data/master-plan-3dsmax-trial.json` so the video asset key points to the new CDN URL and its declared FPS is 60. Preserve the existing 3840×2160 dimensions and 360 logical masterplan positions.

Enable the existing 60 fps masterplan scrub switch in `data/masterPlanFrameCdnUrls.ts`. This changes the standard interaction synchronization interval from approximately 33.3 ms to 16.7 ms and aligns seek thresholds with the new source.

The 360 logical positions remain intentional. The media contains 361 frames because the last frame closes the 360-degree seam; the existing progress mapping avoids seeking beyond the final usable frame.

## Device Coverage

The same new CDN asset is used for all current performance tiers, including desktop, tablet, mobile, Safari-like browsers, and constrained devices. No lighter fallback is retained in this change.

## Error Handling

Keep the existing video readiness, fallback-image, pending-seek, and CDN loading behavior unchanged. This is a configuration switch, not a rewrite of the media component.

## Verification

1. Probe the deployed CDN URL and confirm 4K, 60 fps, 361 frames, GOP 3, and no B-frames.
2. Confirm the TULA configuration exposes the new URL and 60 fps value.
3. Confirm the shared scrub timing resolves to 60 fps.
4. Run targeted lint or TypeScript validation for the modified configuration files.
5. Verify no old TULA 30 fps URL remains in the active masterplan configuration.

## Scope

This change only wires the already-uploaded CDN video into the masterplan and aligns its scrub timing. It does not alter masterplan controls, drag sensitivity, hotspot positions, camera tracking, CDN content, or device-specific media selection.
