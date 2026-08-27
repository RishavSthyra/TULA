# Home Forward/Reverse Hero Loop Design

## Goal

Replace the current home hero media with a seamless, continuously alternating forward/reverse sequence on every screen size. Keep the existing cinematic preloader visible while the critical home media is decoded or made playable, and show the supplied first-frame image until the forward video renders.

## Assets

- Forward video: `https://cdn.sthyra.com/TULA/Videos/Home%20Page2.mp4`
- Reverse video: `https://cdn.sthyra.com/TULA/Videos/Reverse%20Home%20Page.mp4`
- First-frame fallback: `https://cdn.sthyra.com/TULA/Videos/Home%20Page2_first_frame.avif`

The deployed assets have been verified as follows:

- both videos are 3840×2160 HEVC Main 10 at 24 fps
- each video is approximately 7.57 seconds and 3.2 MB
- the fallback is a 3840×2160 AVIF of approximately 230 KB

## Playback Sequence

Use two persistent video elements rather than changing the source of one element.

1. Display the first-frame AVIF behind the media layers.
2. Start the forward video at time zero when the home experience is revealed.
3. When the forward video ends, start the already-prepared reverse video at time zero and reveal it once playable.
4. When the reverse video ends, reset the forward video to time zero, start it, and reveal it.
5. Continue alternating for the lifetime of the home page.

Only one video should be visible at a time. Both videos remain muted, inline, control-free, and preloaded. The poster remains available behind them so a slow start or media error never exposes a black or stale frame.

The sequence applies to desktop, tablet, mobile, coarse-pointer devices, and fullscreen. Remove the current compact/coarse-pointer static-hero bypass and remove the temporary local draft image from the active hero stack.

## Runtime Configuration

Override the published home runtime media keys at the home route so an older database-published developer configuration cannot restore the previous videos. Set the forward video, reverse video, mobile fallback, stage fallback, and poster to the supplied assets where each field's existing role requires it.

Keep the rest of the published home configuration unchanged.

## Preloader and Caching

Reuse the existing cinematic preloader. Do not add another loading screen.

During the preloader:

- add high-priority preload hints for the fallback and forward video
- preload the reverse video in parallel
- decode the fallback through an `Image` object
- create muted inline warm-video elements for both sources with `preload="auto"`
- report combined critical-media progress instead of progress from only the forward video
- do not mark the hero sequence ready until the fallback has decoded or errored and both videos have reached a playable state or errored

Errors count as settled so the preloader cannot deadlock. Preserve the existing minimum preloader display time. Existing noncritical warmups may continue in parallel, but they must not block the home reveal.

Browser media preload and the shared CDN URL allow the visible video elements to reuse the HTTP media cache populated by the warm elements. The implementation must clean up listeners, timers, temporary media elements, and preload links when the effect ends.

## Failure Behavior

- If the fallback fails, continue once both videos settle and retain the existing neutral background.
- If one video fails, keep or resume the other playable video instead of leaving a blank stage.
- If both videos fail, reveal the home UI over the fallback image when available.
- Autoplay rejection must retain the fallback and retry on the existing focus, page-show, and visibility events.

## Verification

1. Confirm the route resolves the exact three supplied assets.
2. Confirm the static mobile bypass and temporary draft image are no longer active.
3. Confirm the forward `ended` event starts reverse and reverse `ended` starts forward.
4. Confirm the first-frame fallback is visible before media playback.
5. Confirm both videos and the fallback participate in preloader readiness.
6. Run targeted lint and the full TypeScript check.
7. Verify the existing home controls and navigation remain unchanged.

## Scope

This change is limited to home hero media selection, alternating playback, first-frame fallback, and critical-media preloading. It does not redesign the cinematic preloader, home typography, navigation, lead form, masterplan warmup, or other routes.
