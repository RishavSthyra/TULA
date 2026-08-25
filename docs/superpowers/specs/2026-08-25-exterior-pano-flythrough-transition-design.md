# Exterior Panorama Fly-Through Transition Design

## Goal

Replace the exterior walkthrough's circular ripple/flash navigation feedback with a fast, lightweight projected panorama transition. The effect should preserve directional feedback without scaling or blurring the panorama canvas, while keeping the existing preview-first tiled panorama loading pipeline.

## Motion Design

Each successful panorama change will use a projected crossfade lasting approximately 180–220 milliseconds:

1. **Panorama swap:** Photo Sphere Viewer crossfades from the current projected panorama to the already-resolved target source.
2. **Directional cue:** a lightweight translucent gradient moves briefly in the requested navigation direction using opacity and `translate3d()` only.
3. **Completion:** the cue fades out as the target panorama becomes interactive; there is no additional settle delay.

The panorama canvas remains geometrically stable throughout. The transition must not animate `scale()`, `filter: blur()`, canvas translation, field of view, or zoom.

## Architecture

The transition will be controlled by a small reusable state inside `ExteriorPanoWalkthrough` rather than duplicated across navigation callbacks. The state will identify whether a swap is active and the requested direction so the directional cue can restart reliably.

The layers have separate responsibilities:

- Photo Sphere Viewer performs the correctly projected panorama crossfade.
- The preview overlay remains available only for existing tile-only/fallback behavior and animates opacity only.
- A new non-interactive gradient cue animates opacity and `translate3d()` without modifying the panorama host.

The existing panorama resolution, signed URL, preview preload, tile preload, caching, and fallback code remains responsible for asset readiness. The transition begins after the target preview has resolved, avoiding a visible loading gap while heavy tiles stream.

## Navigation Coverage

The shared transition must apply to every exterior node change:

- directional buttons;
- double-click/tap forward navigation;
- sequential and automated trail navigation;
- history/back navigation when it changes nodes;
- amenity and expanded-map jumps.

Same-node amenity selections that only rotate or zoom the current panorama will retain their existing direct camera adjustment and will not trigger a panorama transition.

## Existing Effect Removal

The `transitionPulseKey` ring and flash overlay remain removed from exterior navigation. Any CSS keyframes used exclusively by that overlay remain removed.

The subtle transition vignette may remain. The directional gradient cue must not resemble the old circle ripple or a full-screen white flash.

## Loading and Failure Behavior

- Existing node resolution and preview preloading occur before the committed transition begins.
- Existing panorama fade support performs the visual swap at 180–220 milliseconds.
- When tiled panorama loading fails and the preview fallback succeeds, the same short crossfade completes normally.
- When target resolution or all panorama fallbacks fail, the directional cue is cancelled and the current error state is shown.
- Navigation locking remains active for the short swap to prevent overlapping transitions.

## Device and Accessibility Behavior

- Desktop and standard mobile devices receive the projected crossfade and directional gradient cue.
- Apple touch fallback mode uses its preview image opacity transition without transforming the image.
- `prefers-reduced-motion: reduce` disables the directional cue while retaining a short crossfade.
- The effect uses compositor-friendly opacity and `translate3d()` on the small cue layer only. It adds no canvas readbacks, filters, or new large assets.

## Scope Boundaries

This change will not alter:

- panorama source paths or navigation JSON;
- preload limits, tile concurrency, or cache sizes;
- directional graph selection;
- amenity mappings, names, or minimap behavior;
- viewer controls or page layout;
- panorama camera orientation preservation;
- panorama host transform, filter, field of view, or zoom.

## Validation

Before completion, verify:

- the ripple/ring overlay no longer renders;
- all navigation paths use the shared lightweight transition;
- the panorama canvas never scales or blurs;
- the directional cue moves consistently with the requested direction;
- preview and tile loading remain continuous without a black frame;
- failed navigation clears the cue and unlocks navigation;
- rapid repeated input cannot overlap transitions;
- reduced-motion mode uses only the projected crossfade;
- lint, TypeScript checks, and a production build pass;
- the local production walkthrough loads and performs multiple consecutive node changes without console errors.
