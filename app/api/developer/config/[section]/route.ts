import { NextResponse } from "next/server";
import {
  getDeveloperConfigSection,
  saveDeveloperConfigSection,
} from "@/lib/developer-config";
import type {
  DeveloperConfigSection,
  DeveloperConfigSectionMap,
} from "@/types/developer-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sections = new Set<DeveloperConfigSection>([
  "home",
  "master-plan",
  "interior",
  "exterior",
  "amenities",
  "fallback-assets",
]);

function getSection(value: string): DeveloperConfigSection | null {
  return sections.has(value as DeveloperConfigSection)
    ? (value as DeveloperConfigSection)
    : null;
}

/**
 * Intentionally unauthenticated while the developer dashboard is being set up.
 * Add an authorization guard before this route is exposed beyond a private environment.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ section: string }> },
) {
  const { section: rawSection } = await context.params;
  const section = getSection(rawSection);

  if (!section) {
    return NextResponse.json({ message: "Unknown configuration section." }, { status: 404 });
  }

  try {
    return NextResponse.json(await getDeveloperConfigSection(section));
  } catch (error) {
    console.error(`Failed to load developer config ${section}:`, error);
    return NextResponse.json({ message: "Failed to load configuration." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ section: string }> },
) {
  const { section: rawSection } = await context.params;
  const section = getSection(rawSection);

  if (!section) {
    return NextResponse.json({ message: "Unknown configuration section." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { config?: unknown };
    if (!body.config || typeof body.config !== "object" || Array.isArray(body.config)) {
      return NextResponse.json({ message: "config must be an object." }, { status: 400 });
    }

    const saved = await saveDeveloperConfigSection(
      section,
      body.config as DeveloperConfigSectionMap[typeof section],
    );
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
    }
    console.error(`Failed to save developer config ${section}:`, error);
    return NextResponse.json({ message: "Failed to save configuration." }, { status: 500 });
  }
}
