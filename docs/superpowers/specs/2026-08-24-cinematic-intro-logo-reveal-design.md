# Cinematic Intro Logo Reveal

## Goal

Refine the final beat of `components/ui/CinematicIntro.tsx` so “Welcome to” and the TULA brand logo appear as two distinct cinematic scenes.

## Approved Experience

1. The existing narrative screens remain unchanged.
2. “Welcome to” appears alone, centered vertically and horizontally.
3. The text uses Cormorant Garamond in title case, a subtle warm-gold tone, a soft glow, and responsive letter spacing around `0.32em`. Matching text indentation keeps the tracked text optically centered.
4. “Welcome to” fades out completely.
5. After a short visual pause, the supplied gold logo fades and gently scales into the center.
6. The logo appears alone and replaces the existing TULA heading, divider, “Rhythm of Trees,” and “Bangalore” elements.

## Asset

Use the supplied image directly:

`https://cdn.sthyra.com/TULA/Images/Whisper_of_Tree_Logo_Gold%201_01.png`

The image must preserve its intrinsic aspect ratio and use a responsive maximum width suitable for desktop and mobile screens.

## Animation

- Keep the current final-reveal start time and overall intro completion time.
- Preserve the existing GSAP fade/blur language.
- Give the welcome scene a clear exit before beginning the logo entrance; do not overlap the two visible states.
- Animate the logo with opacity, blur, vertical movement, and a restrained scale change.

## Compatibility

- Keep the atmospheric background, audio, loader, skip action, and `readyToComplete` behavior unchanged.
- Retain responsive and reduced-motion compatibility.
- Use a plain `img` because this remote CDN host may not be configured for Next.js image optimization.

## Verification

- Confirm obsolete reveal refs and styles are removed.
- Run the project’s available TypeScript/lint checks.
- Confirm the logo is centered and responsive through CSS inspection or a local browser check if available.
