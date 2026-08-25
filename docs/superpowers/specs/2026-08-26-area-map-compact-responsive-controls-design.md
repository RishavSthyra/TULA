# Area Map Compact Responsive Controls

Date: 2026-08-26
Status: Approved design, pending written-spec review
Primary surface: `app/area-map/page.tsx`
Primary components: `components/MapComponent.tsx`, `components/MobileSiteNav.tsx`, `components/RouteChrome.tsx`

## Goal

Make the Area Map clean and usable on phones and tablets by removing the oversized always-visible filter panel, presenting desktop navigation through a polished hamburger drawer, reducing responsive typography and spacing, and preventing floating controls from overlapping.

## Scope

This is a responsive layout and interaction refinement. Preserve the existing single `MapView`, POI data, category filtering, distance filtering, sorting, markers, routes, selected-place behavior, map styles, navigation destinations, and global desktop rail.

The desktop layout at 1280px and wider remains unchanged unless a small boundary fix is required to prevent a breakpoint jump.

## Responsive Model

### Mobile: below 768px

- The map fills the viewport.
- The desktop rail and permanent top filter card are absent.
- A compact hamburger trigger sits at the top-left, respecting the safe-area inset.
- A matching compact Filters trigger sits at the top-right.
- The hamburger opens the existing site-navigation destinations in a polished bottom drawer.
- Filters opens a separate bottom drawer containing categories, distance, sorting, Clear All, and Close controls.
- Popular Nearby is collapsed by default near the bottom edge.
- Opening navigation, filters, or selected-place details removes competing bottom overlays from view.
- Typography, icons, imagery, padding, gaps, radii, and button heights use the smallest responsive scale.

### Tablet: 768px to 1279px

- Use the same hamburger-plus-Filters control model as mobile.
- Use a wider, slightly roomier bottom drawer with tablet-scaled type and spacing.
- Category controls use a two-column grid in portrait and a three-column grid when tablet width permits.
- Popular Nearby remains compact and does not compete with map controls.

### Desktop: 1280px and wider

- Preserve the current desktop site rail.
- Preserve the existing desktop map sidebar and desktop overlay behavior.
- Do not show the compact hamburger or Filters triggers.

## Navigation Drawer

Reuse `MobileSiteNav` and its existing destination/action behavior. Refine its compact breakpoint presentation so it behaves as the responsive equivalent of the desktop rail:

- top-left floating hamburger trigger on the Area Map
- warm off-white surface, olive active state, subtle border and shadow
- drawer height capped to the available viewport with internal scrolling when necessary
- smaller mobile type and controls; moderately larger tablet values
- close button, backdrop click, Escape key, and route selection close the drawer
- body scroll is locked while open
- safe-area insets are respected

The trigger and drawer must not cover or disable map interaction when closed.

## Filter Drawer

Replace the Area Map's always-visible mobile filter card with a compact top-right Filters trigger. The trigger opens a bottom drawer containing:

- all category chips
- distance select
- sort select
- Clear All
- explicit Close control

Requirements:

- reuse the existing filter state and handlers
- show active-filter state on the trigger without adding a large label block
- cap drawer height and allow internal scrolling
- close via its Close control, backdrop click, or Escape
- lock body scroll while open
- preserve focusable labels and accessible names
- never render a second map instance

## Overlay Coordination

Only one major bottom overlay may be active at a time.

- Opening filters hides Popular Nearby until the filter drawer closes.
- Opening navigation visually covers and suspends other map overlays through its modal backdrop.
- Selecting a POI closes filters and Popular Nearby before showing place details.
- Closing POI details restores the compact default state, not an expanded sheet.
- Map controls move above the active bottom surface and return to their compact default inset when it closes.
- Top triggers occupy separate left and right safe zones and do not overlap each other.

## Compact Visual Scale

Use responsive classes rather than duplicating components.

- phone body copy: 12px
- phone labels and chips: 13px
- phone section headings: 16px to 18px
- tablet body copy: 13px; labels and chips: 14px; section headings: 20px
- interactive touch targets remain at least 44px even when text and icons are reduced
- drawer padding: 16px on phones and 24px on tablets
- avoid large decorative artwork or oversized headings in compact drawers

## State and Component Boundaries

`MapComponent` remains the owner of filter, POI, Popular Nearby, and map-control positioning state. Add only the visibility coordination needed for the filter drawer.

`MobileSiteNav` remains responsible for responsive site navigation and its own open/close animation. It selects the Area Map-specific top-left trigger placement from the current pathname without changing navigation data.

`RouteChrome` continues to choose between desktop and compact global navigation at the existing 1280px breakpoint.

## Accessibility and Failure Behavior

- Drawers expose correct dialog/navigation labeling and `aria-expanded` state.
- Escape and backdrop dismissal must work.
- Focus remains usable with keyboard navigation.
- Reduced-motion users receive restrained or immediate drawer transitions.
- If viewport measurements are unavailable during initial render, default to the compact layout without exposing the large filter panel.
- Empty POI results keep the drawer usable and show the existing empty-state behavior.

## Verification

Run the relevant lint and type checks, then visually verify:

- 375 x 812 phone portrait
- 430 x 932 large phone portrait
- 768 x 1024 tablet portrait
- 1024 x 768 tablet landscape
- 1279px compact boundary
- 1280px desktop boundary

At each compact size confirm:

- no permanent oversized filter card
- hamburger at top-left and Filters at top-right
- no clipped labels or horizontal page overflow
- no overlap among drawers, Popular Nearby, POI details, map controls, and safe areas
- map remains interactive whenever no drawer covers the interaction point
- category, distance, sorting, Clear All, location, route, and navigation actions still work

## Acceptance Criteria

1. Mobile and tablet open to a clean, mostly unobstructed map.
2. The former large top filter panel is replaced by a compact Filters trigger and bottom drawer.
3. The desktop navigation model is available through a polished hamburger drawer below 1280px.
4. Responsive fonts and spacing are visibly smaller and remain readable.
5. Major overlays never collide in supported phone and tablet orientations.
6. The existing desktop rail and desktop map experience remain intact at 1280px and wider.
7. Existing map and POI behavior is preserved with one shared `MapView` instance.
