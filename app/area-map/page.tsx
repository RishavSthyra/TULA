import { CustomStyleExample } from "@/components/MapComponent";
import React from "react";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Area Map",
  description:
    "Explore the surrounding area, nearby landmarks, and location context for Trifecta Veranza through the interactive area map.",
  keywords: [
    "area map",
    "location map",
    "nearby landmarks",
    "Trifecta Veranza location",
  ],
});

export default function page() {
  return (
    <React.Fragment>
      <CustomStyleExample />
    </React.Fragment>
  );
}
