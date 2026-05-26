"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { EquirectangularAdapter, Viewer } from "@photo-sphere-viewer/core";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { AutorotatePlugin } from "@photo-sphere-viewer/autorotate-plugin";
import { EquirectangularTilesAdapter } from "@photo-sphere-viewer/equirectangular-tiles-adapter";
import { motion } from "framer-motion";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";

import navData from "@/data/trifecta_pano_walkthrough_data_Interior.json";
import {
  CLOUDINARY_PANO_IMAGE_BASE_URL,
  CLOUDINARY_PANO_RAW_BASE_URL,
  getPanoFolderCandidates,
  getPanoMetaUrl,
  getPanoPreviewUrl,
  getPanoTileUrl,
} from "@/lib/pano-cloudinary";

type NavItem = {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  image_filename: string;
  forward_vector?: { x: number; y: number; z: number };
};

type PanoMeta = {
  width: number;
  height: number;
  cols: number;
  rows: number;
  actualCols?: number;
  actualRows?: number;
  tileSize: number;
  preview: string;
  tileFormat?: string;
  tileUrl?: string;
  tiles?: Array<{
    col: number;
    row: number;
    file: string;
  }>;
};

type InfoMarker = {
  id: string;
  yaw: number;
  pitch: number;
  rotate?: string;
  html: string;
  tooltip: {
    content: string;
    className: string;
  };
};

type BuiltNode = {
  id: string;
  name: string;
  thumbnail: string;
  panorama:
    | string
    | {
        width: number;
        cols: number;
        rows: number;
        baseUrl: string;
        tileUrl: (col: number, row: number) => string | null;
      };
  links: Array<{
    nodeId: string;
    position: {
      yaw: number;
      pitch: number;
    };
  }>;
  data: NavItem & {
    panoId: string;
    panoFolderId: string;
    label: string;
  };
};

type ActiveTourNode = Pick<BuiltNode, "id"> & {
  name?: string;
  data?: {
    panoId?: string;
  };
};

type TabItem = {
  id: string;
  panoId: string;
  label: string;
  thumbnail: string;
};

const ROOM_LABELS: Record<string, string> = {
  LS_BP_panoPath_Interior_F0000: "Living Room",
  LS_BP_panoPath_Interior_F0001: "Bedroom 1",
  LS_BP_panoPath_Interior_F0002: "Bedroom 2",
  LS_BP_panoPath_Interior_F0003: "Bathroom 1",
  LS_BP_panoPath_Interior_F0004: "Bathroom 2",
  LS_BP_panoPath_Interior_F0005: "Bathroom 3",
  LS_BP_panoPath_Interior_F0006: "Bathroom 4",
  LS_BP_panoPath_Interior_F0007: "Kitchen",
  LS_BP_panoPath_Interior_F0008: "Maid Room",
  LS_BP_panoPath_Interior_F0009: "Master Bedroom",
  LS_BP_panoPath_Interior_F0010: "Dining Room",
  LS_BP_panoPath_Interior_F0011: "Hall 1",
  LS_BP_panoPath_Interior_F0012: "Hall 2",
  LS_BP_panoPath_Interior2_F0013: "Hall 3",
  LS_BP_panoPath_Interior2_F0014: "Passage 1",
  LS_BP_panoPath_Interior2_F0015: "Passage 2",
  LS_BP_panoPath_Interior2_F0016: "Passage 3",
  LS_BP_panoPath_Interior3_F0017: "Passage 4",
  LS_BP_panoPath_Interior3_F0018: "Passage 5",
  LS_BP_panoPath_Interior3_F0019: "Passage 6",
};

function imageToPanoId(imageFilename: string) {
  return imageFilename.replace(/\.[^.]+$/, "");
}

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0;
}

function canUseTiledPanorama(meta: PanoMeta) {
  return isPowerOfTwo(meta.cols) && isPowerOfTwo(meta.rows);
}

function getPreviewUrl(
  panoId: string,
  meta: PanoMeta,
  imageBaseUrl = CLOUDINARY_PANO_IMAGE_BASE_URL,
) {
  return getPanoPreviewUrl(panoId, meta.preview, imageBaseUrl);
}

