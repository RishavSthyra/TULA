# Explore Places Map Redesign

Date: 2026-08-14
Status: Approved design, ready for implementation planning and execution after user review
Primary surface: `app/area-map/page.tsx`
Primary container: `components/MapComponent.tsx`

## Goal

Redesign the existing Explore Places / Nearby Map experience so the map becomes the full-screen canvas and all supporting interface elements float above it as independent overlays. Reuse the existing data, map implementation, markers, filters, API calls, handlers, route logic, search behavior, and POI image data wherever possible. The work is a layout and interaction architecture redesign, not a rebuild of the underlying business logic.

The final experience should follow the premium editorial Whispers design language: warm off-white surfaces, restrained olive accents, soft borders, subtle shadows, and a visually dominant map.

## Non-Negotiable Requirements

1. The map must visually occupy the entire screen using a single full-screen map canvas.
2. There must be exactly one `MapView` instance in the page. Responsive behavior must only rearrange overlay UI around that same map instance. Do not render separate desktop, tablet, or mobile maps.
3. Do not rebuild the current business logic from scratch. Reuse the existing data, filter/search handlers, route logic, marker behavior, images, and map controls wherever practical.
4. The current split dashboard layout must be removed completely.
5. Overlay panels must be independently hideable and restorable.
6. The map must remain interactive outside the actual bounds of floating UI elements.
7. The redesign is not complete after the spec is written. After approval, implementation must continue through code changes, project verification, regression fixes, and visual validation at key breakpoints.

## Current State Summary

The current implementation lives primarily in `components/MapComponent.tsx` and already contains:

- search state and handlers
- category filtering
- distance sorting and open-now filtering
- POI selection and marker interaction
- map controls
- route rendering and route loading
- POI image selection
- nearby list rendering
- POI detail rendering

The current weakness is layout architecture. The page behaves like a multi-column dashboard with a contained map section instead of a map-first experience.

## Target Experience

The page should behave as a full-screen map product where the map is the base layer and the rest of the UI is a set of premium floating controls.

### Base Layer

- `MapView` fills `100vw` by `100dvh`
- positioned as the base canvas with `absolute` or `fixed` style behavior inside the page shell
- no rounded map card
- no large outer margins
- no two-column dashboard framing

### Overlay Layer

- independent floating panels above the map
- empty overlay space must not block map interaction
- use a `pointer-events-none` overlay wrapper and `pointer-events-auto` on interactive cards and controls
- use restrained transitions for show, hide, and responsive reflow

## Responsive Layout Model

### Desktop: 1280px and above

Use the full experience:

- floating left navigation
- floating intro card in the upper-left map area
- floating top search bar
- floating category toolbar
- floating quick filters
- floating Popular Nearby panel at lower-left
- floating selected POI detail card at lower-right
- floating right-side map controls

All of these must coexist without overlapping in normal desktop widths.

### Tablet: 768px to 1279px

Maintain the same map-first structure while simplifying density:

- same single full-screen `MapView`
- narrower nav
- smaller intro card
- compact search and filters
- horizontally scrollable category chips
- narrower popular panel
- POI detail overlay capped around 360px width
- lower-priority copy hidden first when space is constrained

If the width becomes too tight, prioritize preserving map visibility and avoiding panel collisions.

### Mobile: below 768px

The map must still fill the screen. Do not stack large cards in normal document flow above the map.

Use:

- top search bar
- horizontally scrollable category chips beneath the search
- compact top filter affordance
- bottom navigation instead of left rail
- collapsible Popular Nearby bottom sheet
- selected POI detail bottom sheet
- intro content hidden by default behind a small info trigger

Mobile panels may expand and collapse, but they must remain overlays attached to the same underlying `MapView`.

## Overlay Inventory

### 1. Floating Navigation

Desktop and tablet:

