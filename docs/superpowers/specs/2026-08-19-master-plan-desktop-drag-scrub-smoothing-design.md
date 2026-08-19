# Master Plan Desktop Drag Scrub Smoothing Design

## Goal

Improve desktop mouse drag scrubbing in the master plan stage so the scrub feels more directly locked to the cursor while preserving frame accuracy, hotspot correctness, and existing release snap behavior.

## Scope

This design only changes desktop click-and-drag scrubbing in `components/MasterPlanFrameHoverStage.tsx`.

In scope:

- desktop mouse drag follow behavior during active scrubbing
- drag damping and buffering logic
- desktop-only drag sensitivity tuning

Out of scope:

- wheel or trackpad scrub behavior
- touch or tablet gesture behavior
- hover, tooltip, selection, hotspot filtering, or highlight logic
- release snap target selection
- frame-to-progress or progress-to-frame conversion rules

## Problem

The current drag interaction already feels smooth, but it intentionally trails the cursor slightly during active desktop dragging. That lag comes from several conservative safeguards working together:

- pointer delta clamping through `maxPointerPixelsPerMs`
- pending drag buffering through `pendingPointerDeltaXRef`
- progress lead limiting through `clampProgressLead(...)`
- reduced in-drag visual/video sync frequency

These protections help stability, but for normal desktop mouse movement they make the scrub feel less directly attached to the cursor than it could be.

## Design Principles

- Preserve accuracy: the same drag position should still resolve to the same frame math and the same final snap target.
- Prefer adaptive behavior over global looseness: ordinary drags should feel more direct, while extreme flicks should still be bounded.
- Keep the change desktop-specific: touch, tablet, and wheel paths should not regress.
- Minimize surface area: improve the live drag path without rewriting the scrub architecture.

## Proposed Approach

Use an adaptive desktop drag profile that relaxes the current damping only for normal mouse drag motion and keeps stronger clamping for extreme movement bursts.

### 1. Add a desktop-focused drag tuning path

Extend the drag configuration used by desktop mouse drag so normal pointer motion gets a more direct mapping to progress.

This includes:

- increasing the effective pointer velocity ceiling used during desktop dragging
- reducing how quickly ordinary deltas get treated as excessive
- keeping a hard upper bound for pathological flicks

The desktop path should remain bounded, but the threshold for “too much” movement should be meaningfully higher than it is now.

### 2. Reduce live-drag progress lag

Adjust the active drag pipeline so progress stays closer to the cursor during motion.

This includes:

- making pending pointer delta accumulation less conservative for desktop mouse drag
- reducing the amount of artificial lead clamping applied during active desktop dragging
- preserving enough lead protection to avoid runaway overshoot during abrupt, unrealistic spikes

The intent is not raw unbounded motion. The intent is lower latency between pointer movement and visible scrub progress for realistic user input.

### 3. Keep frame accuracy and snap correctness unchanged

Do not change:

- `progressToFrame(...)`
- `frameToProgress(...)`
- nearest or directional snap frame selection
- release snap animation destination
- hotspot interpretation of the final frame

This work is strictly about improving in-drag tracking feel, not changing what counts as the correct frame.

### 4. Leave non-desktop interactions untouched

The desktop drag tuning should be isolated from:

- tablet and touch gesture scrubbing
- wheel scrubbing
- reduced-motion handling
- low-tier fallback behavior unless a shared helper must accept a desktop-specific mode

If a shared helper is updated, it must branch explicitly so existing non-desktop behavior is preserved.

## Implementation Areas

Primary file:

- `components/MasterPlanFrameHoverStage.tsx`

Primary logic areas:

1. `getDragConfig(...)`
   Introduce a more direct desktop drag profile or an equivalent desktop-specific branch.

2. `applyPendingDragDelta(...)`
   Relax active desktop drag lead limiting so progress can remain closer to the cursor.

3. `handlePointerMove` and `handleMouseMove`
   Loosen pending delta buffering and clamp thresholds for desktop mouse drag while preserving protection against extreme spikes.

4. `startDragLoop(...)` and `commitProgress(...)`
   Preserve the current architecture, but ensure the more direct desktop deltas are reflected with minimal extra delay.

## Expected Outcome

After the change:

- slow desktop drags should feel more 1:1 with the cursor
- medium-speed drags should show less visible trailing
- fast drags should still remain controlled
- release snapping should remain consistent with current behavior
- non-desktop scrub paths should feel unchanged

## Risks

### Overshoot or jitter during aggressive drags

If the desktop path is loosened too much, visible jitter or abrupt jumps could appear during fast flicks.

Mitigation:

- keep hard caps for extreme delta spikes
- tune adaptively rather than removing protection entirely

### Video seek instability

A more direct drag path can expose roughness if the visible video cannot keep up with more immediate progress updates.

Mitigation:

- keep existing frame math intact
- prefer tuning input damping first before changing video sync frequency
- only expand sync aggressiveness if needed after testing

### Hidden regression across shared paths

The drag helpers are shared across multiple interaction modes, so a global change could unintentionally affect wheel, touch, or lower-tier performance paths.

Mitigation:

- isolate desktop drag adjustments explicitly
- verify unchanged behavior on non-desktop paths

## Testing Plan

Manual verification:

1. Slow desktop mouse drag
   The stage should feel more tightly attached to the cursor.

2. Medium-speed drag
   The stage should show noticeably less trailing than before.

3. Fast flick drag
   Motion should remain bounded without wild jumps.

4. Drag release
   Snap destination and hotspot outcome should remain correct.

5. Hover and selection after drag
   Tooltip, flat hover, and apartment selection should still behave normally after settling.

6. Non-desktop regression check
   Wheel scrub, touch/tablet behavior, and reduced-motion paths should remain unchanged.

## Decision

Proceed with an adaptive, desktop-only drag tuning pass that improves cursor-follow behavior during active mouse scrubbing while preserving existing accuracy and release semantics.
