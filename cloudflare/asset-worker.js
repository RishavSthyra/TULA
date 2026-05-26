export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const key = normalizeKeyFromPath(url.pathname);
    const sig = url.searchParams.get("sig");

    if (!key) {
      return new Response("Missing file path", { status: 400 });
    }

    if (!sig) {
      return new Response("Forbidden: missing signature", { status: 403 });
    }

    const origin = request.headers.get("Origin") || "";
    const referer = request.headers.get("Referer") || "";

    if (origin && !isAllowedOrigin(origin)) {
      return new Response("Forbidden: bad origin", { status: 403 });
    }

    if (!referer || !isAllowedReferer(referer)) {
      return new Response("Forbidden: direct access blocked", { status: 403 });
    }

    const expectedSig = await hmacHex(key, env.ASSET_SECRET);

    if (!safeEqual(sig, expectedSig)) {
      return new Response("Forbidden: invalid signature", { status: 403 });
    }

    const rangeHeader = request.headers.get("Range");

    if (rangeHeader) {
      return handleRangeRequest(request, env, key, rangeHeader);
    }

    const cache = caches.default;
    const cacheKey = buildCacheKey(request, key);
    const cached = await cache.match(cacheKey);

    if (cached) {
      return finalizeResponse(cached, request, { cacheStatus: "HIT" });
    }

    const object = await env.STHYRA_ASSETS.get(key);

    if (!object) {
      return new Response("Not found in R2: " + key, { status: 404 });
    }

    const originResponse = buildObjectResponse(request, object, {
      cacheStatus: "MISS",
    });

    ctx.waitUntil(cache.put(cacheKey, originResponse.clone()));

    return originResponse;
  },
};

const ALLOWED_SITES = [
  "https://trifecta-veranza.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function normalizeKeyFromPath(pathname) {
  const strippedPath = pathname.replace(/^\/+/, "");

  if (!strippedPath) {
    return "";
  }

  const decodedPath = decodeURIComponent(strippedPath);

  if (
    !decodedPath ||
    decodedPath.startsWith("/") ||
    decodedPath.includes("\\") ||
    decodedPath.includes("../") ||
    decodedPath.includes("..\\") ||
    CONTROL_CHARACTERS.test(decodedPath)
  ) {
    return "";
  }

  return decodedPath;
}

function encodeKeyForPath(key) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildCacheKey(request, key) {
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = `/${encodeKeyForPath(key)}`;
  cacheUrl.search = "";
  cacheUrl.hash = "";

  return new Request(cacheUrl.toString(), {
    method: "GET",
    headers: {
      Accept: request.headers.get("Accept") || "*/*",
    },
  });
}

function isAllowedOrigin(origin) {
  return ALLOWED_SITES.includes(origin);
}

function isAllowedReferer(referer) {
  return ALLOWED_SITES.some((site) => referer.startsWith(site));
}

function getCorsOrigin(request) {
  const origin = request.headers.get("Origin") || "";

  if (isAllowedOrigin(origin)) {
    return origin;
  }

  const referer = request.headers.get("Referer") || "";
  const matchedSite = ALLOWED_SITES.find((site) => referer.startsWith(site));

  if (matchedSite) {
    return matchedSite;
  }

  return "https://trifecta-veranza.vercel.app";
}

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers":
      "Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag",
  };
}

function finalizeResponse(response, request, { cacheStatus }) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request);

  Object.entries(cors).forEach(([name, value]) => {
    headers.set(name, value);
  });

  headers.set("Cache-Control", IMMUTABLE_CACHE_CONTROL);
  headers.set("Vary", "Origin, Referer, Range");
  headers.set("CF-Cache-Status", cacheStatus);
  headers.set("Accept-Ranges", headers.get("Accept-Ranges") || "bytes");

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    headers,
  });
}

function buildObjectResponse(request, object, { cacheStatus, range }) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", IMMUTABLE_CACHE_CONTROL);
  headers.set("Accept-Ranges", "bytes");

  if (range) {
    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${range.total}`,
    );
    headers.set("Content-Length", String(range.length));
  } else if (typeof object.size === "number") {
    headers.set("Content-Length", String(object.size));
  }

  const response = new Response(
    request.method === "HEAD" ? null : object.body,
    {
      status: range ? 206 : 200,
      headers,
    },
  );

  return finalizeResponse(response, request, { cacheStatus });
}

async function handleRangeRequest(request, env, key, rangeHeader) {
  const objectHead = await env.STHYRA_ASSETS.head(key);

  if (!objectHead) {
    return new Response("Not found in R2: " + key, { status: 404 });
  }

  const parsedRange = parseRangeHeader(rangeHeader, objectHead.size);

  if (!parsedRange) {
    return new Response("Invalid Range", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${objectHead.size}`,
        ...corsHeaders(request),
      },
    });
  }

  const object = await env.STHYRA_ASSETS.get(key, {
    range: {
      offset: parsedRange.start,
      length: parsedRange.length,
    },
  });

  if (!object) {
    return new Response("Not found in R2: " + key, { status: 404 });
  }

  return buildObjectResponse(request, object, {
    cacheStatus: "BYPASS",
    range: {
      ...parsedRange,
      total: objectHead.size,
    },
  });
}

function parseRangeHeader(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());

  if (!match) {
    return null;
  }

  const startText = match[1];
  const endText = match[2];

  if (!startText && !endText) {
    return null;
  }

  let start;
  let end;

  if (!startText) {
    const suffixLength = Number(endText);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return null;
    }
  }

  if (start < 0 || end < start || start >= size) {
    return null;
  }

  end = Math.min(end, size - 1);

  return {
    start,
    end,
    length: end - start + 1,
  };
}

async function hmacHex(message, secret) {
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));

  return [...new Uint8Array(sig)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}
