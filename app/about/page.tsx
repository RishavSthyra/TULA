import React from "react";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "About",
  description:
    "Learn more about TULA Whispers of Trees and the digital experience built around its residences and walkthroughs.",
  keywords: [
    "about TULA Whispers of Trees",
    "project information",
    "residential development",
  ],
});

export default function page() {
  return (
    <div>This is 2nd Page</div>
  );
}
