# R2 Floor-Plan Images Design

## Goal

Serve apartment floor-plan images from Cloudflare R2 through the application's existing signed-asset flow instead of sending legacy CDN source URLs through the Next.js image optimizer.

## Design

Both floor-plan previews will use the shared `SignedImage` component. Each preview will pass `apartment.floorPlanImage`, whose legacy CDN URL contains the real R2 object path under `TULA/Images/New Floor Plans`. The signing helper will strip the legacy `https://cdn.sthyra.com/` origin and sign the remaining R2 key.

`SignedImage` will request a signed URL from `/api/sign-asset`. The server will validate the key, sign it using `ASSET_SECRET`, and return a Cloudflare asset-worker URL. The image will remain unoptimized so the browser requests the signed Cloudflare URL directly and does not proxy it through `/_next/image`.

The change applies to:

- The floor-plan card in `MasterPlanLayout`.
- The floor-plan preview in `SelectedFlatDetailsPanel`.

No inventory mapping, layout, or room-dimension behavior will change.

## Loading and Errors

The existing transparent placeholder will be shown while the signed URL is loading. Existing signed-asset error behavior remains unchanged. `ASSET_SECRET` and `ASSET_WORKER_DOMAIN` must be configured in every runtime environment.

## Verification

- Run ESLint on the changed components.
- Run the production build/type checks.
- Confirm both previews reference `apartment.floorPlanImage` through `SignedImage`.
- Confirm the signed request retains the `TULA/Images/New Floor Plans/...` object path rather than the non-existent suggested `floor-plans/...` key.
