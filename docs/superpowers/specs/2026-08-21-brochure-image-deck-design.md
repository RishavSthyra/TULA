# Brochure Image Deck Design

## Goal

Convert the brochure experience into an image-driven deck where every brochure page is rendered from the provided page images, sized to the native `2011 / 1299` ratio, and warmed progressively so page turns stay smooth.

## Scope

This design changes the project overview brochure flow in:

- `components/deck/FlipBookDeck.tsx`
- `components/deck/MobileDeckLanding.tsx`
- `app/project-overview/page.tsx`
- small supporting deck utilities if needed for image ordering or preload orchestration

In scope:

- replacing live custom brochure page rendering with brochure image pages
- keeping the old brochure page component files in the repo but no longer using them in the active composition
- updating desktop flipbook sizing to the brochure image ratio
- updating mobile and tablet brochure rendering to use the same brochure image source set
- preloading `Last.jpg` as the true final closing page
- progressive image warmup for all devices without harming interaction smoothness

Out of scope:

- deleting old brochure page component files
- redesigning the overall brochure art direction
- changing the master plan route or its transition behavior
- changing unrelated home, amenities, or walkthrough preload systems

## Current State

The current brochure flow is split between:

- a desktop flipbook composed from React page components such as `CoverPage`, `OverviewLeftPage`, `OverviewRightPage`, unit plan pages, a spread page, and a closing page
- a separate mobile/tablet landing flow that uses editorial sections rather than brochure page images

This creates two problems for the requested change:

1. The live brochure is not page-image-driven end to end.
2. The current deck dimensions were tuned around prior component layouts rather than the real brochure image ratio.

The brochure image assets in `public/brochure` already share the desired native size of `2011 x 1299`, including `Last.jpg`.

## Design Principles

- Use the real brochure assets as the source of truth.
- Preserve full page visibility without cropping.
- Keep interaction smooth by warming images gradually rather than all at once.
- Maintain existing files when they are no longer used.
- Keep the implementation easy to reason about by moving brochure page ordering and warmup into explicit image-driven logic.

## Proposed Approach

### 1. Build the brochure from an ordered image manifest

Create a single ordered list of brochure pages based on the files in `public/brochure`.

The active brochure composition should be image-driven rather than component-driven. The old custom page components should remain in the repo but be commented out or bypassed in the live page array so they are no longer rendered.

The image manifest should include:

- the opening brochure pages
- all interior brochure pages in order
- `Last.jpg` as the true final closing page

This manifest becomes the shared data source for desktop, tablet, and mobile brochure rendering.

### 2. Render every page with the native brochure ratio

Every brochure page surface should use the native ratio:

- `aspect-ratio: 2011 / 1299`

Desktop flipbook sizing should be recalculated from that ratio instead of assuming the older book proportions.

The rendering rules should be:

- fit the page inside the available book/page bounds
- avoid cropping
- preserve full image visibility
- keep the book centered and visually balanced across viewport sizes

For the actual image styling, use contain-style fitting within the page surface rather than cover-style behavior.

### 3. Keep desktop flipbook interaction, but swap in image pages

Desktop should continue using `react-pageflip` so the main brochure still feels like a brochure/book experience.

What changes is the page content:

- each flipbook leaf becomes an image page
- no live desktop brochure page should depend on the existing React editorial page components

Existing controls such as left/right navigation can stay, but they should operate against the new image page count.

### 4. Replace the mobile/tablet brochure flow with the same image source set

Mobile and tablet should stop using the current editorial landing layout for the brochure route.

They should instead render the same brochure image sequence in a lighter image-first flow that is more touch-friendly than a heavy desktop-style flipbook. This keeps the user requirement intact that each brochure page be an image while avoiding unnecessary touch performance risk.

The mobile/tablet presentation should:

- use the same ordered image manifest
- preserve the same `2011 / 1299` page ratio
- keep each page fully visible
- remain smooth during scroll and touch interaction

## Preload and Warmup Strategy

### 1. Immediately prioritize visible start pages