function getTileUrl(
  panoId: string,
  meta: PanoMeta,
  col: number,
  row: number,
  imageBaseUrl = CLOUDINARY_PANO_IMAGE_BASE_URL,
) {
  const actualCols = meta.actualCols ?? meta.cols;
  const actualRows = meta.actualRows ?? meta.rows;

  if (col < 0 || row < 0 || col >= actualCols || row >= actualRows) {
    return null;
  }

  const explicitTile = meta.tiles?.find(
    (tile) => tile.col === col && tile.row === row,
  );

  if (explicitTile) {
    return getPanoTileUrl(panoId, `tiles/${explicitTile.file}`, imageBaseUrl);
  }

  const template =
    meta.tileUrl ?? `tiles/tile_{col}_{row}.${meta.tileFormat ?? "jpg"}`;

  return getPanoTileUrl(
    panoId,
    template.replace("{col}", String(col)).replace("{row}", String(row)),
    imageBaseUrl,
  );
}

function distance(a: NavItem, b: NavItem) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getCameraHeading(item: NavItem) {
  if (item.forward_vector) {
    return Math.atan2(item.forward_vector.y, item.forward_vector.x);
  }
  return (item.yaw * Math.PI) / 180;
}

function normalizeAngle(angle: number) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

function getLinkYaw(source: NavItem, target: NavItem) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const worldYaw = Math.atan2(dy, dx);
  const cameraHeading = getCameraHeading(source);
  return normalizeAngle(worldYaw - cameraHeading);
}

async function buildNodes(
  items: NavItem[],
  {
    imageBaseUrl = CLOUDINARY_PANO_IMAGE_BASE_URL,
    metaBaseUrl = CLOUDINARY_PANO_RAW_BASE_URL,
  }: {
    imageBaseUrl?: string;
    metaBaseUrl?: string;
  } = {},
) {
  const metaEntries = await Promise.all(
    items.map(async (item) => {
      const panoId = imageToPanoId(item.image_filename);
      const panoFolderCandidates = getPanoFolderCandidates(panoId);

      for (const panoFolderId of panoFolderCandidates) {
        const res = await fetch(getPanoMetaUrl(panoFolderId, metaBaseUrl));

        if (!res.ok) {
          continue;
        }

        const meta: PanoMeta = await res.json();
        return {
          item,
          meta,
          panoId,
          panoFolderId,
          supportsTiles: canUseTiledPanorama(meta),
        };
      }

      console.warn("Skipping missing pano:", panoId);
      return null;
    }),
  );

  const valid = metaEntries.filter(Boolean) as {
    item: NavItem;
    meta: PanoMeta;
    panoId: string;
    panoFolderId: string;
    supportsTiles: boolean;
  }[];

  const usesTiledAdapter =
    valid.length > 0 && valid.every((entry) => entry.supportsTiles);

  const nodes = valid.map(({ item, meta, panoId, panoFolderId }) => {
    const neighbors = valid
      .map((v) => v.item)
      .filter((other) => other.id !== item.id)
      .sort((a, b) => distance(item, a) - distance(item, b))
      .slice(0, 3);

    const label = ROOM_LABELS[panoId] ?? panoId;

    return {
      id: item.id,
      name: label,
      thumbnail: getPreviewUrl(panoFolderId, meta, imageBaseUrl),
      panorama: usesTiledAdapter
        ? {
            width: meta.width,
            cols: meta.cols,
            rows: meta.rows,
            baseUrl: getPreviewUrl(panoFolderId, meta, imageBaseUrl),
            tileUrl: (col: number, row: number) =>
              getTileUrl(panoFolderId, meta, col, row, imageBaseUrl),
          }
        : getPreviewUrl(panoFolderId, meta, imageBaseUrl),
      links: neighbors.map((target) => ({
        nodeId: target.id,
        position: {
          yaw: getLinkYaw(item, target),
          pitch: 0,
        },
      })),
      data: {
        ...item,
        panoId,
        panoFolderId,
        label,
      },
    };
  });

  if (!usesTiledAdapter && valid.length > 0) {
    console.warn(
      "PanoViewer: falling back to preview panoramas because the current tile export is not compatible with Photo Sphere Viewer tiled adapter.",
      valid.map(({ panoId, meta }) => ({
        panoId,
        cols: meta.cols,
        rows: meta.rows,
      })),
    );
  }

  return {
    nodes,
    usesTiledAdapter,
  };
}

