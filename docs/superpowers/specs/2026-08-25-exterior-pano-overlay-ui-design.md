# Exterior Panorama Overlay UI Design

## Goal

Redesign only the overlays rendered by `ExteriorPanoWalkthrough` to match the supplied premium walkthrough reference. The full-screen panorama remains dominant while the amenity information, trail controls, direction controls, and compact minimap use restrained black smoked glass and crisp typography.

The external top navbar is outside this component and must remain completely unchanged and unobstructed. Existing responsive breakpoints, visibility rules, mobile drawer behavior, and layout switching remain unchanged.

## Scope

The change is limited to:

- `ArrowButton` styling and its existing right-side rail;
- `CurrentAmenityPanel` presentation;
- the existing trail player presentation;
- `ExteriorMinimapGraphic` compact/expanded presentation branches;
- `ExteriorMinimapPanel` presentation;
- walkthrough-specific glass styles;
- a lightweight minimap-heading update in the existing viewer event handlers.

The panorama viewer setup, adapters, signed asset resolution, tile loading, caches, warmup, navigation graph, navigation callbacks, camera preservation, trail timing, transition behavior, Apple fallback, gesture handling, and external layout are out of scope.

## Visual System

The overlay system uses neutral smoked black surfaces with low-opacity white borders, restrained shadows, and subtle backdrop blur. Green near `#78c995` is reserved for active rings, the player control, and progress. Decorative green glass, glossy highlight sweeps, oversized gradients, nested borders, and dotted overlays are removed.

Cormorant Garamond remains the editorial title face. Manrope remains the interface face. Text is crisp white with muted white secondary copy.

The implementation must not introduce a new top navigation surface or place content in the protected upper-center navbar area.

## Amenity Information

`CurrentAmenityPanel` becomes containerless information over the panorama:

- small tracked `YOU ARE HERE` label;
- dynamic amenity or trail name in Cormorant Garamond;
- short green accent rule;
- existing dynamic, line-clamped description;
- dynamic `STEP NN OF NN` indicator with a small green status dot.

The visible card, nested border, `Live View` pill, stop pill, and segmented bars are removed. A localized black haze may sit behind the copy for legibility, but it must fade naturally and never read as a rectangular panel.

The existing breakpoint-based visibility and placement behavior is preserved.

## Direction Controls

The four existing controls remain in their current order and retain their callbacks, labels, and disabled logic:

1. forward;
2. left;
3. right;
4. backward.

They become circular black-glass buttons inside a narrow vertical smoked-black rail. Hover and active feedback use a thin green ring without a green fill. The current responsive position and sizing behavior remains intact.

## Trail Player

The existing bottom player remains at its current responsive breakpoints and placement. Its desktop presentation becomes a long, low-profile black-glass pill containing:

- circular play/pause control;
- active amenity or trail name;
- a thin progress track with restrained green fill and marker;
- current trail position and remaining time;
- previous and next controls.

Playback, progress animation refs, navigation history, next-node selection, button semantics, and disabled states remain unchanged. No new timer or playback state is introduced.

## Compact Minimap

The compact minimap becomes a circular game-style view without a rectangular parent card. Its label and expand control remain stationary outside the rotating map content.

The compact hierarchy is:

1. fixed circular clipping viewport with a dark outer ring;
2. heading rotation layer using `--exterior-minimap-rotation`;
3. translated and zoomed map-position layer containing the image, route, visited route, destination marker, and amenity markers;
4. fixed centered upward-facing player chevron above the rotating layers.

The active node's projected minimap coordinate is translated to the viewport center. A modest fixed compact zoom and map overscan prevent empty corners during rotation. Compact drag and wheel zoom are disabled; clicking the compact map or its expand control opens the existing expanded map.

The expanded minimap retains its current north-up layout, drag, wheel zoom, amenity selection, close behavior, and existing responsive sizing.

## Heading Data Flow

Add one documented calibration constant:

```ts
const EXTERIOR_MINIMAP_HEADING_OFFSET_DEG = -90;
```

The component root receives a ref. A heading updater uses `activeNodeIdRef`, the current node, `getViewForwardVector`, and the viewer yaw to calculate raw world heading. It unwraps angular deltas with `wrapAngleRad` so crossing `+PI` and `-PI` cannot cause a 360-degree snap.

The updater schedules at most one `requestAnimationFrame` and writes the result directly to the root CSS custom property:

```css
--exterior-minimap-rotation
```

It does not call React state setters during viewer motion. The existing `position-updated` and `ready` handlers call the updater. Active-node changes refresh it as needed. Apple/fallback mode uses the active node's configured yaw when no viewer instance exists. Pending frames are cancelled during cleanup.

For heading-up behavior, the inner map rotates opposite the camera heading. The circular frame, label, expand control, and centered player chevron never rotate.

## Responsive Behavior

The current responsive system is preserved exactly: existing breakpoints, mobile amenities drawer, overlay visibility, and placement switching are not redesigned. Visual restyling must fit within those current responsive containers without introducing new breakpoint behavior.

Safe-area handling and the external top-navbar clearance remain unchanged. No overlay may be moved into the upper-center protected area.

## Accessibility and Performance

- Preserve existing button elements, aria labels, keyboard behavior, disabled states, and touch behavior.
- Preserve reduced-motion support.
- Add no dependency.
- Avoid React state updates on camera frames.
- Keep map layers in one transform hierarchy so image and coordinate overlays cannot separate.
- Do not recreate the panorama viewer through unstable hook dependencies.
- Use walkthrough-scoped styles so the external navbar and other pages cannot be affected.

## Failure Behavior

If a viewer instance is unavailable, initialize the compact heading from the active node yaw. If a scheduled heading update becomes stale, the latest node and view refs determine the applied value. Component cleanup cancels the pending frame.

All existing panorama, amenity, navigation, and expanded-map error behavior remains unchanged.

## Validation

Before completion, verify:

- the external navbar and panorama host have no implementation changes;
- the bottom-left information is containerless and remains dynamic;
- all four right-side direction controls retain order, labels, callbacks, and disabled behavior;
- trail play/pause, previous, next, timer, and progress behavior still work;
- the compact minimap is circular, player-centered, and heading-up;
- map image, route, visited route, and amenity markers rotate as one layer;
- heading remains continuous across the `+180`/`-180` boundary;
- heading updates while dragging, autorotating, and switching nodes;
- expanded-map drag, zoom, close, and amenity selection still work;
- existing responsive visibility and mobile drawer behavior are unchanged;
- the dotted overlay and broad green/gloss decoration are absent;
- no white transition stripe returns;
- ESLint, TypeScript, and the production build pass;
- the local walkthrough route, runtime configuration, and signed panorama asset still load successfully.
