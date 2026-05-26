import TowerApartmentHoverPreview from "@/components/TowerApartmentHoverPreview";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Tower Hover Preview",
  description:
    "Preview hover-based apartment exploration for tower views and interactive testing.",
  keywords: [
    "tower hover preview",
    "apartment hover test",
    "interactive tower preview",
  ],
  robots: {
    index: false,
    follow: false,
  },
});

export default function TowerHoverTestPage() {
  return (
    <main className="min-h-dvh w-full bg-[linear-gradient(180deg,#d5e4f5_0%,#eff4fb_38%,#f7efe1_100%)] text-slate-950">
    <TowerApartmentHoverPreview tower="Tower A" />
    </main>
  );
}
