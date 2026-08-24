import MaxSceneBlockHoverDebug from "@/components/MaxSceneBlockHoverDebug";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "3ds Max Hover Debug",
  description:
    "Development-only GLB hover sandbox for validating 3ds Max apartment mesh picking.",
  keywords: [
    "3ds max hover debug",
    "glb hover sandbox",
    "apartment mesh picking",
  ],
  robots: {
    index: false,
    follow: false,
  },
});

export default function MaxHoverDebugPage() {
  return <MaxSceneBlockHoverDebug />;
}
