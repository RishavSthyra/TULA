import type { Metadata } from "next";
import ProjectLayoutMap from "@/components/ProjectLayoutMap";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Project Layout",
  description:
    "View the interactive project layout with amenities mapping and spatial context for TULA Whispers of Trees.",
  keywords: [
    "project layout",
    "amenities map",
    "site plan",
    "TULA Whispers of Trees layout",
  ],
});

export default function ProjectLayoutPage() {
  return <ProjectLayoutMap />;
}
