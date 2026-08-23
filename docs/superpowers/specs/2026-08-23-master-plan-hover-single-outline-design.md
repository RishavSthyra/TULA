# Master Plan Hover Single Outline Design

## Goal

Show one clean pale outline around the actively hovered apartment mesh instead of the current orange inner line plus pale outer line.

## Behavior

- Keep the existing transparent status-colored fill.
- Keep the existing pale `outerEdge` line for the active hover.
- Do not render the status-colored `innerEdge` line for the active hover.
- Leave selected-apartment and filter-result highlights unchanged.
- Leave tablet and mobile highlight behavior unchanged.

## Implementation

Update only the `hoveredMeshes` rendering branch in `HighlightOverlay`. The branch will continue rendering its fill and outer edge, but skip `HighlightEdgeLines` for `palette.innerEdge`.

## Verification

Hover Available, Reserved, and Sold apartments on desktop. Each should show its existing translucent fill and one pale outline, with no second status-colored inner line. Selected and filtered apartments should retain their current styling.
