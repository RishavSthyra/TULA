import { NextResponse } from "next/server";
import {
  AssetConfigurationError,
  InvalidR2KeyError,
  normalizeAndValidateR2Key,
  signR2AssetKeys,
  signR2AssetKey,
} from "@/lib/server/r2-signed-assets";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return jsonError("Missing key query parameter.", 400);
    }

    const normalizedKey = normalizeAndValidateR2Key(key);
    return NextResponse.json({
      url: signR2AssetKey(normalizedKey),
    });
  } catch (error) {
    if (error instanceof AssetConfigurationError) {
      return jsonError(error.message, 500);
    }

    if (error instanceof InvalidR2KeyError) {
      return jsonError(error.message, 403);
    }

    return jsonError("Failed to sign asset.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { keys?: unknown }
      | null;

    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body.", 400);
    }

    if (!("keys" in body)) {
      return jsonError("Missing keys array.", 400);
    }

    if (!Array.isArray(body.keys)) {
      return jsonError("keys must be an array.", 400);
    }

    if (body.keys.length === 0) {
      return NextResponse.json({ urls: {} });
    }

    const originalKeys = body.keys.map((value) =>
      typeof value === "string" ? value : String(value),
    );
    const dedupedOriginalKeys = [...new Set(originalKeys)];
    const urls = signR2AssetKeys(dedupedOriginalKeys);

    return NextResponse.json({ urls });
  } catch (error) {
    if (error instanceof AssetConfigurationError) {
      return jsonError(error.message, 500);
    }

    if (error instanceof InvalidR2KeyError) {
      return jsonError(error.message, 403);
    }

    return jsonError("Failed to sign asset batch.", 500);
  }
}
