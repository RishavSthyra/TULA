# Cinematic Intro Performance Pass

## Goal

Improve performance of `components/ui/CinematicIntro.tsx` on weaker devices while preserving:

- the same text sequence
- the same GSAP blur/fade choreography
- the same timings
- the same ambient sound behavior
- the same skip and completion flow

## Approved Scope

This pass focuses on React/runtime overhead reduction, not visual redesign.

### Included

- isolate the heavy cinematic stage from frequent `progress` prop updates
- memoize the heavy animation tree so loading progress changes do not rerender it
- keep GSAP blur animations unchanged
- keep sound, text order, fades, movement, and reveal sequence unchanged
- move obvious hover-only inline JS styling to CSS when it does not alter visuals

### Excluded

- replacing blur with a cheaper visual trick
- changing timings or copy
- redesigning layout, typography, or atmospheric layers
- changing the intro’s narrative sequence

## Implementation Notes

### Architecture

- keep `CinematicIntro` as a thin wrapper
- extract the heavy animated stage into a memoized subcomponent
- update loader accessibility progress imperatively through a ref instead of passing `progress` into the animated stage

### Behavior Guarantees

- `readyToComplete` must still gate the final fade-out
- `onComplete` must still fire after the overlay finishes fading
- audio unlock/retry flow must remain intact
- skip button must still immediately stop the timeline and fade the intro out

### Performance Intent

- eliminate unnecessary React rerenders caused by frequent `progress` updates
- keep GSAP responsible for the actual animation state
- reduce JS work during hover interactions around the skip button by using CSS hover styling

## Risks

- ref wiring for the loader aria label must not break GSAP access to the loader node
- memoization must still allow `readyToComplete` changes to reach the animated stage

## Verification

- intro still plays with the same visual sequence
- loading progress updates do not restart or visually disturb the animation
- skip still works
- completion still waits when `readyToComplete` is false
- TypeScript passes with `npx tsc --noEmit`
