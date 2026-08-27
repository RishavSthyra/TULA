# Masterplan Hotspot Apartment Allowlist Design

## Goal

Restrict apartment interaction at masterplan hotspots A1–A4 so only the explicitly approved tower and flat-ending combinations can be hovered, highlighted, or selected. All non-negative floors matching an approved flat ending are included.

## Wildcard Semantics

`X` means any non-negative floor. For example, `A-X05` includes Tower A apartments whose flat number ends in `05`, such as A-105, A-205, and A-305. It does not grant access to any other Tower A flat ending.

## Allowlist

### A1

- Tower A: 04, 05
- Tower B: 01, 05, 06
- Tower C: 01, 02
- Tower D: 04

### A2

- Tower C: 05
- Tower D: 02, 03

### A3

- Tower A: 02, 03
- Tower B: 02, 03, 04
- Tower C: 03, 04

### A4

- Tower A: 01
- Tower D: 01, 05

Towers or flat endings omitted from a hotspot are denied at that hotspot.

## Implementation

Keep the allowlist centralized in `lib/master-plan-hotspots.ts`. Normalize inventory flat labels and apartment mesh IDs to a two-digit unit ending before evaluating the tower-and-ending rule.

Apply the same rule to the current TULA `3ds-max-vantage` renderer and the inherited renderer path. Remove the TULA-specific bypasses that currently make every prepared apartment mesh interactive.

The hotspot-scoped allowlist must govern:

- raycast candidates
- hover state and tooltip activation
- filtered apartment highlights
- apartment click selection

Apartment geometry remains part of the combined GLB and can remain visually present. Disallowed apartments must not respond to pointer interaction or become highlighted or selected through hotspot interaction.

## Invalid Data

Reject interaction when an apartment ID has no recognizable Tower A–D code, contains no unit ending, references a negative floor, or does not match the active hotspot allowlist. Do not fall back to permitting unknown Tower C or D apartments.

## Testing

Add focused tests or deterministic assertions covering:

1. Every approved tower/ending pair at its hotspot.
2. Representative disallowed pairs for every hotspot, including pairs allowed at a different hotspot.
3. Multiple floors for the same approved ending to verify the `X` wildcard.
4. All four towers.
5. Unknown, malformed, and missing apartment IDs.
6. Nearest-hotspot mapping at frames 1, 91, 181, and 271.

Run targeted lint, the hotspot tests or assertion script, and the full TypeScript check.

## Scope

This change modifies masterplan apartment interactivity only. It does not change hotspot frames, camera positions, video scrubbing, inventory status rules, GLB geometry, apartment availability data, or the selected apartment panel outside hotspot eligibility.