- retain the current project navigation model
- render as a compact floating vertical rail
- warm off-white container
- subtle olive border and soft shadow
- logo at top
- centered primary icons
- active Explore state in dark olive
- filters action near the lower part of the rail
- the rail should not stretch full viewport height unnecessarily

Mobile:

- convert to a bottom navigation bar
- respect safe-area inset at the bottom
- preserve the same destination set and active Explore state

### 2. Intro Card

Content:

- `DISCOVER NEARBY`
- `Explore Places`
- `Find famous places and everyday essentials around you.`

Behavior:

- desktop and tablet: floating card near the upper-left beside nav
- mobile: hidden by default behind a subtle reopen chip
- includes a close or minimize control
- when hidden, show a small `Explore` or info trigger so it can be reopened

Visuals:

- warm off-white background
- 20px to 24px radius
- subtle border
- soft shadow
- premium serif heading
- decorative botanical accent if already available in the project

### 3. Search Bar

- floating top horizontal search element
- reuse the current search input behavior and clear logic
- placeholder remains `Search places, companies, schools...`
- include the existing filter or settings affordance on the right
- compact, pill-shaped, premium styling
- no bulky wrapper around it

### 4. Category Toolbar

- floating horizontally under the search bar
- compact chips, not oversized tiles
- horizontally scrollable when needed
- selected state in dark olive
- inactive chips in warm light tones
- reuse existing category selection logic
- support collapse into a small `Filters` trigger

### 5. Quick Filters

- visually grouped with or directly below the category toolbar
- reuse the current filter controls and logic:
  - distance
  - sort
  - open now
- compact floating controls
- collapse together with the category toolbar

### 6. Popular Nearby Panel

Desktop and tablet:

- floating panel near the lower-left
- fixed max height with internal scroll
- subtle separators between rows rather than heavy nested card styling
- includes close or collapse control
- hidden state replaced by a small `Popular Nearby` trigger

Row contents:

- thumbnail
- name
- category
- distance
- travel time
- rating
- arrow affordance
- selected item receives a subtle olive or sage emphasis

Mobile:

- draggable or collapsible bottom sheet
- collapsed state shows a compact header
- expanded state occupies roughly 45dvh to 60dvh
- internal list scroll only inside the sheet

### 7. Selected POI Detail Overlay

Desktop and tablet:

- floating lower-right card
- close control hides the detail overlay only
- selecting another marker or list item reopens and updates the card
- uses current selected POI data and image set

Content:

- category label or icon row
- close and secondary actions
- large hero image
- optional smaller thumbnails
- POI name
- location text
- distance, duration, rating
- short description
- actions: directions, save, share

Mobile:

- bottom sheet variant using the same selected POI data
- not full-screen by default
- compact handle
- visible CTA row

### 8. Map Controls

- float on the right side
- consistent with new card styling
- must avoid overlapping with the POI detail card or mobile sheets
- dynamic positioning based on responsive layout and visible overlays

## Map and Marker Behavior

### Single Map Instance

The page must preserve one shared `MapView` instance across all breakpoints and UI states. Responsive changes must only affect overlay arrangement and visibility. The map, marker layers, route layers, user location, and controls remain attached to the same live map instance.

### Marker Styling

Normal marker:

- compact ivory or warm light container
- category icon in olive
- subtle shadow

Selected marker:

- darker olive center
- cream icon
- soft concentric olive rings
- slightly larger than normal
- optional POI title pill
- subtle pulse only, never excessive animation

### Existing Map Logic to Preserve

- current center location behavior
- current route rendering
- current cluster behavior
- current user locate logic
- current marker selection and map click behaviors unless small adjustments are needed for the new UI

## State Model

`MapComponent` remains the smart container and owns existing data-driven state. Add lightweight UI visibility state for overlays.

Required independent visibility controls:

- intro visible
- filters visible
- popular panel visible
- POI detail visible

Important rules:

- closing one overlay must not close the others
- POI selection and POI detail visibility are separate concerns
- selecting a marker or nearby result should reopen the POI detail overlay if it was closed
- collapse and reopen behavior must work on all breakpoints

