import { NextRequest } from "next/server";
import { signR2AssetKey } from "@/lib/server/r2-signed-assets";

const EXTERIOR_PANO_BASE_PATH = "exterior-panos-trifecta";

function buildSignedExteriorPanoUrl(pathSegments: string[]) {
  const safePath = pathSegments.map((segment) => segment.replace(/^\/+/, "")).join("/");
  return signR2AssetKey(`${EXTERIOR_PANO_BASE_PATH}/${safePath}`);
}

async function proxyExteriorPano(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;

  if (!path?.length || path.some((segment) => segment.includes(".."))) {
    return new Response("Invalid exterior pano path", { status: 400 });
  }

  const upstream = await fetch(buildSignedExteriorPanoUrl(path), {
    cache: "force-cache",
    method: request.method,
  });

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  headers.set(
    "cache-control",
    upstream.headers.get("cache-control") ?? "public, max-age=31536000, immutable",
  );

  if (!upstream.ok || request.method === "HEAD") {
    return new Response(null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export const GET = proxyExteriorPano;
export const HEAD = proxyExteriorPano;