const infoMarkersByPano: Record<string, InfoMarker[]> = {
  LS_BP_panoPath_Interior_F0010: [
    {
      id: "wall-info-f0010",
      yaw: 1.55,
      pitch: 0.1,
      html: `
        <div class="custom-info-dot"></div>
      `,
      tooltip: {
        className: "custom-marker-tooltip",
        content: `
          <div class="tooltip-card">
            <div class="tooltip-title">Wall Finish</div>
            <div class="tooltip-row"><span>Material:</span> Textured stone plaster</div>
            <div class="tooltip-row"><span>Color:</span> Warm beige</div>
            <div class="tooltip-row"><span>Height:</span> 9 ft</div>
          </div>
        `,
      },
    },
  ],
};

function buildInfoMarkersForPano(panoId: string) {
  const markers = infoMarkersByPano[panoId] ?? [];

  return markers.map((marker) => ({
    id: marker.id,
    position: {
      yaw: marker.yaw,
      pitch: marker.pitch,
    },
    html: `
      <div class="custom-marker-wrap" style="transform: rotate(${marker.rotate ?? "0deg"})">
        ${marker.html}
      </div>
    `,
    size: { width: 56, height: 56 },
    anchor: "center center",
    tooltip: marker.tooltip,
  }));
}

export default function PanoViewer() {

  
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const viewerInstanceRef = useRef<Viewer | null>(null);
  const virtualTourRef = useRef<VirtualTourPlugin | null>(null);
  const markersRef = useRef<MarkersPlugin | null>(null);

  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string>("");

  useEffect(() => {
    if (!viewerRef.current) return;

    let cancelled = false;
    let handlePanoramaError: ((event: unknown) => void) | null = null;

    (async () => {
      const { nodes, usesTiledAdapter } = await buildNodes(navData as NavItem[]);
      if (cancelled || nodes.length === 0) return;

      const startNode =
        nodes.find(
          (node) => node.id === "BP_panoPath_Interior_F0010",
        ) ?? nodes[0];

      setTabs(
        nodes.map((node) => ({
          id: node.id,
          panoId: node.data.panoId,
          label: node.data.label,
          thumbnail: node.thumbnail,
        })),
      );
      setActiveNodeId(startNode.id);

      const viewer = new Viewer({
        container: viewerRef.current!,
        adapter: usesTiledAdapter
          ? EquirectangularTilesAdapter.withConfig({
              resolution: 64,
              showErrorTile: true,
              baseBlur: true,
            })
          : EquirectangularAdapter.withConfig({
              resolution: 64,
            }),
        navbar: false,
        plugins: [
          MarkersPlugin.withConfig({
            markers: [],
          }),

          VirtualTourPlugin.withConfig({
            dataMode: "client",
            positionMode: "manual",
            renderMode: "3d",
            nodes,
            startNodeId: startNode.id,
            preload: true,
          }),

          [
            AutorotatePlugin,
            {
              autostartDelay: 4000,
              autorotateSpeed: "1rpm",
            },
          ],
        ],
      });

      if (cancelled) {
        viewer.destroy();
        return;
      }

      viewerInstanceRef.current = viewer;
      handlePanoramaError = (event: unknown) => {
        console.error(
          "PanoViewer panorama load error:",
          (event as { error?: unknown }).error,
        );
      };
      viewer.addEventListener("panorama-error", handlePanoramaError);

      const markersPlugin = viewer.getPlugin(MarkersPlugin) as MarkersPlugin;
      const virtualTourPlugin = viewer.getPlugin(
        VirtualTourPlugin,
      ) as VirtualTourPlugin;

      markersRef.current = markersPlugin;
      virtualTourRef.current = virtualTourPlugin;

      function syncInfoMarkers(node: ActiveTourNode) {
        const panoId = node.data?.panoId ?? node.name;
        if (!panoId) {
          return;
        }
        const markers = buildInfoMarkersForPano(panoId);
        markersPlugin.setMarkers(
          markers as Parameters<MarkersPlugin["setMarkers"]>[0],
        );
        setActiveNodeId(node.id);
      }

      virtualTourPlugin.addEventListener("node-changed", ({ node }) => {
        syncInfoMarkers(node);
      });

      const currentNode = virtualTourPlugin.getCurrentNode();
      if (currentNode) {
        syncInfoMarkers(currentNode);
      }
    })();

    return () => {
      cancelled = true;
      const viewer = viewerInstanceRef.current;
      if (viewer && handlePanoramaError) {
        viewer.removeEventListener("panorama-error", handlePanoramaError);
      }
      viewerInstanceRef.current?.destroy();
      viewerInstanceRef.current = null;
      virtualTourRef.current = null;
      markersRef.current = null;
    };
  }, []);

  function goToNode(nodeId: string) {
    virtualTourRef.current?.setCurrentNode(nodeId);
  }

  return (
    <div className="relative h-screen w-full">
      <div ref={viewerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-5 pb-5 pt-4 md:px-6">
        <div className="mx-auto max-w-[1400px] pointer-events-auto">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-4 text-2xl font-bold text-white md:text-[28px]"
          >
            Interior
          </motion.h2>

          {/* 3D bent tab bar */}
          <div
            className="relative"
            style={{
              perspective: "1600px",
            }}
          >
            <div className="relative flex items-stretch">
              {/* LEFT BENT EDGE */}
              {/* <div
                className="relative z-10 w-14 shrink-0"
                style={{
                  transformStyle: "preserve-3d",
                  transformOrigin: "right center",
                  transform: "rotateY(55deg)",
                }}
              >
                <div className="h-full min-h-[150px] rounded-l-[28px] border border-white/15 bg-white/10 shadow-[inset_8px_0_18px_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-xl" />
              </div> */}

              {/* CENTER FLAT SECTION */}
              <div className="relative min-w-0 flex-1">
                <div className="flex gap-3 overflow-x-auto custom-scrollbar px-4 py-4">
                  {tabs.map((tab) => {
                    const active = tab.id === activeNodeId;

                    return (
                      <motion.button
                        key={tab.id}
                        onClick={() => goToNode(tab.id)}
                        whileHover={{ y: -3, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="relative min-w-[120px] shrink-0 p-1 text-left text-white"
                      >
                        {active && (
                          <motion.div
                            layoutId="activeTabGlow"
                            className="absolute inset-0 rounded-2xl bg-white/10"
                            transition={{
                              type: "spring",
                              stiffness: 260,
                              damping: 24,
                            }}
                          />
                        )}

                        <div className="relative">
                          <motion.div
                            animate={{
                              scale: active ? 1.03 : 1,
                              borderWidth: active ? 3 : 2,
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 260,
                              damping: 20,
                            }}
                            className={`mb-2 h-[82px] w-[120px] overflow-hidden rounded-2xl bg-white/10 ${
                              active
                                ? "border-white shadow-[0_0_0_2px_rgba(255,255,255,0.18)]"
                                : "border-white/20"
                            } border`}
                          >
                            <img
                              src={tab.thumbnail}
                              alt={tab.label}
                              className="block h-full w-full object-cover"
                            />
                          </motion.div>

                          <div
                            className={`truncate text-center whitespace-nowrap text-[15px] transition-all duration-200 ${
                              active
                                ? "font-bold opacity-100"
                                : "font-medium opacity-90"
                            }`}
                          >
                            {tab.label}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT BENT EDGE */}
              {/* <div
                className="relative z-10 w-14 shrink-0"
                style={{
                  transformStyle: "preserve-3d",
                  transformOrigin: "left center",
                  transform: "rotateY(-55deg)",
                }}
              >
                <div className="h-full min-h-[150px] rounded-r-[28px] border border-white/15 bg-white/10 shadow-[inset_-8px_0_18px_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-xl" />
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
