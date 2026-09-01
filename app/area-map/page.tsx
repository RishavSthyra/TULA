import { CustomStyleExample } from "@/components/MapComponent";
import React from "react";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Area Map",
  description:
    "Explore the surrounding area, nearby landmarks, and location context for TULA Whispers of Trees through the interactive area map.",
  keywords: [
    "area map",
    "location map",
    "nearby landmarks",
    "TULA Whispers of Trees location",
  ],
});

export default function page() {
  return (
    <React.Fragment>
      <CustomStyleExample />
    </React.Fragment>
  );
}
