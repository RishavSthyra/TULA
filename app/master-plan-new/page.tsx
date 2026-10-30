import NewMasterPlanImageViewer from "@/components/NewMasterPlanImageViewer";
import { buildPageMetadata } from "@/lib/metadata";

const MASTER_PLAN_IMAGES = [
  "/new_masterplan_images/4.avif",
  "/new_masterplan_images/3.avif",
  "/new_masterplan_images/2.jpg",
  "/new_masterplan_images/1.avif",
] as const;

export const metadata = buildPageMetadata({
  title: "Master Plan Views",
  description:
    "Explore four high-resolution views of the TULA Whispers of Trees master plan.",
});

export default function NewMasterPlanPage() {
  return (
    <div className="relative app-shell bg-black">
      {MASTER_PLAN_IMAGES.map((src, index) => (
        <link
          key={src}
          rel="preload"
          as="image"
          href={src}
          fetchPriority={index === 0 ? "high" : "auto"}
        />
      ))}
      <NewMasterPlanImageViewer />
    </div>
  );
}