The initial brochure pages should be requested with the highest urgency so first render is fast and stable.

Desktop should prioritize the first visible spread/pages.
Mobile and tablet should prioritize the first visible stacked pages.

### 2. Preload `Last.jpg` early as a dedicated target

`Last.jpg` is the real final closing page and should be explicitly preloaded early instead of waiting until it naturally falls to the end of the queue.

This ensures the closing page is already ready by the time the user reaches it.

### 3. Warm nearby pages in controlled batches

After the first visible pages and `Last.jpg` are requested, warm the most likely next brochure pages in small batches.

The warmup system should:

- track which pages are already requested
- warm only a small number at a time
- use bounded concurrency
- avoid long synchronous loops on the main thread

### 4. Continue remaining warmup during idle time

The rest of the brochure pages should continue warming in the background using idle time, animation frame pacing, or similarly non-blocking scheduling.

The key requirement is that image warming must not make flip or scroll motion feel heavier.

### 5. Decode opportunistically, not aggressively

Where image decode warmup is useful, it should happen inside the bounded queue rather than across the full brochure at once.

This keeps memory and main-thread pressure controlled while still improving page readiness.

## Failure Handling

- If a page image fails to load, show a lightweight fallback page surface instead of breaking the deck.
- If some warmup requests fail, the brochure should remain usable and continue loading on demand.
- The preload system should not assume perfect network conditions or require all pages to be ready before interaction begins.

## Implementation Areas

Primary files:

- `components/deck/FlipBookDeck.tsx`
- `components/deck/MobileDeckLanding.tsx`
- `app/project-overview/page.tsx`

Likely support additions:

1. A brochure image manifest helper
   This centralizes page order and lets both desktop and mobile render from the same source.

2. A brochure image page component
   This keeps image rendering, ratio handling, and fallback behavior isolated from the surrounding deck logic.

3. A brochure image preload helper
   This encapsulates staged preload, dedicated `Last.jpg` warming, queueing, and cleanup.

## Expected Outcome

After the change:

- every brochure page shown to the user is an image page
- the active brochure no longer relies on the custom editorial page components
- the old brochure component files remain in the repo
- the book dimensions match the real brochure page ratio
- brochure images are not cropped while placed in the book
- `Last.jpg` is the true final closing page and is ready when the user reaches it
- preload happens progressively without visibly harming deck smoothness

## Risks

### Over-eager preloading can hurt smoothness

If too many images are requested or decoded at once, page turning or scrolling can feel heavier.

Mitigation:

- use staged loading
- keep concurrency low and explicit
- schedule background work outside critical interaction moments

### Mobile memory pressure

Warming too many large brochure images on smaller devices can increase memory pressure.

Mitigation:

- keep the queue bounded
- prioritize nearby pages over full eager decoding
- allow later pages to remain on-demand until background capacity is available

### Page ordering mistakes

A manual brochure manifest can produce incorrect sequencing if the order is not explicit.

Mitigation:

- define the order in one place
- verify opening, middle, and closing pages manually

## Testing Plan

Manual verification:

1. Desktop initial load
   The first brochure pages should appear promptly and the book should match the new page ratio.

2. Desktop page turns
   Multiple forward and backward turns should remain smooth and should not crop brochure images.

3. Final page reachability
   `Last.jpg` should appear as the real final closing page and should already be ready when reached.

4. Mobile and tablet rendering
   The route should show the same brochure page images with the same ratio and without reverting to the old editorial layout.

5. Slow-network style check
   The brochure should still become interactive quickly, even if later pages continue warming in the background.

6. Failure tolerance
   A failed page request should degrade gracefully rather than breaking the whole brochure flow.

## Decision

Proceed with a shared image-driven brochure architecture across all devices, using the native `2011 / 1299` page ratio, retaining desktop flipbook behavior, replacing mobile/tablet editorial brochure rendering with the same image source set, and adding a staged preload queue that prioritizes the first pages and `Last.jpg` without harming smoothness.