## Component Architecture

Keep `components/MapComponent.tsx` as the orchestration layer for:

- filtered data computation
- selected POI state
- route lookup state
- map ref and viewport state
- map interaction handlers
- loading state

Extract presentational overlay components so the parent remains the single source of logic. Likely extractions:

- `MapOverlayNav`
- `MapIntroCard`
- `MapSearchToolbar`
- `MapFilterToolbar`
- `PopularNearbyPanel`
- `PoiDetailOverlay`
- `MobileBottomNav`
- `MobilePopularSheet`
- `MobilePoiSheet`

Optional shared primitives:

- `FloatingPanel`
- `OverlayChipButton`
- `CategoryChip`
- `MapSheetHandle`

These components should be mostly prop-driven and should not duplicate business logic.

## Animation

Use subtle transitions only:

- opacity
- slight translate
- scale from `0.98` to `1`
- duration between `180ms` and `300ms`

Use existing CSS or Tailwind transitions unless the project already includes an appropriate animation solution. Do not add a new animation dependency just for this redesign.

## Visual Design System

Direction:

- premium editorial
- map-first
- restrained and airy
- cream and off-white surfaces
- dark olive and sage accents
- soft borders
- subtle shadows

Suggested tones:

- card backgrounds around `#F8F5EC`, `#FBF9F3`, or similar warm light values
- olive range around `#344C2E`, `#3F5937`, `#455E3C`
- border around `rgba(75,95,60,0.14)`

Avoid:

- blue UI emphasis
- heavy dashboard framing
- oversized opaque slabs
- loud gradients
- dramatic shadows
- broad glassmorphism treatment

## Collision and Safe-Area Handling

### Collision Priority

When space becomes constrained:

1. collapse intro first
2. reduce filter label density
3. narrow the Popular Nearby panel
4. transition into tablet or mobile overlay behavior

No major overlay should overlap another major overlay in a way that blocks information or key actions.

### Safe Areas

Use modern viewport-safe behavior, especially on mobile:

- `100dvh`
- `env(safe-area-inset-bottom)`
- appropriate top and bottom padding for bottom nav and bottom sheets

## Out of Scope

- replacing the map provider
- rebuilding POI data shape
- creating new APIs for nearby content
- adding a new animation dependency
- creating a separate map implementation for different breakpoints

## Implementation Strategy

1. Preserve the single `MapView` and existing map logic in `MapComponent`.
2. Convert the page shell into a map-first base layer with overlay stacking.
3. Extract overlay UI into focused presentational components.
4. Add independent overlay visibility state.
5. Introduce desktop, tablet, and mobile overlay arrangements around the same map instance.
6. Restyle markers and detail surfaces to match the new visual direction.
7. Verify that current search, filtering, selection, and route behavior still work.

## Verification Requirements

Implementation is not complete until all of the following are done:

1. Run the relevant project checks such as build, lint, and typecheck.
2. Fix any regressions introduced by the redesign.
3. Visually verify the redesigned experience at key breakpoints.

Minimum visual validation widths:

- `375`
- `430`
- `768`
- `1024`
- `1280`
- `1440`

Verification focus:

- one shared `MapView` only
- map remains interactive outside overlay bounds
- overlays collapse and reopen independently
- no critical panel collisions
- mobile uses full-screen map with sheets and bottom nav
- desktop and tablet preserve the premium editorial feel

## Acceptance Criteria

The redesign is successful when:

- the Nearby Map page feels like a full-screen map product rather than a split dashboard
- only one `MapView` instance powers all breakpoints
- current POI data and interaction logic continue to work
- all major overlays can be independently hidden and restored
- mobile keeps the map full-screen and uses overlay sheets rather than stacked page content
- visual quality matches the Whispers premium cream-and-olive design language
- the implementation passes project verification and breakpoint QA
