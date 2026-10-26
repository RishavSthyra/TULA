import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTileDescriptors,
  PanoAssetStore,
  selectPriorityTiles,
} from "./pano";
import type { PanoMeta } from "./types";

const meta: PanoMeta = {
  width: 4096,
  height: 2048,
  cols: 4,
  rows: 2,
  tiles: [{ col: 1, row: 0, file: "custom-name.webp" }],
};

test("panorama loading shares requests, batches signing, and retries failures", async (t) => {
  const originalFetch = globalThis.fetch;
  const metadataRequests: string[] = [];
  const signingBatches: string[][] = [];
  let failMetadataOnce = false;
  let failSigningOnce = false;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("/api/sign-asset")) {
      const keys: string[] = init?.method === "POST"
        ? JSON.parse(String(init.body)).keys
        : [new URL(url, "http://localhost").searchParams.get("key")!];
      if (init?.method === "POST") {
        signingBatches.push(keys);
        if (failSigningOnce) {
          failSigningOnce = false;
          return Response.json({ error: "Temporary signing failure" }, { status: 503 });
        }
      }
      const urls = Object.fromEntries(keys.map((key) => [key, `https://assets.example/${key}`]));
      return Response.json(init?.method === "POST" ? { urls } : { url: urls[keys[0]] });
    }
    assert(url.endsWith("/meta.json"), `Unexpected asset download: ${url}`);
    metadataRequests.push(url);
    if (failMetadataOnce) {
      failMetadataOnce = false;
      return new Response("Unavailable", { status: 503 });
    }
    return Response.json(meta);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await t.test("reuses availability metadata and one in-flight panorama request", async () => {
    const store = new PanoAssetStore("pano-test/shared/");
    await Promise.all([store.getMeta("room"), store.getMeta("room")]);
    assert.equal(metadataRequests.length, 1);

    const first = store.getPanorama("room");
    const second = store.getPanorama("room");
    assert.equal(first, second);
    const resolved = await first;
    assert.equal(await store.getPanorama("room"), resolved);
    assert.equal(metadataRequests.length, 1);
    assert.equal(signingBatches.length, 1);
    assert.equal(signingBatches[0].length, 9);
    assert(signingBatches[0].includes("pano-test/shared/room/preview.jpg"));
    assert(signingBatches[0].includes("pano-test/shared/room/tiles/custom-name.webp"));
    assert.notEqual(typeof resolved.panorama, "string");
    if (typeof resolved.panorama !== "string") {
      assert.equal(resolved.panorama.baseUrl, resolved.previewUrl);
      assert.equal(resolved.panorama.tileUrl(1, 0), "https://assets.example/pano-test/shared/room/tiles/custom-name.webp");
    }
  });

  await t.test("preview-only prefetch does not request tile authorization", async () => {
    const store = new PanoAssetStore("pano-test/preview/");
    const before = signingBatches.length;
    const resolved = await store.getPanorama("room", false);
    assert.equal(resolved.panorama, resolved.previewUrl);
    assert.deepEqual(signingBatches.slice(before), [["pano-test/preview/room/preview.jpg"]]);
  });

  await t.test("metadata errors do not poison the panorama cache", async () => {
    const store = new PanoAssetStore("pano-test/retry-meta/");
    failMetadataOnce = true;
    await assert.rejects(store.getPanorama("room"), /Failed to load pano meta/);
    const resolved = await store.getPanorama("room");
    assert.equal(resolved.meta.cols, 4);
    assert.equal(metadataRequests.filter((url) => url.includes("retry-meta")).length, 2);
  });

  await t.test("failed URL batches can be retried", async () => {
    const store = new PanoAssetStore("pano-test/retry-signing/");
    failSigningOnce = true;
    await assert.rejects(store.getPanorama("room"), /Temporary signing failure/);
    const resolved = await store.getPanorama("room");
    assert(resolved.previewUrl.includes("retry-signing"));
  });
});

test("tile descriptors use the real filenames from metadata", () => {
  const descriptors = buildTileDescriptors("room", meta, "panos/");
  assert.equal(descriptors.find((tile) => tile.col === 1 && tile.row === 0)?.url, "panos/room/tiles/custom-name.webp");
  assert.equal(descriptors.find((tile) => tile.col === 0 && tile.row === 0)?.url, "panos/room/tiles/tile_0_0.jpg");
});

test("priority prefetch follows the view, including the panorama seam", () => {
  const front = selectPriorityTiles("room", meta, "panos/", { yaw: 0, pitch: 0, zoom: 10 }, 1);
  const rear = selectPriorityTiles("room", meta, "panos/", { yaw: Math.PI, pitch: 0, zoom: 10 }, 1);
  assert.equal(front[0].col, 2);
  assert.equal(rear[0].col, 0);
  assert.equal(front[0].row, 1);
});
