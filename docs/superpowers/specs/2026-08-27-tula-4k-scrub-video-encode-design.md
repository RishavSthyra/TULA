# TULA 4K Scrub Video Encode Design

## Goal

Convert `public/360 video.mov` into a browser-deliverable MP4 that retains the source's native 4K detail and 60 fps motion while matching the random-seek characteristics of the smooth Trifecta masterplan video.

## Source

- Path: `public/360 video.mov`
- Video: H.264 High, 3840×2160, 60 fps, 361 frames
- Duration: approximately 6.02 seconds of video
- Pixel format and color: `yuv420p`, BT.709
- Current random-access structure: one-second keyframe spacing with two B-frames
- Additional streams: AAC audio and a data stream that the muted masterplan scrub does not need

The source file remains unchanged.

## Output

- Path: `public/360_video_scrub_gop3.mp4`
- Container: MP4 with fast-start metadata
- Codec: H.264 High through `libx264`
- Resolution: 3840×2160 with no scaling
- Frame rate: constant 60 fps
- Pixel format and color: preserve `yuv420p` and BT.709 signaling
- Quality mode: CRF 12 with the slow preset
- GOP: fixed length of three frames
- Scene-cut keyframes: disabled so the GOP remains deterministic
- B-frames: disabled
- Audio and data: omitted because the masterplan scrub is muted

The encode must not interpolate, duplicate, or discard video frames. It preserves the source duration and 361-frame sequence.

## FFmpeg Strategy

Use `libx264` with CRF 12 and the slow preset. Set `-g 3`, `-keyint_min 3`, `-sc_threshold 0`, and `-bf 0` to produce the `I P P` pattern used by the Trifecta scrub asset. Add `+faststart` for browser delivery and map only the source video stream.

CRF 12 is intentionally aggressive about retaining detail. The output may be larger than a conventional streaming encode because frequent I-frames and the absence of B-frames reduce compression efficiency. Scrub responsiveness takes priority over minimizing file size.

## Verification

After encoding:

1. Confirm the output is 3840×2160, 60 fps, H.264 High, and `yuv420p`.
2. Confirm it contains 361 video frames and retains the source duration.
3. Confirm `has_b_frames=0`.
4. Inspect the first frames and keyframe list to verify a repeating `I P P` structure and a keyframe every 0.05 seconds.
5. Run FFmpeg's SSIM comparison against the source and report the result and output size.
6. Extract matching frames from the source and output for a direct visual spot-check if the metric or encode metadata indicates a problem.

## Scope

This task creates and verifies the optimized MP4. It does not overwrite the MOV, upload assets, modify CDN state, or change the application's configured masterplan video URL unless separately requested.
