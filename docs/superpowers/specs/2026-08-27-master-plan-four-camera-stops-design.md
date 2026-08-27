# Master Plan Four Camera Stops Design

## Goal

Replace the existing six evenly spaced master-plan hotspots with four camera stops matching source frames 0, 90, 180, and 270. Source frames 0 and 360 represent the same wrapped view.

## Frame mapping

The existing master-plan runtime uses one-based frame numbers from 1 through 360. The supplied zero-based source frames therefore map as follows:

| Source frame | Runtime frame | Hotspot key |
| --- | --- | --- |
| 0 / 360 | 1 | A1 |
| 90 | 91 | A2 |
| 180 | 181 | A3 |
| 270 | 271 | A4 |

A5 and A6 will be removed from hotspot navigation. Directional navigation, nearest-hotspot selection, snapping, and camera interpolation will all use the same four runtime frames.

## Camera data

- A1 retains the already integrated frame-zero camera.
- A2 uses position `(243.325, 29.78, 50)` and 3ds Max rotation `(83.59, 0, 90.013)`.
- A3 uses position `(20.675, 218.794, 50)` and 3ds Max rotation `(82.467, 0, -179.962)`.
- A4 uses position `(-201.868, 29.683, 50)` and 3ds Max rotation `(83.594, 0, -89.987)`.
- All four cameras retain the existing 75-degree field of view because no replacement FOV values were supplied.
- Positions remain in metres in the source JSON and use the existing conversion to Three.js millimetre world space.

## Runtime behavior

- Camera transforms interpolate between adjacent stops while the user scrubs the 360-frame video.
- The final segment interpolates from A4 back to A1 across the 360/0 seam.
- Previous/next buttons navigate through only the four stops.
- Inventory filtering uses A1 through A4 only; no A5/A6 state can be selected.

## Verification

- Validate all four cameras are generated with distinct positions and quaternions.
- Confirm all hotspot constants use runtime frames `1, 91, 181, 271`.
- Run ESLint and TypeScript checks.
- Load the master-plan page and verify previous/next navigation wraps A4 → A1 and A1 → A4.
