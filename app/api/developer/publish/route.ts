import { NextResponse } from "next/server";
import { publishDeveloperRuntimeConfig } from "@/lib/developer-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unauthenticated only for the current private setup phase. */
export async function POST() {
  try {
    const result = await publishDeveloperRuntimeConfig();
    if (!result.published) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to publish developer runtime configuration:", error);
    return NextResponse.json({ message: "Failed to publish configuration." }, { status: 500 });
  }
}
