import { NextResponse } from "next/server";
import {
  getDraftDeveloperRuntimeConfig,
  getPublishedDeveloperRuntimeConfig,
} from "@/lib/developer-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unauthenticated only for the current private setup phase. */
export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");

  try {
    const config = mode === "draft"
      ? await getDraftDeveloperRuntimeConfig()
      : await getPublishedDeveloperRuntimeConfig();
    return NextResponse.json({ config, mode: mode === "draft" ? "draft" : "published" });
  } catch (error) {
    console.error("Failed to load developer runtime configuration:", error);
    return NextResponse.json({ message: "Failed to load runtime configuration." }, { status: 500 });
  }
}
