const PRELOADER_CORNER_LOGO_URL =
  "https://cdn.sthyra.com/TULA/Images/linked%20logo%20(1)-Photoroom.png";

export default function PreloaderCornerLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PRELOADER_CORNER_LOGO_URL}
      alt="TULA Properties"
      width={256}
      height={256}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      draggable={false}
      className="pointer-events-none absolute right-[max(env(safe-area-inset-right),0.75rem)] top-[max(env(safe-area-inset-top),0.75rem)] z-50 h-auto w-[clamp(2.5rem,8vw,4.5rem)] select-none object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.3)] sm:right-[max(env(safe-area-inset-right),1rem)] sm:top-[max(env(safe-area-inset-top),1rem)] lg:right-[max(env(safe-area-inset-right),1.5rem)] lg:top-[max(env(safe-area-inset-top),1.5rem)]"
    />
  );
}
