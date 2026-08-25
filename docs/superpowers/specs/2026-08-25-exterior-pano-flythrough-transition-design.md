# Exterior Panorama Fly-Through Transition Design

## Goal

Replace the exterior walkthrough's circular ripple/flash navigation feedback with a balanced Google Street View-style forward fly-through. The new effect should make movement feel spatial while preserving the existing preview-first tiled panorama loading pipeline.

## Motion Design

Each successful panorama change will use three coordinated phases over approximately 600–700 milliseconds:

1. **Forward push:** the current panorama scales toward the viewer with a restrained acceleration. A light blur and darker edge treatment build briefly near the swap point.
2. **Panorama swap:** the already-resolved target preview crossfades over the current panorama while Photo Sphere Viewer changes to the target tiled source.
3. **Settle:** the target preview begins slightly enlarged and settles to its normal scale as the high-resolution tiles become visible through the existing loader.

The movement should feel polished and fast rather than dramatic. It must not use a large tunnel effect, aggressive blur, white flash, or exaggerated zoom.

## Architecture

The transition will be controlled by a small reusable fly-through state inside `ExteriorPanoWalkthrough` rather than duplicated across navigation callbacks. The state will expose explicit phases such as idle, pushing, swapping, and settling, plus a transition key used to restart the animation reliably.

Both viewer layers will participate:

- The Photo Sphere Viewer host will receive the forward-push transform and temporary blur.
- The existing preview overlay will receive the target crossfade and settling transform.

The existing panorama resolution, signed URL, preview preload, tile preload, caching, and fallback code remains responsible for asset readiness. The motion controller only begins the committed fly-through after the target preview has resolved, avoiding an extended zoom while heavy assets are still loading.

## Navigation Coverage

The shared fly-through must apply to every exterior node change:

- directional buttons;
- double-click/tap forward navigation;
- sequential and automated trail navigation;
- history/back navigation when it changes nodes;
- amenity and expanded-map jumps.

Same-node amenity selections that only rotate or zoom the current panorama will retain their existing direct camera adjustment and will not trigger a spatial fly-through.

## Existing Effect Removal

The `transitionPulseKey` ring and flash overlay will be removed from exterior navigation. Any CSS keyframes used exclusively by that overlay will also be removed when no longer referenced.

The subtle transition vignette may remain but will be coordinated with the new phase state rather than acting as the primary movement effect.

## Loading and Failure Behavior

- Existing node resolution and preview preloading occur before the committed motion begins.
- Existing panorama fade support remains active during the swap, with timing shortened to align with the overlay motion.
- The target preview hides the viewer reset so the host can return to its neutral transform without a visible snap.
- When tiled panorama loading fails and the preview fallback succeeds, the same settle phase completes normally.
- When target resolution or all panorama fallbacks fail, the fly-through is cancelled, the current panorama returns to its neutral visual state, and the current error state is shown.
- Navigation locking remains active for the full motion to prevent overlapping transitions.

## Device and Accessibility Behavior

- Desktop and standard mobile devices receive the balanced push, mild blur, crossfade, and settle.
- Apple touch fallback mode applies the equivalent transform to its image layer instead of the hidden viewer host.
- `prefers-reduced-motion: reduce` disables the push, blur, and scale movement while retaining a short crossfade.
- The effect must use compositor-friendly opacity, transform, and limited filter animation without adding canvas readbacks or new large assets.

## Scope Boundaries

This change will not alter:

- panorama source paths or navigation JSON;
- preload limits, tile concurrency, or cache sizes;
- directional graph selection;
- amenity mappings, names, or minimap behavior;
- viewer controls or page layout;
- panorama camera orientation preservation.

## Validation

Before completion, verify:

- the ripple/ring overlay no longer renders;
- all navigation paths use the shared fly-through;
- the current pano visibly pushes forward before the target settles;
- preview and tile loading remain continuous without a black frame;
- failed navigation restores a neutral transform and unlocks navigation;
- rapid repeated input cannot overlap transitions;
- reduced-motion mode uses a crossfade without push or blur;
- lint, TypeScript checks, and a production build pass;
- the local production walkthrough loads and performs multiple consecutive node changes without console errors.
