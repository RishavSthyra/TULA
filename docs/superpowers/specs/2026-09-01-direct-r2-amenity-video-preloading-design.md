# Direct R2 Amenity Video Preloading Design

## Goal

Replace the amenities page's adaptive HLS sources with the nine direct R2 MP4 files supplied for the project. Each video must use its matching AVIF first frame as both its poster and carousel preview. Background loading must improve startup without competing with the page's critical media or creating multiple simultaneous video downloads.

## Amenity catalogue

Replace the existing amenity records with the following records in this exact order. The video and image basename must match exactly, including capitalization and spaces.

| Title | Video basename | Poster basename |
| --- | --- | --- |
| Butterfly Garden | `Butterfly Garden.mp4` | `Butterfly Garden.avif` |
| Play Area | `Play Area.mp4` | `Play Area.avif` |
| Pool | `Pool.mp4` | `Pool.avif` |
| Swimming Pool | `Swimming Pool.mp4` | `Swimming Pool.avif` |
| Buddha | `buddha.mp4` | `buddha.avif` |
| Fountain | `fountain.mp4` | `fountain.avif` |
| Garden Walk | `garden walk.mp4` | `garden walk.avif` |
| Kids Play Area | `kids play area.mp4` | `kids play area.avif` |
| Tennis | `tennis-reversed-FULLQUALITY.mp4` | `tennis-reversed-FULLQUALITY.avif` |

Video URLs use:

`https://cdn.sthyra.com/TULA/Videos/Amenities%20Optimised/<video basename>`

Poster URLs use:

`https://cdn.sthyra.com/TULA/Images/Amenities%20First%20Frames/<poster basename>`

URL path segments containing spaces must be percent encoded. The user-facing titles remain clean display names rather than raw filenames.

## Playback architecture

- Render every amenity video as a direct native MP4 source.
- Do not generate, request, or initialize an HLS manifest for these records.
- Do not run bitrate-selection or highest-quality HLS behavior for the amenities page.
- Keep autoplay, muted startup, looping, inline playback, seeking, play/pause, volume, fullscreen, and carousel behavior unchanged.
- Set the matching AVIF as the video's `poster` so it remains visible until the browser can paint video data.
- When switching amenities, keep the current visual visible until the incoming direct video reports usable data or an error. On error, reveal the target amenity's AVIF rather than blocking carousel navigation.

The shared HLS component and the `hls.js` dependency are outside this change's scope and may remain for other or future media. The amenities page itself will use native MP4 playback explicitly.

## Gentle preload and cache policy

Use browser-native media loading and the CDN's immutable HTTP caching. Do not introduce Cache Storage, blob playback, or a service worker.

### Global safeguards

- Never warm more than one background amenity video at a time.
- Schedule non-critical work with `requestIdleCallback` when available, with a timeout fallback for browsers that do not support it.
- Do not create a separate `<link rel="preload" as="video">`; the hidden media element is the single warming mechanism.
- Skip background video warming when Data Saver is enabled, the effective connection is `slow-2g` or `2g`, the device is constrained, or the document is hidden.
- Stop and release a warm-up media element before starting the next item.
- Treat warm-up failures as non-fatal and allow normal on-demand playback to retry.
- Deduplicate queued and warmed URLs for the lifetime of the page session.

### Home profile

After the existing home-page critical media has completed and the existing delay has elapsed, warm at most the first two amenity videos, one at a time. Use metadata-level warming so this work only establishes the CDN connection and retrieves the MP4 metadata/initial byte ranges the browser needs for a fast future start.

### Master Plan profile

After the Master Plan's existing delayed trigger, warm at most the first two amenity videos, one at a time, using the same metadata-level policy. Session-level deduplication prevents repeating work already completed on Home.

### Amenities profile

- The visible active video uses `preload="auto"` because it is immediately needed.
- Warm the next and previous carousel neighbors first, then continue through the remaining catalogue sequentially while the page stays visible and unconstrained.
- Background items use metadata-level warming. The selected item's real player is responsible for its fuller playback buffer.
- Reorder pending work around the newly selected amenity without launching parallel warmers.

This policy intentionally does not guarantee that all full MP4 files are downloaded before use. It provides useful browser-cache warming while avoiding the bandwidth spikes and playback contention the user explicitly wants to prevent.

## Poster preloading

- Preload the first amenity poster from the server-rendered page at high priority.
- Decode the remaining AVIF posters on the client with low or automatic fetch priority.
- Poster failures fall back to the existing text/gradient placeholder.
- Do not let poster preloading block page interaction or active video playback.

## Data and copy

- Update the amenities summary so it no longer claims adaptive 4K streaming.
- Give each new record a stable slug-style ID.
- Preserve the existing record schema and populate concise category, description, detail, tags, and stat fields appropriate to each new display title.
- Runtime developer configuration must not restore the removed HLS catalogue; the canonical JSON remains authoritative as in the current implementation.

## Error handling

- A direct MP4 loading error must not leave the page blank or lock the carousel.
- The matching AVIF remains the visual fallback for failed or delayed playback.
- Failed background warm-ups are removed cleanly and may be retried by the actual player when selected.
- Playback-control state continues to follow native video play and pause events.

## Verification

- Confirm all nine encoded MP4 URLs and all nine encoded AVIF URLs return successfully.
- Confirm the rendered amenity data contains no `.m3u8` source.
- Confirm the amenities player does not initialize hls.js or request an HLS manifest.
- Confirm only one hidden video warmer can exist at a time and no video preload links are created.
- Confirm constrained-network and hidden-document safeguards skip or pause background warming.
- Confirm the poster remains visible during delayed video startup and after a video error.
- Run ESLint, TypeScript checking, and a production build.
- Review the final diff to ensure unrelated working-tree changes are untouched.
