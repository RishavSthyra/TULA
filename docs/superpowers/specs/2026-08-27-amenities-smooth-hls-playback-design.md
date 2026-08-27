# Amenities Smooth HLS Playback Design

## Goal

Keep the amenities renders sharp while eliminating stalls caused by forcing the 19 Mbps 4K rendition before the connection has built a playback buffer. Restore cinematic separation only around the bottom carousel and controls, without darkening the rest of the video.

## Media source

- Use each amenity's adaptive `master.m3u8` from `NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL`.
- The R2 layout keeps the existing relative paths for 1080p, 1440p, and 4K variants.
- Do not point the player directly at a single-resolution playlist because that prevents adaptive switching.

## Playback behavior

- Begin HLS playback at the 1080p level for fast, dependable startup.
- Keep automatic bitrate selection enabled after startup so hls.js can promote playback to 1440p or 4K when measured throughput and buffer health support it.
- Cap rendition selection to the rendered player size and device pixel ratio to avoid downloading pixels the display cannot show.
- Maintain a larger forward buffer and conservative emergency downgrade behavior to avoid rebuffering.
- On a fatal network error, attempt hls.js network recovery before abandoning HLS. On a fatal media error, attempt media recovery once. Fall back to the direct source only when recovery is not possible.

## Visual treatment

- Add one pointer-events-disabled bottom gradient behind the filmstrip and playback controls.
- Keep the gradient strongest at the bottom edge and fully transparent above the deck region.
- Do not restore top, side, full-screen, thumbnail, brightness, contrast, or filter overlays.

## Verification

- Confirm the R2 master playlist and representative variant assets return successfully.
- Run ESLint and TypeScript checks.
- Verify no full-screen media mask has been reintroduced.
- Verify the player starts at 1080p and remains in automatic quality mode afterward.
